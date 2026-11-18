window.IMS = window.IMS || {};

(() => {
  const sessionKey = 'cbsuaSupplySession';
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

  window.IMS.accounts = {
    async login(role, username, password, remember) {
      const account = accounts[role];
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
