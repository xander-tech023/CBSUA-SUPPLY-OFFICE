document.addEventListener('DOMContentLoaded', () => {
  const { getLocalRecords } = window.IMS;
  const canvas = document.getElementById('stockChart');
  const chartDescription = canvas?.closest('.stat-card')?.querySelector('p.text-xs');
  const stats = [...document.querySelectorAll('main .stat-card')].slice(0, 4);
  const transactionBody = document.querySelector('#transactions tbody');
  const attentionList = document.querySelector('main .grid.grid-cols-1.lg\\:grid-cols-3 > .stat-card:last-child .space-y-3');
  const notificationToggle = document.getElementById('notificationToggle');
  const notificationPanel = document.getElementById('notificationPanel');
  const notificationBadge = document.getElementById('notificationBadge');
  const notificationSummary = document.getElementById('notificationSummary');
  const notificationList = document.getElementById('notificationList');
  let chart = null;

  function makeCell(text) {
    const cell = document.createElement('td');
    cell.className = 'py-3';
    cell.textContent = text;
    return cell;
  }

  function renderNotifications(requests, items) {
    if (!notificationList) return;
    const notifications = requests
      .filter(request => request.status === 'Pending')
      .map(request => ({
        title: `Approval needed · ${request.id}`,
        details: `${request.office || 'Office'} · ${request.recipient || 'End user'} requested ${request.quantity} of ${request.item}.`,
        note: request.remarks ? `End-user note: ${request.remarks}` : '',
        href: 'stock_request.html'
      }));

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    items.forEach(item => {
      const quantity = Number(item.quantity);
      const minimum = Number(item.minimum);
      if (Number.isFinite(quantity) && Number.isFinite(minimum) && quantity <= minimum) {
        notifications.push({
          title: quantity <= 0 ? `Out of stock · ${item.name}` : `Low stock · ${item.name}`,
          details: `${quantity} ${item.unit} available; minimum is ${minimum} ${item.unit}.`,
          note: '',
          href: 'inventory.html'
        });
      }

      const expiryDate = item.expiry ? new Date(`${item.expiry}T00:00:00`) : null;
      const daysUntilExpiry = expiryDate ? Math.ceil((expiryDate - today) / 86400000) : null;
      const isExpiring = expiryDate
        ? daysUntilExpiry >= 0 && daysUntilExpiry <= 45
        : item.status?.toLowerCase().includes('expiring');
      if (isExpiring) {
        notifications.push({
          title: `Expiring item · ${item.name}`,
          details: item.expiry ? `Expires ${item.expiry}.` : item.status,
          note: '',
          href: 'inventory.html'
        });
      }
    });

    notificationList.replaceChildren();
    if (!notifications.length) {
      const emptyState = document.createElement('p');
      emptyState.className = 'px-4 py-6 text-center text-sm text-cbsua-muted';
      emptyState.textContent = 'You are all caught up.';
      notificationList.append(emptyState);
    } else {
      notifications.forEach(notification => {
        const link = document.createElement('a');
        link.href = notification.href;
        link.className = 'block border-b border-cbsua-border px-4 py-3 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-700';
        const title = document.createElement('p');
        title.className = 'text-sm font-medium';
        title.textContent = notification.title;
        const details = document.createElement('p');
        details.className = 'mt-1 text-xs text-cbsua-muted';
        details.textContent = notification.details;
        link.append(title, details);
        if (notification.note) {
          const note = document.createElement('p');
          note.className = 'mt-1 text-xs text-cbsua-muted';
          note.textContent = notification.note;
          link.append(note);
        }
        notificationList.append(link);
      });
    }

    const count = notifications.length;
    if (notificationBadge) {
      notificationBadge.textContent = count > 99 ? '99+' : String(count);
      notificationBadge.classList.toggle('hidden', count === 0);
    }
    if (notificationSummary) {
      notificationSummary.textContent = `${count} active ${count === 1 ? 'notification' : 'notifications'}`;
    }
    notificationToggle?.setAttribute('aria-label', `Notifications, ${count} active ${count === 1 ? 'notification' : 'notifications'}`);
  }

  function setNotificationOpen(isOpen) {
    if (!notificationToggle || !notificationPanel) return;
    notificationPanel.classList.toggle('hidden', !isOpen);
    notificationToggle.setAttribute('aria-expanded', String(isOpen));
  }

  notificationToggle?.addEventListener('click', () => {
    setNotificationOpen(notificationPanel?.classList.contains('hidden'));
  });
  document.addEventListener('click', event => {
    if (!notificationPanel?.contains(event.target) && !notificationToggle?.contains(event.target)) {
      setNotificationOpen(false);
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') setNotificationOpen(false);
  });
  window.addEventListener('storage', event => {
    if (event.key !== 'cbsuaSupplyRecords') return;
    window.IMS.initializeRecords()
      .then(() => window.dispatchEvent(new CustomEvent('ims:records-updated')))
      .catch(error => console.error('Dashboard notifications could not be refreshed.', error));
  });

  function getMovementData() {
    const receipts = getLocalRecords('receipts');
    const issuances = getLocalRecords('issuances');
    const today = new Date();
    const days = Array.from({ length: 7 }, (_, index) =>
      new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6 + index));
    const keyFor = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const totals = Object.fromEntries(days.map(date => [keyFor(date), { received: 0, issued: 0 }]));
    const addTotals = (records, type, dateField) => records.forEach(record => {
      const value = record[dateField] || record.createdAt;
      const dateKey = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)
        ? value.slice(0, 10)
        : keyFor(new Date(value));
      if (totals[dateKey]) totals[dateKey][type]++;
    });
    addTotals(receipts, 'received', 'receivedDate');
    addTotals(issuances, 'issued', 'date');
    const labels = days.map(date => new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short' }).format(date));
    if (chartDescription) {
      const formatDate = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' });
      chartDescription.textContent = `Transaction counts · ${formatDate.format(days[0])}–${formatDate.format(days[6])}`;
    }
    return {
      labels,
      received: days.map(date => totals[keyFor(date)].received),
      issued: days.map(date => totals[keyFor(date)].issued),
      totalReceived: receipts.length,
      totalIssued: issuances.length
    };
  }

  function update() {
    const reportDate = [...document.querySelectorAll('main p')]
      .find(paragraph => /^\d{1,2} \w+ 2026 —/.test(paragraph.textContent));
    if (reportDate) {
      reportDate.textContent = new Intl.DateTimeFormat('en', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      }).format(new Date());
    }
    const items = getLocalRecords('items');
    const requests = getLocalRecords('requests');
    const pending = requests.filter(request => request.status === 'Pending').length;
    renderNotifications(requests, items);
    const lowStock = items.filter(item => item.quantity <= item.minimum).length;
    const expiring = items.filter(item => {
      if (!item.expiry) return item.status?.toLowerCase().includes('expiring');
      const days = (new Date(`${item.expiry}T00:00:00`) - new Date()) / 86400000;
      return days >= 0 && days <= 45;
    }).length;
    const values = [
      [items.length, `${items.filter(item => item.quantity > 0).length} stocked, ${items.filter(item => item.quantity <= 0).length} out of stock`],
      [pending, 'Awaiting your review'],
      [lowStock, 'At or below minimum stock'],
      [expiring, 'Review batches before issuance']
    ];
    stats.forEach((card, index) => {
      if (!values[index]) return;
      const content = card.querySelectorAll('p');
      if (content[1]) {
        content[1].textContent = String(values[index][0]);
        content[1].removeAttribute('aria-label');
      }
      if (content[2]) {
        content[2].textContent = values[index][1];
        content[2].removeAttribute('aria-label');
      }
    });
    document.querySelector('.dashboard-metrics')?.setAttribute('aria-busy', 'false');

    if (attentionList) {
      attentionList.replaceChildren();
      const attentionItems = items.filter(item => item.quantity <= item.minimum || item.status?.toLowerCase().includes('expiring'));
      attentionItems.slice(0, 5).forEach(item => {
        const card = document.createElement('div');
        const out = item.quantity <= 0;
        card.className = `${out ? 'bg-red-50 border-red-400' : 'bg-amber-50 border-amber-400'} border-l-4 p-3 rounded-r-lg`;
        const name = document.createElement('p');
        name.className = 'font-medium text-sm';
        name.textContent = item.name;
        const status = document.createElement('p');
        status.className = 'text-xs text-cbsua-muted';
        status.textContent = `${item.status || (out ? 'Out of stock' : 'Low stock')} · ${item.quantity} ${item.unit}`;
        card.append(name, status);
        attentionList.append(card);
      });
      if (!attentionItems.length) {
        const message = document.createElement('p');
        message.className = 'text-sm text-cbsua-muted';
        message.textContent = 'No stock alerts. Inventory is in good standing.';
        attentionList.append(message);
      }
    }

    if (transactionBody) {
      const transactions = [
        ...getLocalRecords('receipts').map(record => ({ ...record, movement: 'Received' })),
        ...getLocalRecords('issuances').map(record => ({ ...record, movement: 'Issued' }))
      ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      transactionBody.replaceChildren();
      transactions.slice(0, 8).forEach(record => {
        const row = document.createElement('tr');
        row.className = 'border-b border-cbsua-border/50';
        const reference = document.createElement('td');
        reference.className = 'py-3';
        const id = document.createElement('p');
        id.className = 'font-medium';
        id.textContent = record.id;
        const date = document.createElement('p');
        date.className = 'text-xs text-cbsua-muted';
        date.textContent = record.receivedDate || record.date || new Date(record.createdAt).toLocaleDateString();
        reference.append(id, date);
        const movement = document.createElement('td');
        movement.className = 'py-3';
        const badge = document.createElement('span');
        badge.className = record.movement === 'Received'
          ? 'bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs font-medium'
          : 'bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs font-medium';
        badge.textContent = `${record.movement} ${record.movement === 'Received' ? '+' : '−'}${record.quantity}`;
        movement.append(badge);
        row.append(reference, makeCell(`${record.itemId} — ${record.itemName}`), movement,
          makeCell(record.movement === 'Received' ? record.supplier : record.office),
          makeCell(record.movement === 'Received' ? `Received by ${record.receivedBy}` : `${record.recipient} / ${record.handledBy}`));
        transactionBody.append(row);
      });
      if (!transactions.length) {
        const row = document.createElement('tr');
        const cell = makeCell('No stock movements have been recorded yet.');
        cell.colSpan = 5;
        row.append(cell);
        transactionBody.append(row);
      }
    }

    const data = getMovementData();
    const totals = canvas?.closest('.stat-card')?.querySelectorAll('.flex.gap-4.mb-4 strong');
    if (totals) {
      totals[0].textContent = String(data.totalReceived);
      totals[1].textContent = String(data.totalIssued);
    }
    if (chart) {
      chart.data.labels = data.labels;
      chart.data.datasets[0].data = data.received;
      chart.data.datasets[1].data = data.issued;
      chart.update();
    }
    const requestNotice = document.querySelector('#transactions .bg-cbsua-light p');
    if (requestNotice) requestNotice.textContent = `${pending} request${pending === 1 ? '' : 's'} ${pending === 1 ? 'is' : 'are'} waiting for review.`;
  }

  if (canvas && window.Chart) {
    const data = getMovementData();
    chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: data.labels,
        datasets: [
          { label: 'Received', data: data.received, backgroundColor: '#166534', borderRadius: 4 },
          { label: 'Issued', data: data.issued, backgroundColor: '#90EE90', borderRadius: 4 }
        ]
      },
      options: {
        responsive: true,
        scales: {
          y: { beginAtZero: true, grid: { display: false } },
          x: { grid: { display: false } }
        }
      }
    });
  } else if (canvas) {
    const message = document.createElement('p');
    message.className = 'text-sm text-cbsua-muted';
    message.textContent = 'Stock movement chart is unavailable offline.';
    canvas.replaceWith(message);
  }

  window.addEventListener('ims:records-updated', update);
  update();
});
