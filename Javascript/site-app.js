(function () {
  const STORAGE_KEY = 'cbsua-supply-office-v1';
  const AUTH_KEY = 'cbsua-supply-user';

  const defaultState = {
    users: [
      { username: 'admin', password: 'admin123', role: 'admin', name: 'Renjene D.S. Rivera', title: 'Head, Supply Office' },
      { username: 'staff', password: 'staff123', role: 'staff', name: 'Maria Santos', title: 'Supply Staff Officer' },
      { username: 'supply', password: '123456', role: 'staff', name: 'Alyssa Dela Cruz', title: 'Inventory Officer' }
    ],
    items: [
      { id: 'ITM-001', name: 'Bond paper, A4', category: 'Paper supplies', quantity: 18, unit: 'reams', supplier: 'Bicol Office Depot', minimum: 20, status: 'Low stock', location: 'Cabinet A-2' },
      { id: 'ITM-002', name: 'Bond paper, letter', category: 'Paper supplies', quantity: 240, unit: 'reams', supplier: 'Bicol Office Depot', minimum: 50, status: 'In stock', location: 'Cabinet A-1' },
      { id: 'ITM-003', name: 'Ballpen per pack', category: 'Writing tools', quantity: 24, unit: 'pieces', supplier: 'Bicol Office Depot', minimum: 10, status: 'In stock', location: 'Drawer B-4' },
      { id: 'ITM-004', name: 'Toner cartridge', category: 'Printing', quantity: 12, unit: 'cartridges', supplier: 'Sipocot Print Supply', minimum: 5, status: 'Low expiring', location: 'Printer shelf' },
      { id: 'ITM-005', name: 'Ethyl alcohol, 500 mL', category: 'Cleaning', quantity: 36, unit: 'bottles', supplier: 'Camarines Essentials', minimum: 10, status: 'Expiring soon', location: 'Sanitary cabinet' },
      { id: 'ITM-008', name: 'Whiteboard marker', category: 'Writing tools', quantity: 0, unit: 'pieces', supplier: 'Bicol Office Depot', minimum: 10, status: 'Out of stock', location: 'Drawer B-1' }
    ],
    requests: [
      { id: 'REQ-2026-044', date: '2026-10-16', office: 'ICT Office', recipient: 'Carlo Mendoza', item: 'Toner cartridge', itemId: 'ITM-004', quantity: 2, unit: 'cartridges', status: 'Pending', handler: 'Renjene D.S. Rivera' },
      { id: 'REQ-2026-043', date: '2026-10-16', office: 'Clinic', recipient: 'Mid Cruz', item: 'Ethyl alcohol, 500 mL', itemId: 'ITM-005', quantity: 8, unit: 'bottles', status: 'Pending', handler: 'Renjene D.S. Rivera' },
      { id: 'REQ-2026-042', date: '2026-10-15', office: 'Registrar\'s Office', recipient: 'Ana Santos', item: 'Bond paper, letter', itemId: 'ITM-002', quantity: 30, unit: 'reams', status: 'Approved', handler: 'Renjene D.S. Rivera' },
      { id: 'REQ-2026-041', date: '2026-10-15', office: 'Accounting Office', recipient: 'Leo Ramos', item: 'Bond paper, A4', itemId: 'ITM-001', quantity: 20, unit: 'reams', status: 'Pending', handler: 'Renjene D.S. Rivera' }
    ],
    receipts: [
      { id: 'RCV-2026-026', itemId: 'ITM-002', itemName: 'Bond paper, letter', quantity: 100, unit: 'reams', supplier: 'Bicol Office Depot', receivedBy: 'Renjene D.S. Rivera', receivedDate: '2026-10-16', createdAt: '2026-10-16T09:30:00' },
      { id: 'RCV-2026-027', itemId: 'ITM-004', itemName: 'Toner cartridge', quantity: 12, unit: 'cartridges', supplier: 'Sipocot Print Supply', receivedBy: 'Renjene D.S. Rivera', receivedDate: '2026-10-14', createdAt: '2026-10-14T08:15:00' }
    ],
    issuances: [
      { id: 'ISS-2026-020', itemId: 'ITM-002', itemName: 'Bond paper, letter', quantity: 30, unit: 'reams', office: 'Registrar\'s Office', recipient: 'Ana Santos', handledBy: 'Renjene D.S. Rivera', date: '2026-10-16', requestId: 'REQ-2026-042', createdAt: '2026-10-16T15:00:00' }
    ],
    suppliers: [
      { id: 'SUP-001', name: 'Bicol Office Depot', category: 'Office & school supplies, paper, stationery', contact: 'Maria Cruz — Procurement', phone: '0917-XXX-XXXX', email: 'bod@example.ph', address: 'National Highway, Sipocot, Camarines Sur', items: 8, deliveries: 12 },
      { id: 'SUP-002', name: 'Sipocot Print Supply', category: 'Printers, toner, ink, printing services', contact: 'Juan Reyes — Manager', phone: '0918-XXX-XXXX', email: 'sps@example.ph', address: 'Barangay San Vicente, Sipocot, Camarines Sur', items: 2, deliveries: 4 },
      { id: 'SUP-003', name: 'Camarines Essentials', category: 'Medical, hygiene, cleaning supplies', contact: 'Ana Santos — Sales Officer', phone: '0915-XXX-XXXX', email: 'ce@example.ph', address: 'Centro, Sipocot, Camarines Sur', items: 3, deliveries: 6 }
    ]
  };

  function getState() {
    try {
      const current = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return { ...defaultState, ...current, items: Array.isArray(current.items) ? current.items : defaultState.items, requests: Array.isArray(current.requests) ? current.requests : defaultState.requests, receipts: Array.isArray(current.receipts) ? current.receipts : defaultState.receipts, issuances: Array.isArray(current.issuances) ? current.issuances : defaultState.issuances, suppliers: Array.isArray(current.suppliers) ? current.suppliers : defaultState.suppliers, users: Array.isArray(current.users) ? current.users : defaultState.users };
    } catch (error) {
      return structuredClone(defaultState);
    }
  }

  function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function ensureSeed() {
    const state = getState();
    const hasItems = Array.isArray(state.items) && state.items.length > 0;
    if (!hasItems) {
      saveState(defaultState);
      return defaultState;
    }
    saveState(state);
    return state;
  }

  function getCurrentUser() {
    try {
      return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null');
    } catch (error) {
      return null;
    }
  }

  function setCurrentUser(user) {
    localStorage.setItem(AUTH_KEY, JSON.stringify(user));
  }

  function logout() {
    localStorage.removeItem(AUTH_KEY);
    window.location.href = 'index.html';
  }

  function getStatusClass(status) {
    switch (status) {
      case 'Approved':
        return 'bg-green-100 text-green-700';
      case 'Issued':
        return 'bg-blue-100 text-blue-700';
      case 'Rejected':
        return 'bg-red-100 text-red-700';
      case 'Low stock':
      case 'Low expiring':
        return 'bg-amber-100 text-amber-700';
      case 'Out of stock':
        return 'bg-red-100 text-red-700';
      case 'Expiring soon':
        return 'bg-orange-100 text-orange-700';
      default:
        return 'bg-amber-100 text-amber-700';
    }
  }

  function showToast(message) {
    let toast = document.getElementById('cbsua-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'cbsua-toast';
      toast.className = 'fixed right-4 bottom-4 z-50 rounded-lg bg-slate-900 text-white px-4 py-2 shadow-lg opacity-0 transition-opacity duration-300';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.remove('opacity-0');
    toast.classList.add('opacity-100');
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => {
      toast.classList.add('opacity-0');
      toast.classList.remove('opacity-100');
    }, 2200);
  }

  function formatQuantity(quantity, unit) {
    return `${quantity} ${unit}`;
  }

  function updateRequestStatus(requestId, status) {
    const state = getState();
    state.requests = state.requests.map(request => request.id === requestId ? { ...request, status } : request);
    saveState(state);
    return state;
  }

  function saveNewItem(item) {
    const state = getState();
    state.items.push(item);
    saveState(state);
    return state;
  }

  function saveReceipt(receipt) {
    const state = getState();
    state.receipts.push(receipt);
    const item = state.items.find(entry => entry.id === receipt.itemId);
    if (item) {
      item.quantity += Number(receipt.quantity || 0);
      item.status = item.quantity <= 0 ? 'Out of stock' : item.quantity <= item.minimum ? 'Low stock' : 'In stock';
    }
    saveState(state);
    return state;
  }

  function saveIssuance(issuance) {
    const state = getState();
    state.issuances.push(issuance);
    const item = state.items.find(entry => entry.id === issuance.itemId);
    if (item) {
      item.quantity = Math.max(0, item.quantity - Number(issuance.quantity || 0));
      item.status = item.quantity <= 0 ? 'Out of stock' : item.quantity <= item.minimum ? 'Low stock' : 'In stock';
    }
    const request = state.requests.find(entry => entry.id === issuance.requestId);
    if (request) request.status = 'Issued';
    saveState(state);
    return state;
  }

  function nextId(prefix, currentItems, suffixLength = 3) {
    const highest = currentItems.reduce((max, entry) => {
      const match = String(entry.id).match(/(\d+)$/);
      const value = match ? Number(match[1]) : 0;
      return Math.max(max, value);
    }, 0);
    return `${prefix}${String(highest + 1).padStart(suffixLength, '0')}`;
  }

  function applyAuthState() {
    const user = getCurrentUser();
    const usernameEl = document.querySelector('[data-user-name]');
    const roleEl = document.querySelector('[data-user-role]');
    const logoutBtn = document.querySelector('[data-logout]');
    if (usernameEl && user) usernameEl.textContent = user.name;
    if (roleEl && user) roleEl.textContent = user.title || user.role;
    if (logoutBtn && user) logoutBtn.addEventListener('click', logout);
  }

  function renderAdminDashboard() {
    const state = ensureSeed();
    const items = state.items;
    const requests = state.requests;
    const pending = requests.filter(item => item.status === 'Pending').length;
    const approved = requests.filter(item => item.status === 'Approved').length;
    const table = document.querySelector('#admin-request-table');
    const statValues = document.querySelectorAll('[data-stat]');
    if (statValues.length >= 4) {
      statValues[0].textContent = String(items.length);
      statValues[1].textContent = String(pending);
      statValues[2].textContent = String(items.filter(item => item.quantity <= item.minimum).length);
      statValues[3].textContent = String(items.filter(item => item.quantity <= item.minimum + 5).length);
    }

    if (table) {
      table.innerHTML = requests.slice().reverse().map(request => `
        <tr class="border-b border-cbsua-border/50 hover:bg-gray-50">
          <td class="py-3">
            <p class="font-medium">${request.id}</p>
            <p class="text-cbsua-muted text-xs">${request.date}</p>
          </td>
          <td class="py-3">${request.office}<br /><span class="text-cbsua-muted text-xs">${request.recipient}</span></td>
          <td class="py-3">${request.item}<br /><span class="text-cbsua-muted text-xs">${request.quantity} ${request.unit}</span></td>
          <td class="py-3">${request.handler}</td>
          <td class="py-3"><span class="badge rounded-full px-2 py-0.5 text-xs font-medium ${getStatusClass(request.status)}">${request.status}</span></td>
          <td class="py-3">
            ${request.status === 'Pending' ? `<div class="flex gap-2"><button data-approve="${request.id}" class="text-cbsua-primary hover:underline">Approve</button><button data-reject="${request.id}" class="text-red-600 hover:underline">Reject</button></div>` : '<span class="text-cbsua-muted">Reviewed</span>'}
          </td>
        </tr>
      `).join('');

      table.querySelectorAll('[data-approve]').forEach(button => {
        button.addEventListener('click', () => {
          updateRequestStatus(button.dataset.approve, 'Approved');
          renderAdminDashboard();
          showToast('Request approved.');
        });
      });
      table.querySelectorAll('[data-reject]').forEach(button => {
        button.addEventListener('click', () => {
          updateRequestStatus(button.dataset.reject, 'Rejected');
          renderAdminDashboard();
          showToast('Request rejected.');
        });
      });
    }

    const appCount = document.querySelector('[data-approval-count]');
    if (appCount) appCount.textContent = String(approved + pending);

    const lowStockEl = document.querySelector('#attention-list');
    if (lowStockEl) {
      const alerts = items.filter(item => item.quantity <= item.minimum || item.status.includes('Expiring')).slice(0, 4);
      lowStockEl.innerHTML = alerts.map(item => `
        <div class="${item.quantity <= 0 ? 'bg-red-50 border-red-400' : 'bg-amber-50 border-amber-400'} border-l-4 p-3 rounded-r-lg">
          <p class="font-medium text-sm">${item.name}</p>
          <p class="text-xs ${item.quantity <= 0 ? 'text-red-600' : 'text-cbsua-muted'}">${item.quantity <= 0 ? 'Out of stock' : item.status}</p>
        </div>
      `).join('');
    }
  }

  function renderInventoryPage() {
    const state = ensureSeed();
    const table = document.querySelector('#itemTableBody');
    if (!table) return;
    const rows = state.items.map(item => `
      <tr class="border-b border-cbsua-border/50 hover:bg-gray-50" data-item-id="${item.id}">
        <td class="py-3"><p class="font-medium">${item.id}</p><p class="text-cbsua-muted">${item.name}</p></td>
        <td class="py-3">${item.category}</td>
        <td class="py-3 font-semibold">${formatQuantity(item.quantity, item.unit)}</td>
        <td class="py-3">${item.unit}</td>
        <td class="py-3">${item.supplier}</td>
        <td class="py-3"><span class="badge rounded-full px-2 py-0.5 text-xs font-medium ${getStatusClass(item.status)}">${item.status}</span></td>
        <td class="py-3"><button class="text-cbsua-primary hover:underline" data-inspect-item="${item.id}">Inspect →</button></td>
      </tr>
    `).join('');
    table.innerHTML = rows;

    const count = document.querySelector('[data-item-count]');
    if (count) count.textContent = String(state.items.length);

    document.querySelectorAll('[data-inspect-item]').forEach(button => {
      button.addEventListener('click', () => {
        const item = state.items.find(entry => entry.id === button.dataset.inspectItem);
        if (!item) return;
        const modal = document.querySelector('#itemDetailModal');
        if (modal) {
          modal.classList.remove('hidden');
          modal.innerHTML = `
            <div class="max-w-xl mx-auto mt-16 bg-white rounded-2xl shadow-xl p-6">
              <div class="flex justify-between items-start mb-5">
                <div>
                  <p class="text-cbsua-muted text-sm">Inventory inspection</p>
                  <h3 class="text-2xl font-bold">${item.name}</h3>
                </div>
                <button class="text-xl" data-close-detail>✕</button>
              </div>
              <div class="grid grid-cols-2 gap-4 text-sm">
                <div><p class="text-cbsua-muted">Code</p><p class="font-medium">${item.id}</p></div>
                <div><p class="text-cbsua-muted">Category</p><p class="font-medium">${item.category}</p></div>
                <div><p class="text-cbsua-muted">On hand</p><p class="font-medium">${formatQuantity(item.quantity, item.unit)}</p></div>
                <div><p class="text-cbsua-muted">Status</p><p class="font-medium"><span class="badge rounded-full px-2 py-0.5 text-xs font-medium ${getStatusClass(item.status)}">${item.status}</span></p></div>
                <div><p class="text-cbsua-muted">Supplier</p><p class="font-medium">${item.supplier}</p></div>
                <div><p class="text-cbsua-muted">Location</p><p class="font-medium">${item.location || 'Not specified'}</p></div>
                <div class="col-span-2"><p class="text-cbsua-muted">Minimum stock</p><p class="font-medium">${item.minimum} ${item.unit}</p></div>
              </div>
            </div>
          `;
          modal.querySelector('[data-close-detail]').addEventListener('click', () => modal.classList.add('hidden'));
        }
      });
    });

    const searchInput = document.querySelector('#searchInput');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        const term = searchInput.value.trim().toLowerCase();
        document.querySelectorAll('#itemTableBody tr').forEach(row => {
          const text = row.textContent.toLowerCase();
          row.style.display = text.includes(term) ? '' : 'none';
        });
      });
    }
  }

  function renderSuppliersPage() {
    const state = ensureSeed();
    const list = document.querySelector('#supplier-list');
    if (!list) return;
    list.innerHTML = state.suppliers.map(supplier => `
      <div class="border border-cbsua-border rounded-lg p-4 hover:bg-gray-50">
        <div class="flex justify-between items-start">
          <div>
            <h6 class="font-bold">${supplier.id} — ${supplier.name}</h6>
            <p class="text-sm text-cbsua-muted mt-1">${supplier.category}</p>
          </div>
          <span class="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Active</span>
        </div>
        <div class="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          <div><p class="text-cbsua-muted text-xs">Contact person</p><p>${supplier.contact}</p></div>
          <div><p class="text-cbsua-muted text-xs">Phone / Email</p><p>${supplier.phone} · ${supplier.email}</p></div>
          <div class="sm:col-span-2"><p class="text-cbsua-muted text-xs">Address</p><p>${supplier.address}</p></div>
        </div>
        <div class="mt-3 flex gap-3 text-sm">
          <span class="text-cbsua-muted">Used in: <strong>${supplier.items} items</strong> · <strong>${supplier.deliveries} deliveries</strong></span>
        </div>
      </div>
    `).join('');
  }

  function renderRequestPage() {
    const state = ensureSeed();
    const table = document.querySelector('#request-table');
    if (!table) return;
    table.innerHTML = state.requests.slice().reverse().map(request => `
      <tr class="border-b border-cbsua-border/50 hover:bg-gray-50">
        <td class="py-3"><p class="font-medium">${request.id}</p><p class="text-cbsua-muted text-xs">${request.date}</p></td>
        <td class="py-3">${request.office}<br /><span class="text-cbsua-muted text-xs">${request.recipient}</span></td>
        <td class="py-3">${request.item}<br /><span class="text-cbsua-muted text-xs">${request.quantity} ${request.unit}</span></td>
        <td class="py-3">${request.handler}</td>
        <td class="py-3"><span class="badge rounded-full px-2 py-0.5 text-xs font-medium ${getStatusClass(request.status)}">${request.status}</span></td>
        <td class="py-3">${request.status === 'Pending' ? `<button data-review-request="${request.id}" class="text-cbsua-primary hover:underline">Review →</button>` : '<span class="text-cbsua-muted">No action</span>'}</td>
      </tr>
    `).join('');

    table.querySelectorAll('[data-review-request]').forEach(button => {
      button.addEventListener('click', () => {
        const request = state.requests.find(entry => entry.id === button.dataset.reviewRequest);
        if (!request) return;
        const summary = document.querySelector('#request-review-summary');
        if (summary) {
          summary.innerHTML = `
            <h5 class="font-semibold mb-2">Selected request</h5>
            <p class="text-sm"><strong>${request.id}</strong> — ${request.item}</p>
            <p class="text-xs text-cbsua-muted mt-1">${request.office} · ${request.recipient} · ${request.quantity} ${request.unit}</p>
            <div class="mt-4 flex gap-3">
              <button data-approve-request="${request.id}" class="px-3 py-2 bg-green-700 text-white rounded-lg text-sm">Approve</button>
              <button data-reject-request="${request.id}" class="px-3 py-2 border border-red-300 text-red-600 rounded-lg text-sm">Reject</button>
            </div>
          `;
          const approve = summary.querySelector('[data-approve-request]');
          const reject = summary.querySelector('[data-reject-request]');
          approve?.addEventListener('click', () => { updateRequestStatus(request.id, 'Approved'); renderRequestPage(); showToast('Request approved'); });
          reject?.addEventListener('click', () => { updateRequestStatus(request.id, 'Rejected'); renderRequestPage(); showToast('Request rejected'); });
        }
      });
    });
  }

  function bindCommonForms() {
    const loginForm = document.querySelector('#loginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', function (event) {
        event.preventDefault();
        const username = document.querySelector('#username').value.trim();
        const password = document.querySelector('#password').value.trim();
        const selectedRole = document.querySelector('input[name="role"]:checked')?.value || 'staff';
        const state = ensureSeed();
        const user = state.users.find(entry => entry.username.toLowerCase() === username.toLowerCase() && entry.password === password && entry.role === selectedRole);
        if (!user) {
          showToast('Incorrect credentials for the selected role.');
          return;
        }
        setCurrentUser(user);
        window.location.href = user.role === 'admin' ? 'dashboard.html' : 'inventory.html';
      });
    }

    const itemForm = document.querySelector('#itemForm');
    if (itemForm) {
      itemForm.addEventListener('submit', function (event) {
        event.preventDefault();
        const state = getState();
        const item = {
          id: nextId('ITM-', state.items),
          name: document.querySelector('#itemName').value.trim(),
          category: document.querySelector('#itemCategory').value.trim(),
          quantity: Number(document.querySelector('#itemQuantity').value || 0),
          unit: document.querySelector('#itemUnit').value.trim(),
          supplier: document.querySelector('#itemSupplier').value.trim(),
          minimum: Number(document.querySelector('#itemMinimum').value || 0),
          status: Number(document.querySelector('#itemQuantity').value || 0) <= Number(document.querySelector('#itemMinimum').value || 0) ? 'Low stock' : 'In stock',
          location: document.querySelector('#itemLocation').value.trim() || 'Main store'
        };
        if (!item.name || !item.category) {
          showToast('Provide the item name and category.');
          return;
        }
        state.items.push(item);
        saveState(state);
        itemForm.reset();
        document.querySelector('#itemModal')?.classList.add('hidden');
        renderInventoryPage();
        showToast('New item added successfully.');
      });
    }

    const receiveForm = document.querySelector('#receiveForm');
    if (receiveForm) {
      receiveForm.addEventListener('submit', function (event) {
        event.preventDefault();
        const state = getState();
        const itemId = document.querySelector('#receiveItem').value;
        const quantity = Number(document.querySelector('#receiveQuantity').value || 0);
        const item = state.items.find(entry => entry.id === itemId);
        if (!item || quantity <= 0) {
          showToast('Choose a valid item and quantity.');
          return;
        }
        const receipt = {
          id: `RCV-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`,
          itemId,
          itemName: item.name,
          quantity,
          unit: item.unit,
          supplier: document.querySelector('#receiveSupplier').value || item.supplier,
          receivedBy: getCurrentUser()?.name || 'Staff',
          receivedDate: document.querySelector('#receiveDate').value || new Date().toISOString().slice(0, 10),
          createdAt: new Date().toISOString()
        };
        state.receipts.push(receipt);
        item.quantity += quantity;
        item.status = item.quantity <= 0 ? 'Out of stock' : item.quantity <= item.minimum ? 'Low stock' : 'In stock';
        saveState(state);
        receiveForm.reset();
        showToast('Receiving entry saved.');
        window.location.href = 'inventory.html';
      });
    }

    const issueForm = document.querySelector('#issueForm');
    if (issueForm) {
      issueForm.addEventListener('submit', function (event) {
        event.preventDefault();
        const state = getState();
        const requestId = document.querySelector('#issueRequest').value;
        const itemId = document.querySelector('#issueItem').value;
        const quantity = Number(document.querySelector('#issueQuantity').value || 0);
        const item = state.items.find(entry => entry.id === itemId);
        if (!item || quantity <= 0) {
          showToast('Choose a valid request and quantity.');
          return;
        }
        const issuance = {
          id: `ISS-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`,
          itemId,
          itemName: item.name,
          quantity,
          unit: item.unit,
          office: document.querySelector('#issueOffice').value || 'Office',
          recipient: document.querySelector('#issueRecipient').value || 'Employee',
          handledBy: getCurrentUser()?.name || 'Head',
          date: document.querySelector('#issueDate').value || new Date().toISOString().slice(0, 10),
          requestId,
          createdAt: new Date().toISOString()
        };
        state.issuances.push(issuance);
        item.quantity = Math.max(0, item.quantity - quantity);
        item.status = item.quantity <= 0 ? 'Out of stock' : item.quantity <= item.minimum ? 'Low stock' : 'In stock';
        const request = state.requests.find(entry => entry.id === requestId);
        if (request) request.status = 'Issued';
        saveState(state);
        issueForm.reset();
        showToast('Items issued successfully.');
        window.location.href = 'stock_request.html';
      });
    }

    const supplierForm = document.querySelector('#supplierForm');
    if (supplierForm) {
      supplierForm.addEventListener('submit', function (event) {
        event.preventDefault();
        const state = getState();
        const supplier = {
          id: nextId('SUP-', state.suppliers, 3),
          name: document.querySelector('#supplierName').value.trim(),
          category: document.querySelector('#supplierCategory').value.trim(),
          contact: document.querySelector('#supplierContact').value.trim(),
          phone: document.querySelector('#supplierPhone').value.trim(),
          email: document.querySelector('#supplierEmail').value.trim(),
          address: document.querySelector('#supplierAddress').value.trim(),
          items: 0,
          deliveries: 0
        };
        state.suppliers.push(supplier);
        saveState(state);
        supplierForm.reset();
        document.querySelector('#supplierModal')?.classList.add('hidden');
        renderSuppliersPage();
        showToast('Supplier saved.');
      });
    }
  }

  function populateItemSelects() {
    const state = ensureSeed();
    const selectors = document.querySelectorAll('[data-item-select]');
    selectors.forEach(select => {
      select.innerHTML = state.items.map(item => `<option value="${item.id}">${item.id} — ${item.name} (${item.quantity} ${item.unit} available)</option>`).join('');
    });

    const supplierSelect = document.querySelector('#receiveSupplier');
    if (supplierSelect) {
      supplierSelect.innerHTML = state.suppliers.map(supplier => `<option value="${supplier.name}">${supplier.id} — ${supplier.name}</option>`).join('');
    }

    const requestSelect = document.querySelector('#issueRequest');
    if (requestSelect) {
      requestSelect.innerHTML = state.requests.filter(item => item.status === 'Approved').map(item => `<option value="${item.id}">${item.id} — ${item.item}</option>`).join('') || '<option value="">No approved requests</option>';
    }
  }

  function bindPageActions() {
    document.querySelectorAll('[data-open-modal]').forEach(button => {
      button.addEventListener('click', () => {
        const target = document.querySelector(button.dataset.openModal || '#itemModal');
        if (target) target.classList.remove('hidden');
      });
    });
    document.querySelectorAll('[data-close-modal]').forEach(button => {
      button.addEventListener('click', () => {
        const target = button.closest('.fixed');
        if (target) target.classList.add('hidden');
      });
    });
    document.querySelector('[data-logout]')?.addEventListener('click', logout);
  }

  document.addEventListener('DOMContentLoaded', function () {
    ensureSeed();
    populateItemSelects();
    bindPageActions();
    applyAuthState();
    bindCommonForms();

    const page = document.body.dataset.page;
    if (page === 'admin-dashboard') renderAdminDashboard();
    if (page === 'staff-inventory') renderInventoryPage();
    if (page === 'admin-requests') renderRequestPage();
    if (page === 'supplier-directory') renderSuppliersPage();
    if (page === 'admin-dashboard' || page === 'staff-inventory' || page === 'supplier-directory') {
      const currentUser = getCurrentUser();
      if (!currentUser) window.location.href = 'index.html';
    }
  });

  window.CBSUA = {
    getState,
    saveState,
    ensureSeed,
    getCurrentUser,
    setCurrentUser,
    logout,
    showToast,
    nextId,
    updateRequestStatus,
    saveNewItem,
    saveReceipt,
    saveIssuance,
    renderAdminDashboard,
    renderInventoryPage,
    renderRequestPage,
    renderSuppliersPage
  };
})();
