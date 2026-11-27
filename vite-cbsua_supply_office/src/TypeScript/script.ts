const currentPage = location.pathname.split('/').pop() || 'index.html';
window.IMS = window.IMS || {};
window.IMS.pageFeatures = window.IMS.pageFeatures || [];
try {
  const savedPreferences = JSON.parse(localStorage.getItem('cbsuaSupplyPreferences')) || {};
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = savedPreferences.theme === 'dark' ||
    (savedPreferences.theme !== 'light' && systemDark);
  document.documentElement.classList.toggle('dark', isDark);
} catch {
  // Let the regular preference initializer handle invalid or unavailable storage.
}
window.tailwind = window.tailwind || {};
window.tailwind.config = {
  darkMode: 'class',
  theme: { extend: {
    colors: {
      'cbsua-dark': '#084236',
      'cbsua-primary': '#166534',
      'cbsua-light': '#E8F5E9',
      'cbsua-pale': '#F0F7F0',
      'cbsua-gold': '#D4AF37',
      'cbsua-muted': '#6B7280',
      'cbsua-border': '#E5E7EB',
      'cbsua-warning': '#FFFBEB',
      'cbsua-danger': '#FEF2F2'
    },
    fontFamily: { sans: ['system-ui', 'sans-serif'] }
  } }
};
document.addEventListener('DOMContentLoaded', async () => {
  if (currentPage === 'index.html' || currentPage === 'navigation.html'
    || currentPage === 'asset_scanner.html') return;

  let currentUser;
  try {
    currentUser = await window.IMS.accounts.getSession();
    if (!currentUser) {
      window.location.replace('index.html');
      return;
    }
    await window.IMS.initializeRecords();
    await window.IMS.accounts.initialize(currentUser);
    window.dispatchEvent(new CustomEvent('ims:records-updated'));
  } catch (error) {
    console.error('The workspace could not be initialized.', error);
    const message = document.createElement('p');
    message.className = 'mx-auto mt-12 max-w-xl rounded-lg bg-red-50 p-5 text-red-800';
    message.textContent = 'Could not connect to the database-backed workspace. Check that PostgreSQL and the API are running, then reload this page.';
    document.body.replaceChildren(message);
    return;
  }
  const roleHome = currentUser?.role === 'admin'
    ? 'dashboard.html'
    : currentUser?.role === 'end-user'
      ? 'end_user_dashboard.html'
      : 'inventory.html';
  if (currentUser.role === 'end-user' && currentPage !== 'end_user_dashboard.html') {
    window.location.replace(roleHome);
    return;
  }
  if (currentPage === 'end_user_dashboard.html' && currentUser.role !== 'end-user') {
    window.location.replace(roleHome);
    return;
  }
  if (currentPage === 'dashboard.html' && !['admin', 'staff'].includes(currentUser.role)) {
    window.location.replace(roleHome);
    return;
  }
  window.IMS.currentUser = currentUser;
  window.dispatchEvent(new CustomEvent('ims:current-user-ready', { detail: currentUser }));

  const {
    getLocalRecords, saveRecord, updateRequestStatus, updateInventoryItem, updateSupplier, addInventoryRow,
    addRequestRow, addSupplierCard, nextRecordId, nextRequestId
  } = window.IMS;
  function getRequestPeriod(value) {
    let date;
    const dateMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
    if (dateMatch) {
      date = new Date(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3]));
    } else {
      date = new Date(value);
    }
    if (Number.isNaN(date.getTime())) return null;
    return {
      year: date.getFullYear(),
      quarter: Math.floor(date.getMonth() / 3) + 1
    };
  }
  function getRequestQuantity(quantity) {
    const match = /^\s*(\d+)(?:\s|$)/.exec(String(quantity || ''));
    if (!match) return 0;
    const value = Number(match[1]);
    return Number.isSafeInteger(value) ? value : 0;
  }
  function getQuarterlyRequestLimitRemaining(
    itemId, officeName, excludedRequestId = '', referenceDate = new Date()
  ) {
    const period = getRequestPeriod(referenceDate);
    if (!period || !officeName) return 0;
    const quota = getLocalRecords('officeQuotas').find(entry =>
      String(entry.itemId) === String(itemId)
      && String(entry.office || '').trim().toLowerCase() === String(officeName).trim().toLowerCase()
      && Number(entry.year) === period.year);
    if (!quota) return 0;
    const quarterIndex = period.quarter - 1;
    let quarterUsed = Number(quota.quarterUsage[quarterIndex]) || 0;
    let annualUsed = Number(quota.annualUsed) || 0;
    if (excludedRequestId) {
      const request = getLocalRecords('requests').find(entry => String(entry.id) === String(excludedRequestId));
      const requestPeriod = getRequestPeriod(request?.createdAt || request?.date);
      if (request && String(request.itemId) === String(itemId)
        && String(request.office || '').trim().toLowerCase() === String(officeName).trim().toLowerCase()
        && requestPeriod?.year === period.year) {
        const excludedQuantity = getRequestQuantity(request.quantity);
        annualUsed = Math.max(0, annualUsed - excludedQuantity);
        if (requestPeriod.quarter === period.quarter) {
          quarterUsed = Math.max(0, quarterUsed - excludedQuantity);
        }
      }
    }
    const quarterRemaining = Number(quota.quarterLimits[quarterIndex]) - quarterUsed;
    const annualRemaining = Number(quota.annualLimit) - annualUsed;
    return Math.max(0, Math.min(quarterRemaining, annualRemaining));
  }
  function updateRequestLimitHint() {
    const requestForm = document.querySelector('#requestForm');
    const limitHint = requestForm?.querySelector('[data-quarterly-request-limit]');
    if (!requestForm || !limitHint) return;
    const itemId = requestForm.querySelector('#requestItem')?.value;
    const item = getLocalRecords('items').find(entry => String(entry.id) === String(itemId));
    const officeName = requestForm.querySelector('#requestOffice')?.value;
    if (!item || !officeName) {
      limitHint.textContent = 'Quarterly request limits are assigned by the administrator for each office and item.';
      return;
    }
    const editingRequest = getLocalRecords('requests')
      .find(request => request.id === requestForm.dataset.editingRequest);
    const period = getRequestPeriod(editingRequest?.createdAt || new Date());
    const quota = getLocalRecords('officeQuotas').find(entry =>
      String(entry.itemId) === String(item.id)
      && String(entry.office || '').trim().toLowerCase() === officeName.trim().toLowerCase()
      && Number(entry.year) === period?.year);
    if (!quota) {
      limitHint.textContent = `No ${period?.year || ''} request allocation has been assigned to ${officeName} for ${item.name}.`;
      return;
    }
    const remaining = getQuarterlyRequestLimitRemaining(
      item.id, officeName, editingRequest?.id || '', editingRequest?.createdAt || new Date()
    );
    const quarter = period?.quarter || 1;
    const quarterLimit = Number(quota.quarterLimits[quarter - 1]) || 0;
    const quarterUsed = Number(quota.quarterUsage[quarter - 1]) || 0;
    limitHint.textContent = `Q${quarter}: ${quarterUsed}/${quarterLimit} ${item.unit} used · ${remaining} ${item.unit} remain this quarter. Annual allocation: ${quota.annualUsed}/${quota.annualLimit} ${item.unit}. Pending, approved, and issued requests count.`;
  }
  const modalId = {
    'inventory.html': 'addItemModal',
    'stock_request.html': 'requestModal',
    'end_user_dashboard.html': 'requestModal',
    'suppliers.html': 'supplierModal'
  }[currentPage];
  const pageModal = modalId ? document.getElementById(modalId) : null;
  const requestClassifications = {
    consumable: {
      label: 'Consumable',
      documentType: 'RIS',
      documentName: 'Requisition and Issue Slip'
    },
    'semi-expendable': {
      label: 'Semi-expendable',
      documentType: 'ICS',
      documentName: 'Inventory Custodian Slip'
    },
    'fixed-asset': {
      label: 'Fixed Asset',
      documentType: 'PAR',
      documentName: 'Property Acknowledgment Receipt'
    }
  };
  let modalOpener = null;
  let previousBodyOverflowY = '';
  function resetRequestClassification(form) {
    if (!form) return;
    form.hidden = true;
    delete form.dataset.supplyClassification;
    window.dispatchEvent(new CustomEvent('ims:request-classification-changed'));
    form.querySelector('#requestSupplyClassification').value = '';
    form.querySelector('#requestFormDocumentType').value = '';
    form.querySelector('[data-request-form-summary]').textContent = '';
    const chooser = pageModal.querySelector('[data-request-classification-step]');
    if (chooser) chooser.hidden = false;
    const heading = pageModal.querySelector('[data-request-dialog-title]');
    if (heading) heading.textContent = heading.dataset.defaultTitle;
    form.querySelectorAll('[data-request-classification-fields]').forEach(section => {
      section.hidden = true;
      section.querySelectorAll('input, textarea, select').forEach(field => {
        field.required = false;
        field.value = '';
      });
    });
  }
  function selectRequestClassification(classificationKey) {
    const form = pageModal?.querySelector('#requestForm');
    const classification = requestClassifications[classificationKey];
    if (!form || !classification) return;
    form.dataset.supplyClassification = classificationKey;
    window.dispatchEvent(new CustomEvent('ims:request-classification-changed'));
    form.querySelector('#requestSupplyClassification').value = classification.label;
    form.querySelector('#requestFormDocumentType').value = classification.documentType;
    form.querySelector('[data-request-form-summary]').textContent =
      `${classification.label} · ${classification.documentType} — ${classification.documentName}`;
    const heading = pageModal.querySelector('[data-request-dialog-title]');
    if (heading) heading.textContent = `${form.dataset.editingRequest ? 'Edit' : 'Create'} ${classification.label} request`;
    const chooser = pageModal.querySelector('[data-request-classification-step]');
    if (chooser) chooser.hidden = true;
    form.querySelectorAll('[data-request-classification-fields]').forEach(section => {
      const active = section.dataset.requestClassificationFields === classificationKey;
      section.hidden = !active;
      section.querySelectorAll('input, textarea, select').forEach(field => {
        field.required = active && field.dataset.classificationRequired === classificationKey;
        if (!active) field.value = '';
      });
    });
    form.hidden = false;
    form.querySelector('#requestItem')?.focus();
  }
  function openModal(opener) {
    if (!pageModal) return;
    modalOpener = opener || document.activeElement;
    if (pageModal.classList.contains('hidden')) {
      previousBodyOverflowY = document.body.style.overflowY;
      document.body.style.overflowY = 'hidden';
    }
    if (pageModal.id === 'requestModal') {
      const requestForm = pageModal.querySelector('#requestForm');
      if (requestForm) {
        delete requestForm.dataset.editingRequest;
        resetRequestClassification(requestForm);
        const submitButton = requestForm.querySelector('button[type="submit"]');
        if (submitButton) submitButton.textContent = 'Submit request';
        requestForm.querySelector('#requestId').value = nextRequestId();
        const today = new Date();
        today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
        requestForm.querySelector('#requestDate').value = today.toISOString().slice(0, 10);
        if (currentUser.role === 'end-user') {
          requestForm.querySelector('#requestOffice').value = currentUser.office || '';
          requestForm.querySelector('#requestRecipient').value = currentUser.name || currentUser.username;
          requestForm.querySelector('#requestEmployeeId').value = currentUser.employeeId || '';
          requestForm.querySelector('#requestEmployeeId').readOnly = false;
        }
        const officeOverride = new URLSearchParams(location.search).get('office');
        if (officeOverride) requestForm.querySelector('#requestOffice').value = officeOverride;
        updateRequestLimitHint();
      }
    }
    if (pageModal.id === 'addItemModal' && !pageModal.querySelector('#addItemForm').dataset.editingItem) {
      const itemIdField = pageModal.querySelector('#itemInventoryId');
      itemIdField.value = nextRecordId('items', 'ITM-', 0);
      itemIdField.readOnly = true;
    }
    if (pageModal.id === 'supplierModal' && !pageModal.querySelector('#supplierForm').dataset.editingSupplier) {
      pageModal.querySelector('#supplierForm input').value = nextRecordId('suppliers', 'SUP-', 0);
    }
    pageModal.classList.remove('hidden');
    const dialog = pageModal.firstElementChild;
    if (dialog) {
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');
      dialog.setAttribute('aria-label', pageModal.querySelector('h3')?.textContent.trim() || 'Form dialog');
    }
    const initialFocus = pageModal.id === 'requestModal'
      ? pageModal.querySelector('[data-select-supply-classification]')
      : pageModal.querySelector('input:not([type="hidden"]), select, textarea, button');
    initialFocus?.focus();
  }
  function closeModal() {
    if (!pageModal) return;
    pageModal.classList.add('hidden');
    document.body.style.overflowY = previousBodyOverflowY;
    modalOpener?.focus();
  }
  function resetModalForm(form) {
    if (!form) return;
    form.reset();
    delete form.dataset.editingItem;
    delete form.dataset.editingSupplier;
    delete form.dataset.editingRequest;
    const requestSubmitButton = form.querySelector('button[type="submit"]');
    if (form.id === 'requestForm' && requestSubmitButton) {
      requestSubmitButton.textContent = 'Submit request';
    }
    const idField = form.querySelector('input');
    if (idField) idField.readOnly = form.id === 'supplierForm' || form.id === 'addItemForm';
    const heading = form.closest('.fixed')?.querySelector('h3');
    if (heading) {
      heading.textContent = form.id === 'addItemForm'
        ? 'Add a new inventory item'
        : form.id === 'supplierForm'
        ? 'Register new supplier'
          : heading.textContent;
    }
    if (form.id === 'addItemForm') {
      const quantityInput = [...form.querySelectorAll('input[type="number"]')][1];
      if (quantityInput) {
        quantityInput.readOnly = false;
        quantityInput.previousElementSibling.textContent = 'Opening quantity *';
      }
    }
  }

  // Shared IMS behavior
  (() => {
  const svgNamespace = 'http://www.w3.org/2000/svg';
  const preferenceKey = 'cbsuaSupplyPreferences', preferences = readPreferences();
  let toastTimer;
  let toastRoot;
  let toastSequence = 0;
  function createElement(tag, className = '', text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (arguments.length > 2) element.textContent = text;
    return element;
  }
  function setAttributes(element, attributes) {
    Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
  }
  function createIcon(pathData, className, circle) {
    const icon = document.createElementNS(svgNamespace, 'svg');
    setAttributes(icon, { viewBox: '0 0 24 24', class: className, fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'aria-hidden': 'true' });
    if (circle) {
      const shape = document.createElementNS(svgNamespace, 'circle');
      setAttributes(shape, { cx: circle[0], cy: circle[1], r: circle[2] });
      icon.append(shape);
    }
    const path = document.createElementNS(svgNamespace, 'path');
    setAttributes(path, { d: pathData, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    icon.append(path);
    return icon;
  }
  // Read preferences
  function readPreferences() {
    try {
      return JSON.parse(localStorage.getItem(preferenceKey)) || {};
    } catch {
      return {};
    }
  }
  function savePreferences() {
    try {
      localStorage.setItem(preferenceKey, JSON.stringify(preferences));
    } catch {
      showToast('Preferences could not be saved in this browser.');
    }
  }
  function applyPreferences() {
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = preferences.theme === 'dark' || (preferences.theme !== 'light' && systemDark);
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.style.fontSize = preferences.textSize === 'large' ? '18px' : '';
    document.documentElement.style.setProperty('--tw-duration', preferences.motion === 'reduced' ? '0ms' : '');
    document.documentElement.style.scrollBehavior = preferences.motion === 'reduced' ? 'auto' : '';
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
      const icon = isDark
        ? createIcon('M12 2.5v2.5M12 19v2.5M4.93 4.93l1.77 1.77M17.3 17.3l1.77 1.77M2.5 12h2.5M19 12h2.5M4.93 19.07l1.77-1.77M17.3 6.7l1.77-1.77', 'h-4 w-4 fill-none stroke-current stroke-[1.8]', ['12', '12', '4'])
        : createIcon('M20 14.5A7.5 7.5 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z', 'h-4 w-4 fill-none stroke-current stroke-[1.8]');
      themeToggle.replaceChildren(icon);
      themeToggle.setAttribute('aria-label', isDark ? 'Switch to light appearance' : 'Switch to dark appearance');
      themeToggle.title = isDark ? 'Switch to light appearance' : 'Switch to dark appearance';
    }
  }

  // Show notifications
  function showToast(message) {
    if (window.React && window.ReactDOM?.createRoot) {
      let mount = document.getElementById('ims-toast-root');
      if (!mount) {
        mount = createElement('div');
        mount.id = 'ims-toast-root';
        document.body.append(mount);
      }
      if (!toastRoot) toastRoot = window.ReactDOM.createRoot(mount);
      const Toast = ({ text }) => window.React.createElement(
        'div',
        { className: 'ims-toast', role: 'status', 'aria-live': 'polite' },
        text
      );
      toastRoot.render(window.React.createElement(Toast, { text: message, key: ++toastSequence }));
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toastRoot.render(null), 3200);
      return;
    }

    let toast = document.querySelector('.ims-toast');
    if (!toast) {
      toast = createElement('div', 'ims-toast');
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      document.body.append(toast);
    }
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 3200);
  }
  function applyTailwindUtilities() {
    const addClasses = (selector, classes) => document.querySelectorAll(selector).forEach(element => element.classList.add(...classes.split(' ')));
    addClasses('.upload-zone', 'cursor-pointer rounded-lg border-2 border-dashed border-cbsua-border p-6 text-center transition-colors hover:bg-cbsua-light/50');
    addClasses('body', 'dark:bg-gray-900 dark:text-gray-100');
    addClasses('.bg-white, .bg-gray-50, .bg-gray-100', 'dark:bg-gray-800 dark:text-gray-100');
    addClasses('.bg-cbsua-light, .bg-green-50, .bg-amber-50, .bg-red-50, .bg-orange-50', 'dark:bg-gray-700 dark:text-gray-100');
    addClasses('.text-cbsua-muted, .text-gray-500, .text-gray-600, .text-gray-700, .text-gray-800', 'dark:text-gray-300');
    addClasses('[class*="border-cbsua-border"]', 'dark:border-gray-700');
    addClasses('input:not([type="checkbox"]):not([type="file"]), select, textarea', 'dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100');
  }

  // Build sidebar
  function buildSidebar() {
    const sidebar = document.querySelector('aside'), main = document.querySelector('main');
    if (!sidebar || !main) return;
    const nav = sidebar.querySelector('nav') || createElement('nav');
    const currentPage = location.pathname.split('/').pop() || 'dashboard.html';
    nav.className = 'flex-1 min-h-0 overflow-hidden';
    let officesLink = nav.querySelector('a[href="offices.html"]');
    if (!officesLink && currentUser.role !== 'end-user') {
      officesLink = createElement('a', 'sidebar-link');
      officesLink.href = 'offices.html';
      officesLink.append(
        createIcon('M3.5 21V5.5l7-2.5V21m0-12h10v12M6.5 8.5h.01M6.5 12h.01M6.5 15.5h.01M14 12h2.5M14 15.5h2.5M14 19h2.5', 'h-4 w-4 fill-none stroke-current stroke-[1.8]')
      );
      officesLink.append(document.createTextNode(' Offices'));
      nav.append(officesLink);
    }
    nav.querySelectorAll('a[href]').forEach(link => {
      const href = link.getAttribute('href');
      const page = href?.split('#')[0];
      const isCurrent = page === currentPage;
      link.classList.toggle('active', isCurrent);
      if (isCurrent) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
      if (page === 'dashboard.html') link.hidden = !['admin', 'staff'].includes(currentUser.role);
      if (page === 'stock_request.html') {
        const count = link.querySelector('span');
        if (count) count.textContent = String(getLocalRecords('requests').filter(request => request.status === 'Pending').length);
      }
    });
    sidebar.id = 'sidebar';
    sidebar.classList.add('fixed', 'left-0', 'top-0', 'z-40', 'h-screen', 'w-64', 'flex', 'flex-col', 'overflow-hidden', 'bg-cbsua-dark', 'p-4', 'text-white', 'transition-transform', '-translate-x-full', 'lg:translate-x-0');
    sidebar.setAttribute('aria-label', 'Workspace navigation');
    const header = main.querySelector('.mb-8');
    const profile = header?.querySelector('[class*="sm:block"]');
    if (profile) {
      const name = profile.querySelector('p');
      const title = profile.querySelector('p + p');
      if (name) name.textContent = currentUser.name;
      if (title) title.textContent = currentUser.title;
      const avatar = profile.previousElementSibling;
      if (avatar) avatar.textContent = currentUser.name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
    }
    document.querySelectorAll('input[readonly]').forEach(input => {
      if (/RENJENE|RIVERA|SUPPLY OFFICER/i.test(input.value)) input.value = `${currentUser.name} — ${currentUser.title}`;
    });
    main.classList.remove('ml-64', 'lg:ml-64');
    main.classList.add('min-w-0', 'ml-0', 'lg:ml-64', 'pt-16', 'lg:pt-6');
    const menuButton = createElement('button', 'ims-menu-toggle fixed left-3 top-3 z-[80] grid h-11 w-11 place-items-center rounded-lg border border-gray-300 bg-white text-xl text-cbsua-dark shadow lg:hidden dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100');
    menuButton.type = 'button';
    setAttributes(menuButton, { 'aria-label': 'Open workspace menu', 'aria-controls': 'sidebar', 'aria-expanded': 'false' });
    menuButton.append(createIcon('M4 7h16M4 12h16M4 17h16', 'h-5 w-5 fill-none stroke-current stroke-[1.8]'));
    const backdrop = createElement('div', 'ims-menu-backdrop fixed inset-0 z-30 hidden bg-slate-900/45 lg:hidden');
    backdrop.setAttribute('aria-hidden', 'true');
    main.before(menuButton, backdrop);
  }

  // Dialog controls
  function buildDialogs() {
    const overlay = createElement('div', 'hidden fixed inset-0 z-[100] place-items-center bg-slate-900/55 p-4');
    overlay.hidden = true;
    const section = createElement('section', 'max-h-[88vh] w-full max-w-xl overflow-auto rounded-2xl border-t-4 border-cbsua-gold border-x border-b border-gray-200 bg-white p-6 text-gray-900 shadow-2xl dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100');
    setAttributes(section, { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'ims-dialog-title' });
    const header = createElement('div', 'flex items-center justify-between gap-4'), headingGroup = createElement('div');
    const title = createElement('h2', 'm-0 text-xl font-bold');
    title.id = 'ims-dialog-title';
    const description = createElement('p', 'mt-1 text-sm text-gray-500 dark:text-gray-300');
    description.id = 'ims-dialog-description';
    headingGroup.append(title, description);
    const close = createElement('button', 'ims-settings-close grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gray-100 text-xl text-gray-700 dark:bg-gray-900 dark:text-gray-100', '×');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close dialog');
    header.append(headingGroup, close);
    const content = createElement('div', 'ims-dialog-content mt-4 space-y-4 text-sm text-gray-600 dark:text-gray-300');
    const actions = createElement('div', 'ims-settings-actions mt-6 flex justify-end gap-3');
    section.append(header, content, actions);
    overlay.append(section);
    document.body.append(overlay);
    return overlay;
  }
  const dialog = buildDialogs(), dialogTitle = dialog.querySelector('#ims-dialog-title');
  const dialogDescription = dialog.querySelector('#ims-dialog-description'), dialogContent = dialog.querySelector('.ims-dialog-content');
  const dialogActions = dialog.querySelector('.ims-settings-actions');
  let dialogOpener = null;
  let confirmationAction = null;
  let previousDocumentOverflow = null;
  function closeDialog() {
    if (!dialog.hidden) {
      document.documentElement.style.overflow = previousDocumentOverflow || '';
      previousDocumentOverflow = null;
    }
    dialog.hidden = true;
    dialog.classList.add('hidden');
    dialog.classList.remove('grid');
    confirmationAction = null;
    dialogOpener?.focus();
    dialogOpener = null;
  }
  function showDialog() {
    if (dialog.hidden) previousDocumentOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    dialog.hidden = false;
    dialog.classList.remove('hidden');
    dialog.classList.add('grid');
    dialog.querySelector('.ims-settings-close').focus();
  }
  function showConfirmation(title, description, confirmLabel, onConfirm, danger = false, request = null) {
    dialogOpener = document.activeElement;
    dialogTitle.textContent = title;
    dialogDescription.textContent = description;
    if (request) {
      const details = createElement('dl', 'grid grid-cols-1 gap-3 rounded-xl border border-cbsua-border bg-gray-50 p-4 sm:grid-cols-2');
      [
        ['Request / Date', request.id, request.date],
        ['Office / Recipient', request.office, [
          request.recipient,
          request.employeeId ? `ID ${request.employeeId}` : ''
        ].filter(Boolean).join(' · ')],
        ['Item / Quantity', request.item, request.quantity]
      ].forEach(([label, value, supportingText]) => {
        const group = createElement('div', 'min-w-0');
        group.append(
          createElement('dt', 'text-xs font-medium uppercase tracking-wide text-cbsua-muted', label),
          createElement('dd', 'mt-1 break-words font-medium text-gray-900 dark:text-gray-100', value || '—')
        );
        if (supportingText) {
          group.append(createElement('dd', 'mt-1 break-words text-sm text-cbsua-muted', supportingText));
        }
        details.append(group);
      });
      dialogContent.replaceChildren(details);
    } else {
      const prompt = createElement('div', 'mx-auto grid h-12 w-12 place-items-center rounded-full bg-cbsua-light text-xl font-bold text-cbsua-primary', danger ? '!' : '?');
      dialogContent.replaceChildren(prompt);
    }
    dialogActions.replaceChildren();
    const cancelButton = createElement('button', 'rounded-lg border border-gray-300 px-4 py-2 dark:border-gray-600', 'Cancel');
    cancelButton.type = 'button';
    cancelButton.dataset.closeDialog = '';
    const confirmButton = createElement('button', `rounded-lg px-4 py-2 text-white ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-cbsua-primary hover:bg-green-700'}`, confirmLabel);
    confirmButton.type = 'button';
    confirmButton.dataset.confirmDialog = '';
    dialogActions.append(cancelButton, confirmButton);
    confirmationAction = onConfirm;
    showDialog();
  }
  function trapFocus(event, container, selector) {
    if (event.key !== 'Tab') return;
    const focusable = [...container.querySelectorAll(selector)].filter(element => !element.hidden);
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
  function openSettings() {
    dialogTitle.textContent = 'Settings';
    dialogDescription.textContent = 'View your account and manage workspace preferences.';
    dialogContent.replaceChildren();
    const accountHeading = createElement('h3', 'text-base font-semibold text-gray-900 dark:text-gray-100', 'Account information');
    const accountInfo = createElement('div', 'rounded-lg border border-gray-200 p-3 dark:border-gray-700');
    accountInfo.append(
      createElement('p', 'font-medium text-gray-900 dark:text-gray-100', `${currentUser.name} · ${currentUser.role}`),
      createElement('p', 'mt-1 text-xs text-gray-500 dark:text-gray-300', `Username: ${currentUser.username}`),
      createElement('p', 'mt-2 text-xs text-gray-500 dark:text-gray-300', 'Password changes are completed through approved administrator reset requests.')
    );
    dialogContent.append(accountHeading, accountInfo);
    const appearanceHeading = createElement('h3', 'border-t border-gray-200 pt-4 text-base font-semibold text-gray-900 dark:border-gray-700 dark:text-gray-100', 'Appearance');
    dialogContent.append(appearanceHeading);
    const addSetting = (labelText, id, options) => {
      const label = createElement('label', 'font-semibold text-gray-900 dark:text-gray-100', labelText);
      label.htmlFor = id;
      const select = createElement('select', 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100');
      select.id = id;
      options.forEach(([value, text]) => {
        const option = createElement('option', '', text);
        option.value = value;
        select.append(option);
      });
      dialogContent.append(label, select);
    };
    addSetting('Appearance', 'ims-theme', [['system', 'Use device setting'], ['light', 'Light'], ['dark', 'Dark']]);
    addSetting('Text size', 'ims-text-size', [['normal', 'Standard'], ['large', 'Large']]);
    addSetting('Motion', 'ims-motion', [['normal', 'Standard'], ['reduced', 'Reduced']]);
    dialogContent.append(createElement('p', '', 'Appearance preferences apply across workspace pages on this device.'));
    dialogActions.replaceChildren();
    const resetButton = createElement('button', 'rounded-lg border border-gray-300 px-4 py-2 dark:border-gray-600', 'Reset');
    resetButton.type = 'button';
    resetButton.dataset.resetSettings = '';
    const saveButton = createElement('button', 'rounded-lg bg-cbsua-primary px-4 py-2 text-white', 'Save settings');
    saveButton.type = 'button';
    saveButton.dataset.saveSettings = '';
    dialogActions.append(resetButton, saveButton);
    dialog.querySelector('#ims-theme').value = preferences.theme || 'system';
    dialog.querySelector('#ims-text-size').value = preferences.textSize || 'normal';
    dialog.querySelector('#ims-motion').value = preferences.motion || 'normal';
    showDialog();
  }
  function openHelp() {
    dialogTitle.textContent = 'Help & support';
    dialogDescription.textContent = 'Frequently asked questions and help for using the CBSUA Supply Office system.';
    dialogContent.replaceChildren();

    if (currentUser.role === 'end-user') {
      const guide = createElement('section', 'rounded-xl border border-cbsua-border bg-cbsua-pale p-4');
      guide.append(
        createElement('h3', 'text-base font-semibold text-gray-900 dark:text-gray-100', 'First-time user guide'),
        createElement('p', 'mt-1 text-sm', 'Follow these steps to submit and track a supply request.')
      );
      const steps = document.createElement('ol');
      steps.className = 'mt-3 list-decimal space-y-2 pl-5 text-sm';
      [
        'Review Available items and choose an item that is in stock.',
        'Select + New stock request, then choose Consumable, Semi-expendable, or Fixed Asset to open the matching request form.',
        'Confirm the item, enter the quantity and purpose, and check your employee ID. Your name and office are filled from your account.',
        'Submit the request. Follow its status in My request history or Request updates.',
        'You can cancel a request while it is Pending. Contact the Supply Office if a request that has already been reviewed needs a change.'
      ].forEach(text => steps.append(createElement('li', '', text)));
      guide.append(steps);
      dialogContent.append(guide);
    }

    const faqSection = createElement('section', 'space-y-3');
    faqSection.append(createElement('h3', 'text-base font-semibold text-gray-900 dark:text-gray-100', 'Frequently Asked Questions (FAQ)'));
    const faqItems = [
      ['Which supply classification should I choose?', 'Choose the classification that matches the requested item. Consumable requests use the RIS form, Semi-expendable requests use ICS, and Fixed Asset requests use PAR. Ask the Supply Office if you are unsure.'],
      ['What do the request statuses mean?', 'Pending means the Supply Office has not reviewed it yet. Approved means it can proceed to issue. Issued means the supply issue was recorded. Rejected means it was not approved; Cancelled means the requester cancelled it while pending.'],
      ['Can I change or cancel a request?', 'A Pending request can be cancelled from My request history. If the Supply Office has already reviewed it, contact the Supply Office for help.'],
      ['Where can I see request updates?', 'Use Request updates near the top of your dashboard and My request history to check the latest status and remarks.'],
      ['Why can I only request some items or quantities?', 'The available-items list shows items with stock. The request form also checks current stock and displays any applicable quantity limit.'],
      ['Where are my records saved?', 'Records are saved in this browser on this device. Continue using the same browser and avoid clearing its site data if you need to keep access to those records.'],
      ['Who can help with account access or other issues?', 'Contact the Supply Office in person for account access, password resets, or operational support.']
    ];
    faqItems.forEach(([question, answer]) => {
      const entry = createElement('details', 'rounded-lg border border-gray-200 px-4 py-3 dark:border-gray-700');
      const summary = createElement('summary', 'cursor-pointer font-medium text-gray-900 dark:text-gray-100', question);
      entry.append(summary, createElement('p', 'mt-2 text-sm', answer));
      faqSection.append(entry);
    });
    dialogContent.append(faqSection);

    dialogActions.replaceChildren();
    const closeButton = createElement('button', 'rounded-lg bg-cbsua-primary px-4 py-2 text-white', 'Close');
    closeButton.type = 'button';
    closeButton.dataset.closeDialog = '';
    dialogActions.append(closeButton);
    showDialog();
  }
  function setMenuOpen(isOpen) {
    const sidebar = document.getElementById('sidebar'), button = document.querySelector('.ims-menu-toggle');
    const backdrop = document.querySelector('.ims-menu-backdrop');
    if (!sidebar || !button || !backdrop) return;
    sidebar.classList.toggle('-translate-x-full', !isOpen);
    backdrop.classList.toggle('hidden', !isOpen);
    button.setAttribute('aria-expanded', String(isOpen));
    button.setAttribute('aria-label', isOpen ? 'Close workspace menu' : 'Open workspace menu');
    const pathData = isOpen ? 'M6 6l12 12M18 6L6 18' : 'M4 7h16M4 12h16M4 17h16';
    button.replaceChildren(createIcon(pathData, 'h-5 w-5 fill-none stroke-current stroke-[1.8]'));
  }

  // Click actions
  function setupActions() {
    document.addEventListener('click', async event => {
      const target = event.target.closest('button, a');
      if (!target) return;
      if (target.classList.contains('sidebar-link') && target.matches('a[href]')) {
        setMenuOpen(false);
      }
      if (target.matches('[data-open-settings]')) {
        dialogOpener = target;
        return openSettings();
      }
      if (target.matches('[data-open-help]')) {
        dialogOpener = target;
        return openHelp();
      }
      if (target.matches('[data-select-supply-classification]')) {
        return selectRequestClassification(target.dataset.selectSupplyClassification);
      }
      if (target.matches('[data-change-supply-classification]')) {
        const requestForm = pageModal?.querySelector('#requestForm');
        resetRequestClassification(requestForm);
        return pageModal?.querySelector('[data-select-supply-classification]')?.focus();
      }
      if (target.matches('[data-open-modal]')) return openModal(target);
      if (target.matches('[data-close-modal]')) {
        resetModalForm(target.closest('.fixed')?.querySelector('form'));
        closeModal();
        return;
      }
      if (target.matches('[data-save-settings], [data-reset-settings]')) {
        const reset = target.matches('[data-reset-settings]');
        if (reset) Object.assign(preferences, { theme: 'system', textSize: 'normal', motion: 'normal' });
        else Object.assign(preferences, {
          theme: dialog.querySelector('#ims-theme').value,
          textSize: dialog.querySelector('#ims-text-size').value,
          motion: dialog.querySelector('#ims-motion').value
        });
        savePreferences();
        applyPreferences();
        closeDialog();
        return showToast(`Appearance settings ${reset ? 'reset' : 'saved'}.`);
      }
      if (target.matches('[data-close-dialog], .ims-settings-close')) return closeDialog();
      if (target.matches('[data-confirm-dialog]')) {
        const action = confirmationAction;
        closeDialog();
        await action?.();
        return;
      }
      if (target.matches('.ims-menu-toggle')) return setMenuOpen(document.getElementById('sidebar')?.classList.contains('-translate-x-full'));
      if (target.matches('.ims-menu-backdrop')) return setMenuOpen(false);
      if (target.id === 'themeToggle') {
        preferences.theme = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
        savePreferences();
        applyPreferences();
        return showToast(`Switched to ${preferences.theme} appearance.`);
      }
      const label = target.textContent.trim();
      if (target.matches('[data-sign-out]')) {
        event.preventDefault();
        try {
          await window.IMS.accounts.logout();
          window.location.href = 'index.html';
        } catch (error) {
          console.error('Sign out failed.', error);
          showToast('Could not sign out. Please try again.');
        }
        return;
      }
      if (target.matches('[data-request-action]')) {
        if (currentUser.role !== 'admin') return showToast('Only the Supply Office head can review requests.');
        const row = target.closest('tr');
        const requestCard = target.closest('[data-request-card]');
        const requestId = row?.dataset.requestId || requestCard?.dataset.requestId;
        const request = getLocalRecords('requests').find(entry => entry.id === requestId);
        if (!request) return showToast('The stock request could not be found.');
        const status = target.dataset.requestAction === 'approve' ? 'Approved' : 'Rejected';
        return showConfirmation(
          `${status} stock request`,
          `Are you sure you want to ${status.toLowerCase()} ${requestId}?`,
          status,
          async () => {
            if (!await updateRequestStatus(requestId, status)) return;
            window.IMS.refreshPage();
            const pendingCount = getLocalRecords('requests').filter(requestEntry => requestEntry.status === 'Pending').length;
            const countBadge = document.querySelector('#sidebar nav a[href="stock_request.html"] span');
            if (countBadge) countBadge.textContent = String(pendingCount);
            showToast(`${requestId} ${status.toLowerCase()}.`);
          },
          status === 'Rejected',
          request
        );
      }
      if (target.matches('[data-item-action]')) {
        const item = getLocalRecords('items').find(entry => entry.id === target.dataset.itemId);
        if (!item) return showToast('The inventory item could not be found.');
        const form = document.getElementById('addItemForm');
        if (!form) return;
        const fields = [...form.querySelectorAll('input, select, textarea')];
        const modal = document.getElementById('addItemModal');
        const heading = modal.querySelector('h3');
        fields[0].value = item.id;
        fields[1].value = item.name;
        fields[2].value = item.description || '';
        fields[3].value = [...fields[3].options].find(option => option.textContent.includes(item.category))?.value || fields[3].options[0].value;
        fields[4].value = [...fields[4].options].find(option => option.textContent.includes(item.supplier))?.value || fields[4].options[0].value;
        fields[5].value = item.supplyClassification || '';
        fields[6].value = item.unit;
        fields[7].value = item.minimum;
        fields[8].value = item.quantity;
        fields[9].value = item.expiry || '';
        fields[0].readOnly = true;
        fields[8].readOnly = true;
        fields[8].previousElementSibling.textContent = 'On-hand quantity (adjust via receiving / issuance)';
        heading.textContent = `Inspect / edit ${item.id}`;
        form.dataset.editingItem = item.id;
        return openModal(target);
      }
      if (target.matches('[data-supplier-action="edit"]')) {
        const supplier = getLocalRecords('suppliers').find(entry => entry.id === target.dataset.supplierId);
        const form = document.getElementById('supplierForm');
        if (!supplier || !form) return showToast('The supplier could not be found.');
        const fields = [...form.querySelectorAll('input, select, textarea')];
        [supplier.id, supplier.name, supplier.category, supplier.contact, supplier.phone, supplier.email, supplier.address]
          .forEach((value, index) => { fields[index].value = value || ''; });
        fields[0].readOnly = true;
        form.dataset.editingSupplier = supplier.id;
        document.querySelector('#supplierModal h3').textContent = `Edit ${supplier.name}`;
        return openModal(target);
      }
      if (label.startsWith('+ New request')) {
        location.href = 'stock_request.html?newRequest=1';
        return;
      }
      if (label.startsWith('Review requests')) {
        location.href = 'stock_request.html';
        return;
      }
      if (label === 'Receive stock') {
        location.href = 'receive_stock.html';
        return;
      }
      if (label === 'Manage categories') {
        showToast('Categories can be selected in the Add item form.');
        return;
      }
      if (label === 'Browse files') {
        document.querySelector('#receiptUpload')?.click();
        return;
      }
      if (label === 'Cancel' && target.closest('form')) {
        const form = target.closest('form');
        form.reset();
        delete form.dataset.attachmentName;
        window.IMS.refreshPage();
        return;
      }
      if (target.matches('a[href="#"]') && !target.closest('#sidebar')) {
        event.preventDefault();
        if (label.includes('Export list')) {
          const rows = [...document.querySelectorAll('main tbody tr')].filter(row => !row.hidden);
          const csv = [
            ['Request / Date', 'Office / Recipient', 'Item / Quantity', 'Handler', 'Status'],
            ...rows.map(row => [...row.cells].slice(0, 5).map(cell => cell.innerText.replace(/\s*\n\s*/g, ' — ')))
          ].map(values => values.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\r\n');
          const link = document.createElement('a');
          link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
          link.download = 'cbsua-stock-requests.csv';
          document.body.append(link);
          link.click();
          setTimeout(() => {
            URL.revokeObjectURL(link.href);
            link.remove();
          }, 0);
          return;
        }
        if (label.includes('history') || label.includes('transactions')) {
          location.href = 'dashboard.html#transactions';
        } else if (label.includes('Review')) {
          if (currentUser.role !== 'admin') return showToast('Only the Supply Office head can review requests.');
          const row = target.closest('tr'), requestId = row?.cells[0]?.innerText.trim().split('\n')[0];
          const request = getLocalRecords('requests').find(entry => entry.id === requestId);
          if (row && request) showConfirmation(
            'Approve stock request',
            `Are you sure you want to approve ${requestId}?`,
            'Approve',
            async () => {
              if (!await updateRequestStatus(requestId, 'Approved')) return;
              const request = getLocalRecords('requests').find(entry => entry.id === requestId);
              if (request) addRequestRow(request);
              showToast(`${requestId} approved.`);
            },
            false,
            request
          );
        } else {
          showToast('the developer are authorized to change the password');
        }
      }
    });
    dialog.addEventListener('keydown', event => trapFocus(
      event,
      dialog,
      'button:not([disabled]), select:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
    ));
    if (pageModal) {
      pageModal.addEventListener('keydown', event => trapFocus(
        event,
        pageModal,
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ));
    }
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    });
    window.addEventListener('resize', () => {
      if (window.innerWidth >= 1024) setMenuOpen(false);
    });
  }
  // Form handlers
  function setupForms() {
    document.addEventListener('submit', async event => {
      const form = event.target;
      if (form.id === 'loginForm' || form.id === 'officeQuotaForm') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (form.id === 'addItemForm') {
        const fields = [...form.querySelectorAll('input, select, textarea')];
        const minimum = Number(fields[7].value);
        const quantity = Number(fields[8].value);
        if (!Number.isSafeInteger(minimum) || minimum < 0 || !Number.isSafeInteger(quantity) || quantity < 0) {
          return showToast('Stock quantities must be whole numbers greater than or equal to zero.');
        }
        const item = {
          id: fields[0].value.trim().toUpperCase(), name: fields[1].value.trim(),
          description: fields[2].value.trim(), category: fields[3].selectedOptions[0].textContent.split(' — ').slice(1).join(' — '),
          supplier: fields[4].selectedOptions[0].textContent.split(' — ').slice(1).join(' — '),
          supplyClassification: fields[5].value,
          unit: fields[6].value.trim(), minimum, quantity, expiry: fields[9].value
        };
        const itemIdBeingEdited = form.dataset.editingItem;
        const savedItem = itemIdBeingEdited
          ? await updateInventoryItem(itemIdBeingEdited, item)
          : await saveRecord('items', item);
        if (!savedItem) return;
        addInventoryRow(savedItem);
        document.querySelector('#searchInput')?.dispatchEvent(new Event('input', { bubbles: true }));
        form.reset();
        fields[0].readOnly = true;
        fields[8].readOnly = false;
        fields[8].previousElementSibling.textContent = 'Opening quantity *';
        delete form.dataset.editingItem;
        document.querySelector('#addItemModal h3').textContent = 'Add a new inventory item';
        closeModal();
        window.IMS.refreshPage();
        return showToast(`${savedItem.id} ${itemIdBeingEdited ? 'updated' : 'saved'} successfully.`);
      }
      if (form.id === 'requestForm') {
        const itemId = form.querySelector('#requestItem').value;
        const item = getLocalRecords('items').find(entry => entry.id === itemId);
        const quantity = Number(form.querySelector('#requestQuantity').value);
        const classificationKey = form.dataset.supplyClassification;
        const classification = requestClassifications[classificationKey];
        const editingRequestId = form.dataset.editingRequest || '';
        const requestBeingEdited = editingRequestId
          ? getLocalRecords('requests').find(entry => entry.id === editingRequestId)
          : null;
        if (!item || !Number.isSafeInteger(quantity) || quantity <= 0) {
          return showToast('Choose an item and enter a whole-number quantity greater than zero.');
        }
        if (!classification) {
          return showToast('Choose a Supply Classification before completing the request form.');
        }
        if (editingRequestId && (!requestBeingEdited
          || requestBeingEdited.status !== 'Pending'
          || currentUser.role !== 'end-user'
          || String(requestBeingEdited.requesterId) !== String(currentUser.id)
          || String(requestBeingEdited.office || '').trim().toLowerCase()
            !== String(currentUser.office || '').trim().toLowerCase())) {
          return showToast('Only your own pending requests for your office can be edited.');
        }
        if (String(item.supplyClassification || '').trim().toLowerCase() !== classification.label.toLowerCase()) {
          return showToast('Choose an item that matches the selected supply classification.');
        }
        const today = new Date();
        today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
        const requestDate = today.toISOString().slice(0, 10);
        const classificationDetails = {};
        if (classificationKey === 'semi-expendable') {
          const specifications = form.querySelector('#requestIcsSpecifications').value.trim();
          if (!specifications) return showToast('Enter the specifications required for the ICS request.');
          const usefulLifeText = form.querySelector('#requestUsefulLife').value.trim();
          const usefulLife = usefulLifeText ? Number(usefulLifeText) : null;
          if (usefulLifeText && (!Number.isFinite(usefulLife) || usefulLife < 1)) {
            return showToast('Estimated useful life must be at least one year.');
          }
          classificationDetails.specifications = specifications;
          classificationDetails.estimatedUsefulLifeYears = usefulLife;
          const unitCostText = form.querySelector('#requestIcsUnitCost').value.trim();
          const unitCost = unitCostText ? Number(unitCostText) : null;
          if (unitCostText && (!Number.isFinite(unitCost) || unitCost < 0)) {
            return showToast('ICS unit cost must be zero or greater.');
          }
          classificationDetails.unitCost = unitCost;
          classificationDetails.supplier = form.querySelector('#requestIcsSupplier').value.trim();
          classificationDetails.deliveryReceiptDate = form.querySelector('#requestIcsDeliveryReceiptDate').value;
          classificationDetails.purchaseOrderDate = form.querySelector('#requestIcsPurchaseOrderDate').value;
          classificationDetails.iarDate = form.querySelector('#requestIcsIarDate').value;
        } else if (classificationKey === 'fixed-asset') {
          const specifications = form.querySelector('#requestSpecifications').value.trim();
          if (!specifications) return showToast('Enter the specifications required for the PAR request.');
          const amountText = form.querySelector('#requestParAmount').value.trim();
          const amount = amountText ? Number(amountText) : null;
          if (amountText && (!Number.isFinite(amount) || amount < 0)) {
            return showToast('PAR amount must be zero or greater.');
          }
          classificationDetails.specifications = specifications;
          classificationDetails.supplier = form.querySelector('#requestParSupplier').value.trim();
          classificationDetails.propertyNumber = form.querySelector('#requestParPropertyNumber').value.trim();
          classificationDetails.dateAcquired = form.querySelector('#requestParDateAcquired').value;
          classificationDetails.amount = amount;
        }
        const officeOverride = new URLSearchParams(location.search).get('office');
        if (officeOverride && !window.IMS.accounts.getOfficeId(officeOverride)) {
          return showToast('Choose a valid office for this stock request.');
        }
        const requestOffice = form.querySelector('#requestOffice');
        if (currentUser.role === 'admin') {
          requestOffice.value = officeOverride || 'Supply Office';
        } else if (officeOverride) {
          requestOffice.value = officeOverride;
        }
        const request = {
          id: requestBeingEdited?.id || nextRequestId(),
          date: requestBeingEdited?.date || requestDate,
          createdAt: requestBeingEdited?.createdAt || new Date().toISOString(),
          office: form.querySelector('#requestOffice').value,
          recipient: form.querySelector('#requestRecipient').value.trim(),
          employeeId: form.querySelector('#requestEmployeeId').value.trim().toUpperCase(),
          requesterId: currentUser.id,
          item: item.name,
          itemId,
          quantity: `${quantity} ${item.unit}`,
          supplyClassification: classification.label,
          documentType: classification.documentType,
          classificationDetails,
          status: 'Pending',
          remarks: form.querySelector('#requestRemarks').value.trim()
        };
        if (!/^[A-Z0-9-]{3,24}$/.test(request.employeeId)) {
          return showToast('Enter an employee ID using 3–24 letters, numbers, or hyphens.');
        }
        if (currentUser.role === 'end-user') {
          const updated = await window.IMS.accounts.updateEmployeeId(currentUser.username, request.employeeId);
          if (!updated) return;
        }
        if (currentUser.role === 'end-user' && quantity > item.quantity) {
          return showToast(`Only ${item.quantity} ${item.unit} are currently available.`);
        }
        const remainingQuarterlyQuantity = getQuarterlyRequestLimitRemaining(
          itemId, request.office, requestBeingEdited?.id || '', requestBeingEdited?.createdAt || new Date()
        );
        if (quantity > remainingQuarterlyQuantity) {
          return showToast(
            `Request limit exceeded. Only ${remainingQuarterlyQuantity} ${item.unit} remain in this office's assigned allocation.`
          );
        }
        if (!requestBeingEdited && getLocalRecords('requests').some(savedRequest => savedRequest.id === request.id)) {
          return showToast(`${request.id} already exists.`);
        }
        const savedRequest = requestBeingEdited
          ? await window.IMS.updateRequest(request)
          : await saveRecord('requests', request);
        if (!savedRequest) return;
        form.reset();
        delete form.dataset.editingRequest;
        const submitButton = form.querySelector('button[type="submit"]');
        if (submitButton) submitButton.textContent = 'Submit request';
        closeModal();
        window.IMS.refreshPage();
        return showToast(requestBeingEdited
          ? `${savedRequest.id} updated successfully.`
          : `${savedRequest.id} saved successfully as pending.`);
      }
      if (form.id === 'supplierForm') {
        const fields = [...form.querySelectorAll('input, select, textarea')];
        const supplier = {
          id: fields[0].value.trim(), name: fields[1].value.trim(), category: fields[2].value.trim(),
          contact: fields[3].value.trim(), phone: fields[4].value.trim(), email: fields[5].value.trim(), address: fields[6].value.trim()
        };
        const supplierBeingEdited = form.dataset.editingSupplier;
        if (getLocalRecords('suppliers').some(entry =>
          entry.id !== supplierBeingEdited
          && entry.name.toLowerCase() === supplier.name.toLowerCase())) {
          return showToast('A supplier with this ID or name already exists.');
        }
        const savedSupplier = supplierBeingEdited
          ? await updateSupplier(supplierBeingEdited, supplier)
          : await saveRecord('suppliers', supplier);
        if (!savedSupplier) return;
        if (supplierBeingEdited) window.IMS.refreshPage();
        else {
          addSupplierCard(savedSupplier);
          fields[0].value = nextRecordId('suppliers', 'SUP-', 0);
          const list = document.querySelector('main .space-y-4');
          const count = [...document.querySelectorAll('main p')].find(paragraph => paragraph.textContent.includes('supplier records'));
          if (count && list) count.textContent = `${list.children.length} suppliers`;
          window.IMS.refreshPage();
        }
        resetModalForm(form);
        if (form.id === 'supplierForm') fields[0].value = nextRecordId('suppliers', 'SUP-', 0);
        closeModal();
        return showToast(`${savedSupplier.id} — ${supplier.name} ${supplierBeingEdited ? 'updated' : 'saved'} successfully.`);
      }
      if (form.id === 'receiveForm') {
        const quantity = Number(form.querySelector('#receiveQuantity').value);
        if (!Number.isSafeInteger(quantity) || quantity <= 0) return showToast('Enter a whole-number quantity greater than zero.');
        const itemId = form.querySelector('#receiveItem').value;
        const item = getLocalRecords('items').find(entry => entry.id === itemId);
        if (!item) return showToast('Choose a valid inventory item.');
        const deliveryReference = form.querySelector('#deliveryReference').value.trim();
        if (getLocalRecords('receipts').some(entry => entry.deliveryReference === deliveryReference)) {
          return showToast('This delivery reference has already been recorded.');
        }
        const receipt = {
          id: nextRecordId('receipts', `RCV-${new Date().getFullYear()}-`, 0),
          supplier: form.querySelector('#receiveSupplier').selectedOptions[0].textContent.split(' — ').slice(1).join(' — '),
          deliveryReference, itemId, itemName: item.name,
          quantity,
          receivedDate: form.querySelector('#receivedDate').value,
          receivedBy: form.querySelector('#receivedBy').value.trim(),
          batchNumber: form.querySelector('#batchNumber').value.trim(),
          expiryDate: form.querySelector('#expiryDate').value,
          remarks: form.querySelector('textarea')?.value.trim() || '',
          attachmentName: form.dataset.attachmentName || form.querySelector('#receiptUpload')?.files[0]?.name || ''
        };
        const savedReceipt = await saveRecord('receipts', receipt);
        if (!savedReceipt) return;
        form.reset();
        delete form.dataset.attachmentName;
        form.querySelector('#receivedBy').value = `${currentUser.name} — ${currentUser.title}`;
        const today = new Date();
        today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
        form.querySelector('#receivedDate').value = today.toISOString().slice(0, 10);
        window.IMS.refreshPage?.();
        return showToast(`${savedReceipt.id} saved successfully and supply record updated.`);
      }
      if (form.id === 'issueForm') {
        const requestId = form.querySelector('#issueRequest').value;
        const request = getLocalRecords('requests').find(entry => entry.id === requestId);
        const itemId = form.querySelector('#issueItemId').value;
        const item = getLocalRecords('items').find(entry => entry.id === itemId);
        const quantity = Number(form.querySelector('#issueQuantity').value);
        const requested = request ? window.IMS.getRemainingRequestQuantity(request) : 0;
        if (!request || request.status !== 'Approved') return showToast('Choose an approved request.');
        if (!item || !Number.isSafeInteger(quantity) || quantity <= 0 || quantity > requested) {
          return showToast(`Issue a whole-number quantity from 1 to ${requested}.`);
        }
        if (!document.querySelector('#issueConfirmed').checked) return showToast('Confirm the recipient and physical quantity before issuing.');
        const issuance = {
          id: nextRecordId('issuances', `ISS-${new Date().getFullYear()}-`, 0), requestId,
          itemId, itemName: item.name, quantity,
          office: request.office, recipient: form.querySelector('#issueRecipient').value,
          recipientEmployeeId: request.employeeId || '',
          date: form.querySelector('#issueDate').value, handledBy: `${currentUser.name} — ${currentUser.title}`,
          remarks: form.querySelector('textarea')?.value.trim() || ''
        };
        const savedIssuance = await saveRecord('issuances', issuance);
        if (!savedIssuance) return;
        window.dispatchEvent(new CustomEvent('ims:issuance-saved', { detail: savedIssuance }));
        form.reset();
        window.IMS.refreshPage?.();
        return showToast(`${savedIssuance.id} saved successfully and stock balance updated.`);
      }
    }, true);
  }
  Object.assign(window.IMS, {
    createIcon,
    showToast,
    getQuarterlyRequestLimitRemaining,
  });
  applyTailwindUtilities();
  buildSidebar();
  function updatePendingCount() {
    const badge = document.querySelector('#sidebar nav a[href="stock_request.html"] span');
    if (badge) badge.textContent = String(getLocalRecords('requests').filter(request => request.status === 'Pending').length);
  }
  window.addEventListener('ims:records-updated', updatePendingCount);
  updatePendingCount();
  applyPreferences();
  window.addEventListener('ims:edit-request', event => {
    const requestId = event.detail?.requestId;
    const request = getLocalRecords('requests').find(entry => entry.id === requestId);
    if (!pageModal || pageModal.id !== 'requestModal' || currentUser.role !== 'end-user'
      || !request || request.status !== 'Pending'
      || String(request.requesterId) !== String(currentUser.id)
      || String(request.office || '').trim().toLowerCase()
        !== String(currentUser.office || '').trim().toLowerCase()) {
      return showToast('Only your own pending requests for your office can be edited.');
    }

    const classificationKey = Object.keys(requestClassifications).find(key =>
      requestClassifications[key].label.toLowerCase()
        === String(request.supplyClassification || '').trim().toLowerCase());
    if (!classificationKey) return showToast('This request has an unsupported supply classification.');

    openModal(event.detail?.opener);
    const form = pageModal.querySelector('#requestForm');
    form.dataset.editingRequest = request.id;
    selectRequestClassification(classificationKey);
    form.querySelector('#requestId').value = request.id;
    form.querySelector('#requestDate').value = request.date || '';
    form.querySelector('#requestOffice').value = currentUser.office || request.office || '';
    form.querySelector('#requestRecipient').value = currentUser.name || request.recipient || '';
    form.querySelector('#requestEmployeeId').value = request.employeeId || currentUser.employeeId || '';
    form.querySelector('#requestEmployeeId').readOnly = true;
    form.querySelector('#requestItem').value = request.itemId;
    form.querySelector('#requestItem').dispatchEvent(new Event('change', { bubbles: true }));
    form.querySelector('#requestQuantity').value = getRequestQuantity(request.quantity) || '';
    form.querySelector('#requestRemarks').value = request.remarks || '';

    const details = request.classificationDetails || {};
    const detailFields = {
      '#requestIcsSpecifications': details.specifications,
      '#requestUsefulLife': details.estimatedUsefulLifeYears,
      '#requestIcsUnitCost': details.unitCost,
      '#requestIcsSupplier': details.supplier,
      '#requestIcsDeliveryReceiptDate': details.deliveryReceiptDate,
      '#requestIcsPurchaseOrderDate': details.purchaseOrderDate,
      '#requestIcsIarDate': details.iarDate,
      '#requestSpecifications': details.specifications,
      '#requestParPropertyNumber': details.propertyNumber,
      '#requestParDateAcquired': details.dateAcquired,
      '#requestParAmount': details.amount,
      '#requestParSupplier': details.supplier
    };
    Object.entries(detailFields).forEach(([selector, value]) => {
      const field = form.querySelector(selector);
      if (field) field.value = value ?? '';
    });

    const heading = pageModal.querySelector('[data-request-dialog-title]');
    if (heading) heading.textContent = 'Edit pending request';
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) submitButton.textContent = 'Save changes';
  });
  setupActions();
  setupForms();
  const requestForm = document.querySelector('#requestForm');
  requestForm?.addEventListener('input', updateRequestLimitHint);
  requestForm?.addEventListener('change', updateRequestLimitHint);
  window.addEventListener('ims:records-updated', updateRequestLimitHint);
  if (new URLSearchParams(location.search).has('newRequest')) {
    window.setTimeout(() => openModal(), 0);
  }
  window.IMS.pageFeatures.forEach(initialize => initialize());
  updateRequestLimitHint();
})();
});
