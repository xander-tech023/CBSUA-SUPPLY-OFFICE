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
  const categorySelect = document.querySelectorAll('#addItemForm select')[0];
  const categoryFilter = selects[0];
  const categoryModal = document.querySelector('#addCategoryModal');
  const categoryForm = document.querySelector('#addCategoryForm');
  const categoryNameInput = document.querySelector('#categoryName');
  const categoryStorageKey = 'cbsuaSupplyCategories';
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
    try {
      const categories = JSON.parse(localStorage.getItem(categoryStorageKey) || '[]');
      if (!Array.isArray(categories) || categories.some(category =>
        !category || typeof category.id !== 'string' || typeof category.name !== 'string')) {
        throw new Error('Saved item categories have an invalid format.');
      }
      savedCategories = categories;
      savedCategories.forEach(addCategoryOption);
    } catch (error) {
      console.error('Item categories could not be loaded.', error);
      window.IMS.showToast('Saved item categories could not be loaded.');
    }
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
  categoryModal.addEventListener('click', event => {
    if (event.target === categoryModal) closeCategoryModal();
  });
  categoryNameInput.addEventListener('input', validateCategoryName);
  categoryForm.addEventListener('submit', event => {
    event.preventDefault();
    event.stopPropagation();
    if (!validateCategoryName() || !categoryForm.reportValidity()) return;

    const name = categoryNameInput.value.trim();
    const categoryNumber = Math.max(0, ...[...categorySelect.options].map(option =>
      Number(option.textContent.match(/^CAT-(\d+)/)?.[1]) || 0)) + 1;
    const category = { id: `CAT-${String(categoryNumber).padStart(3, '0')}`, name };
    try {
      localStorage.setItem(categoryStorageKey, JSON.stringify([...savedCategories, category]));
    } catch (error) {
      console.error('The item category could not be saved.', error);
      window.IMS.showToast('The item category could not be saved in this browser.');
      return;
    }

    savedCategories.push(category);
    addCategoryOption(category);
    categorySelect.value = name;
    closeCategoryModal();
    window.IMS.showToast(`${name} added successfully.`);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !categoryModal.classList.contains('hidden')) {
      closeCategoryModal();
    }
  });
  refreshSuppliers();
  update();
});
