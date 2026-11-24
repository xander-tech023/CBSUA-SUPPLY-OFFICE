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
  if (currentPage === 'index.html' || currentPage === 'navigation.html' || currentPage === 'offices.html') return;

  let currentUser;
  try {
    currentUser = await window.IMS.accounts.getSession();
    if (!currentUser) {
      window.location.replace('index.html');
      return;
    }
    await window.IMS.initializeRecords();
    window.dispatchEvent(new CustomEvent('ims:records-updated'));
  } catch (error) {
    console.error('The workspace could not be initialized.', error);
    const message = document.createElement('p');
    message.className = 'mx-auto mt-12 max-w-xl rounded-lg bg-red-50 p-5 text-red-800';
    message.textContent = 'Could not initialize the local workspace. Reload this page and try again.';
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
    addRequestRow, addSupplierCard, nextRecordId
  } = window.IMS;
  const modalId = {
    'inventory.html': 'addItemModal',
    'stock_request.html': 'requestModal',
    'end_user_dashboard.html': 'requestModal',
    'suppliers.html': 'supplierModal'
  }[currentPage];
  const pageModal = modalId ? document.getElementById(modalId) : null;
  let modalOpener = null;
  let previousBodyOverflowY = '';
  function openModal(opener) {
    if (!pageModal) return;
    modalOpener = opener || document.activeElement;
    if (pageModal.classList.contains('hidden')) {
      previousBodyOverflowY = document.body.style.overflowY;
      document.body.style.overflowY = 'hidden';
    }
    if (pageModal.id === 'requestModal') {
      const requestForm = pageModal.querySelector('#requestForm');
      const today = new Date();
      today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
      if (requestForm) {
        requestForm.querySelector('#requestId').value = nextRecordId('requests', 'REQ-2026-', 44);
        requestForm.querySelector('#requestDate').value = today.toISOString().slice(0, 10);
      }
    }
    if (pageModal.id === 'addItemModal' && !pageModal.querySelector('#addItemForm').dataset.editingItem) {
      const itemIdField = pageModal.querySelector('#itemInventoryId');
      itemIdField.value = nextRecordId('items', 'ITM-', 8);
      itemIdField.readOnly = true;
    }
    if (pageModal.id === 'supplierModal' && !pageModal.querySelector('#supplierForm').dataset.editingSupplier) {
      pageModal.querySelector('#supplierForm input').value = nextRecordId('suppliers', 'SUP-', 3);
    }
    pageModal.classList.remove('hidden');
    const dialog = pageModal.firstElementChild;
    if (dialog) {
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');
      dialog.setAttribute('aria-label', pageModal.querySelector('h3')?.textContent.trim() || 'Form dialog');
    }
    pageModal.querySelector('input:not([type="hidden"]), select, textarea, button')?.focus();
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
    dialogDescription.textContent = 'CBSUA Supply Office Inventory Management System';
    dialogContent.replaceChildren();
    [
      'Use the workspace menu to move between the Dashboard, Inventory, Stock Requests, Issue Supplies, Receive Stock, Suppliers, and Offices. Inventory items, requests, suppliers, offices, and stock movements are saved locally in this browser.',
      'For account access, password resets, or operational support, contact the Supply Office in person.'
    ].forEach(text => dialogContent.append(createElement('p', '', text)));
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
        fields[5].value = item.unit;
        fields[6].value = item.minimum;
        fields[7].value = item.quantity;
        fields[8].value = item.expiry || '';
        fields[0].readOnly = true;
        fields[7].readOnly = true;
        fields[7].previousElementSibling.textContent = 'On-hand quantity (adjust via receiving / issuance)';
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
    dialog.addEventListener('click', event => {
      if (event.target === dialog) closeDialog();
    });
    dialog.addEventListener('keydown', event => trapFocus(
      event,
      dialog,
      'button:not([disabled]), select:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
    ));
    if (pageModal) {
      pageModal.addEventListener('click', event => {
        if (event.target === pageModal) closeModal();
      });
      pageModal.addEventListener('keydown', event => trapFocus(
        event,
        pageModal,
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ));
    }
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        if (pageModal && !pageModal.classList.contains('hidden')) closeModal();
        closeDialog();
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
      if (form.id === 'loginForm') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (form.id === 'addItemForm') {
        const fields = [...form.querySelectorAll('input, select, textarea')];
        const minimum = Number(fields[6].value);
        const quantity = Number(fields[7].value);
        if (!Number.isSafeInteger(minimum) || minimum < 0 || !Number.isSafeInteger(quantity) || quantity < 0) {
          return showToast('Stock quantities must be whole numbers greater than or equal to zero.');
        }
        const item = {
          id: fields[0].value.trim().toUpperCase(), name: fields[1].value.trim(),
          description: fields[2].value.trim(), category: fields[3].selectedOptions[0].textContent.split(' — ').slice(1).join(' — '),
          supplier: fields[4].selectedOptions[0].textContent.split(' — ').slice(1).join(' — '), unit: fields[5].value.trim(),
          minimum, quantity, expiry: fields[8].value
        };
        const itemIdBeingEdited = form.dataset.editingItem;
        if (!itemIdBeingEdited && getLocalRecords('items').some(savedItem => savedItem.id === item.id)) {
          return showToast(`${item.id} already exists in this inventory.`);
        }
        const savedItem = itemIdBeingEdited
          ? await updateInventoryItem(itemIdBeingEdited, item)
          : await saveRecord('items', item);
        if (!savedItem) return;
        addInventoryRow(savedItem);
        document.querySelector('#searchInput')?.dispatchEvent(new Event('input', { bubbles: true }));
        form.reset();
        fields[0].readOnly = true;
        fields[7].readOnly = false;
        fields[7].previousElementSibling.textContent = 'Opening quantity *';
        delete form.dataset.editingItem;
        document.querySelector('#addItemModal h3').textContent = 'Add a new inventory item';
        closeModal();
        window.IMS.refreshPage();
        return showToast(`${item.id} ${itemIdBeingEdited ? 'updated' : 'saved'} successfully.`);
      }
      if (form.id === 'requestForm') {
        const itemId = form.querySelector('#requestItem').value;
        const item = getLocalRecords('items').find(entry => entry.id === itemId);
        const quantity = Number(form.querySelector('#requestQuantity').value);
        if (!item || !Number.isSafeInteger(quantity) || quantity <= 0) {
          return showToast('Choose an item and enter a whole-number quantity greater than zero.');
        }
        const request = {
          id: form.querySelector('#requestId').value.trim(),
          date: form.querySelector('#requestDate').value,
          office: form.querySelector('#requestOffice').value,
          recipient: form.querySelector('#requestRecipient').value.trim(),
          employeeId: form.querySelector('#requestEmployeeId').value.trim().toUpperCase(),
          requesterId: currentUser.id,
          item: item.name,
          itemId,
          quantity: `${quantity} ${item.unit}`,
          status: 'Pending',
          remarks: form.querySelector('#requestRemarks').value.trim()
        };
        if (!/^[A-Z0-9-]{3,24}$/.test(request.employeeId)) {
          return showToast('Enter an employee ID using 3–24 letters, numbers, or hyphens.');
        }
        if (currentUser.role === 'end-user' && quantity > item.quantity) {
          return showToast(`Only ${item.quantity} ${item.unit} are currently available.`);
        }
        if (getLocalRecords('requests').some(savedRequest => savedRequest.id === request.id)) {
          return showToast(`${request.id} already exists.`);
        }
        const savedRequest = await saveRecord('requests', request);
        if (!savedRequest) return;
        form.reset();
        closeModal();
        window.IMS.refreshPage();
        return showToast(`${request.id} saved successfully as pending.`);
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
          && (entry.id === supplier.id || entry.name.toLowerCase() === supplier.name.toLowerCase()))) {
          return showToast('A supplier with this ID or name already exists.');
        }
        const savedSupplier = supplierBeingEdited
          ? await updateSupplier(supplierBeingEdited, supplier)
          : await saveRecord('suppliers', supplier);
        if (!savedSupplier) return;
        if (supplierBeingEdited) window.IMS.refreshPage();
        else {
          addSupplierCard(savedSupplier);
          fields[0].value = nextRecordId('suppliers', 'SUP-', 3);
          const list = document.querySelector('main .space-y-4');
          const count = [...document.querySelectorAll('main p')].find(paragraph => paragraph.textContent.includes('supplier records'));
          if (count && list) count.textContent = `${list.children.length} suppliers`;
          window.IMS.refreshPage();
        }
        resetModalForm(form);
        if (form.id === 'supplierForm') fields[0].value = nextRecordId('suppliers', 'SUP-', 3);
        closeModal();
        return showToast(`${supplier.name} ${supplierBeingEdited ? 'updated' : 'saved'} successfully.`);
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
          id: nextRecordId('receipts', 'RCV-2026-', 27),
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
        return showToast(`Saved successfully and supply record updated.`);
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
          id: nextRecordId('issuances', 'ISS-2026-', 20), requestId,
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
        return showToast(`${issuance.id} saved successfully and stock balance updated.`);
      }
    }, true);
  }
  Object.assign(window.IMS, { createIcon, showToast });
  applyTailwindUtilities();
  buildSidebar();
  function updatePendingCount() {
    const badge = document.querySelector('#sidebar nav a[href="stock_request.html"] span');
    if (badge) badge.textContent = String(getLocalRecords('requests').filter(request => request.status === 'Pending').length);
  }
  window.addEventListener('ims:records-updated', updatePendingCount);
  updatePendingCount();
  applyPreferences();
  setupActions();
  setupForms();
  if (new URLSearchParams(location.search).has('newRequest')) {
    window.setTimeout(() => openModal(), 0);
  }
  window.IMS.pageFeatures.forEach(initialize => initialize());
})();
});
