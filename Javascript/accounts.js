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

  const officeNames = [
    "Accounting Office", "Admission Office", "Alumni Office", "Auxiliary Budget Office",
    "Bids and Awards Committee Office", "Business Affairs Unit", "Campus PIO",
    "Cashier's Office", "Clinic / Infirmary", "College of Education",
    "College of Engineering", "College of Industrial Technology",
    "College of Information Technology", "College of Criminology",
    "Commission on Audit", "Curriculum and Instruction Division",
    "Disaster Risk Readiness Management Office",
    "Environmental Science and Agroforestry Program", "Extension Services Unit",
    "Gender and Development Office", "General Administration and Support Services",
    "Guidance and Counseling Unit", "Human Resource Management Office",
    "Informations and Communications Technology Office",
    "Industry Linkages and Development Office",
    "Institutional Planning and Development Office", "Library", "Motorpool",
    "Office of Campus Administrator", "Office of the Student Affairs and Services",
    "Physical Plant and Development Office", "Publication Office",
    "Quality Assurance Office", "Reading Center", "Record's Office",
    "Registrar's Office", "Research and Development Center", "ROTC / NSTP Office",
    "Sentro ng Wika, Kultura at Sining", "Supply Office", "UMIS"
  ].sort((a, b) => a.localeCompare(b));

  function getOfficeId(officeName) {
    const index = officeNames.findIndex(name => name.toLowerCase() === String(officeName || '').trim().toLowerCase());
    return index >= 0 ? `OFF-${String(index + 1).padStart(3, '0')}` : '';
  }

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
        officeId: account.officeId || getOfficeId(account.office),
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
        officeId: getOfficeId(registration.office),
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
    getOfficeId,
    getOfficeNames: () => [...officeNames],
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
