window.IMS = window.IMS || {};

(() => {
  const accountsKey = 'cbsuaSupplyAccounts';
  const defaults = {
    admin: { username: 'admin', password: 'admin123', name: 'Renjene D.S. Rivera', title: 'Head, Supply Office' },
    staff: { username: 'staff', password: 'staff123', name: 'Maria Santos', title: 'Supply Staff Officer' }
  };

  function getAccounts() {
    const saved = localStorage.getItem(accountsKey);
    if (!saved) return JSON.parse(JSON.stringify(defaults));
    const accounts = JSON.parse(saved);
    if (!accounts || !accounts.admin || !accounts.staff
      || !['admin', 'staff'].every(role => ['username', 'password', 'name', 'title']
        .every(field => typeof accounts[role][field] === 'string' && accounts[role][field]))) {
      throw new Error('Saved account information is incomplete.');
    }
    return accounts;
  }

  function saveAccounts(accounts) {
    localStorage.setItem(accountsKey, JSON.stringify(accounts));
  }

  window.IMS.accounts = { getAccounts, saveAccounts };
})();
