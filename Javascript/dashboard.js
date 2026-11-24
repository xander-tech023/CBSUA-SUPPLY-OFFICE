document.addEventListener('DOMContentLoaded', () => {
  const { getLocalRecords } = window.IMS;
  const notificationToggle = document.getElementById('notificationToggle');
  const notificationPanel = document.getElementById('notificationPanel');
  const notificationBadge = document.getElementById('notificationBadge');
  const notificationSummary = document.getElementById('notificationSummary');
  const notificationList = document.getElementById('notificationList');
  let canManagePasswordResets = window.IMS.currentUser?.role === 'admin';
  const canvas = document.getElementById('stockChart');
  const chartDescription = canvas?.closest('.stat-card')?.querySelector('p.text-xs');
  const stats = [...document.querySelectorAll('main .stat-card')].slice(0, 4);
  const transactionBody = document.querySelector('#transactions tbody');
  const attentionList = document.querySelector('main .grid.grid-cols-1.lg\\:grid-cols-3 > .stat-card:last-child .space-y-3');
  let chart = null;

  function renderPasswordResetNotifications() {
    if (!notificationList || !notificationBadge || !notificationSummary) return;
    const requests = window.IMS.accounts.readPasswordResetRequests()
      .filter(request => request.status === 'Pending');
    notificationList.replaceChildren();
    notificationBadge.textContent = String(requests.length);
    notificationBadge.classList.toggle('hidden', requests.length === 0);
    notificationSummary.textContent = requests.length
      ? `${requests.length} password reset${requests.length === 1 ? '' : 's'}`
      : 'No active alerts';

    if (!requests.length) {
      const empty = document.createElement('p');
      empty.className = 'px-4 py-6 text-center text-sm text-cbsua-muted';
      empty.textContent = 'No pending password reset requests.';
      notificationList.append(empty);
      return;
    }

    requests.forEach(request => {
      const item = document.createElement('article');
      item.className = 'border-b border-cbsua-border px-4 py-3 last:border-b-0';
      const title = document.createElement('p');
      title.className = 'font-medium';
      title.textContent = 'Password reset request';
      const account = document.createElement('p');
      account.className = 'mt-1 text-sm';
      account.textContent = `${request.accountName || request.username} (@${request.username})`;
      const date = document.createElement('p');
      date.className = 'mt-1 text-xs text-cbsua-muted';
      date.textContent = new Date(request.requestedAt).toLocaleString();
      item.append(title, account, date);
      if (canManagePasswordResets) {
        const actions = document.createElement('div');
        actions.className = 'mt-3 flex gap-2';
        const rejectButton = document.createElement('button');
        rejectButton.type = 'button';
        rejectButton.className = 'rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50';
        rejectButton.textContent = 'Reject';
        rejectButton.addEventListener('click', () => {
          window.IMS.accounts.rejectPasswordReset(request.id)
            .then(() => window.IMS.showToast(`Password reset request for ${request.username} rejected.`))
            .catch(error => window.IMS.showToast(error.message));
        });
        const approveButton = document.createElement('button');
        approveButton.type = 'button';
        approveButton.className = 'rounded-lg bg-cbsua-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700';
        approveButton.textContent = 'Approve';
        approveButton.addEventListener('click', () => {
          window.IMS.accounts.approvePasswordReset(request.id)
            .then(() => window.IMS.showToast(`Password reset request for ${request.username} approved.`))
            .catch(error => window.IMS.showToast(error.message));
        });
        actions.append(rejectButton, approveButton);
        item.append(actions);
      } else {
        const note = document.createElement('p');
        note.className = 'mt-2 text-xs text-cbsua-muted';
        note.textContent = 'Awaiting administrator review.';
        item.append(note);
      }
      notificationList.append(item);
    });
  }

  notificationToggle?.addEventListener('click', () => {
    const isOpen = !notificationPanel?.classList.contains('hidden');
    notificationPanel?.classList.toggle('hidden', isOpen);
    notificationToggle.setAttribute('aria-expanded', String(!isOpen));
  });
  document.addEventListener('click', event => {
    if (!notificationPanel || notificationPanel.classList.contains('hidden')) return;
    if (!event.target.closest('#notificationToggle') && !event.target.closest('#notificationPanel')) {
      notificationPanel.classList.add('hidden');
      notificationToggle?.setAttribute('aria-expanded', 'false');
    }
  });
  window.addEventListener('ims:password-reset-updated', renderPasswordResetNotifications);
  window.addEventListener('ims:current-user-ready', event => {
    canManagePasswordResets = event.detail?.role === 'admin';
    renderPasswordResetNotifications();
  });
  renderPasswordResetNotifications();

  function makeCell(text) {
    const cell = document.createElement('td');
    cell.className = 'py-3';
    cell.textContent = text;
    return cell;
  }

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
