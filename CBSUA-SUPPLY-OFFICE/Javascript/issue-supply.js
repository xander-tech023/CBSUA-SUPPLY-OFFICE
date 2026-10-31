window.IMS.pageFeatures.push(() => {
  const { createIcon, getLocalRecords, showToast } = window.IMS;
  const issueForm = [...document.querySelectorAll('main form')]
    .find(form => form.querySelector('input[readonly][value*="Supply Officer"]'));
  if (!issueForm) return;

  const quantityInput = issueForm.querySelector('input[type="number"]');
  const readonlyInputs = [...issueForm.querySelectorAll('input[readonly]')];
  let requested = Number.parseFloat(readonlyInputs[1]?.value) || 0;
  const balanceCard = [...document.querySelectorAll('.stat-card')]
    .find(card => ['Balance after release', 'Stock after issuance']
      .includes(card.querySelector('h5')?.textContent.trim()));
  const rows = [...(balanceCard?.querySelectorAll('.flex.justify-between') || [])];
  const [currentLabel, issueLabel, newBalanceLabel] = rows.map(row => row.querySelector('span:last-child'));
  const currentText = currentLabel?.textContent.trim() || '';
  let currentBalance = Number.parseFloat(currentText) || 0;
  let unit = currentText.replace(/^[\d,.]+\s*/, '');
  const issueButton = issueForm.querySelector('button[type="submit"]');
  const stockStatus = balanceCard?.querySelector('.bg-green-50');

  function updateIssuePreview() {
    const quantity = Number(quantityInput.value) || 0;
    const newBalance = currentBalance - quantity;
    if (issueLabel) issueLabel.textContent = `−${quantity} ${unit}`;
    if (newBalanceLabel) newBalanceLabel.textContent = `${newBalance} ${unit}`;
    if (issueButton) issueButton.textContent = 'Confirm & Issue';
    if (!stockStatus) return;

    const sufficient = quantity > 0 && quantity <= currentBalance;
    const statusPath = sufficient
      ? 'M9 12.5l2 2 4-5m-7.5 9.5h9a2 2 0 0 0 2-2V7.5a2 2 0 0 0-2-2h-9a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2Z'
      : 'M12 9v4m0 4h.01M10.29 3.86 2.82 17.35A2 2 0 0 0 4.53 20h14.94a2 2 0 0 0 1.71-2.65L13.71 3.86a2 2 0 0 0-3.42 0Z';
    stockStatus.replaceChildren(
      createIcon(statusPath, 'h-4 w-4 fill-none stroke-current stroke-[1.8]'),
      document.createTextNode(sufficient ? ' Sufficient stock' : ' Quantity exceeds available stock')
    );
    stockStatus.classList.toggle('bg-green-50', sufficient);
    stockStatus.classList.toggle('text-green-700', sufficient);
    stockStatus.classList.toggle('bg-red-50', !sufficient);
    stockStatus.classList.toggle('text-red-700', !sufficient);
  }

  quantityInput.addEventListener('input', updateIssuePreview);
  updateIssuePreview();
  const requestId = issueForm.querySelector('select').value.split(' · ')[0];
  const storedRequest = getLocalRecords('requests').find(request => request.id === requestId);
  const itemId = readonlyInputs[0].value.match(/ITM-\d+/)?.[0];
  const storedItem = getLocalRecords('items').find(item => item.id === itemId);
  if (!storedRequest || !storedItem || storedRequest.status !== 'Approved') {
    issueButton.disabled = true;
    showToast('Select an approved request with an inventory item.');
    return;
  }

  requested = Number.parseFloat(storedRequest.quantity) || requested;
  currentBalance = Number(storedItem.quantity) || 0;
  unit = storedItem.unit || unit;
  if (currentLabel) currentLabel.textContent = `${currentBalance} ${unit}`;
  const requestLabel = issueForm.querySelector('input[readonly][value*="reams"], input[readonly][value*="bottles"]');
  if (requestLabel) requestLabel.value = `${requested} ${unit}`;
  quantityInput.max = String(Math.min(requested, currentBalance));
  issueButton.disabled = false;
  updateIssuePreview();
});
