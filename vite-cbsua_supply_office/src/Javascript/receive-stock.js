window.IMS.pageFeatures.push(() => {
  const { getLocalRecords, showToast } = window.IMS;
  const form = document.getElementById('receiveForm');
  if (!form) return;

  const supplierSelect = form.querySelector('#receiveSupplier');
  const itemSelect = form.querySelector('#receiveItem');
  const quantityInput = form.querySelector('#receiveQuantity');
  const receiptUpload = form.querySelector('#receiptUpload');
  const uploadZone = receiptUpload?.closest('.upload-zone');
  const uploadLabel = uploadZone?.querySelector('p');
  const previewCard = [...document.querySelectorAll('.stat-card')]
    .find(card => card.querySelector('h5')?.textContent.trim() === 'Stock balance preview');
  const readyCard = [...document.querySelectorAll('.stat-card')]
    .find(card => card.querySelector('h5')?.textContent.trim() === 'Ready to record');
  const today = new Date();
  today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
  form.querySelector('#receivedDate').value = today.toISOString().slice(0, 10);
  form.querySelector('#receivedBy').value = `${window.IMS.currentUser.name} — ${window.IMS.currentUser.title}`;

  function populateOptions(select, entries, valueFor, labelFor, emptyText) {
    const previousValue = select.value;
    select.replaceChildren();
    entries.forEach(entry => {
      const option = document.createElement('option');
      option.value = valueFor(entry);
      option.textContent = labelFor(entry);
      select.append(option);
    });
    if (!entries.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = emptyText;
      select.append(option);
      select.disabled = true;
      return;
    }
    select.disabled = false;
    if (entries.some(entry => valueFor(entry) === previousValue)) select.value = previousValue;
  }

  function updatePreview() {
    const item = getLocalRecords('items').find(record => record.id === itemSelect.value);
    const received = Number(quantityInput.value) || 0;
    if (!previewCard || !item) return;
    const name = previewCard.querySelector('p.text-sm');
    const total = previewCard.querySelector('.text-4xl');
    const rows = [...previewCard.querySelectorAll('.flex.justify-between')];
    if (name) name.textContent = `${item.id} — ${item.name}`;
    if (total) total.textContent = String(item.quantity + received);
    [item.quantity, `+${received}`, item.quantity + received].forEach((value, index) => {
      const output = rows[index]?.querySelector('span:last-child');
      if (output) output.textContent = `${value} ${item.unit}`;
    });
    const unitLabel = previewCard.querySelector('.text-center p.text-sm');
    if (unitLabel) unitLabel.textContent = `${item.unit} after saving this receipt`;
    const previewNote = previewCard.querySelector('p.text-xs');
    if (previewNote) previewNote.textContent = `Preview only — inventory currently shows ${item.quantity} ${item.unit}.`;
    if (readyCard) {
      const values = [...readyCard.querySelectorAll('.flex.justify-between span:last-child')];
      if (values[0]) values[0].textContent = window.IMS.nextRecordId('receipts', 'RCV-2026-', 27);
      if (values[1]) values[1].textContent = supplierSelect.selectedOptions[0]?.textContent || '—';
      if (values[2]) values[2].textContent = window.IMS.currentUser.name;
      if (values[3]) values[3].textContent = form.dataset.attachmentName || 'No attachment selected';
    }
  }

  function refreshOptions() {
    populateOptions(supplierSelect, getLocalRecords('suppliers'), entry => entry.id, entry => `${entry.id} — ${entry.name}`, 'No suppliers available');
    populateOptions(itemSelect, getLocalRecords('items'), entry => entry.id, entry => `${entry.id} — ${entry.name}`, 'No inventory items available');
    const currentDate = new Date();
    currentDate.setMinutes(currentDate.getMinutes() - currentDate.getTimezoneOffset());
    form.querySelector('#receivedDate').value = currentDate.toISOString().slice(0, 10);
    form.querySelector('#receivedBy').value = `${window.IMS.currentUser.name} — ${window.IMS.currentUser.title}`;
    if (uploadLabel) uploadLabel.textContent = form.dataset.attachmentName
      ? `Selected: ${form.dataset.attachmentName}`
      : 'Drop delivery receipt here or browse files';
    updatePreview();
  }

  itemSelect.addEventListener('change', updatePreview);
  quantityInput.addEventListener('input', updatePreview);
  window.addEventListener('ims:records-updated', refreshOptions);
  refreshOptions();

  function setAttachment(file) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024 || !/\.(pdf|jpe?g|png)$/i.test(file.name)) {
      receiptUpload.value = '';
      delete form.dataset.attachmentName;
      return showToast('Choose a PDF, JPG, or PNG file under 10 MB.');
    }
    form.dataset.attachmentName = file.name;
    if (uploadLabel) uploadLabel.textContent = `Selected: ${file.name}`;
    showToast(`${file.name} selected.`);
  }
  receiptUpload?.addEventListener('change', () => setAttachment(receiptUpload.files[0]));
  uploadZone?.addEventListener('click', event => {
    if (event.target !== receiptUpload && !event.target.closest('button')) receiptUpload.click();
  });
  uploadZone?.addEventListener('dragover', event => {
    event.preventDefault();
    uploadZone.classList.add('ring-2', 'ring-cbsua-primary');
  });
  uploadZone?.addEventListener('dragleave', () => uploadZone.classList.remove('ring-2', 'ring-cbsua-primary'));
  uploadZone?.addEventListener('drop', event => {
    event.preventDefault();
    uploadZone.classList.remove('ring-2', 'ring-cbsua-primary');
    setAttachment(event.dataTransfer.files[0]);
  });
});
