window.IMS.pageFeatures.push(() => {
  const { getLocalRecords, getRemainingRequestQuantity, showToast } = window.IMS;
  const form = document.getElementById('issueForm');
  if (!form) return;

  const requestSelect = form.querySelector('#issueRequest');
  const quantityInput = form.querySelector('#issueQuantity');
  const itemInput = form.querySelector('#issueItem');
  const itemIdInput = form.querySelector('#issueItemId');
  const requestedInput = form.querySelector('#issueRequested');
  const officeInput = form.querySelector('#issueOffice');
  const recipientInput = form.querySelector('#issueRecipient');
  const recipientIdInput = form.querySelector('#issueRecipientId');
  const issueButton = form.querySelector('button[type="submit"]');
  const balanceCard = [...document.querySelectorAll('.stat-card')]
    .find(card => card.querySelector('h5')?.textContent.trim() === 'Stock after issuance');
  const balanceRows = [...(balanceCard?.querySelectorAll('.flex.justify-between') || [])];
  const stockStatus = balanceCard?.querySelector('.bg-green-50');
  const audit = {
    reference: document.getElementById('issueReference'),
    request: document.getElementById('issueAuditRequest'),
    recipient: document.getElementById('issueAuditRecipient'),
    office: document.getElementById('issueAuditOffice'),
    handler: document.getElementById('issueAuditHandler'),
    date: document.getElementById('issueAuditDate')
  };
  const header = document.querySelector('main .border-2');
  let selectedItem = null;
  let selectedRequest = null;
  const today = new Date();
  today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
  form.querySelector('#issueDate').value = today.toISOString().slice(0, 10);
  form.querySelector('#issueHandler').value = `${window.IMS.currentUser.name} — ${window.IMS.currentUser.title}`;

  function updatePreview(resetQuantity = false) {
    selectedRequest = getLocalRecords('requests').find(request => request.id === requestSelect.value);
    selectedItem = selectedRequest && getLocalRecords('items').find(item => item.id === selectedRequest.itemId);
    if (!selectedRequest || !selectedItem) {
      itemInput.value = '';
      itemIdInput.value = '';
      requestedInput.value = '';
      officeInput.value = '';
      recipientInput.value = '';
      recipientIdInput.value = '';
      quantityInput.value = '';
      quantityInput.removeAttribute('max');
      issueButton.disabled = true;
      if (header) {
        header.querySelector('span').textContent = 'No approved requests';
        header.querySelector('h5').textContent = 'No approved request selected';
        const details = header.querySelector('p');
        if (details) details.textContent = 'Approve a request before recording an issuance.';
      }
      balanceRows.forEach(row => {
        const output = row.querySelector('span:last-child');
        if (output) output.textContent = '—';
      });
      if (stockStatus) stockStatus.textContent = 'No approved request selected';
      Object.values(audit).forEach(element => { if (element) element.textContent = '—'; });
      return;
    }

    const remaining = getRemainingRequestQuantity(selectedRequest);
    const maximumIssue = Math.min(remaining, selectedItem.quantity);
    itemInput.value = `${selectedItem.id} — ${selectedItem.name}`;
    itemIdInput.value = selectedItem.id;
    requestedInput.value = `${remaining} ${selectedItem.unit} remaining`;
    officeInput.value = selectedRequest.office;
    recipientInput.value = selectedRequest.recipient;
    recipientIdInput.value = selectedRequest.employeeId || 'Not recorded for this request';
    if (audit.reference) audit.reference.textContent = window.IMS.nextRecordId('issuances', 'ISS-2026-', 20);
    if (audit.request) audit.request.textContent = selectedRequest.id;
    if (audit.recipient) audit.recipient.textContent = selectedRequest.employeeId
      ? `${selectedRequest.recipient} · ${selectedRequest.employeeId}`
      : selectedRequest.recipient;
    if (audit.office) audit.office.textContent = selectedRequest.office;
    if (audit.handler) audit.handler.textContent = window.IMS.currentUser.name;
    if (audit.date) audit.date.textContent = form.querySelector('#issueDate').value;
    if (resetQuantity || !quantityInput.value) {
      quantityInput.value = maximumIssue > 0 ? String(maximumIssue) : '';
    }
    quantityInput.max = String(maximumIssue);
    const quantity = Number(quantityInput.value) || 0;
    issueButton.disabled = quantity <= 0 || quantity > maximumIssue;
    if (header) {
      header.querySelector('span').textContent = 'Approved · Ready to issue';
      header.querySelector('h5').textContent = `${selectedRequest.id} — ${selectedItem.name}`;
      const details = header.querySelector('p');
      if (details) details.textContent = `Approved by ${selectedRequest.reviewedBy || 'Supply Office'} · ${selectedRequest.date} · Remaining ${remaining} ${selectedItem.unit}`;
    }

    const currentBalance = selectedItem.quantity;
    const issueQuantity = Number(quantityInput.value) || 0;
    const newBalance = currentBalance - issueQuantity;
    const values = [currentBalance, `−${issueQuantity}`, newBalance, selectedItem.minimum];
    values.forEach((value, index) => {
      const output = balanceRows[index]?.querySelector('span:last-child');
      if (output) output.textContent = `${value} ${selectedItem.unit}`;
    });
    if (stockStatus) {
      stockStatus.textContent = issueQuantity > 0 && issueQuantity <= currentBalance
        ? 'Sufficient stock'
        : 'Quantity exceeds available stock';
      stockStatus.classList.toggle('bg-green-50', issueQuantity > 0 && issueQuantity <= currentBalance);
      stockStatus.classList.toggle('text-green-700', issueQuantity > 0 && issueQuantity <= currentBalance);
      stockStatus.classList.toggle('bg-red-50', issueQuantity <= 0 || issueQuantity > currentBalance);
      stockStatus.classList.toggle('text-red-700', issueQuantity <= 0 || issueQuantity > currentBalance);
    }
  }

  function refreshRequests() {
    const currentDate = new Date();
    currentDate.setMinutes(currentDate.getMinutes() - currentDate.getTimezoneOffset());
    form.querySelector('#issueDate').value = currentDate.toISOString().slice(0, 10);
    form.querySelector('#issueHandler').value = `${window.IMS.currentUser.name} — ${window.IMS.currentUser.title}`;
    const requestedId = new URLSearchParams(location.search).get('request');
    const requests = getLocalRecords('requests')
      .filter(request => request.status === 'Approved' && getLocalRecords('items').some(item => item.id === request.itemId));
    requestSelect.replaceChildren();
    requests.forEach(request => {
      const item = getLocalRecords('items').find(entry => entry.id === request.itemId);
      const option = document.createElement('option');
      option.value = request.id;
      option.textContent = `${request.id} · ${item.name} · ${request.quantity}`;
      requestSelect.append(option);
    });
    if (!requests.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No approved requests available';
      requestSelect.append(option);
      showToast('There are no approved requests ready to issue.');
    } else {
      requestSelect.value = requests.some(request => request.id === requestedId)
        ? requestedId
        : requests[0].id;
    }
    updatePreview(true);
  }

  requestSelect.addEventListener('change', () => updatePreview(true));
  quantityInput.addEventListener('input', () => updatePreview());
  window.addEventListener('ims:records-updated', refreshRequests);
  refreshRequests();
});
