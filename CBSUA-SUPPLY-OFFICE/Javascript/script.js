const currentPage = location.pathname.split('/').pop() || 'index.html';
window.IMS = window.IMS || {};
window.IMS.pageFeatures = window.IMS.pageFeatures || [];
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
document.addEventListener('DOMContentLoaded', () => {
  const {
    getLocalRecords, saveRecord, updateRequestStatus, addInventoryRow,
    addRequestRow, addSupplierCard, nextRecordId
  } = window.IMS;
  const modalId = {
    'inventory.html': 'addItemModal',
    'stock_request.html': 'requestModal',
    'suppliers.html': 'supplierModal'
  }[currentPage];
  const pageModal = modalId ? document.getElementById(modalId) : null;
  let modalOpener = null;
  function openModal(opener) {
    if (!pageModal) return;
    modalOpener = opener || document.activeElement;
    pageModal.classList.remove('hidden');
    const dialog = pageModal.firstElementChild;
    if (dialog) setAttributes(dialog, {
      role: 'dialog', 'aria-modal': 'true',
      'aria-label': pageModal.querySelector('h3')?.textContent.trim() || 'Form dialog'
    });
    pageModal.querySelector('input:not([type="hidden"]), select, textarea, button')?.focus();
  }
  function closeModal() {
    if (!pageModal) return;
    pageModal.classList.add('hidden');
    modalOpener?.focus();
  }

  // Shared IMS behavior
  (() => {
  const svgNamespace = 'http://www.w3.org/2000/svg';
  const pages = [
    ['dashboard.html', 'Dashboard', 'M4 18V9m6 9V5m6 13V12m4 6H4'],
    ['inventory.html', 'Inventory', 'M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Zm9 13.5v-9m9-4.5-9 4.5-9-4.5'],
    ['stock_request.html', 'Stock Requests', 'M9 4.5h6M8 3.5h8a1 1 0 0 1 1 1v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-12a1 1 0 0 1 1-1h2Zm-1 7h8M7 11h8M7 15h6'],
    ['issue_supply.html', 'Issue Supplies', 'M9 12.5l2 2 4-5m-7.5 9.5h9a2 2 0 0 0 2-2V7.5a2 2 0 0 0-2-2h-9a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2Z'],
    ['receive_stock.html', 'Receive Stock', 'M12 4v8m0 0 3.5-3.5M12 12l-3.5-3.5M5 17.5h14'],
    ['suppliers.html', 'Suppliers', 'M4 20V7.5L12 4l8 3.5V20M8 20v-6h8v6M10 10h.01M14 10h.01M10 13h.01M14 13h.01']
  ];
  const preferenceKey = 'cbsuaSupplyPreferences', preferences = readPreferences();
  let toastTimer;
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
  function createButton(text, className, attribute, pathData) {
    const button = createElement('button', className);
    button.type = 'button';
    button.dataset[attribute] = '';
    button.append(createIcon(pathData, 'h-4 w-4'), document.createTextNode(` ${text}`));
    return button;
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
    let toast = document.querySelector('.ims-toast');
    if (!toast) {
      toast = createElement('div', 'ims-toast fixed bottom-4 right-4 z-[120] max-w-[calc(100vw-2rem)] rounded-lg bg-cbsua-dark px-4 py-3 text-sm text-white shadow-lg');
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
    const brand = sidebar.firstElementChild, nav = sidebar.querySelector('nav') || createElement('nav');
    const currentPage = location.pathname.split('/').pop() || 'dashboard.html';
    nav.className = 'flex-1 min-h-0 overflow-hidden';
    nav.replaceChildren(createElement('p', 'uppercase text-xs text-white/40 mb-2', 'Workspace'));
    pages.forEach(([href, label, pathData]) => {
      const isCurrent = href.split('#')[0] === currentPage;
      const link = createElement('a', `flex items-center gap-3 rounded-lg px-4 py-1.5 text-white/75 transition-colors hover:bg-white/10 hover:text-white${isCurrent ? ' bg-white/10 text-white' : ''}`);
      link.href = href;
      if (isCurrent) link.setAttribute('aria-current', 'page');
      const icon = createElement('span');
      icon.setAttribute('aria-hidden', 'true');
      icon.append(createIcon(pathData, 'h-4 w-4 fill-none stroke-current stroke-[1.8]'));
      const linkLabel = createElement('span', '', label);
      link.append(icon, linkLabel);
      if (label === 'Stock Requests') {
        const count = createElement('span', 'ml-auto rounded-full bg-white/20 px-2 py-0.5 text-xs', '3');
        link.append(count);
      }
      nav.append(link);
    });
    const footer = createElement('div', 'mt-auto shrink-0 border-t border-white/10 pt-3');
    footer.append(
      createButton('Settings', 'flex w-full items-center gap-3 rounded-lg border-0 bg-transparent px-4 py-1.5 text-left font-[inherit] text-white/75 hover:bg-white/10 hover:text-white', 'openSettings', 'M12 3.5v2.2m0 14.6v2.2m8.5-8.5h-2.2M5.7 12H3.5m14.9-6.4-1.5 1.5M8.1 15.9l-1.5 1.5m0-11.8 1.5 1.5m7.8 7.8 1.5 1.5M12 8.5A3.5 3.5 0 1 1 12 15.5A3.5 3.5 0 0 1 12 8.5Z'),
      createButton('Help?', 'flex w-full items-center gap-3 rounded-lg border-0 bg-transparent px-4 py-1.5 text-left font-[inherit] text-white/75 hover:bg-white/10 hover:text-white', 'openHelp', 'M9.75 9.25A2.5 2.5 0 0 1 12 7a2.5 2.5 0 0 1 2.5 2.5c0 1.7-1.5 2.2-2.1 3.1-.2.3-.4.6-.4 1.4M12 17.5h.01M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 0 0 0-17Z')
    );
    const signOut = createElement('a', 'flex items-center gap-3 rounded-lg px-4 py-1.5 text-white/75 hover:bg-white/10 hover:text-white');
    signOut.href = 'index.html';
    signOut.append(createIcon('M15 7.5V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-2.5M14 12h6m0 0-2.5-2.5M20 12l-2.5 2.5', 'h-4 w-4 fill-none stroke-current stroke-[1.8]'), document.createTextNode(' Sign out'));
    footer.append(signOut);
    sidebar.id = 'sidebar';
    sidebar.classList.add('fixed', 'left-0', 'top-0', 'z-40', 'h-screen', 'w-64', 'flex', 'flex-col', 'overflow-hidden', 'bg-cbsua-dark', 'p-4', 'text-white', 'transition-transform', '-translate-x-full', 'lg:translate-x-0');
    sidebar.setAttribute('aria-label', 'Workspace navigation');
    sidebar.replaceChildren(brand, nav, footer);
    main.classList.remove('ml-64', 'lg:ml-64');
    main.classList.add('min-w-0', 'ml-0', 'lg:ml-64', 'pt-16', 'lg:pt-6');
    const compact = window.matchMedia('(min-width: 1024px) and (max-height: 640px)').matches;
    sidebar.classList.toggle('p-3', compact);
    sidebar.classList.toggle('p-4', !compact);
    brand.classList.toggle('!mb-2', compact);
    brand.firstElementChild?.classList.toggle('!mb-2', compact);
    nav.firstElementChild?.classList.toggle('!mb-1', compact);
    sidebar.querySelectorAll('nav a, nav button, .mt-auto a, .mt-auto button').forEach(link => {
      link.classList.toggle('py-0.5', compact);
      link.classList.toggle('py-1.5', !compact);
    });
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
    const section = createElement('section', 'max-h-[88vh] w-full max-w-xl overflow-auto rounded-xl border border-gray-200 bg-white p-6 text-gray-900 shadow-2xl dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100');
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
  function closeDialog() {
    dialog.hidden = true;
    dialog.classList.add('hidden');
    dialog.classList.remove('grid');
    dialogOpener?.focus();
    dialogOpener = null;
  }
  function showDialog() {
    dialog.hidden = false;
    dialog.classList.remove('hidden');
    dialog.classList.add('grid');
    dialog.querySelector('.ims-settings-close').focus();
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
    dialogDescription.textContent = 'Appearance preference is saved in this browser.';
    dialogContent.replaceChildren();
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
    dialogContent.append(createElement('p', '', 'Changes apply across all workspace pages on this device.'));
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
      'Use the workspace menu to move between the Dashboard, Inventory, Stock Requests, Issue Supplies, Receive Stock, and Suppliers. Inventory items, requests, suppliers, and stock movements are saved in this browser on this device.',
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
    document.addEventListener('click', event => {
      const target = event.target.closest('button, a');
      if (!target) return;
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
        if (target.textContent.trim() === 'Cancel') target.closest('form')?.reset();
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
      if (target.matches('.ims-menu-toggle')) return setMenuOpen(document.getElementById('sidebar')?.classList.contains('-translate-x-full'));
      if (target.matches('.ims-menu-backdrop')) return setMenuOpen(false);
      if (target.id === 'themeToggle') {
        preferences.theme = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
        savePreferences();
        applyPreferences();
        return showToast(`Switched to ${preferences.theme} appearance.`);
      }
      const label = target.textContent.trim();
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
        target.closest('form').reset();
        return;
      }
      if (target.matches('a[href="#"]') && !target.closest('#sidebar')) {
        event.preventDefault();
        if (label.includes('Export list')) return;
        if (label.includes('history') || label.includes('transactions')) {
          location.href = 'dashboard.html#transactions';
        } else if (label.includes('Edit')) {
          showToast('Sample records are read-only in this browser.');
        } else if (label.includes('Review')) {
          const row = target.closest('tr'), requestId = row?.cells[0]?.innerText.trim().split('\n')[0];
          if (row && confirm(`Approve ${requestId}?`)) {
            if (!updateRequestStatus(requestId, 'Approved')) return;
            const status = row.cells[4].querySelector('span');
            status.textContent = 'Approved';
            status.className = 'badge bg-green-100 text-green-700';
            target.replaceWith(document.createTextNode('Issue →'));
            row.hidden = false;
            showToast(`${requestId} approved.`);
          }
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
      const sidebar = document.getElementById('sidebar'), compact = window.innerWidth >= 1024 && window.innerHeight <= 640;
      sidebar?.classList.toggle('p-3', compact);
      sidebar?.classList.toggle('p-4', !compact);
      sidebar?.querySelectorAll('nav a, nav button, .mt-auto a, .mt-auto button').forEach(link => {
        link.classList.toggle('py-0.5', compact);
        link.classList.toggle('py-1.5', !compact);
      });
    });
  }
  // Form handlers
  function setupForms() {
    document.addEventListener('submit', event => {
      const form = event.target;
      if (form.id === 'loginForm') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (form.id === 'addItemForm') {
        const fields = [...form.elements];
        const item = {
          id: fields[0].value.trim(), name: fields[1].value.trim(),
          description: fields[2].value.trim(), category: fields[3].selectedOptions[0].textContent.split(' — ').slice(1).join(' — '),
          supplier: fields[4].selectedOptions[0].textContent.split(' — ').slice(1).join(' — '), unit: fields[5].value.trim(),
          minimum: Number(fields[6].value), quantity: Number(fields[7].value), expiry: fields[8].value
        };
        const alreadyExists = getLocalRecords('items').some(savedItem => savedItem.id === item.id);
        if (alreadyExists) return showToast(`${item.id} already exists in this inventory.`);
        const savedItem = saveRecord('items', item);
        if (!savedItem) return;
        addInventoryRow(savedItem);
        document.querySelector('#searchInput')?.dispatchEvent(new Event('input', { bubbles: true }));
        form.reset();
        form.closest('.fixed')?.classList.add('hidden');
        return showToast(`${item.id} saved successfully.`);
      }
      if (form.id === 'requestForm') {
        const fields = [...form.elements];
        const request = {
          id: fields[0].value.trim(), date: fields[1].value, office: fields[2].value,
          recipient: 'Requesting employee',
          item: fields[3].selectedOptions[0].textContent.split('(')[0].trim(),
          quantity: `${fields[4].value} ${fields[3].selectedOptions[0].textContent.match(/\d+\s+(\w+) available/)?.[1] || 'units'}`, remarks: fields[5].value.trim()
        };
        const savedRequest = saveRecord('requests', request);
        if (!savedRequest) return;
        addRequestRow(savedRequest);
        fields[0].value = nextRecordId('requests', 'REQ-2026-', 44);
        document.querySelector('main input[type="text"]')?.dispatchEvent(new Event('input', { bubbles: true }));
        form.closest('.fixed')?.classList.add('hidden');
        return showToast(`${request.id} saved successfully as pending.`);
      }
      if (form.id === 'supplierForm') {
        const fields = [...form.elements];
        const supplier = {
          id: fields[0].value.trim(), name: fields[1].value.trim(), category: fields[2].value.trim(),
          contact: fields[3].value.trim(), phone: fields[4].value.trim(), email: fields[5].value.trim(), address: fields[6].value.trim()
        };
        const savedSupplier = saveRecord('suppliers', supplier);
        if (!savedSupplier) return;
        addSupplierCard(savedSupplier);
        form.reset();
        fields[0].value = nextRecordId('suppliers', 'SUP-', 3);
        form.closest('.fixed')?.classList.add('hidden');
        const list = document.querySelector('main .space-y-4');
        const count = [...document.querySelectorAll('main p')].find(paragraph => paragraph.textContent.includes('sample suppliers'));
        if (count && list) count.textContent = `${list.children.length} suppliers`;
        return showToast(`${supplier.name} saved successfully.`);
      }
      if (form.querySelector('#receiptUpload')) {
        const quantity = Number(form.querySelector('input[type="number"]')?.value);
        if (!Number.isFinite(quantity) || quantity <= 0) return showToast('Enter a quantity greater than zero.');
        const selects = [...form.querySelectorAll('select')], inputs = [...form.querySelectorAll('input')];
        const itemOption = selects[1].selectedOptions[0].textContent;
        const receipt = {
          id: `RCV-${crypto.randomUUID()}`, supplier: selects[0].selectedOptions[0].textContent,
          deliveryReference: inputs[0].value.trim(), itemId: itemOption.match(/ITM-\d+/)?.[0] || '',
          itemName: itemOption.split(' — ').slice(1).join(' — '),
          quantity,
          receivedDate: inputs[2].value, receivedBy: inputs[3].value.trim(), batchNumber: inputs[4].value.trim(),
          expiryDate: inputs[5].value,
          remarks: form.querySelector('textarea')?.value.trim() || '',
          attachmentName: form.querySelector('#receiptUpload')?.files[0]?.name || ''
        };
        const savedReceipt = saveRecord('receipts', receipt);
        if (!savedReceipt) return;
        return showToast(`Saved successfully and supply record updated.`);
      }
      if (form.querySelector('input[readonly][value*="Supply Officer"]')) {
        const quantityInput = form.querySelector('input[type="number"]'), checkbox = document.querySelector('input[type="checkbox"]');
        const readonlyInputs = [...form.querySelectorAll('input[readonly]')], requested = Number.parseFloat(readonlyInputs[1]?.value) || 0;
        const quantity = Number(quantityInput?.value);
        if (!Number.isFinite(quantity) || quantity <= 0 || quantity > requested) return showToast(`Issue a quantity from 1 to ${requested}.`);
        const itemId = readonlyInputs[0]?.value.match(/ITM-\d+/)?.[0], available = getLocalRecords('items').find(item => item.id === itemId)?.quantity || 0;
        if (quantity > available) return showToast(`Only ${available} units are currently available.`);
        if (!checkbox?.checked) return showToast('Confirm the recipient and physical quantity before issuing.');
        const itemMatch = readonlyInputs[0]?.value.match(/(ITM-\d+)\s+—\s+(.+)/);
        const issuance = {
          id: `ISS-${crypto.randomUUID()}`, requestId: form.querySelector('select').selectedOptions[0].textContent.split(' · ')[0],
          itemId: itemMatch?.[1] || '', itemName: itemMatch?.[2] || readonlyInputs[0].value, quantity,
          office: readonlyInputs[2].value, recipient: form.querySelectorAll('select')[1].value,
          date: form.querySelector('input[type="date"]')?.value, handledBy: readonlyInputs[3].value,
          remarks: form.querySelector('textarea')?.value.trim() || ''
        };
        const savedIssuance = saveRecord('issuances', issuance);
        if (!savedIssuance) return;
        return showToast(`${issuance.id} saved successfully and stock balance updated.`);
      }
    }, true);
  }
  Object.assign(window.IMS, { createIcon, showToast });
  applyTailwindUtilities();
  buildSidebar();
  applyPreferences();
  setupActions();
  setupForms();
  if (new URLSearchParams(location.search).has('newRequest')) {
    window.setTimeout(() => openModal(), 0);
  }
  window.IMS.pageFeatures.forEach(initialize => initialize());
})();
});
