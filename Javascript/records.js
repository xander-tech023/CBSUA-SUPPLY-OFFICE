window.IMS = window.IMS || {};
window.IMS.pageFeatures = window.IMS.pageFeatures || [];

(() => {
  const resources = ['items', 'requests', 'suppliers', 'receipts', 'issuances'];
  const records = Object.fromEntries(resources.map(resource => [resource, []]));
  const storageKey = 'cbsuaSupplyRecords';
  const seedRecords = {
    items: [
      { id: 'ITM-001', name: 'Bond paper, A4', description: '', category: 'Paper supplies', quantity: 18, unit: 'reams', supplier: 'Bicol Office Depot', minimum: 20, expiry: null, status: 'Low stock' },
      { id: 'ITM-002', name: 'Bond paper, letter', description: '', category: 'Paper supplies', quantity: 240, unit: 'reams', supplier: 'Bicol Office Depot', minimum: 50, expiry: null, status: 'In stock' },
      { id: 'ITM-003', name: 'Ballpen per pack', description: '', category: 'Writing tools', quantity: 24, unit: 'pieces', supplier: 'Bicol Office Depot', minimum: 10, expiry: null, status: 'In stock' },
      { id: 'ITM-004', name: 'Toner cartridge', description: '', category: 'Printing', quantity: 12, unit: 'cartridges', supplier: 'Sipocot Print Supply', minimum: 5, expiry: null, status: 'In stock' },
      { id: 'ITM-005', name: 'Ethyl alcohol, 500 mL', description: '', category: 'Cleaning', quantity: 36, unit: 'bottles', supplier: 'Camarines Essentials', minimum: 10, expiry: null, status: 'In stock' },
      { id: 'ITM-008', name: 'Whiteboard marker', description: '', category: 'Writing tools', quantity: 0, unit: 'pieces', supplier: 'Bicol Office Depot', minimum: 10, expiry: null, status: 'Out of stock' }
    ],
    suppliers: [
      { id: 'SUP-001', name: 'Bicol Office Depot', category: 'Office & school supplies, paper, stationery', contact: 'Maria Cruz — Procurement', phone: '0917-XXX-XXXX', email: 'bod@example.ph', address: 'National Highway, Sipocot, Camarines Sur', items: 4, deliveries: 0 },
      { id: 'SUP-002', name: 'Sipocot Print Supply', category: 'Printers, toner, ink, printing services', contact: 'Juan Reyes — Manager', phone: '0918-XXX-XXXX', email: 'sps@example.ph', address: 'Barangay San Vicente, Sipocot, Camarines Sur', items: 1, deliveries: 0 },
      { id: 'SUP-003', name: 'Camarines Essentials', category: 'Medical, hygiene, cleaning supplies', contact: 'Ana Santos — Sales Officer', phone: '0915-XXX-XXXX', email: 'ce@example.ph', address: 'Centro, Sipocot, Camarines Sur', items: 1, deliveries: 0 }
    ],
    requests: [
      {
        id: 'REQ-2026-11-045',
        date: '2026-11-18',
        office: 'College of Education',
        recipient: 'Angelica Ramos',
        employeeId: 'CBSUA-1042',
        item: 'Bond paper, A4 (ITM-001)',
        itemId: 'ITM-001',
        quantity: '10 reams',
        status: 'Pending',
        reviewedBy: '',
        reviewedAt: null,
        remarks: 'For instructional materials and examination packets.',
        createdAt: '2026-11-18T08:30:00'
      },
      {
        id: 'REQ-2026-11-044',
        date: '2026-11-17',
        office: 'Registrar',
        recipient: 'Noel P. Mendoza',
        employeeId: 'CBSUA-0831',
        item: 'Ballpen per pack (ITM-003)',
        itemId: 'ITM-003',
        quantity: '4 pieces',
        status: 'Approved',
        reviewedBy: 'Renjene D.S. Rivera',
        reviewedAt: '2026-11-17T14:20:00',
        remarks: 'Office writing supplies.',
        createdAt: '2026-11-17T09:10:00'
      },
      {
        id: 'REQ-2026-11-043',
        date: '2026-11-15',
        office: 'Campus Health Services',
        recipient: 'Liza Marie Cruz',
        employeeId: 'CBSUA-0674',
        item: 'Ethyl alcohol, 500 mL (ITM-005)',
        itemId: 'ITM-005',
        quantity: '6 bottles',
        status: 'Issued',
        reviewedBy: 'Renjene D.S. Rivera',
        reviewedAt: '2026-11-15T11:05:00',
        remarks: 'Sanitation supplies.',
        createdAt: '2026-11-15T08:45:00'
      }
    ],
    receipts: [
      {
        id: 'RCV-2026-028',
        itemId: 'ITM-001',
        itemName: 'Bond paper, A4',
        quantity: 20,
        unit: 'reams',
        supplier: 'Bicol Office Depot',
        supplierId: 'SUP-001',
        receivedBy: 'Maria Santos — Supply Staff Officer',
        receivedDate: '2026-11-14',
        deliveryReference: 'DR-2026-184',
        batchNumber: 'BOD-A4-1114',
        expiryDate: null,
        remarks: 'Standard office delivery.',
        attachmentName: 'delivery-receipt-184.pdf',
        createdAt: '2026-11-14T10:15:00'
      },
      {
        id: 'RCV-2026-027',
        itemId: 'ITM-005',
        itemName: 'Ethyl alcohol, 500 mL',
        quantity: 12,
        unit: 'bottles',
        supplier: 'Camarines Essentials',
        supplierId: 'SUP-003',
        receivedBy: 'Maria Santos — Supply Staff Officer',
        receivedDate: '2026-11-12',
        deliveryReference: 'DR-2026-179',
        batchNumber: 'CE-ALC-1112',
        expiryDate: '2027-11-12',
        remarks: 'Checked and recorded.',
        attachmentName: '',
        createdAt: '2026-11-12T13:40:00'
      }
    ],
    issuances: [
      {
        id: 'ISS-2026-021',
        requestId: 'REQ-2026-11-043',
        itemId: 'ITM-005',
        itemName: 'Ethyl alcohol, 500 mL',
        quantity: 6,
        unit: 'bottles',
        office: 'Campus Health Services',
        recipient: 'Liza Marie Cruz',
        recipientEmployeeId: 'CBSUA-0674',
        handledBy: 'Maria Santos — Supply Staff Officer',
        date: '2026-11-15',
        remarks: 'Issued for clinic sanitation use.',
        createdAt: '2026-11-15T13:30:00'
      },
      {
        id: 'ISS-2026-020',
        requestId: 'REQ-2026-11-044',
        itemId: 'ITM-003',
        itemName: 'Ballpen per pack',
        quantity: 2,
        unit: 'pieces',
        office: 'Registrar',
        recipient: 'Noel P. Mendoza',
        recipientEmployeeId: 'CBSUA-0831',
        handledBy: 'Maria Santos — Supply Staff Officer',
        date: '2026-11-17',
        remarks: 'Partial issue recorded.',
        createdAt: '2026-11-17T15:10:00'
      }
    ]
  };

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

  function readStoredRecords() {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey));
      if (stored && resources.every(resource => Array.isArray(stored[resource]))) return stored;
    } catch {
      // Fall back to starter records when browser storage is unavailable or invalid.
    }
    return structuredClone(seedRecords);
  }

  function persistRecords() {
    localStorage.setItem(storageKey, JSON.stringify(records));
  }

  async function loadRecords() {
    const stored = readStoredRecords();
    for (const resource of resources) {
      records[resource] = stored[resource].map(record => ({ ...record }));
    }
  }

  function replaceStoredResource(resource, record, recordId) {
    const index = records[resource].findIndex(entry => entry.id === recordId);
    if (index >= 0) records[resource][index] = record;
    else records[resource].push(record);
  }

  async function runMutation(action, payload) {
    try {
      let result = true;
      if (action === 'save-record') {
        const { resource, record } = payload;
        if (!resources.includes(resource)) throw new Error('A valid record type is required.');
        const saved = structuredClone(record);

        if (resource === 'items') {
          updateInventoryStatus(saved);
        } else if (resource === 'receipts') {
          const item = records.items.find(entry => entry.id === saved.itemId);
          if (!item) throw new Error('Choose a valid inventory item.');
          item.quantity += Number(saved.quantity);
          if (saved.expiryDate) item.expiry = saved.expiryDate;
          updateInventoryStatus(item);
        } else if (resource === 'issuances') {
          const item = records.items.find(entry => entry.id === saved.itemId);
          const request = records.requests.find(entry => entry.id === saved.requestId);
          if (!item || !request || request.status !== 'Approved') throw new Error('Choose an approved request.');
          if (getRemainingRequestQuantity(request) < Number(saved.quantity) || item.quantity < Number(saved.quantity)) {
            throw new Error('The issue quantity exceeds the remaining request or available stock.');
          }
          item.quantity -= Number(saved.quantity);
          updateInventoryStatus(item);
          if (getRemainingRequestQuantity(request) - Number(saved.quantity) <= 0) request.status = 'Issued';
        }
        replaceStoredResource(resource, saved);
        result = saved;
      } else if (action === 'update-record') {
        const { resource, recordId, changes } = payload;
        if (resource === 'items') {
          const item = records.items.find(entry => entry.id === recordId);
          if (!item) throw new Error('The inventory item could not be found.');
          Object.assign(item, changes);
          updateInventoryStatus(item);
          result = item;
        } else if (resource === 'suppliers') {
          const supplier = records.suppliers.find(entry => entry.id === recordId);
          if (!supplier) throw new Error('The supplier could not be found.');
          Object.assign(supplier, changes);
          result = supplier;
        } else {
          throw new Error('The record update is invalid.');
        }
      } else if (action === 'update-request-status') {
        if (window.IMS.currentUser?.role !== 'admin') throw new Error('Only the Supply Office head can review requests.');
        const request = records.requests.find(entry => entry.id === payload.requestId);
        if (!request || request.status !== 'Pending') throw new Error('This request is no longer awaiting review.');
        if (payload.status === 'Approved') {
          const item = records.items.find(entry => entry.id === request.itemId);
          if (!item || Number.parseFloat(request.quantity) > item.quantity) {
            throw new Error('There is not enough stock to approve this request.');
          }
        }
        if (!['Approved', 'Rejected'].includes(payload.status)) throw new Error('Choose a valid request status.');
        request.status = payload.status;
        request.reviewedBy = window.IMS.currentUser.name;
        request.reviewedAt = new Date().toISOString();
        result = true;
      } else {
        throw new Error('Unknown action.');
      }
      persistRecords();
      window.dispatchEvent(new CustomEvent('ims:records-updated'));
      return result;
    } catch (error) {
      console.error('Local record operation failed.', error);
      window.IMS.showToast(error.message || 'The record could not be saved.');
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
    row.append(createElement('td', 'py-3', '—'));
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
    if (currentPage === 'suppliers.html') {
      const suppliers = getLocalRecords('suppliers');
      const countElements = [...document.querySelectorAll('main p')];
      const recordCount = countElements.find(paragraph => paragraph.textContent.includes('supplier records'));
      if (recordCount) recordCount.textContent = `${suppliers.length} supplier records`;

      const statValues = [...document.querySelectorAll('main .stat-card .flex.justify-between span:last-child')];
      if (statValues[0]) statValues[0].textContent = String(suppliers.length);
      if (statValues[1]) statValues[1].textContent = String(suppliers.length);
      if (statValues[2]) statValues[2].textContent = String(getLocalRecords('items').filter(item =>
        suppliers.some(supplier => supplier.name === item.supplier)).length);
      if (statValues[3]) statValues[3].textContent = String(getLocalRecords('receipts').length);
    }
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
    const recordsForDisplay = currentPage === 'inventory.html'
      ? [...records].sort((left, right) =>
        left.id.localeCompare(right.id, undefined, { numeric: true, sensitivity: 'base' }))
      : currentPage === 'stock_request.html'
        ? [...records].sort((left, right) =>
          Number(left.id.match(/(\d+)$/)?.[1]) - Number(right.id.match(/(\d+)$/)?.[1]))
        : records;
    recordsForDisplay.forEach(resource[1]);
    const filter = currentPage === 'inventory.html' ? document.querySelector('#searchInput')
      : currentPage === 'stock_request.html' ? document.querySelector('main input[type="text"]') : null;
    filter?.dispatchEvent(new Event('input', { bubbles: true }));
    const idConfig = {
      'stock_request.html': ['#requestForm input[name="requestId"]', 'request'],
      'suppliers.html': ['#supplierForm input[readonly]', 'suppliers', 'SUP-', 3]
    }[currentPage];
    if (idConfig) {
      const idField = document.querySelector(idConfig[0]);
      if (idField) idField.value = idConfig[1] === 'request' ? nextRequestId() : nextRecordId(...idConfig.slice(1));
    }
  }

  function nextRequestId() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `REQ-${year}-${month}-`;
    const nextNumber = getLocalRecords('requests').reduce((maximum, record) => {
      const formatted = String(record.id || '').match(/^REQ-(\d{4})-(\d{2})-(\d{3})$/);
      if (formatted && Number(formatted[1]) === year && Number(formatted[2]) === now.getMonth() + 1) {
        return Math.max(maximum, Number(formatted[3]));
      }
      const legacy = String(record.id || '').match(/^REQ-\d{4}-(\d+)$/);
      const recordDate = String(record.date || record.createdAt || '').slice(0, 7);
      if (legacy && recordDate === `${year}-${month}`) {
        return Math.max(maximum, Number(legacy[1]));
      }
      return maximum;
    }, 0) + 1;
    return `${prefix}${String(nextNumber).padStart(3, '0')}`;
  }

  function nextRecordId(resource, prefix, initialValue) {
    const nextNumber = getLocalRecords(resource).reduce((maximum, record) => {
      const number = Number(record.id.match(/(\d+)$/)?.[1]) || initialValue;
      return Math.max(maximum, number);
    }, initialValue) + 1;
    return `${prefix}${String(nextNumber).padStart(3, '0')}`;
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
    nextRecordId,
    nextRequestId,
    refreshPage() {
      restoreLocalRecords();
      window.dispatchEvent(new CustomEvent('ims:records-updated'));
    }
  });
  window.IMS.pageFeatures.push(restoreLocalRecords);
})();
