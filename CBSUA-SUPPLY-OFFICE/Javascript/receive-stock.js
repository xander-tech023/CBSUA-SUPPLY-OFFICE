window.IMS.pageFeatures.push(() => {
  const { getLocalRecords, showToast } = window.IMS;
  const receiveForm = [...document.querySelectorAll('main form')]
    .find(form => form.querySelector('#receiptUpload'));
  if (!receiveForm) return;

  const itemSelect = receiveForm.querySelector('select:nth-of-type(2)') || receiveForm.querySelectorAll('select')[1];
  const quantityInput = receiveForm.querySelector('input[type="number"]');
  const previewCard = [...document.querySelectorAll('.stat-card')]
    .find(card => card.querySelector('h5')?.textContent.trim() === 'Stock balance preview');

  function updateReceivePreview() {
    const selectedItem = itemSelect?.selectedOptions[0]?.textContent || '';
    const code = selectedItem.match(/ITM-\d+/)?.[0] || 'ITM-002';
    const item = getLocalRecords('items').find(record => record.id === code)
      || { quantity: 0, unit: 'units', name: selectedItem };
    const received = Number(quantityInput?.value) || 0;
    if (!previewCard) return;

    const name = previewCard.querySelector('p.text-sm');
    const total = previewCard.querySelector('.text-4xl');
    const rows = [...previewCard.querySelectorAll('.flex.justify-between')];
    if (name) name.textContent = `${code} — ${item.name}`;
    if (total) total.textContent = String(item.quantity + received);
    [item.quantity, `+${received}`, item.quantity + received].forEach((value, index) => {
      const balance = rows[index]?.querySelector('span:last-child');
      if (balance) balance.textContent = `${value} ${item.unit}`;
    });
    const unitLabel = previewCard.querySelector('.text-center p.text-sm');
    if (unitLabel) unitLabel.textContent = `${item.unit} after saving this receipt`;
  }

  itemSelect?.addEventListener('change', updateReceivePreview);
  quantityInput?.addEventListener('input', updateReceivePreview);
  updateReceivePreview();

  const receiptUpload = document.querySelector('#receiptUpload');
  receiptUpload?.addEventListener('change', () => {
    const file = receiptUpload.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024 || !/\.(pdf|jpe?g|png)$/i.test(file.name)) {
      receiptUpload.value = '';
      return showToast('Choose a PDF, JPG, or PNG file under 10 MB.');
    }
    const label = receiptUpload.closest('.upload-zone')?.querySelector('p');
    if (label) label.textContent = `Selected: ${file.name}`;
    showToast(`${file.name} selected.`);
  });
});
