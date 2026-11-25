window.IMS.pageFeatures.push(() => {
  const { getLocalRecords, nextRequestId, showToast } = window.IMS;
  const table = document.querySelector('main tbody');
  if (!table || !document.querySelector('#requestModal')) return;

  const tabs = [...document.querySelectorAll('main button')]
    .filter(button => /^(All requests|Pending|Approved|Issued|Rejected|Cancelled|Canceled)/.test(button.textContent.trim()));
  const query = document.querySelector('main input[type="text"]');
  const office = document.querySelector('main select');
  const itemSelect = document.querySelector('#requestItem');
  const idField = document.querySelector('#requestId');
  const exportButton = document.querySelector('[data-export-requests]');
  const adminCards = document.querySelector('#adminRequestCards');
  const adminCardList = document.querySelector('#adminRequestCardList');
  const adminCardSummary = document.querySelector('#adminRequestCardSummary');
  const requestTableCard = document.querySelector('#requestTableCard');
  const requestForm = document.querySelector('#requestForm');
  const isAdmin = window.IMS.currentUser?.role === 'admin';
  const requestClassifications = {
    consumable: { label: 'Consumable', itemClassification: 'consumable' },
    'semi-expendable': { label: 'Semi-expendable', itemClassification: 'semi-expendable' },
    'fixed-asset': { label: 'Fixed Asset', itemClassification: 'fixed asset' }
  };
  let statusFilter = '';

  function formatOfficeOptions(select) {
    if (!select) return;
    [...select.options].forEach(option => {
      if (!option.value || !window.IMS.accounts.getOfficeId(option.value)) return;
      option.textContent = `${window.IMS.accounts.getOfficeId(option.value)} — ${option.value}`;
    });
  }

  formatOfficeOptions(office);
  const requestOfficeInput = document.querySelector('#requestOffice');
  if (requestOfficeInput) {
    requestOfficeInput.value = 'Supply Office';
    requestOfficeInput.readOnly = true;
  }

  function refreshRequestForm() {
    if (itemSelect) {
      const previousValue = itemSelect.value;
      const selectedClassification = requestClassifications[requestForm?.dataset.supplyClassification];
      const items = getLocalRecords('items').filter(item => !selectedClassification
        || String(item.supplyClassification || '').trim().toLowerCase() === selectedClassification.itemClassification);
      itemSelect.replaceChildren();
      items.forEach(item => {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = `${item.id} — ${item.name} (${item.quantity} ${item.unit} available)`;
        itemSelect.append(option);
      });
      if (itemSelect.options.length) {
        itemSelect.value = [...itemSelect.options].some(option => option.value === previousValue)
          ? previousValue
          : itemSelect.options[0].value;
      } else {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = selectedClassification
          ? `No ${selectedClassification.label} items available`
          : 'No inventory items available';
        itemSelect.append(option);
      }
      itemSelect.disabled = items.length === 0;
    }
    if (idField) idField.value = nextRequestId();
  }

  function update() {
    const records = getLocalRecords('requests');
    tabs.forEach(button => {
      const label = button.textContent.split('·')[0].trim();
      const count = label === 'All requests'
        ? records.length
        : records.filter(request => {
          const requestStatus = (request.status || 'Pending').toLowerCase();
          return requestStatus === label.toLowerCase()
            || (label.toLowerCase() === 'cancelled' && requestStatus === 'canceled');
        }).length;
      button.textContent = `${label} · ${count}`;
    });
    [...table.rows].forEach(row => {
      const status = row.cells[4]?.innerText.toLowerCase() || '';
      const statusMatch = !statusFilter
        || status === statusFilter
        || (statusFilter === 'cancelled' && status === 'canceled');
      const queryMatch = !query?.value || row.innerText.toLowerCase().includes(query.value.toLowerCase());
      const officeMatch = !office || office.selectedIndex === 0 || row.cells[1]?.innerText.includes(office.value);
      row.hidden = !(statusMatch && queryMatch && officeMatch);
    });
    renderAdminCards(records);
  }

  function renderAdminCards(records) {
    if (!adminCards || !adminCardList || !requestTableCard) return;
    adminCards.hidden = !isAdmin;
    adminCards.classList.toggle('hidden', !isAdmin);
    requestTableCard.hidden = isAdmin;
    if (!isAdmin) return;

    const searchTerm = query?.value.trim().toLowerCase() || '';
    const officeTerm = office?.selectedIndex > 0 ? office.value.toLowerCase() : '';
    const visibleRequests = records.filter(request => {
      const status = (request.status || 'Pending').toLowerCase();
      const searchableText = [
        request.id, request.date, request.office, request.recipient,
        request.employeeId, request.item, request.quantity,
        request.supplyClassification, request.documentType,
        ...Object.values(request.classificationDetails || {})
      ].map(value => value || '').join(' ').toLowerCase();
      return (!statusFilter
        || status === statusFilter
        || (statusFilter === 'cancelled' && status === 'canceled'))
        && (!searchTerm || searchableText.includes(searchTerm))
        && (!officeTerm || String(request.office || '').toLowerCase().includes(officeTerm));
    }).sort((left, right) => {
      const timestampDifference =
        new Date(right.createdAt || `${right.date || ''}T23:59:59`) -
        new Date(left.createdAt || `${left.date || ''}T23:59:59`);
      return timestampDifference || String(right.id).localeCompare(String(left.id), undefined, { numeric: true });
    });

    adminCardSummary.textContent = `Showing ${visibleRequests.length} of ${records.length} requests`;
    adminCardList.replaceChildren();
    if (!visibleRequests.length) {
      const emptyState = document.createElement('p');
      emptyState.className = 'rounded-lg border border-dashed border-cbsua-border p-8 text-center text-sm text-cbsua-muted';
      emptyState.textContent = 'No requests match the current filters.';
      adminCardList.append(emptyState);
      return;
    }

    const detail = (label, value, supportingText) => {
      const group = document.createElement('div');
      group.className = 'min-w-0';
      const title = document.createElement('p');
      title.className = 'text-xs font-medium uppercase tracking-wide text-cbsua-muted';
      title.textContent = label;
      const mainValue = document.createElement('p');
      mainValue.className = 'mt-1 break-words font-medium';
      mainValue.textContent = value || '—';
      group.append(title, mainValue);
      if (supportingText) {
        const supportingValue = document.createElement('p');
        supportingValue.className = 'mt-1 break-words text-sm text-cbsua-muted';
        supportingValue.textContent = supportingText;
        group.append(supportingValue);
      }
      return group;
    };

    visibleRequests.forEach(request => {
      const status = request.status || 'Pending';
      const card = document.createElement('article');
      card.className = 'rounded-xl border border-cbsua-border bg-white p-5 shadow-sm';
      card.dataset.requestCard = '';
      card.dataset.requestId = request.id;

      const header = document.createElement('div');
      header.className = 'flex items-start justify-between gap-3';
      header.append(detail('Request / Date', request.id, request.date));
      const badge = document.createElement('span');
      badge.className = `badge shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
        status === 'Approved' ? 'bg-green-100 text-green-700'
          : status === 'Issued' ? 'bg-blue-100 text-blue-700'
          : ['Rejected', 'Cancelled', 'Canceled'].includes(status) ? 'bg-red-100 text-red-700'
          : 'bg-amber-100 text-amber-700'
      }`;
      badge.textContent = status;
      header.append(badge);

      const details = document.createElement('div');
      details.className = 'mt-5 grid grid-cols-1 gap-4 border-t border-cbsua-border pt-4 sm:grid-cols-2';
      details.append(
        detail('Office / Recipient', request.office, [
          request.recipient,
          request.employeeId ? `ID ${request.employeeId}` : ''
        ].filter(Boolean).join(' · ')),
        detail('Item / Quantity', request.item, [
          request.quantity,
          request.documentType
            ? `${request.supplyClassification || 'Classification not set'} · ${request.documentType}`
            : 'Existing request'
        ].filter(Boolean).join(' · '))
      );
      const references = request.classificationDetails || {};
      const referenceSummary = [
        references.fundCluster && `FC: ${references.fundCluster}`,
        references.purchaseOrderNumber && `PO: ${references.purchaseOrderNumber}`,
        references.iarNumber && `IAR: ${references.iarNumber}`
      ].filter(Boolean).join(' · ');
      if (referenceSummary) details.append(detail('Generated references', referenceSummary));
      card.append(header, details);

      const actions = document.createElement('div');
      actions.className = 'mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-cbsua-border pt-4';
      if (status === 'Pending') {
        const approveButton = document.createElement('button');
        approveButton.type = 'button';
        approveButton.className = 'rounded-lg bg-cbsua-primary px-4 py-2 text-sm font-medium text-white hover:bg-green-700';
        approveButton.dataset.requestAction = 'approve';
        approveButton.textContent = 'Approve request';
        const rejectButton = document.createElement('button');
        rejectButton.type = 'button';
        rejectButton.className = 'rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50';
        rejectButton.dataset.requestAction = 'reject';
        rejectButton.textContent = 'Reject request';
        actions.append(rejectButton, approveButton);
      } else if (status === 'Approved') {
        const issueLink = document.createElement('a');
        issueLink.className = 'rounded-lg border border-cbsua-border px-4 py-2 text-sm font-medium text-cbsua-primary hover:bg-gray-50';
        issueLink.href = `issue_supply.html?request=${encodeURIComponent(request.id)}`;
        issueLink.textContent = 'Issue supplies';
        actions.append(issueLink);
      } else {
        const statusNote = document.createElement('p');
        statusNote.className = 'text-sm text-cbsua-muted';
        statusNote.textContent = `This request is ${status.toLowerCase()}.`;
        actions.append(statusNote);
      }
      card.append(actions);
      adminCardList.append(card);
    });
  }

  exportButton?.addEventListener('click', () => {
    const visibleRows = [...table.rows].filter(row => !row.hidden && row.cells.length >= 5);
    if (!visibleRows.length) return showToast('There are no requests matching the current filters.');
    const escapeCell = value => {
      const text = String(value).replace(/\s*\n\s*/g, ' — ');
      const safeText = /^[\t\r ]*[=+\-@]/.test(text) ? `'${text}` : text;
      return `"${safeText.replace(/"/g, '""')}"`;
    };
    const csv = [
      ['Request / Date', 'Office / Recipient', 'Item / Quantity / Generated references', 'Handler', 'Status'],
      ...visibleRows.map(row => [...row.cells].slice(0, 5).map(cell => cell.innerText))
    ].map(values => values.map(escapeCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'cbsua-stock-requests.csv';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    showToast(`Exported ${visibleRows.length} filtered request${visibleRows.length === 1 ? '' : 's'}.`);
  });

  tabs.forEach(button => button.addEventListener('click', () => {
    const label = button.textContent.split('·')[0].trim();
    statusFilter = label === 'All requests' ? '' : label.toLowerCase();
    tabs.forEach(tab => {
      const active = tab === button;
      ['border-b-2', 'border-cbsua-primary', 'text-cbsua-primary'].forEach(name => tab.classList.toggle(name, active));
      tab.classList.toggle('text-cbsua-muted', !active);
    });
    update();
  }));
  query?.addEventListener('input', update);
  office?.addEventListener('change', update);
  window.addEventListener('ims:records-updated', () => {
    refreshRequestForm();
    update();
  });
  window.addEventListener('ims:request-classification-changed', refreshRequestForm);
  refreshRequestForm();
  update();
});
