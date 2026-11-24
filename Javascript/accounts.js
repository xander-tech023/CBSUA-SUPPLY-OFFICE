window.IMS = window.IMS || {};

(() => {
  const sessionKey = 'cbsuaSupplySession';
  const registeredAccountsKey = 'cbsuaSupplyAccounts';
  const passwordOverridesKey = 'cbsuaSupplyPasswordOverrides';
  const passwordResetRequestsKey = 'cbsuaSupplyPasswordResetRequests';
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

  function readPasswordOverrides() {
    try {
      return JSON.parse(localStorage.getItem(passwordOverridesKey) || '{}');
    } catch {
      return {};
    }
  }

  function readPasswordResetRequests() {
    try {
      return JSON.parse(localStorage.getItem(passwordResetRequestsKey) || '[]');
    } catch {
      return [];
    }
  }

  function writePasswordResetRequests(requests) {
    localStorage.setItem(passwordResetRequestsKey, JSON.stringify(requests));
  }

  function getAllAccounts() {
    const overrides = readPasswordOverrides();
    return [...Object.values(accounts).map(account => ({
      ...account,
      password: overrides[account.username.toLowerCase()] || account.password
    })), ...readRegisteredAccounts()];
  }

  function findAccount(username) {
    const normalized = String(username || '').trim().toLowerCase();
    return getAllAccounts().find(account => account.username.toLowerCase() === normalized) || null;
  }

  function getPublicProfile(account) {
    if (!account) return null;
    const { id, username, name, title, role, employeeId, office, email } = account;
    return { id, username, name, title, role, employeeId: employeeId || '', office: office || '', email: email || '' };
  }

  function findAccountById(id) {
    const account = getAllAccounts().find(candidate => String(candidate.id) === String(id));
    return getPublicProfile(account);
  }

  function findEndUserByName(name, office) {
    const normalizedName = String(name || '').trim().toLowerCase();
    const normalizedOffice = String(office || '').trim().toLowerCase();
    const account = getAllAccounts().find(candidate =>
      candidate.role === 'end-user'
      && candidate.name?.trim().toLowerCase() === normalizedName
      && (!normalizedOffice || candidate.office?.trim().toLowerCase() === normalizedOffice)
    );
    return getPublicProfile(account);
  }

  function getSupplyOfficeHead() {
    const account = getAllAccounts().find(candidate =>
      candidate.role === 'admin'
      && /\bhead\b/i.test(candidate.title || '')
      && /supply office/i.test(`${candidate.title || ''} ${candidate.office || ''}`)
    );
    return getPublicProfile(account);
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
      const account = getAllAccounts().find(
        candidate => candidate.username.toLowerCase() === username.toLowerCase()
      );
      if (!account || account.username.toLowerCase() !== username.toLowerCase() || account.password !== password) {
        throw new Error('Username or password is incorrect for the selected workspace.');
      }
      const user = {
        id: account.id,
        username: account.username,
        name: account.name,
        title: account.title,
        role: account.role,
        employeeId: account.employeeId || '',
        office: account.office || '',
        email: account.email || ''
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
      if (!registration.acceptedTerms) {
        throw new Error('You must accept the Terms and Conditions to create an account.');
      }
      const account = {
        id: Date.now(),
        username: registration.username.trim().toLowerCase(),
        password: registration.password,
        name: [registration.firstName, registration.middleName, registration.surname].filter(Boolean).join(' '),
        title: registration.position.trim(),
        office: registration.office,
        email: registration.email.trim().toLowerCase(),
        role: 'end-user'
      };
      writeRegisteredAccount(account);
      return { ok: true, account };
    },
    async requestPasswordReset(username) {
      const account = findAccount(username);
      if (!account) throw new Error('No account was found with that username.');
      const normalizedUsername = account.username.toLowerCase();
      const requests = readPasswordResetRequests();
      if (requests.some(request => request.username === normalizedUsername
        && ['Pending', 'Approved'].includes(request.status))) {
        throw new Error('A password reset request is already active for this account.');
      }
      const request = {
        id: `RESET-${Date.now()}`,
        username: normalizedUsername,
        accountName: account.name,
        role: account.role,
        status: 'Pending',
        requestedAt: new Date().toISOString()
      };
      requests.unshift(request);
      writePasswordResetRequests(requests);
      window.dispatchEvent(new CustomEvent('ims:password-reset-updated'));
      return { ok: true, request };
    },
    async resetPassword(username, password) {
      const account = findAccount(username);
      if (!account) throw new Error('No account was found with that username.');
      const normalizedUsername = account.username.toLowerCase();
      const requests = readPasswordResetRequests();
      const approvedRequest = requests.find(request =>
        request.username === normalizedUsername && request.status === 'Approved'
      );
      if (!approvedRequest) throw new Error('This password reset request has not been approved.');
      if (Object.values(accounts).some(item => item.username.toLowerCase() === normalizedUsername)) {
        const overrides = readPasswordOverrides();
        overrides[normalizedUsername] = password;
        localStorage.setItem(passwordOverridesKey, JSON.stringify(overrides));
      } else {
        const registeredAccounts = readRegisteredAccounts();
        const registeredAccount = registeredAccounts.find(
          item => item.username.toLowerCase() === normalizedUsername
        );
        if (!registeredAccount) throw new Error('No account was found with that username.');
        registeredAccount.password = password;
        localStorage.setItem(registeredAccountsKey, JSON.stringify(registeredAccounts));
      }
      requests.forEach(request => {
        if (request.username === normalizedUsername && request.status === 'Approved') {
          request.status = 'Completed';
          request.completedAt = new Date().toISOString();
        }
      });
      writePasswordResetRequests(requests);
      window.dispatchEvent(new CustomEvent('ims:password-reset-updated'));
      return { ok: true };
    },
    async approvePasswordReset(requestId) {
      if (window.IMS.currentUser?.role !== 'admin') {
        throw new Error('Only an administrator can approve password reset requests.');
      }
      const requests = readPasswordResetRequests();
      const request = requests.find(entry => entry.id === requestId);
      if (!request || request.status !== 'Pending') throw new Error('This password reset request is no longer pending.');
      request.status = 'Approved';
      request.approvedAt = new Date().toISOString();
      writePasswordResetRequests(requests);
      window.dispatchEvent(new CustomEvent('ims:password-reset-updated'));
      return { ok: true, request };
    },
    async rejectPasswordReset(requestId) {
      if (window.IMS.currentUser?.role !== 'admin') {
        throw new Error('Only an administrator can reject password reset requests.');
      }
      const requests = readPasswordResetRequests();
      const request = requests.find(entry => entry.id === requestId);
      if (!request || request.status !== 'Pending') throw new Error('This password reset request is no longer pending.');
      request.status = 'Rejected';
      request.rejectedAt = new Date().toISOString();
      writePasswordResetRequests(requests);
      window.dispatchEvent(new CustomEvent('ims:password-reset-updated'));
      return { ok: true, request };
    },
    readPasswordResetRequests,
    findAccountById,
    findEndUserByName,
    getSupplyOfficeHead,
    async getSession() {
      const session = readSession();
      if (!session) return null;
      const account = [...Object.values(accounts), ...readRegisteredAccounts()].find(
        candidate => candidate.username.toLowerCase() === session.username?.toLowerCase()
      );
      return account
        ? {
          ...session,
          employeeId: account.employeeId || '',
          office: account.office || '',
          email: account.email || ''
        }
        : session;
    },
    async logout() {
      sessionStorage.removeItem(sessionKey);
      localStorage.removeItem(sessionKey);
      return { ok: true };
    }
  };
})();
