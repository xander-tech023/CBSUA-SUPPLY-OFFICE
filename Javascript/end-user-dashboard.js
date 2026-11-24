window.IMS.pageFeatures.push(() => {
  const availableItemList = document.getElementById('availableItemList');
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
    itemQuantity.textContent = request.quantity || 'Quantity not recorded';
    itemCell.append(itemName, itemQuantity);

    const statusCell = document.createElement('td');
    statusCell.className = 'py-3 pr-4';
    const status = request.status || 'Pending';
    const statusBadge = document.createElement('span');
    const statusClass = {
      Approved: 'bg-green-100 text-green-700',
      Issued: 'bg-blue-100 text-blue-700',
      Rejected: 'bg-red-100 text-red-700'
    }[status] || 'bg-amber-100 text-amber-700';
    statusBadge.className = `badge rounded-full px-2.5 py-1 text-xs font-medium ${statusClass}`;
    statusBadge.textContent = status;
    statusCell.append(statusBadge);

    const remarksCell = document.createElement('td');
    remarksCell.className = 'py-3 text-cbsua-muted';
    remarksCell.textContent = request.remarks || '—';
    row.append(requestCell, itemCell, statusCell, remarksCell);
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
    const availableQuantity = Number(selectedItem.quantity);
    quantityInput.max = String(availableQuantity);
    if (Number(quantityInput.value) > availableQuantity) {
      quantityInput.value = String(availableQuantity);
    }
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
        detail.textContent = `${item.category || 'General supplies'} · ${item.quantity} ${item.unit} available`;

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

        actionRow.append(stockState, requestButton);
        card.append(heading, detail, actionRow);
        availableItemList.append(card);
      });
    }

    if (itemSelect) {
      const previousValue = itemSelect.value;
      itemSelect.replaceChildren();
      availableItems.forEach(item => {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = `${item.name} (${item.quantity} ${item.unit} available)`;
        itemSelect.append(option);
      });
      if (availableItems.length) {
        itemSelect.value = availableItems.some(item => item.id === previousValue)
          ? previousValue
          : availableItems[0].id;
      } else {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No items currently available';
        itemSelect.append(option);
      }
      itemSelect.disabled = availableItems.length === 0;
      const submitButton = requestForm?.querySelector('button[type="submit"]');
      if (submitButton) submitButton.disabled = availableItems.length === 0;
      updateQuantityLimit(availableItems);
    }
  }

  function render() {
    const user = window.IMS.currentUser;
    if (!user) return;

    const officeName = user.office || 'Office not set';
    document.getElementById('userName').textContent = user.name || user.username;
    document.getElementById('userOffice').textContent = officeName;
    document.getElementById('officeGreeting').textContent = `${officeName} · ${user.employeeId || 'Employee ID not set'}`;

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
        message.colSpan = 4;
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
      updateQuantityLimit(window.IMS.getLocalRecords('items').filter(item => Number(item.quantity) > 0));
    }
    if (!notificationPanel?.contains(event.target) && !notificationToggle?.contains(event.target)) {
      setNotificationPanelOpen(false);
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') setNotificationPanelOpen(false);
  });
  window.addEventListener('ims:records-updated', render);
  window.addEventListener('storage', event => {
    if (event.key === 'cbsuaSupplyRecords') {
      window.IMS.initializeRecords()
        .then(() => window.dispatchEvent(new CustomEvent('ims:records-updated')))
        .catch(error => console.error('Your dashboard could not be refreshed.', error));
    } else if (event.key?.startsWith('cbsuaSupplyUserNotificationReads:')) {
      renderNotifications(currentRequests);
    }
  });
  render();
});
