window.IMS.pageFeatures.push(() => {
  const availableItemList = document.getElementById('availableItemList');
  const officeItemAllocationList = document.getElementById('officeItemAllocationList');
  const requestList = document.getElementById('myRequestList');
  const itemSelect = document.getElementById('requestItem');
  const quantityInput = document.getElementById('requestQuantity');
  const requestForm = document.getElementById('requestForm');
  const notificationToggle = document.getElementById('userNotificationToggle');
  const notificationPanel = document.getElementById('userNotificationPanel');
  const notificationBadge = document.getElementById('userNotificationBadge');
  const notificationSummary = document.getElementById('userNotificationSummary');
  const notificationList = document.getElementById('userNotificationList');
  const markNotificationsRead = document.getElementById('markNotificationsRead');
  const requestClassifications = {
    consumable: { label: 'Consumable', itemClassification: 'consumable' },
    'semi-expendable': { label: 'Semi-expendable', itemClassification: 'semi-expendable' },
    'fixed-asset': { label: 'Fixed Asset', itemClassification: 'fixed asset' }
  };
  let currentRequests = [];
  let currentNotifications = [];

  function makeRequestRow(request) {
    const row = document.createElement('tr');
    row.className = 'border-b border-cbsua-border/50';
    row.dataset.requestId = request.id;
    row.tabIndex = -1;

    const requestCell = document.createElement('td');
    requestCell.className = 'py-3 pr-4';
    const requestId = document.createElement('p');
    requestId.className = 'font-medium';
    requestId.textContent = request.id;
    const requestDate = document.createElement('p');
    requestDate.className = 'text-xs text-cbsua-muted';
    requestDate.textContent = request.date || 'Date not recorded';
    requestCell.append(requestId, requestDate);

    const itemCell = document.createElement('td');
    itemCell.className = 'py-3 pr-4';
    const itemName = document.createElement('p');
    itemName.className = 'font-medium';
    itemName.textContent = request.item || 'Item not recorded';
    const itemQuantity = document.createElement('p');
    itemQuantity.className = 'text-xs text-cbsua-muted';
    const formSummary = request.documentType
      ? `${request.supplyClassification || 'Classification not set'} · ${request.documentType}`
      : 'Existing request';
    const references = request.classificationDetails || {};
    const referenceSummary = [
      references.fundCluster && `FC: ${references.fundCluster}`,
      references.purchaseOrderNumber && `PO: ${references.purchaseOrderNumber}`,
      references.iarNumber && `IAR: ${references.iarNumber}`
    ].filter(Boolean).join(' · ');
    itemQuantity.textContent = [
      request.quantity || 'Quantity not recorded',
      formSummary,
      referenceSummary
    ].filter(Boolean).join(' · ');
    itemCell.append(itemName, itemQuantity);

    const statusCell = document.createElement('td');
    statusCell.className = 'py-3 pr-4';
    const status = request.status || 'Pending';
    const statusBadge = document.createElement('span');
    const statusClass = {
      Approved: 'bg-green-100 text-green-700',
      Issued: 'bg-blue-100 text-blue-700',
      Rejected: 'bg-red-100 text-red-700',
      Cancelled: 'bg-red-100 text-red-700',
      Canceled: 'bg-red-100 text-red-700'
    }[status] || 'bg-amber-100 text-amber-700';
    statusBadge.className = `badge rounded-full px-2.5 py-1 text-xs font-medium ${statusClass}`;
    statusBadge.textContent = status;
    statusCell.append(statusBadge);

    const actionCell = document.createElement('td');
    actionCell.className = 'py-3';
    if (status === 'Pending') {
      const actions = document.createElement('div');
      actions.className = 'flex flex-wrap gap-2';
      const editButton = document.createElement('button');
      editButton.type = 'button';
      editButton.className = 'rounded-lg border border-cbsua-border px-3 py-1.5 text-xs font-medium text-cbsua-primary hover:bg-gray-50';
      editButton.dataset.editRequest = request.id;
      editButton.textContent = 'Edit request';
      const cancelButton = document.createElement('button');
      cancelButton.type = 'button';
      cancelButton.className = 'rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50';
      cancelButton.dataset.cancelRequest = request.id;
      cancelButton.textContent = 'Cancel request';
      actions.append(editButton, cancelButton);
      actionCell.append(actions);
    } else {
      actionCell.textContent = '—';
      actionCell.classList.add('text-cbsua-muted');
    }

    const remarksCell = document.createElement('td');
    remarksCell.className = 'py-3 text-cbsua-muted';
    remarksCell.textContent = request.remarks || '—';
    row.append(requestCell, itemCell, statusCell, actionCell, remarksCell);
    return row;
  }

  function getNotificationReadKey(user) {
    return `cbsuaSupplyUserNotificationReads:${user.id}`;
  }

  function readNotificationKeys(user) {
    try {
      const savedKeys = JSON.parse(localStorage.getItem(getNotificationReadKey(user)) || '[]');
      if (Array.isArray(savedKeys)) return new Set(savedKeys);
      console.error('Saved notification read state has an invalid format.');
    } catch (error) {
      console.error('Saved notification read state could not be loaded.', error);
    }
    return new Set();
  }

  function saveNotificationKeys(user, readKeys) {
    try {
      localStorage.setItem(getNotificationReadKey(user), JSON.stringify([...readKeys]));
    } catch (error) {
      console.error('Notification read state could not be saved.', error);
      window.IMS.showToast?.('Notification read state could not be saved in this browser.');
    }
  }

  function notificationKey(request) {
    const status = request.status || 'Pending';
    return `${request.id}:${status}:${request.reviewedAt || request.createdAt || ''}`;
  }

  function renderNotifications(requests) {
    if (!notificationList) return;
    const user = window.IMS.currentUser;
    if (!user) return;

    currentNotifications = requests.map(request => {
      const status = request.status || 'Pending';
      const messages = {
        Pending: ['Request pending', 'Your request is waiting for Supply Office review.'],
        Approved: ['Request approved', 'Your request has been approved.'],
        Rejected: ['Request rejected', 'Your request was not approved. Contact the Supply Office if you need more information.'],
        Issued: ['Request issued', 'Your requested supplies have been issued.']
      };
      const [title, message] = messages[status] || ['Request updated', `Your request status is ${status}.`];
      return {
        key: notificationKey(request),
        requestId: request.id,
        title: `${title} · ${request.id}`,
        details: `${request.item || 'Stock item'} · ${request.quantity || 'Quantity not recorded'}. ${message}`,
        remarks: request.remarks || ''
      };
    });

    const readKeys = readNotificationKeys(user);
    const unreadCount = currentNotifications.filter(notification => !readKeys.has(notification.key)).length;
    notificationList.replaceChildren();
    if (!currentNotifications.length) {
      const emptyState = document.createElement('p');
      emptyState.className = 'px-4 py-6 text-center text-sm text-cbsua-muted';
      emptyState.textContent = 'Your request updates will appear here.';
      notificationList.append(emptyState);
    } else {
      currentNotifications.forEach(notification => {
        const unread = !readKeys.has(notification.key);
        const link = document.createElement('a');
        link.href = '#myRequests';
        link.dataset.notificationKey = notification.key;
        link.dataset.requestId = notification.requestId;
        link.className = `block border-b border-cbsua-border px-4 py-3 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-700${unread ? ' bg-cbsua-light/50' : ''}`;

        const heading = document.createElement('div');
        heading.className = 'flex items-start justify-between gap-3';
        const title = document.createElement('p');
        title.className = 'text-sm font-medium';
        title.textContent = notification.title;
        heading.append(title);
        if (unread) {
          const newBadge = document.createElement('span');
          newBadge.className = 'shrink-0 rounded-full bg-cbsua-primary px-2 py-0.5 text-xs font-medium text-white';
          newBadge.textContent = 'New';
          heading.append(newBadge);
        }

        const details = document.createElement('p');
        details.className = 'mt-1 text-xs text-cbsua-muted';
        details.textContent = notification.details;
        link.append(heading, details);
        if (notification.remarks) {
          const remarks = document.createElement('p');
          remarks.className = 'mt-1 text-xs text-cbsua-muted';
          remarks.textContent = `Purpose: ${notification.remarks}`;
          link.append(remarks);
        }
        notificationList.append(link);
      });
    }

    if (notificationBadge) {
      notificationBadge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
      notificationBadge.classList.toggle('hidden', unreadCount === 0);
    }
    if (notificationSummary) {
      notificationSummary.textContent = unreadCount
        ? `${unreadCount} unread update${unreadCount === 1 ? '' : 's'}`
        : 'No new updates';
    }
    notificationToggle?.setAttribute(
      'aria-label',
      `Request notifications, ${unreadCount} unread update${unreadCount === 1 ? '' : 's'}`
    );
    if (markNotificationsRead) markNotificationsRead.disabled = unreadCount === 0;
  }

  function setNotificationPanelOpen(isOpen) {
    if (!notificationToggle || !notificationPanel) return;
    notificationPanel.classList.toggle('hidden', !isOpen);
    notificationToggle.setAttribute('aria-expanded', String(isOpen));
  }

  function updateQuantityLimit(items) {
    if (!itemSelect || !quantityInput) return;
    const selectedItem = items.find(item => item.id === itemSelect.value);
    if (!selectedItem) {
      quantityInput.removeAttribute('max');
      return;
    }
    const editingRequest = window.IMS.getLocalRecords('requests')
      .find(request => request.id === requestForm?.dataset.editingRequest);
    const requestAllocation = window.IMS.getQuarterlyRequestLimitRemaining(
      selectedItem.id,
      window.IMS.currentUser?.office,
      editingRequest?.id || '',
      editingRequest?.createdAt || new Date()
    );
    const availableQuantity = Math.min(Number(selectedItem.quantity), requestAllocation);
    quantityInput.max = String(availableQuantity);
    if (availableQuantity > 0 && Number(quantityInput.value) > availableQuantity) {
      quantityInput.value = String(availableQuantity);
    }
  }

  function renderRequestItemOptions(items) {
    if (!itemSelect) return;
    const previousValue = itemSelect.value;
    const selectedClassification = requestClassifications[requestForm?.dataset.supplyClassification];
    const editingRequest = window.IMS.getLocalRecords('requests')
      .find(request => request.id === requestForm?.dataset.editingRequest);
    const availableItems = items.filter(item => Number(item.quantity) > 0 || item.id === editingRequest?.itemId);
    const matchingItems = availableItems.filter(item => !selectedClassification
      || String(item.supplyClassification || '').trim().toLowerCase() === selectedClassification.itemClassification);
    const selectableItems = matchingItems.filter(item =>
      Number(window.IMS.getQuarterlyRequestLimitRemaining(
        item.id,
        window.IMS.currentUser?.office,
        editingRequest?.id || '',
        editingRequest?.createdAt || new Date()
      )) > 0);
    itemSelect.replaceChildren();
    selectableItems.forEach(item => {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = `${item.name} (${item.quantity} ${item.unit} available)`;
      itemSelect.append(option);
    });
    if (selectableItems.length) {
      itemSelect.value = selectableItems.some(item => item.id === previousValue)
        ? previousValue
        : selectableItems[0].id;
    } else {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = selectedClassification
        ? `No ${selectedClassification.label} items have an available office allocation`
        : 'No items have an available office allocation';
      itemSelect.append(option);
    }
    itemSelect.disabled = selectableItems.length === 0;
    const submitButton = requestForm?.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = selectableItems.length === 0;
    updateQuantityLimit(selectableItems);
  }

  function renderAvailableItems(items) {
    if (!availableItemList) return;
    const availableItems = items.filter(item => Number(item.quantity) > 0);
    availableItemList.replaceChildren();

    if (!availableItems.length) {
      const emptyState = document.createElement('p');
      emptyState.className = 'col-span-full rounded-lg border border-dashed border-cbsua-border p-8 text-center text-sm text-cbsua-muted';
      emptyState.textContent = 'There are no items currently available to request.';
      availableItemList.append(emptyState);
    } else {
      availableItems.forEach(item => {
        const card = document.createElement('article');
        card.className = 'flex flex-col gap-3 rounded-xl border border-cbsua-border p-4';

        const heading = document.createElement('div');
        const name = document.createElement('h4');
        name.className = 'font-semibold';
        name.textContent = item.name;
        const id = document.createElement('p');
        id.className = 'text-xs text-cbsua-muted';
        id.textContent = item.id;
        heading.append(name, id);

        const detail = document.createElement('p');
        detail.className = 'text-sm text-cbsua-muted';
        const remaining = window.IMS.getQuarterlyRequestLimitRemaining(
          item.id, window.IMS.currentUser?.office
        );
        detail.textContent = `${item.category || 'General supplies'} · ${item.quantity} ${item.unit} available · ${remaining} ${item.unit} requestable this quarter`;

        const actionRow = document.createElement('div');
        actionRow.className = 'mt-auto flex items-center justify-between gap-3';
        const stockState = document.createElement('span');
        stockState.className = item.quantity <= item.minimum
          ? 'text-xs font-medium text-amber-700'
          : 'text-xs font-medium text-green-700';
        stockState.textContent = item.quantity <= item.minimum ? 'Low stock' : 'Available';

        const requestButton = document.createElement('button');
        requestButton.type = 'button';
        requestButton.dataset.openModal = '';
        requestButton.dataset.requestItem = item.id;
        requestButton.className = 'rounded-lg bg-cbsua-primary px-3 py-2 text-sm font-medium text-white hover:bg-green-700';
        requestButton.textContent = 'Request item';
        requestButton.disabled = remaining <= 0;
        if (requestButton.disabled) {
          requestButton.classList.add('cursor-not-allowed', 'opacity-50');
          requestButton.title = 'No request allocation remains for this item this quarter.';
        }

        actionRow.append(stockState, requestButton);
        card.append(heading, detail, actionRow);
        availableItemList.append(card);
      });
    }

    renderRequestItemOptions(items);
  }

  function renderOfficeItemAllocations(user) {
    if (!officeItemAllocationList) return;
    const currentYear = new Date().getFullYear();
    const quotas = window.IMS.getLocalRecords('officeQuotas')
      .filter(quota => String(quota.office || '').trim().toLowerCase()
        === String(user.office || '').trim().toLowerCase()
        && Number(quota.year) === currentYear);
    officeItemAllocationList.replaceChildren();
    if (!quotas.length) {
      const emptyState = document.createElement('p');
      emptyState.className = 'col-span-full rounded-lg border border-dashed border-cbsua-border p-6 text-center text-sm text-cbsua-muted';
      emptyState.textContent = 'No item allocations are assigned to your office for this year. Contact the Supply Office administrator.';
      officeItemAllocationList.append(emptyState);
      return;
    }

    const currentQuarter = Math.floor(new Date().getMonth() / 3);
    quotas.forEach(quota => {
      const card = document.createElement('article');
      card.className = 'rounded-lg border border-cbsua-border p-4';
      const heading = document.createElement('div');
      heading.className = 'flex items-start justify-between gap-3';
      const itemName = document.createElement('h4');
      itemName.className = 'font-semibold';
      itemName.textContent = quota.itemName;
      const allocationYear = document.createElement('span');
      allocationYear.className = 'shrink-0 text-xs text-cbsua-muted';
      allocationYear.textContent = String(quota.year);
      heading.append(itemName, allocationYear);

      const annualUsage = document.createElement('p');
      annualUsage.className = 'mt-2 text-sm text-cbsua-muted';
      annualUsage.textContent = `Annual allocation: ${quota.annualUsed} / ${quota.annualLimit} ${quota.unit} · ${Math.max(0, quota.annualLimit - quota.annualUsed)} remaining`;

      const quarters = document.createElement('div');
      quarters.className = 'mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4';
      quota.quarterLimits.forEach((limit, index) => {
        const quarter = document.createElement('div');
        quarter.className = `rounded-md px-2 py-2 text-center text-xs ${index === currentQuarter ? 'bg-cbsua-pale font-semibold text-cbsua-primary' : 'bg-gray-50 text-cbsua-muted'}`;
        quarter.textContent = `Q${index + 1}: ${quota.quarterUsage[index]} / ${limit} ${quota.unit}`;
        quarters.append(quarter);
      });
      card.append(heading, annualUsage, quarters);
      officeItemAllocationList.append(card);
    });
  }

  function render() {
    const user = window.IMS.currentUser;
    if (!user) return;

    const officeName = user.office || 'Office not set';
    document.getElementById('userName').textContent = user.name || user.username;
    document.getElementById('userOffice').textContent = officeName;
    document.getElementById('officeGreeting').textContent = `${officeName} · ${user.employeeId || 'Employee ID not set'}`;
    renderOfficeItemAllocations(user);

    const officeKey = officeName.trim().toLowerCase();
    const employeeId = (user.employeeId || '').trim().toUpperCase();
    const requests = window.IMS.getLocalRecords('requests').filter(request => {
      if ((request.office || '').trim().toLowerCase() !== officeKey) return false;
      if (request.requesterId != null) return String(request.requesterId) === String(user.id);
      return employeeId && (request.employeeId || '').trim().toUpperCase() === employeeId;
    }).sort((left, right) => new Date(right.createdAt || right.date) - new Date(left.createdAt || left.date));
    currentRequests = requests;
    renderNotifications(requests);
    const statusCount = status => requests.filter(request =>
      (request.status || 'Pending').toLowerCase() === status.toLowerCase()).length;

    document.getElementById('myRequestCount').textContent = String(requests.length);
    document.getElementById('pendingRequestCount').textContent = String(statusCount('Pending'));
    document.getElementById('approvedRequestCount').textContent = String(statusCount('Approved'));
    document.getElementById('issuedRequestCount').textContent = String(statusCount('Issued'));

    if (requestList) {
      requestList.replaceChildren();
      if (!requests.length) {
        const row = document.createElement('tr');
        const message = document.createElement('td');
        message.colSpan = 5;
        message.className = 'py-8 text-center text-sm text-cbsua-muted';
        message.textContent = 'You have not submitted any requests for this office yet.';
        row.append(message);
        requestList.append(row);
      } else {
        requests.forEach(request => requestList.append(makeRequestRow(request)));
      }
    }

    const items = window.IMS.getLocalRecords('items');
    renderAvailableItems(items);
    const officeField = document.getElementById('requestOffice');
    const recipientField = document.getElementById('requestRecipient');
    const employeeIdField = document.getElementById('requestEmployeeId');
    if (officeField) {
      officeField.value = user.office || '';
      const officeId = user.officeId || window.IMS.accounts.getOfficeId(user.office);
      officeField.title = officeId ? `${officeId} — ${user.office}` : user.office || '';
      const officeIdField = document.getElementById('requestOfficeId');
      if (officeIdField) officeIdField.textContent = officeId ? `Office ID: ${officeId}` : '';
    }
    if (recipientField) recipientField.value = user.name || '';
    if (employeeIdField) {
      employeeIdField.value = user.employeeId || '';
      employeeIdField.readOnly = false;
    }
  }

  itemSelect?.addEventListener('change', () => {
    updateQuantityLimit(window.IMS.getLocalRecords('items').filter(item => Number(item.quantity) > 0));
  });
  requestList?.addEventListener('click', async event => {
    const editButton = event.target.closest('[data-edit-request]');
    if (editButton) {
      const request = currentRequests.find(entry => entry.id === editButton.dataset.editRequest);
      if (!request || request.status !== 'Pending') return;
      window.dispatchEvent(new CustomEvent('ims:edit-request', {
        detail: { requestId: request.id, opener: editButton }
      }));
      return;
    }
    const cancelButton = event.target.closest('[data-cancel-request]');
    if (!cancelButton) return;
    const requestId = cancelButton.dataset.cancelRequest;
    const request = currentRequests.find(entry => entry.id === requestId);
    if (!request || request.status !== 'Pending') return;
    if (!window.confirm(`Cancel pending request ${requestId}?`)) return;
    if (await window.IMS.cancelRequest(requestId)) {
      window.IMS.showToast(`${requestId} cancelled.`);
    }
  });
  notificationToggle?.addEventListener('click', () => {
    setNotificationPanelOpen(notificationPanel?.classList.contains('hidden'));
  });
  notificationList?.addEventListener('click', event => {
    const link = event.target.closest('[data-notification-key]');
    if (!link) return;
    event.preventDefault();
    const user = window.IMS.currentUser;
    if (!user) return;
    const readKeys = readNotificationKeys(user);
    readKeys.add(link.dataset.notificationKey);
    saveNotificationKeys(user, readKeys);
    const requestId = link.dataset.requestId;
    renderNotifications(currentRequests);
    setNotificationPanelOpen(false);
    const row = [...(requestList?.querySelectorAll('tr[data-request-id]') || [])]
      .find(entry => entry.dataset.requestId === requestId);
    row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    row?.focus({ preventScroll: true });
  });
  markNotificationsRead?.addEventListener('click', () => {
    const user = window.IMS.currentUser;
    if (!user) return;
    const readKeys = readNotificationKeys(user);
    currentNotifications.forEach(notification => readKeys.add(notification.key));
    saveNotificationKeys(user, readKeys);
    renderNotifications(currentRequests);
  });
  document.addEventListener('click', event => {
    const requestButton = event.target.closest('[data-request-item]');
    if (requestButton && itemSelect) {
      itemSelect.value = requestButton.dataset.requestItem;
      itemSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (!notificationPanel?.contains(event.target) && !notificationToggle?.contains(event.target)) {
      setNotificationPanelOpen(false);
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') setNotificationPanelOpen(false);
  });
  window.addEventListener('ims:records-updated', render);
  window.addEventListener('ims:request-classification-changed', () => {
    renderRequestItemOptions(window.IMS.getLocalRecords('items'));
  });
  window.addEventListener('storage', event => {
    if (event.key?.startsWith('cbsuaSupplyUserNotificationReads:')) {
      renderNotifications(currentRequests);
    }
  });
  render();
});
