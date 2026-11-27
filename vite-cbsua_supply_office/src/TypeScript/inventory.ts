window.IMS.pageFeatures.push(() => {
  const { getLocalRecords } = window.IMS;
  const table = document.querySelector('#itemTableBody');
  if (!table) return;
  const movementCanvas = document.getElementById('inventoryMovementChart');
  const movementItemFilter = document.getElementById('inventoryMovementItem');
  const movementDescription = document.getElementById('inventoryMovementDescription');
  const demandSummary = document.getElementById('inventoryDemandSummary');
  const requestedTotal = document.getElementById('inventoryRequestedTotal');
  const issuedTotal = document.getElementById('inventoryIssuedTotal');
  const receivedTotal = document.getElementById('inventoryReceivedTotal');
  let movementChart = null;
  let chartUnavailableMessageShown = false;

  const createElement = (tag, className = '', text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };
  const emptyRow = createElement('tr');
  emptyRow.dataset.emptyState = 'true';
  emptyRow.hidden = true;
  const emptyCell = createElement('td', 'py-8 text-center text-cbsua-muted');
  emptyCell.colSpan = 8;
  const resetButton = createElement('button', 'mt-3 text-cbsua-primary underline', 'Reset filters');
  resetButton.type = 'button';
  resetButton.dataset.resetInventorySearch = '';
  emptyCell.append(createElement('p', '', 'No items found matching your search.'), resetButton);
  emptyRow.append(emptyCell);
  table.append(emptyRow);

  const search = document.querySelector('#searchInput');
  const selects = [...document.querySelectorAll('main select')].slice(0, 2);
  const filterButtons = [...document.querySelectorAll('main button')]
    .filter(button => /^(All items|In stock|Low stock|Out of stock|Expiring soon)/.test(button.textContent.trim()));
  const categorySelect = document.querySelectorAll('#addItemForm select')[0];
  const categoryFilter = selects[0];
  const categoryModal = document.querySelector('#addCategoryModal');
  const categoryForm = document.querySelector('#addCategoryForm');
  const categoryNameInput = document.querySelector('#categoryName');
  let savedCategories = [];
  let categoryModalOpener = null;
  const supplierSelect = document.querySelectorAll('#addItemForm select')[1];
  const supplierFilter = selects[1];
  const card = table.closest('.stat-card');
  const pagination = card?.querySelector('.flex.gap-2');
  const summary = card?.querySelector('p');
  const pageSummary = card?.querySelector('.flex.justify-between > p');
  const pageSize = 3;
  let currentPage = 1;
  let statusFilter = '';

  function getCategoryName(option) {
    return option.textContent.split(' — ').slice(1).join(' — ') || option.textContent;
  }

  function addCategoryOption(category) {
    if ([...categorySelect.options].some(option =>
      getCategoryName(option).toLowerCase() === category.name.toLowerCase())) return;
    const itemOption = document.createElement('option');
    itemOption.value = category.name;
    itemOption.textContent = `${category.id} — ${category.name}`;
    categorySelect.append(itemOption);

    const filterOption = document.createElement('option');
    filterOption.value = category.name;
    filterOption.textContent = category.name;
    categoryFilter.append(filterOption);
  }

  function loadCategories() {
    [...categoryFilter.options].slice(1).forEach(option => {
      option.value = getCategoryName(option);
    });
    savedCategories = getLocalRecords('categories');
    savedCategories.forEach(addCategoryOption);
  }

  function validateCategoryName() {
    const name = categoryNameInput.value.trim();
    let message = '';
    if (!name) message = 'Enter a category name.';
    else if (name.length < 2) message = 'Category names must contain at least 2 characters.';
    else if (name.length > 50) message = 'Category names must contain no more than 50 characters.';
    else if ([...categorySelect.options].some(option =>
      getCategoryName(option).toLowerCase() === name.toLowerCase())) {
      message = 'This category already exists.';
    }
    categoryNameInput.setCustomValidity(message);
    return !message;
  }

  function openCategoryModal(opener) {
    categoryModalOpener = opener || document.activeElement;
    categoryModal.classList.remove('hidden');
    categoryModal.querySelector('.rounded-xl').setAttribute('role', 'dialog');
    categoryModal.querySelector('.rounded-xl').setAttribute('aria-modal', 'true');
    categoryNameInput.focus();
  }

  function closeCategoryModal() {
    categoryModal.classList.add('hidden');
    categoryForm.reset();
    categoryNameInput.setCustomValidity('');
    categoryModalOpener?.focus();
  }

  function renderPage() {
    const rows = [...table.rows].filter(row => row.dataset.emptyState !== 'true');
    const matchingRows = rows.filter(row => row.dataset.filteredOut !== 'true');
    emptyRow.hidden = matchingRows.length !== 0;
    const pageCount = Math.max(1, Math.ceil(matchingRows.length / pageSize));
    currentPage = Math.min(currentPage, pageCount);
    matchingRows.forEach((row, index) => {
      row.hidden = index < (currentPage - 1) * pageSize || index >= currentPage * pageSize;
    });

    const firstItem = matchingRows.length ? (currentPage - 1) * pageSize + 1 : 0;
    const lastItem = Math.min(currentPage * pageSize, matchingRows.length);
    if (summary) {
      const currentDate = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date());
      summary.textContent = `${matchingRows.length} catalog records · balances updated ${currentDate}`;
    }
    if (pageSummary) pageSummary.textContent = `Showing ${firstItem}–${lastItem} of ${matchingRows.length} items`;
    pagination?.querySelectorAll('button').forEach(button => {
      const label = button.textContent.trim();
      const page = Number(label);
      if (label === 'Previous') button.disabled = currentPage === 1;
      else if (label === 'Next') button.disabled = currentPage === pageCount;
      else if (Number.isInteger(page)) {
        button.hidden = page > pageCount;
        button.classList.toggle('bg-cbsua-primary', page === currentPage);
        button.classList.toggle('text-white', page === currentPage);
      }
    });
  }

  function update() {
    currentPage = 1;
    const term = search?.value.trim().toLowerCase() || '';
    const category = selects[0]?.selectedIndex > 0 ? selects[0].value : '';
    const supplier = selects[1]?.selectedIndex > 0 ? selects[1].value : '';
    [...table.rows].filter(row => row.dataset.emptyState !== 'true').forEach(row => {
      const cells = row.cells;
      const status = cells[5]?.innerText.toLowerCase() || '';
      const matchesStatus = !statusFilter
        || (statusFilter === 'low stock'
          ? status.includes('low stock') || status.includes('low expiring')
          : statusFilter === 'expiring soon'
            ? status.includes('expiring')
            : status.includes(statusFilter));
      row.dataset.filteredOut = String(!(row.innerText.toLowerCase().includes(term)
        && (!category || cells[1]?.innerText.includes(category))
        && (!supplier || cells[4]?.innerText.includes(supplier))
        && matchesStatus));
      row.hidden = row.dataset.filteredOut === 'true';
    });

    filterButtons.forEach(button => {
      const label = button.textContent.split('·')[0].trim();
      const count = [...table.rows].filter(row => {
        if (row.dataset.emptyState === 'true') return false;
        const status = row.cells[5]?.innerText.toLowerCase() || '';
        if (label === 'All items') return true;
        if (label === 'Low stock') return status.includes('low');
        if (label === 'Expiring soon') return status.includes('expiring');
        return status.includes(label.toLowerCase());
      }).length;
      button.textContent = `${label} · ${count}`;
    });
    renderPage();
    document.querySelector('#searchSuggestions')?.classList.add('hidden');
  }

  function getMovementData(items, itemId) {
    const selectedItem = items.find(item => item.id === itemId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = Array.from({ length: 30 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - 29 + index);
      return date;
    });
    const keyFor = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const totals = Object.fromEntries(days.map(date => [keyFor(date), { requested: 0, issued: 0, received: 0 }]));
    const addTotals = (records, type, dateField) => records.forEach(record => {
      if (!itemId || record.itemId !== itemId) return;
      const value = record[dateField] || record.createdAt;
      if (!value) return;
      let dateKey;
      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
        dateKey = value.slice(0, 10);
      } else {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return;
        dateKey = keyFor(date);
      }
      if (!totals[dateKey]) return;
      const quantity = Number.parseFloat(String(record.quantity));
      if (Number.isFinite(quantity) && quantity > 0) totals[dateKey][type] += quantity;
    });
    addTotals(getLocalRecords('requests'), 'requested', 'date');
    addTotals(getLocalRecords('issuances'), 'issued', 'date');
    addTotals(getLocalRecords('receipts'), 'received', 'receivedDate');

    return {
      selectedItem,
      labels: days.map(date => new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short' }).format(date)),
      requested: days.map(date => totals[keyFor(date)].requested),
      issued: days.map(date => totals[keyFor(date)].issued),
      received: days.map(date => totals[keyFor(date)].received),
      totalRequested: days.reduce((sum, date) => sum + totals[keyFor(date)].requested, 0),
      totalIssued: days.reduce((sum, date) => sum + totals[keyFor(date)].issued, 0),
      totalReceived: days.reduce((sum, date) => sum + totals[keyFor(date)].received, 0)
    };
  }

  function getDemandStatuses(items) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 29);
    const counts = new Map(items.map(item => [item.id, 0]));
    getLocalRecords('requests').forEach(request => {
      if (!counts.has(request.itemId)) return;
      const value = request.date || request.createdAt;
      if (!value) return;
      const dateParts = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
      const requestDate = dateParts
        ? new Date(Number(dateParts[1]), Number(dateParts[2]) - 1, Number(dateParts[3]))
        : new Date(value);
      if (Number.isNaN(requestDate.getTime())) return;
      requestDate.setHours(0, 0, 0, 0);
      if (requestDate < startDate || requestDate > today) return;
      counts.set(request.itemId, counts.get(request.itemId) + 1);
    });

    return counts;
  }

  function refreshDemandStatuses() {
    const items = getLocalRecords('items');
    const counts = getDemandStatuses(items);
    const highestCount = Math.max(0, ...counts.values());
    items.forEach(item => {
      const count = counts.get(item.id) || 0;
      const row = [...table.rows].find(candidate => candidate.dataset.itemId === item.id);
      const cell = row?.cells[6];
      if (!cell) return;

      const label = count === 0
        ? 'No recent demand'
        : count === highestCount
          ? 'High demand'
          : 'Some demand';
      const badgeClass = count === 0
        ? 'badge rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600'
        : count === highestCount
          ? 'badge rounded-full px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-800'
          : 'badge rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700';
      const requestText = `${count} ${count === 1 ? 'request' : 'requests'}`;
      const badge = createElement('span', badgeClass, `${label} · ${requestText}`);
      badge.setAttribute('aria-label', `${item.name}: ${label}, ${requestText} in the last 30 days`);
      cell.replaceChildren(badge);
    });

    if (!demandSummary) return;
    if (highestCount === 0) {
      demandSummary.textContent = 'No inventory items had requests in the last 30 days.';
      return;
    }
    const highestDemandItems = items
      .filter(item => counts.get(item.id) === highestCount)
      .map(item => `${item.name} (${item.id})`);
    demandSummary.textContent = `High demand: ${highestDemandItems.join(', ')} · ${highestCount} ${highestCount === 1 ? 'request' : 'requests'} each`;
  }

  function refreshMovementChart() {
    if (!movementItemFilter) return;
    const items = getLocalRecords('items');
    const previousValue = movementItemFilter.value;
    movementItemFilter.replaceChildren();
    items.forEach(item => {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = `${item.name} (${item.id})`;
      movementItemFilter.append(option);
    });
    if (items.length) {
      movementItemFilter.value = items.some(item => item.id === previousValue)
        ? previousValue
        : items[0].id;
      movementItemFilter.disabled = false;
    } else {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No inventory items';
      movementItemFilter.append(option);
      movementItemFilter.disabled = true;
    }

    const data = getMovementData(items, movementItemFilter.value);
    const unit = data.selectedItem?.unit ? ` ${data.selectedItem.unit}` : '';
    if (movementDescription) {
      movementDescription.textContent = data.selectedItem
        ? `${data.selectedItem.name} · requested, issued, and received quantities over the last 30 days`
        : 'No inventory items are available to analyze.';
    }
    if (requestedTotal) requestedTotal.textContent = `${data.totalRequested.toLocaleString()}${unit}`;
    if (issuedTotal) issuedTotal.textContent = `${data.totalIssued.toLocaleString()}${unit}`;
    if (receivedTotal) receivedTotal.textContent = `${data.totalReceived.toLocaleString()}${unit}`;
    if (!movementCanvas) return;

    if (!window.Chart) {
      if (!chartUnavailableMessageShown) {
        const message = createElement('p', 'text-sm text-cbsua-muted', 'Movement trend chart is unavailable offline.');
        movementCanvas.replaceWith(message);
        chartUnavailableMessageShown = true;
      }
      return;
    }

    if (!movementChart) {
      movementChart = new Chart(movementCanvas, {
        type: 'line',
        data: {
          labels: data.labels,
          datasets: [
            {
              label: 'Requested (demand)',
              data: data.requested,
              borderColor: '#d97706',
              backgroundColor: '#d97706',
              tension: 0.25,
              pointRadius: 2
            },
            {
              label: 'Issued (fulfilled)',
              data: data.issued,
              borderColor: '#166534',
              backgroundColor: '#166534',
              tension: 0.25,
              pointRadius: 2
            },
            {
              label: 'Received (supply)',
              data: data.received,
              borderColor: '#2563eb',
              backgroundColor: '#2563eb',
              tension: 0.25,
              pointRadius: 2
            }
          ]
        },
        options: {
          responsive: true,
          interaction: { mode: 'index', intersect: false },
          plugins: { tooltip: { mode: 'index', intersect: false } },
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: data.selectedItem?.unit ? `Quantity (${data.selectedItem.unit})` : 'Quantity'
              },
              grid: { display: false }
            },
            x: { grid: { display: false } }
          }
        }
      });
      return;
    }

    movementChart.data.labels = data.labels;
    movementChart.data.datasets[0].data = data.requested;
    movementChart.data.datasets[1].data = data.issued;
    movementChart.data.datasets[2].data = data.received;
    movementChart.options.scales.y.title.text = data.selectedItem?.unit
      ? `Quantity (${data.selectedItem.unit})`
      : 'Quantity';
    movementChart.update();
  }

  movementItemFilter?.addEventListener('change', refreshMovementChart);

  function refreshSuppliers() {
    if (supplierSelect) {
      const previousValue = supplierSelect.value;
      supplierSelect.replaceChildren();
      getLocalRecords('suppliers').forEach(supplier => {
        const option = document.createElement('option');
        option.value = supplier.id;
        option.textContent = `${supplier.id} — ${supplier.name}`;
        supplierSelect.append(option);
      });
      if ([...supplierSelect.options].some(option => option.value === previousValue)) {
        supplierSelect.value = previousValue;
      }
    }

    if (!supplierFilter) return;
    const previousFilter = supplierFilter.value;
    supplierFilter.replaceChildren();
    const allOption = document.createElement('option');
    allOption.textContent = 'All suppliers';
    supplierFilter.append(allOption);
    getLocalRecords('suppliers').forEach(supplier => {
      const option = document.createElement('option');
      option.textContent = `${supplier.id} — ${supplier.name}`;
      option.value = supplier.name;
      supplierFilter.append(option);
    });
    if ([...supplierFilter.options].some(option => option.value === previousFilter)) {
      supplierFilter.value = previousFilter;
    }
  }

  search?.addEventListener('input', update);
  selects.forEach(select => select.addEventListener('change', update));
  window.addEventListener('ims:records-updated', update);
  window.addEventListener('ims:records-updated', refreshSuppliers);
  window.addEventListener('ims:records-updated', refreshMovementChart);
  window.addEventListener('ims:records-updated', refreshDemandStatuses);
  filterButtons.forEach(button => button.addEventListener('click', () => {
    const label = button.textContent.split('·')[0].trim();
    statusFilter = label === 'All items' ? '' : label.toLowerCase();
    filterButtons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    update();
  }));
  pagination?.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button || button.disabled) return;
    const label = button.textContent.trim();
    if (label === 'Previous') currentPage--;
    else if (label === 'Next') currentPage++;
    else if (Number.isInteger(Number(label))) currentPage = Number(label);
    renderPage();
  });
  resetButton.addEventListener('click', () => {
    if (search) search.value = '';
    selects.forEach(select => { select.selectedIndex = 0; });
    statusFilter = '';
    update();
    refreshSuppliers();
  });
  loadCategories();
  document.querySelector('[data-open-category-modal]')?.addEventListener('click', event => {
    event.stopPropagation();
    openCategoryModal(event.currentTarget);
  });
  categoryModal.querySelectorAll('[data-close-category-modal]').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      closeCategoryModal();
    });
  });
  categoryNameInput.addEventListener('input', validateCategoryName);
  categoryForm.addEventListener('submit', async event => {
    event.preventDefault();
    event.stopPropagation();
    if (!validateCategoryName() || !categoryForm.reportValidity()) return;

    const name = categoryNameInput.value.trim();
    const category = await window.IMS.saveRecord('categories', { name });
    if (!category) return;
    loadCategories();
    addCategoryOption(category);
    categorySelect.value = name;
    closeCategoryModal();
    window.IMS.showToast(`${name} added successfully.`);
  });
  window.addEventListener('ims:records-updated', loadCategories);
  refreshSuppliers();
  update();
  refreshMovementChart();
  refreshDemandStatuses();
});
