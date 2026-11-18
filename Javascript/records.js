window.IMS = window.IMS || {};
window.IMS.pageFeatures = window.IMS.pageFeatures || [];

(() => {
  const resources = ['items', 'requests', 'suppliers', 'receipts', 'issuances'];
  const records = Object.fromEntries(resources.map(resource => [resource, []]));

  function createElement(tag, className = '', text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (arguments.length > 2) element.textContent = text;
    return element;
  }

  function getLocalRecords(resource) {
    return records[resource] || [];
  }

  function getQuantity(value) {
    const quantity = Number.parseFloat(String(value));
    return Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
  }

  function getRemainingRequestQuantity(request) {
    const requested = getQuantity(request.quantity);
    const issued = getLocalRecords('issuances')
      .filter(record => record.requestId === request.id)
      .reduce((total, record) => total + getQuantity(record.quantity), 0);
    return Math.max(0, requested - issued);
  }

  function compareRecordIdsDescending(left, right) {
    const leftNumber = Number(String(left).match(/(\d+)$/)?.[1]) || 0;
    const rightNumber = Number(String(right).match(/(\d+)$/)?.[1]) || 0;
    return rightNumber - leftNumber || String(right).localeCompare(String(left));
  }

  function sortElementsById(container, dataKey) {
    [...container.children]
      .sort((left, right) => compareRecordIdsDescending(left.dataset[dataKey], right.dataset[dataKey]))
      .forEach(element => container.append(element));
  }

  function updateInventoryStatus(item) {
    const expiry = item.expiry && new Date(`${item.expiry}T00:00:00`);
    const daysUntilExpiry = expiry ? Math.ceil((expiry - new Date()) / 86400000) : Infinity;
    item.status = item.quantity <= 0
      ? 'Out of stock'
      : daysUntilExpiry <= 45
        ? 'Expiring soon'
        : !item.expiry && item.status?.toLowerCase().includes('expiring')
          ? item.quantity <= item.minimum ? 'Low expiring' : 'Expiring soon'
        : item.quantity <= item.minimum
          ? 'Low stock'
          : 'In stock';
  }

  async function loadRecords() {
    const response = await fetch('../api.php?action=records', { credentials: 'same-origin' });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || 'Records could not be loaded from the database.');
    for (const resource of resources) {
      records[resource] = Array.isArray(result.records?.[resource]) ? result.records[resource] : [];
    }
  }

  async function runMutation(action, payload) {
    try {
      const response = await fetch('../api.php', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload })
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || 'The record could not be saved to the database.');
      await loadRecords();
      window.dispatchEvent(new CustomEvent('ims:records-updated'));
      return result.record || true;
    } catch (error) {
      console.error('Database record operation failed.', error);
      window.IMS.showToast(error.message || 'The record could not be saved to the database.');
      return null;
    }
  }

  function saveRecord(resource, record) {
    return runMutation('save-record', { resource, record });
  }

  async function updateRequestStatus(requestId, status) {
    if (window.IMS.currentUser?.role !== 'admin') {
      window.IMS.showToast('Only the Supply Office head can review requests.');
      return false;
    }
    return Boolean(await runMutation('update-request-status', { requestId, status }));
  }

  function updateInventoryItem(itemId, changes) {
    return runMutation('update-record', { resource: 'items', recordId: itemId, changes });
  }

  function updateSupplier(supplierId, changes) {
    return runMutation('update-record', { resource: 'suppliers', recordId: supplierId, changes });
  }

  function addInventoryRow(item) {
    const table = document.querySelector('#itemTableBody');
    if (!table) return;
    const existingRow = [...table.rows].find(row => row.dataset.itemId === item.id);
    const status = item.status || (item.quantity <= 0 ? 'Out of stock' : item.quantity <= item.minimum ? 'Low stock' : 'In stock');
    const statusClass = status === 'Out of stock'
      ? 'badge rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700'
      : status === 'Expiring soon'
        ? 'badge rounded-full px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-700'
        : status === 'Low stock' || status === 'Low expiring'
          ? 'badge rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700'
          : 'badge rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700';
    if (existingRow) {
      const itemName = existingRow.cells[0].querySelector('p:nth-child(2)');
      if (itemName) itemName.textContent = item.name;
      [item.category, `${item.quantity} ${item.unit}`, item.unit, item.supplier]
        .forEach((value, index) => { existingRow.cells[index + 1].textContent = value; });
      const badge = existingRow.cells[5].querySelector('span');
      if (badge) Object.assign(badge, { className: statusClass, textContent: status });
      sortElementsById(table, 'itemId');
      return;
    }
    const row = createElement('tr', 'border-b border-cbsua-border/50 hover:bg-gray-50 dark:hover:bg-gray-700');
    row.dataset.itemId = item.id;
    const itemCell = createElement('td', 'py-3');
    itemCell.append(createElement('p', 'font-medium', item.id), createElement('p', 'text-cbsua-muted', item.name));
    row.append(itemCell);
    [item.category, `${item.quantity} ${item.unit}`, item.unit, item.supplier]
      .forEach(value => row.append(createElement('td', 'py-3', value)));
    const statusCell = createElement('td', 'py-3');
    statusCell.append(createElement('span', statusClass, status));
    row.append(statusCell);
    const actionCell = createElement('td', 'py-3');
    const editButton = createElement('button', 'text-cbsua-primary hover:underline', 'Inspect / Edit');
    editButton.type = 'button';
    editButton.dataset.itemAction = 'edit';
    editButton.dataset.itemId = item.id;
    actionCell.append(editButton);
    row.append(actionCell);
    table.append(row);
    sortElementsById(table, 'itemId');
  }

  function addRequestRow(request) {
    const table = document.querySelector('main tbody');
    if (!table || !document.querySelector('#requestModal')) return;
    const existingRow = [...table.rows].find(row => row.dataset.requestId === request.id);
    const setCellDetails = (cell, title, detail) => cell.replaceChildren(
      document.createTextNode(title),
      document.createElement('br'),
      createElement('span', 'text-cbsua-muted text-xs', detail)
    );
    if (existingRow) {
      const status = request.status || 'Pending';
      const date = existingRow.cells[0].querySelector('p.text-cbsua-muted');
      if (date) date.textContent = request.date;
      setCellDetails(existingRow.cells[1], request.office, request.employeeId
        ? `${request.recipient} · ID ${request.employeeId}`
        : request.recipient);
      setCellDetails(existingRow.cells[2], request.item, request.quantity);
      const badge = existingRow.cells[4].querySelector('span');
      if (badge) Object.assign(badge, {
        className: `badge rounded-full px-2 py-0.5 text-xs font-medium ${status === 'Approved' ? 'bg-green-100 text-green-700' : status === 'Issued' ? 'bg-blue-100 text-blue-700' : status === 'Rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`,
        textContent: status
      });
      const actionCell = existingRow.cells[5];
      actionCell.replaceChildren();
      if (status === 'Pending') {
        if (window.IMS.currentUser?.role === 'admin') {
          const reviewButton = createElement('button', 'text-cbsua-primary hover:underline mr-2', 'Approve');
          reviewButton.type = 'button';
          reviewButton.dataset.requestAction = 'approve';
          const rejectButton = createElement('button', 'text-red-600 hover:underline', 'Reject');
          rejectButton.type = 'button';
          rejectButton.dataset.requestAction = 'reject';
          actionCell.append(reviewButton, rejectButton);
        } else {
          actionCell.textContent = 'Awaiting review';
        }
      } else {
        if (status === 'Approved') {
          const issueLink = createElement('a', 'text-cbsua-primary hover:underline', 'Issue →');
          issueLink.href = `issue_supply.html?request=${encodeURIComponent(request.id)}`;
          actionCell.append(issueLink);
        } else {
          actionCell.textContent = status;
        }
      }
      return;
    }
    const row = createElement('tr', 'border-b border-cbsua-border/50 hover:bg-gray-50 dark:hover:bg-gray-700');
    row.dataset.requestId = request.id;
    const addCell = content => {
      const cell = createElement('td', 'py-3');
      cell.textContent = content;
      row.append(cell);
      return cell;
    };
    const idCell = addCell('');
    idCell.append(createElement('p', 'font-medium', request.id), createElement('p', 'text-cbsua-muted text-xs', request.date));
    const officeCell = addCell('');
    setCellDetails(officeCell, request.office, request.employeeId
      ? `${request.recipient} · ID ${request.employeeId}`
      : request.recipient);
    const itemCell = addCell('');
    setCellDetails(itemCell, request.item, request.quantity);
    addCell(request.reviewedBy || '—');
    const status = request.status || 'Pending';
    const statusCell = addCell('');
    statusCell.append(createElement('span',
      `badge rounded-full px-2 py-0.5 text-xs font-medium ${status === 'Approved' ? 'bg-green-100 text-green-700' : status === 'Issued' ? 'bg-blue-100 text-blue-700' : status === 'Rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`,
      status));
    const actionCell = addCell('');
    if (status === 'Pending') {
      if (window.IMS.currentUser?.role === 'admin') {
        const reviewButton = createElement('button', 'text-cbsua-primary hover:underline mr-2', 'Approve');
        reviewButton.type = 'button';
        reviewButton.dataset.requestAction = 'approve';
        const rejectButton = createElement('button', 'text-red-600 hover:underline', 'Reject');
        rejectButton.type = 'button';
        rejectButton.dataset.requestAction = 'reject';
        actionCell.append(reviewButton, rejectButton);
      } else {
        actionCell.textContent = 'Awaiting review';
      }
    } else {
      if (status === 'Approved') {
        const issueLink = createElement('a', 'text-cbsua-primary hover:underline', 'Issue →');
        issueLink.href = `issue_supply.html?request=${encodeURIComponent(request.id)}`;
        actionCell.append(issueLink);
      } else {
        actionCell.textContent = status;
      }
    }
    table.append(row);
    sortElementsById(table, 'requestId');
  }

  function addSupplierCard(supplier) {
    const list = document.querySelector('main .space-y-4');
    if (!list || !document.querySelector('#supplierModal')) return;
    if ([...list.children].some(card => card.dataset.supplierId === supplier.id)) return;
    const card = createElement('div', 'border border-cbsua-border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors');
    card.dataset.supplierId = supplier.id;
    const headingRow = createElement('div', 'flex justify-between items-start');
    const headingGroup = document.createElement('div');
    headingGroup.append(
      createElement('h6', 'font-bold', `${supplier.id} — ${supplier.name}`),
      createElement('p', 'text-sm text-cbsua-muted mt-1', supplier.category)
    );
    headingRow.append(headingGroup, createElement('span', 'text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium', 'Active'));
    card.append(headingRow);

    const details = createElement('div', 'mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm');
    [['Contact person', supplier.contact], ['Phone / Email', [supplier.phone, supplier.email].filter(Boolean).join(' · ')], ['Address', supplier.address]]
      .forEach(([label, value]) => {
        const detail = createElement('div');
        detail.append(createElement('p', 'text-cbsua-muted text-xs', label), createElement('p', '', value));
        details.append(detail);
      });
    details.lastElementChild.classList.add('sm:col-span-2');
    card.append(details);

    const footer = createElement('div', 'mt-3 flex gap-3 text-sm');
    const usage = createElement('span', 'text-cbsua-muted');
    usage.append('Used in: ', createElement('strong', '', `${supplier.items || 0} items`), ' · ',
      createElement('strong', '', `${supplier.deliveries || 0} deliveries`));
    const edit = createElement('button', 'ml-auto text-cbsua-primary hover:underline', 'Edit');
    edit.type = 'button';
    edit.dataset.supplierAction = 'edit';
    edit.dataset.supplierId = supplier.id;
    footer.append(usage, edit);
    card.append(footer);
    list.append(card);
    sortElementsById(list, 'supplierId');
  }

  function addTransactionRow(record, movementType) {
    const table = document.querySelector('main tbody');
    if (!table || [...table.rows].some(row => row.innerText.includes(record.id))) return;
    const row = createElement('tr', 'border-b border-cbsua-border/50');
    row.dataset.transactionId = record.id;
    const dateCell = createElement('td', 'py-3');
    dateCell.append(
      createElement('p', 'font-medium', record.id),
      createElement('p', 'text-xs text-cbsua-muted',
        record.receivedDate || record.date || new Date(record.createdAt).toLocaleDateString())
    );
    row.append(dateCell, createElement('td', 'py-3', `${record.itemId} — ${record.itemName}`));
    const movementCell = createElement('td', 'py-3');
    movementCell.append(createElement('span',
      movementType === 'Received' ? 'bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs font-medium' : 'bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs font-medium',
      movementType === 'Received' ? `Received +${record.quantity}` : `Issued -${record.quantity}`));
    row.append(movementCell,
      createElement('td', 'py-3', movementType === 'Received' ? record.supplier : record.office),
      createElement('td', 'py-3', movementType === 'Received' ? `Received by ${record.receivedBy}` : `${record.recipient} / ${record.handledBy}`));
    table.append(row);
    sortElementsById(table, 'transactionId');
  }

  function restoreLocalRecords() {
    const currentPage = location.pathname.split('/').pop();
    if (currentPage === 'dashboard.html') {
      [['receipts', 'Received'], ['issuances', 'Issued']]
        .flatMap(([resource, type]) => getLocalRecords(resource).map(record => [record, type]))
        .sort((left, right) => compareRecordIdsDescending(left[0].id, right[0].id))
        .forEach(([record, type]) => addTransactionRow(record, type));
      return;
    }
    const resourceByPage = {
      'inventory.html': ['items', addInventoryRow],
      'stock_request.html': ['requests', addRequestRow],
      'suppliers.html': ['suppliers', addSupplierCard]
    };
    const resource = resourceByPage[currentPage];
    if (!resource) return;
    const table = document.querySelector('#itemTableBody')
      || (currentPage === 'stock_request.html' ? document.querySelector('main tbody') : null);
    if (table) table.replaceChildren();
    const supplierList = currentPage === 'suppliers.html' ? document.querySelector('main .space-y-4') : null;
    supplierList?.replaceChildren();
    [...getLocalRecords(resource[0])]
      .sort((left, right) => compareRecordIdsDescending(left.id, right.id))
      .forEach(resource[1]);
    const filter = currentPage === 'inventory.html' ? document.querySelector('#searchInput')
      : currentPage === 'stock_request.html' ? document.querySelector('main input[type="text"]') : null;
    filter?.dispatchEvent(new Event('input', { bubbles: true }));
  }

  Object.assign(window.IMS, {
    initializeRecords: loadRecords,
    getLocalRecords,
    getRemainingRequestQuantity,
    saveRecord,
    updateRequestStatus,
    updateInventoryItem,
    updateSupplier,
    addInventoryRow,
    addRequestRow,
    addSupplierCard,
    restoreLocalRecords,
    refreshPage() {
      restoreLocalRecords();
      window.dispatchEvent(new CustomEvent('ims:records-updated'));
    }
  });
  window.IMS.pageFeatures.push(restoreLocalRecords);
})();
