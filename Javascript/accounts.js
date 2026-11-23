window.IMS = window.IMS || {};

(() => {
  const sessionKey = 'cbsuaSupplySession';
  const registeredAccountsKey = 'cbsuaSupplyAccounts';
  const accounts = {
    admin: {
      id: 1,
      username: 'admin',
      password: 'admin123',
      name: 'Renjene D.S. Rivera',
      title: 'Head, Supply Office',
      role: 'admin'
    },
    staff: {
      id: 2,
      username: 'staff',
      password: 'staff123',
      name: 'Maria Santos',
      title: 'Supply Staff Officer',
      role: 'staff'
    }
  };

  function readSession() {
    try {
      return JSON.parse(sessionStorage.getItem(sessionKey) || localStorage.getItem(sessionKey) || 'null');
    } catch {
      return null;
    }
  }

  function readRegisteredAccounts() {
    try {
      return JSON.parse(localStorage.getItem(registeredAccountsKey) || '[]');
    } catch {
      return [];
    }
  }

  function writeRegisteredAccount(account) {
    const registeredAccounts = readRegisteredAccounts();
    const duplicate = [...registeredAccounts, ...Object.values(accounts)].some(
      existing => existing.username.toLowerCase() === account.username.toLowerCase()
    );
    if (duplicate) throw new Error('That username is already registered.');
    registeredAccounts.push(account);
    localStorage.setItem(registeredAccountsKey, JSON.stringify(registeredAccounts));
  }

  window.IMS.accounts = {
    async login(role, username, password, remember) {
      const account = [...Object.values(accounts), ...readRegisteredAccounts()].find(
        candidate => candidate.username.toLowerCase() === username.toLowerCase()
      );
      if (!account || account.username !== username || account.password !== password) {
        throw new Error('Username or password is incorrect for the selected workspace.');
      }
      const user = {
        id: account.id,
        username: account.username,
        name: account.name,
        title: account.title,
        role: account.role
      };
      sessionStorage.setItem(sessionKey, JSON.stringify(user));
      if (remember) {
        localStorage.setItem(sessionKey, JSON.stringify(user));
      } else {
        localStorage.removeItem(sessionKey);
      }
      return { ok: true, user };
    },
    async register(registration) {
      const account = {
        id: Date.now(),
        username: registration.username.trim().toLowerCase(),
        password: registration.password,
        name: registration.fullName.trim(),
        title: `${registration.office} account`,
        office: registration.office,
        role: registration.role
      };
      writeRegisteredAccount(account);
      return { ok: true, account };
    },
    async getSession() {
      return readSession();
    },
    async logout() {
      sessionStorage.removeItem(sessionKey);
      localStorage.removeItem(sessionKey);
      return { ok: true };
    }
  };
})();
