window.IMS.pageFeatures.push(() => {
  const table = document.querySelector('main tbody');
  if (!table || !document.querySelector('#requestModal')) return;

  const tabs = [...document.querySelectorAll('main button')]
    .filter(button => /^(All requests|Pending|Approved|Issued)/.test(button.textContent.trim()));
  const query = document.querySelector('main input[type="text"]');
  const office = document.querySelector('main select');
  let statusFilter = '';

  function update() {
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
  update();
});
