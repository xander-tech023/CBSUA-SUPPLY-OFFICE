window.IMS.pageFeatures.push(() => {
  const { getLocalRecords } = window.IMS;
  const table = document.querySelector('#itemTableBody');
  if (!table) return;

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
  emptyCell.colSpan = 7;
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
  const supplierSelect = document.querySelectorAll('#addItemForm select')[1];
  const card = table.closest('.stat-card');
  const pagination = card?.querySelector('.flex.gap-2');
  const summary = card?.querySelector('p');
  const pageSummary = card?.querySelector('.flex.justify-between > p');
  const pageSize = 3;
  let currentPage = 1;
  let statusFilter = '';

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

  function refreshSuppliers() {
    if (!supplierSelect) return;
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

  search?.addEventListener('input', update);
  selects.forEach(select => select.addEventListener('change', update));
  window.addEventListener('ims:records-updated', update);
  window.addEventListener('ims:records-updated', refreshSuppliers);
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
  update();
});
