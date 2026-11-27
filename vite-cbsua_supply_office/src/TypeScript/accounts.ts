import { apiRequest, jsonRequest } from './api-client.ts';

window.IMS = window.IMS || {};

(() => {
  const officeNames = [
    'Accounting Office',
    'Admission Office',
    'Alumni Office',
    'Auxiliary Office',
    'Budget Office',
    'Bids and Awards Committee Office',
    'Business Affairs Unit',
    'Campus PIO',
    "Cashier's Office",
    'College of Engineering',
    'College of Information Technology',
    'Clinic / Infirmary',
    'College of Criminology',
    'College of Education',
    'Commission on Audit',
    'College of Industrial Technology',
    'Curriculum and Instruction Division',
    'Disaster Risk Readiness Management Office',
    'Environmental Science and Agroforestry Program',
    'Extension Services Unit',
    'Gender and Development Office',
    'General Administration and Support Services',
    'Guidance and Counseling Unit',
    'Human Resource Management Office',
    'Informations and Communications Technology Office',
    'Industry Linkages and Development Office',
    'Institutional Planning and Development Office',
    'Library',
    'Motorpool',
    'Office of Campus Administrator',
    'Office of the Student Affairs and Services',
    'Physical Plant and Development Office',
    'Publication Office',
    'Quality Assurance Office',
    'Reading Center',
    "Record's Office",
    "Registrar's Office",
    'Research and Development Center',
    'ROTC / NSTP Office',
    'Sentro ng Wika, Kultura at Sining',
    'Supply Office',
    'UMIS'
  ];
  let passwordResetRequests = [];

  function getOfficeId(officeName) {
    const index = officeNames.findIndex(name =>
      name.toLowerCase() === String(officeName || '').trim().toLowerCase());
    return index >= 0 ? `OFF-${String(index + 1).padStart(3, '0')}` : '';
  }

  function validatePassword(password) {
    return typeof password === 'string'
      && password.length >= 8
      && password.length <= 64
      && new TextEncoder().encode(password).length <= 72
      && /[A-Za-z]/.test(password)
      && /\d/.test(password);
  }

  function normalizeRegistration(registration) {
    if (!registration || typeof registration !== 'object') {
      throw new Error('Enter the account details before creating the account.');
    }
    const firstName = String(registration.firstName || '').trim();
    const middleName = String(registration.middleName || '').trim();
    const surname = String(registration.surname || '').trim();
    const employeeId = String(registration.employeeId || '').trim();
    const username = String(registration.username || '').trim().toLowerCase();
    const position = String(registration.position || '').trim();
    const office = String(registration.office || '').trim();
    const email = String(registration.email || '').trim().toLowerCase();
    const password = registration.password;

    if (!firstName || !surname || !employeeId || !position || !office || !email || !username) {
      throw new Error('Complete all required account details.');
    }
    if (!/^[A-Za-z0-9._-]{4,30}$/.test(username)) {
      throw new Error('Username must be 4-30 characters using letters, numbers, dots, underscores, or hyphens.');
    }
    if (!/^[A-Za-z0-9-]{2,24}$/.test(employeeId)) {
      throw new Error('Enter a valid employee ID using letters, numbers, or hyphens.');
    }
    if (!/^[A-Za-zÑñ .'-]{2,40}$/.test(firstName)
      || !/^[A-Za-zÑñ .'-]{2,40}$/.test(surname)
      || (middleName && !/^[A-Za-zÑñ .'-]{1,40}$/.test(middleName))) {
      throw new Error('Enter valid names using letters, spaces, apostrophes, periods, or hyphens.');
    }
    if (position.length < 2 || position.length > 100) {
      throw new Error('Employee position must be 2-100 characters.');
    }
    if (!officeNames.includes(office)) throw new Error('Select a valid office.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid institutional email address.');
    if (!validatePassword(password)) {
      throw new Error('Password must be 8-64 characters and contain at least one letter and one number.');
    }
    return {
      firstName,
      middleName,
      surname,
      employeeId,
      username,
      position,
      office,
      email,
      password,
      acceptedTerms: registration.acceptedTerms === true
    };
  }

  async function getPasswordResetRequests(username = '') {
    const query = username ? `?username=${encodeURIComponent(username)}` : '';
    const { requests } = await apiRequest(`/api/password-resets${query}`);
    if (!username) passwordResetRequests = requests;
    return requests;
  }

  async function refreshAdminPasswordResetRequests() {
    passwordResetRequests = await getPasswordResetRequests();
    window.dispatchEvent(new CustomEvent('ims:password-reset-updated'));
  }

  window.IMS.accounts = {
    async initialize(user) {
      if (user?.role === 'admin') await refreshAdminPasswordResetRequests();
    },
    async login(role, username, password, remember) {
      return apiRequest('/api/auth/login', jsonRequest('POST', {
        username: String(username || '').trim().toLowerCase(),
        password,
        remember: remember === true
      }));
    },
    async register(registration) {
      const account = normalizeRegistration(registration);
      return apiRequest('/api/auth/register', jsonRequest('POST', account));
    },
    async updateEmployeeId(username, employeeId) {
      const normalizedEmployeeId = String(employeeId || '').trim().toUpperCase();
      if (!/^[A-Z0-9-]{3,24}$/.test(normalizedEmployeeId)) {
        throw new Error('Enter an employee ID using 3-24 letters, numbers, or hyphens.');
      }
      const result = await apiRequest('/api/accounts/me/employee-id',
        jsonRequest('PUT', { employeeId: normalizedEmployeeId }));
      if (window.IMS.currentUser) {
        window.IMS.currentUser.employeeId = result.employeeId;
      }
      return result;
    },
    async requestPasswordReset(username) {
      const result = await apiRequest('/api/password-resets', jsonRequest('POST', {
        username: String(username || '').trim().toLowerCase()
      }));
      window.dispatchEvent(new CustomEvent('ims:password-reset-updated'));
      return result;
    },
    async resetPassword(username, password) {
      const result = await apiRequest('/api/password-resets/complete', jsonRequest('POST', {
        username: String(username || '').trim().toLowerCase(),
        password
      }));
      window.dispatchEvent(new CustomEvent('ims:password-reset-updated'));
      return result;
    },
    async approvePasswordReset(requestId) {
      if (window.IMS.currentUser?.role !== 'admin') {
        throw new Error('Only an administrator can approve password reset requests.');
      }
      const result = await apiRequest(`/api/password-resets/${encodeURIComponent(requestId)}/review`,
        jsonRequest('POST', { status: 'Approved' }));
      await refreshAdminPasswordResetRequests();
      return result;
    },
    async rejectPasswordReset(requestId) {
      if (window.IMS.currentUser?.role !== 'admin') {
        throw new Error('Only an administrator can reject password reset requests.');
      }
      const result = await apiRequest(`/api/password-resets/${encodeURIComponent(requestId)}/review`,
        jsonRequest('POST', { status: 'Rejected' }));
      await refreshAdminPasswordResetRequests();
      return result;
    },
    readPasswordResetRequests() {
      return [...passwordResetRequests];
    },
    getPasswordResetRequests,
    getOfficeId,
    async findAccountById(id) {
      const { account } = await apiRequest(`/api/accounts/${encodeURIComponent(id)}`);
      return account;
    },
    async findEndUserByName(name, office) {
      const params = new URLSearchParams({ name: String(name || '').trim(), office: String(office || '').trim() });
      const { account } = await apiRequest(`/api/accounts/find?${params}`);
      return account;
    },
    async getSupplyOfficeHead() {
      const { account } = await apiRequest('/api/accounts/head');
      return account;
    },
    async getSession() {
      const { user } = await apiRequest('/api/auth/session');
      return user;
    },
    async logout() {
      return apiRequest('/api/auth/logout', { method: 'POST' });
    }
  };
})();
