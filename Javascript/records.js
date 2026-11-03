window.IMS = window.IMS || {};
window.IMS.pageFeatures = window.IMS.pageFeatures || [];

(() => {
  const recordsKey = 'cbsuaSupplyRecords';
  const sampleItems = [
    { id: 'ITM-001', name: 'Bond paper, A4', category: 'Paper supplies', quantity: 18, unit: 'reams', supplier: 'Bicol Office Depot', minimum: 20, status: 'Low stock' },
    { id: 'ITM-002', name: 'Bond paper, letter', category: 'Paper supplies', quantity: 240, unit: 'reams', supplier: 'Bicol Office Depot', minimum: 50, status: 'In stock' },
    { id: 'ITM-003', name: 'Ballpen per pack', category: 'Writing tools', quantity: 24, unit: 'pieces', supplier: 'Bicol Office Depot', minimum: 10, status: 'In stock' },
    { id: 'ITM-004', name: 'Toner cartridge', category: 'Printing', quantity: 12, unit: 'cartridges', supplier: 'Sipocot Print Supply', minimum: 5, status: 'Low expiring' },
    { id: 'ITM-005', name: 'Ethyl alcohol, 500 mL', category: 'Cleaning', quantity: 36, unit: 'bottles', supplier: 'Camarines Essentials', minimum: 10, status: 'Expiring soon' },
    { id: 'ITM-008', name: 'Whiteboard marker', category: 'Writing tools', quantity: 0, unit: 'pieces', supplier: 'Bicol Office Depot', minimum: 10, status: 'Out of stock' }
  ];
  const sampleRequests = [
    { id: 'REQ-2026-044', date: '16 Oct 2026', office: 'ICT Office', recipient: 'Carlo Mendoza', item: 'Toner cartridge (ITM-004)', itemId: 'ITM-004', quantity: '2 cartridges', status: 'Pending' },
    { id: 'REQ-2026-043', date: '16 Oct 2026', office: 'Clinic', recipient: 'Mid Cruz', item: 'Ethyl alcohol (ITM-005)', itemId: 'ITM-005', quantity: '8 bottles', status: 'Pending' },
    { id: 'REQ-2026-042', date: '15 Oct 2026', office: "Registrar's Office", recipient: 'Ana Santos', item: 'Bond paper, letter (ITM-002)', itemId: 'ITM-002', quantity: '30 reams', status: 'Issued' },
    { id: 'REQ-2026-041', date: '15 Oct 2026', office: 'Accounting Office', recipient: 'Leo Ramos', item: 'Bond paper, A4 (ITM-001)', itemId: 'ITM-001', quantity: '20 reams', status: 'Pending' }
  ];
  const sampleSuppliers = [
    { id: 'SUP-001', name: 'Bicol Office Depot', category: 'Office & school supplies, paper, stationery', contact: 'Maria Cruz — Procurement', phone: '0917-XXX-XXXX', email: 'bod@example.ph', address: 'National Highway, Sipocot, Camarines Sur', items: 8, deliveries: 12 },
    { id: 'SUP-002', name: 'Sipocot Print Supply', category: 'Printers, toner, ink, printing services', contact: 'Juan Reyes — Manager', phone: '0918-XXX-XXXX', email: 'sps@example.ph', address: 'Barangay San Vicente, Sipocot, Camarines Sur', items: 2, deliveries: 4 },
    { id: 'SUP-003', name: 'Camarines Essentials', category: 'Medical, hygiene, cleaning supplies', contact: 'Ana Santos — Sales Officer', phone: '0915-XXX-XXXX', email: 'ce@example.ph', address: 'Centro, Sipocot, Camarines Sur', items: 3, deliveries: 6 }
  ];
  const sampleReceipts = [
    { id: 'RCV-2026-026', itemId: 'ITM-002', itemName: 'Bond paper, letter', quantity: 100, unit: 'reams', supplier: 'Bicol Office Depot', receivedBy: 'Renjene D.S. Rivera', receivedDate: '2026-10-16', createdAt: '2026-10-16T09:30:00' },
    { id: 'RCV-2026-027', itemId: 'ITM-004', itemName: 'Toner cartridge', quantity: 12, unit: 'cartridges', supplier: 'Sipocot Print Supply', receivedBy: 'Renjene D.S. Rivera', receivedDate: '2026-10-14', createdAt: '2026-10-14T08:15:00' }
  ];
  const sampleIssuances = [
    { id: 'ISS-2026-020', itemId: 'ITM-002', itemName: 'Bond paper, letter', quantity: 30, unit: 'reams', office: "Registrar's Office", recipient: 'Ana Santos', handledBy: 'Renjene D.S. Rivera', date: '2026-10-16', requestId: 'REQ-2026-042', createdAt: '2026-10-16T15:00:00' }
  ];

  function createElement(tag, className = '', text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (arguments.length > 2) element.textContent = text;
    return element;
  }

  function readRecordStore() {
    try {
      const store = JSON.parse(localStorage.getItem(recordsKey) || '{}');
      if (!store || typeof store !== 'object' || Array.isArray(store)) {
        throw new Error('Saved records have an invalid format.');
      }
      return store;
    } catch (error) {
      console.error(error);
      window.IMS.showToast('Saved records could not be read.');
      return {};
    }
  }

  function writeRecordStore(records) {
    try {
      localStorage.setItem(recordsKey, JSON.stringify(records));
      return true;
    } catch (error) {
      console.error(error);
      window.IMS.showToast('Records could not be saved in this browser.');
      return false;
    }
  }

  function getSampleRecords(resource) {
    const samples = { items: sampleItems, requests: sampleRequests, suppliers: sampleSuppliers, receipts: sampleReceipts, issuances: sampleIssuances };
    return (samples[resource] || []).map(record => ({ ...record }));
  }

  function getLocalRecords(resource) {
    const store = readRecordStore();
    if (!Array.isArray(store[resource])) {
      store[resource] = getSampleRecords(resource);
      writeRecordStore(store);
    }
    return store[resource];
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

  function saveRecord(resource, record) {
    const store = readRecordStore();
    store[resource] = Array.isArray(store[resource]) ? store[resource] : getSampleRecords(resource);
    if (record.id && store[resource].some(entry => entry.id === record.id)) {
      window.IMS.showToast(`${record.id} already exists.`);
      return null;
    }
    const savedRecord = {
      ...record,
      createdAt: record.createdAt || new Date().toISOString(),
      createdBy: record.createdBy || window.IMS.currentUser?.name || 'Supply Office'
    };
    if (resource === 'receipts' || resource === 'issuances') {
      store.items = Array.isArray(store.items) ? store.items : getSampleRecords('items');
      const item = store.items.find(entry => entry.id === record.itemId);
      if (!item) {
        window.IMS.showToast('The selected inventory item was not found.');
        return null;
      }
      const quantity = getQuantity(record.quantity);
      if (!quantity) {
        window.IMS.showToast('Enter a quantity greater than zero.');
        return null;
      }
      if (resource === 'issuances') {
        store.requests = Array.isArray(store.requests) ? store.requests : getSampleRecords('requests');
        const request = store.requests.find(entry => entry.id === record.requestId);
        const requestedQuantity = request && getQuantity(request.quantity);
        if (!request || request.status !== 'Approved') {
          window.IMS.showToast('Only approved requests can be issued.');
          return null;
        }
        const alreadyIssued = store.issuances.reduce((total, issuance) =>
          total + (issuance.requestId === request.id ? getQuantity(issuance.quantity) : 0), 0);
        const remainingQuantity = Math.max(0, requestedQuantity - alreadyIssued);
        if (quantity > remainingQuantity) {
          window.IMS.showToast(`Only ${remainingQuantity} ${item.unit} remain to be issued for this request.`);
          return null;
        }
        if (quantity > item.quantity) {
          window.IMS.showToast(`Only ${item.quantity} ${item.unit} are available.`);
          return null;
        }
        request.issuedQuantity = alreadyIssued + quantity;
        if (request.issuedQuantity >= requestedQuantity) {
          request.status = 'Issued';
          request.issuedAt = new Date().toISOString();
        }
      }
      item.quantity += resource === 'receipts' ? quantity : -quantity;
      updateInventoryStatus(item);
    }
    store[resource].push(savedRecord);
    if (resource === 'issuances') {
      store.requests = Array.isArray(store.requests) ? store.requests : getSampleRecords('requests');
    }
    return writeRecordStore(store) ? savedRecord : null;
  }

  function updateRequestStatus(requestId, status) {
    if (window.IMS.currentUser?.role !== 'admin') {
      window.IMS.showToast('Only the Supply Office head can review requests.');
      return false;
    }
    const store = readRecordStore();
    store.requests = Array.isArray(store.requests) ? store.requests : getSampleRecords('requests');
    const request = store.requests.find(entry => entry.id === requestId);
    if (!request || request.status !== 'Pending' || !['Approved', 'Rejected'].includes(status)) {
      window.IMS.showToast('This request is no longer awaiting review.');
      return false;
    }
    if (status === 'Approved') {
      store.items = Array.isArray(store.items) ? store.items : getSampleRecords('items');
      const item = store.items.find(entry => entry.id === request.itemId);
      const quantity = getQuantity(request.quantity);
      if (!item || !quantity || item.quantity < quantity) {
        window.IMS.showToast(`Not enough stock to approve ${request.id}.`);
        return false;
      }
    }
    request.status = status;
    request.reviewedAt = new Date().toISOString();
    request.reviewedBy = window.IMS.currentUser?.name || 'Supply Office';
    return writeRecordStore(store);
  }

  function updateInventoryItem(itemId, changes) {
    const store = readRecordStore();
    store.items = Array.isArray(store.items) ? store.items : getSampleRecords('items');
    const item = store.items.find(entry => entry.id === itemId);
    if (!item) {
      window.IMS.showToast('The inventory item could not be found.');
      return null;
    }
    Object.assign(item, changes);
    updateInventoryStatus(item);
    item.updatedAt = new Date().toISOString();
    item.updatedBy = window.IMS.currentUser?.name || 'Supply Office';
    return writeRecordStore(store) ? item : null;
  }

  function updateSupplier(supplierId, changes) {
    const store = readRecordStore();
    store.suppliers = Array.isArray(store.suppliers) ? store.suppliers : getSampleRecords('suppliers');
    const supplier = store.suppliers.find(entry => entry.id === supplierId);
    if (!supplier) {
      window.IMS.showToast('The supplier could not be found.');
      return null;
    }
    Object.assign(supplier, changes);
    supplier.updatedAt = new Date().toISOString();
    supplier.updatedBy = window.IMS.currentUser?.name || 'Supply Office';
    return writeRecordStore(store) ? supplier : null;
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
    table.prepend(row);
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
    list.prepend(card);
  }

  function addTransactionRow(record, movementType) {
    const table = document.querySelector('main tbody');
    if (!table || [...table.rows].some(row => row.innerText.includes(record.id))) return;
    const row = createElement('tr', 'border-b border-cbsua-border/50');
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
    table.prepend(row);
  }

  function restoreLocalRecords() {
    const currentPage = location.pathname.split('/').pop();
    if (currentPage === 'dashboard.html') {
      [['receipts', 'Received'], ['issuances', 'Issued']]
        .flatMap(([resource, type]) => getLocalRecords(resource).map(record => [record, type]))
        .sort((left, right) => new Date(right[0].createdAt) - new Date(left[0].createdAt))
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
    const records = getLocalRecords(resource[0]);
    (currentPage === 'stock_request.html' || currentPage === 'suppliers.html' ? [...records].reverse() : records)
      .forEach(resource[1]);
    const filter = currentPage === 'inventory.html' ? document.querySelector('#searchInput')
      : currentPage === 'stock_request.html' ? document.querySelector('main input[type="text"]') : null;
    filter?.dispatchEvent(new Event('input', { bubbles: true }));
    const idConfig = {
      'stock_request.html': ['#requestForm input[readonly]', 'requests', 'REQ-2026-', 44],
      'suppliers.html': ['#supplierForm input[readonly]', 'suppliers', 'SUP-', 3]
    }[currentPage];
    if (idConfig) {
      const idField = document.querySelector(idConfig[0]);
      if (idField) idField.value = nextRecordId(...idConfig.slice(1));
    }
  }

  function nextRecordId(resource, prefix, initialValue) {
    const nextNumber = getLocalRecords(resource).reduce((maximum, record) => {
      const number = Number(record.id.match(/(\d+)$/)?.[1]) || initialValue;
      return Math.max(maximum, number);
    }, initialValue) + 1;
    return `${prefix}${String(nextNumber).padStart(3, '0')}`;
  }

  Object.assign(window.IMS, {
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
    nextRecordId,
    refreshPage() {
      restoreLocalRecords();
      window.dispatchEvent(new CustomEvent('ims:records-updated'));
    }
  });
  window.addEventListener('storage', event => {
    if (event.key === recordsKey) window.IMS.refreshPage();
  });
  window.IMS.pageFeatures.push(restoreLocalRecords);
})();
