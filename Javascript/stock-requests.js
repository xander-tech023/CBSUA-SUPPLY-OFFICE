window.IMS.pageFeatures.push(() => {
  const { getLocalRecords, nextRecordId } = window.IMS;
  const table = document.querySelector('main tbody');
  if (!table || !document.querySelector('#requestModal')) return;

  const tabs = [...document.querySelectorAll('main button')]
    .filter(button => /^(All requests|Pending|Approved|Issued|Rejected)/.test(button.textContent.trim()));
  const query = document.querySelector('main input[type="text"]');
  const office = document.querySelector('main select');
  const itemSelect = document.querySelector('#requestItem');
  const idField = document.querySelector('#requestId');
  const dateField = document.querySelector('#requestDate');
  let statusFilter = '';

  function refreshRequestForm() {
    if (itemSelect) {
      const previousValue = itemSelect.value;
      itemSelect.replaceChildren();
      getLocalRecords('items').forEach(item => {
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
        option.textContent = 'No inventory items available';
        itemSelect.append(option);
      }
      itemSelect.disabled = itemSelect.options.length === 1 && !itemSelect.value;
    }
    if (idField) idField.value = nextRecordId('requests', 'REQ-2026-', 44);
    if (dateField) {
      const today = new Date();
      today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
      dateField.value = today.toISOString().slice(0, 10);
    }
  }

  function update() {
    const records = getLocalRecords('requests');
    const labels = ['All requests', 'Pending', 'Approved', 'Issued', 'Rejected'];
    tabs.forEach(button => {
      const label = button.textContent.split('·')[0].trim();
      const count = label === 'All requests'
        ? records.length
        : records.filter(request => request.status.toLowerCase() === label.toLowerCase()).length;
      button.textContent = `${label} · ${count}`;
    });
    [...table.rows].forEach(row => {
      const status = row.cells[4]?.innerText.toLowerCase() || '';
      const statusMatch = !statusFilter || status.includes(statusFilter);
      const queryMatch = !query?.value || row.innerText.toLowerCase().includes(query.value.toLowerCase());
      const officeMatch = !office || office.selectedIndex === 0 || row.cells[1]?.innerText.includes(office.value);
      row.hidden = !(statusMatch && queryMatch && officeMatch);
    });
  }

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
  refreshRequestForm();
  update();
});
