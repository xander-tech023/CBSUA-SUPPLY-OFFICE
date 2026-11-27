(() => {
  interface Account {
    id: number;
    username: string;
    password: string;
    name: string;
    title: string;
    role: string;
    employeeId?: string;
    office?: string;
    officeId?: string;
    email?: string;
  }

  interface RegisteredAccount extends Account {
    employeeId: string;
  }

  interface SessionUser {
    id: number | string;
    username: string;
    name: string;
    title: string;
    role: string;
    employeeId?: string;
    office?: string;
    officeId?: string;
    email?: string;
  }

  interface PublicProfile {
    id: number | string;
    username: string;
    name: string;
    title: string;
    role: string;
    employeeId: string;
    office: string;
    email: string;
  }

  interface PasswordResetRequest {
    id: string;
    username: string;
    accountName: string;
    role: string;
    status: string;
    requestedAt: string;
    approvedAt?: string;
    completedAt?: string;
    rejectedAt?: string;
  }

  interface AccountsApi {
    login(role: unknown, username: unknown, password: unknown, remember: unknown): Promise<{ ok: true; user: SessionUser }>;
    register(registration: { acceptedTerms?: unknown; [key: string]: unknown }): Promise<{ ok: true; account: Account }>;
    updateEmployeeId(username: unknown, employeeId: unknown): Promise<{ ok: true; employeeId: string }>;
    requestPasswordReset(username: unknown): Promise<{ ok: true; request: PasswordResetRequest }>;
    resetPassword(username: unknown, password: unknown): Promise<{ ok: true }>;
    approvePasswordReset(requestId: unknown): Promise<{ ok: true; request: PasswordResetRequest }>;
    rejectPasswordReset(requestId: unknown): Promise<{ ok: true; request: PasswordResetRequest }>;
    readPasswordResetRequests(): PasswordResetRequest[];
    getOfficeId(officeName: unknown): string;
    findAccountById(id: unknown): PublicProfile | null;
    findEndUserByName(name: unknown, office: unknown): PublicProfile | null;
    getSupplyOfficeHead(): PublicProfile | null;
    getSession(): Promise<SessionUser | null>;
    logout(): Promise<{ ok: true }>;
  }

  interface IMSNamespace {
    accounts?: AccountsApi;
    currentUser?: SessionUser | null;
  }

  const imsWindow = window as Window & { IMS?: IMSNamespace };
  const ims = imsWindow.IMS || {};
  imsWindow.IMS = ims;

  const sessionKey = 'cbsuaSupplySession';
  const registeredAccountsKey = 'cbsuaSupplyAccounts';
  const passwordOverridesKey = 'cbsuaSupplyPasswordOverrides';
  const passwordResetRequestsKey = 'cbsuaSupplyPasswordResetRequests';
  const accounts: Record<string, Account> = {
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

  function getOfficeId(officeName: unknown): string {
    const index = officeNames.findIndex(name => name.toLowerCase() === String(officeName || '').trim().toLowerCase());
    return index >= 0 ? `OFF-${String(index + 1).padStart(3, '0')}` : '';
  }

  function readSession(): SessionUser | null {
    try {
      return JSON.parse(sessionStorage.getItem(sessionKey) || localStorage.getItem(sessionKey) || 'null') as SessionUser | null;
    } catch {
      return null;
    }
  }

  function readRegisteredAccounts(): RegisteredAccount[] {
    try {
      return JSON.parse(localStorage.getItem(registeredAccountsKey) || '[]') as RegisteredAccount[];
    } catch {
      return [];
    }
  }

  function readPasswordOverrides(): Record<string, string> {
    try {
      return JSON.parse(localStorage.getItem(passwordOverridesKey) || '{}') as Record<string, string>;
    } catch {
      return {};
    }
  }

  function readPasswordResetRequests(): PasswordResetRequest[] {
    try {
      return JSON.parse(localStorage.getItem(passwordResetRequestsKey) || '[]') as PasswordResetRequest[];
    } catch {
      return [];
    }
  }

  function writePasswordResetRequests(requests: PasswordResetRequest[]): void {
    localStorage.setItem(passwordResetRequestsKey, JSON.stringify(requests));
  }

  function getAllAccounts(): Account[] {
    const overrides = readPasswordOverrides();
    return [...Object.values(accounts).map(account => ({
      ...account,
      password: account.role === 'admin'
        ? account.password
        : overrides[account.username.toLowerCase()] || account.password
    })), ...readRegisteredAccounts()];
  }

  function canResetPassword(account: Account | null): boolean {
    return account?.role === 'staff' || account?.role === 'end-user';
  }

  function validatePassword(password: unknown): password is string {
    return typeof password === 'string'
      && password.length >= 8
      && password.length <= 64
      && /[A-Za-z]/.test(password)
      && /\d/.test(password);
  }

  function normalizeRegistration(registration: unknown): RegisteredAccount {
    if (!registration || typeof registration !== 'object') {
      throw new Error('Enter the account details before creating the account.');
    }
    const registrationDetails = registration as Record<string, unknown>;
    const firstName = String(registrationDetails.firstName || '').trim();
    const middleName = String(registrationDetails.middleName || '').trim();
    const surname = String(registrationDetails.surname || '').trim();
    const employeeId = String(registrationDetails.employeeId || '').trim();
    const username = String(registrationDetails.username || '').trim().toLowerCase();
    const position = String(registrationDetails.position || '').trim();
    const office = String(registrationDetails.office || '').trim();
    const email = String(registrationDetails.email || '').trim().toLowerCase();
    const password = registrationDetails.password;

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
    if (position.length < 2 || position.length > 80) {
      throw new Error('Employee position must be 2-80 characters.');
    }
    if (!officeNames.includes(office)) throw new Error('Select a valid office.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid institutional email address.');
    if (!validatePassword(password)) {
      throw new Error('Password must be 8-64 characters and contain at least one letter and one number.');
    }
    return {
      id: Date.now(),
      username,
      password,
      name: [firstName, middleName, surname].filter(Boolean).join(' '),
      employeeId,
      title: position,
      office,
      officeId: getOfficeId(office),
      email,
      role: 'end-user'
    };
  }

  function findAccount(username: unknown): Account | null {
    const normalized = String(username || '').trim().toLowerCase();
    return getAllAccounts().find(account => account.username.toLowerCase() === normalized) || null;
  }

  function getPublicProfile(account: Account | null | undefined): PublicProfile | null {
    if (!account) return null;
    const { id, username, name, title, role, employeeId, office, email } = account;
    return { id, username, name, title, role, employeeId: employeeId || '', office: office || '', email: email || '' };
  }

  function findAccountById(id: unknown): PublicProfile | null {
    const account = getAllAccounts().find(candidate => String(candidate.id) === String(id));
    return getPublicProfile(account);
  }

  function findEndUserByName(name: unknown, office: unknown): PublicProfile | null {
    const normalizedName = String(name || '').trim().toLowerCase();
    const normalizedOffice = String(office || '').trim().toLowerCase();
    const account = getAllAccounts().find(candidate =>
      candidate.role === 'end-user'
      && candidate.name?.trim().toLowerCase() === normalizedName
      && (!normalizedOffice || candidate.office?.trim().toLowerCase() === normalizedOffice)
    );
    return getPublicProfile(account);
  }

  function getSupplyOfficeHead(): PublicProfile | null {
    const account = getAllAccounts().find(candidate =>
      candidate.role === 'admin'
      && /\bhead\b/i.test(candidate.title || '')
      && /supply office/i.test(`${candidate.title || ''} ${candidate.office || ''}`)
    );
    return getPublicProfile(account);
  }

  function writeRegisteredAccount(account: RegisteredAccount): void {
    const registeredAccounts = readRegisteredAccounts();
    const existingAccounts = [...registeredAccounts, ...Object.values(accounts)];
    const duplicate = existingAccounts.some(
      existing => existing.username.toLowerCase() === account.username.toLowerCase()
    );
    if (duplicate) throw new Error('That username is already registered.');
    if (existingAccounts.some(existing =>
      existing.employeeId
      && existing.employeeId.toLowerCase() === account.employeeId.toLowerCase()
    )) {
      throw new Error('An account already exists for that employee ID.');
    }
    while (existingAccounts.some(existing => String(existing.id) === String(account.id))) {
      account.id += 1;
    }
    registeredAccounts.push(account);
    localStorage.setItem(registeredAccountsKey, JSON.stringify(registeredAccounts));
  }

  function saveAccountPassword(account: Account, password: string): void {
    const normalizedUsername = account.username.toLowerCase();
    if (Object.values(accounts).some(item => item.username.toLowerCase() === normalizedUsername)) {
      const overrides = readPasswordOverrides();
      overrides[normalizedUsername] = password;
      localStorage.setItem(passwordOverridesKey, JSON.stringify(overrides));
      return;
    }
    const registeredAccounts = readRegisteredAccounts();
    const registeredAccount = registeredAccounts.find(
      item => item.username.toLowerCase() === normalizedUsername
    );
    if (!registeredAccount) throw new Error('No account was found with that username.');
    registeredAccount.password = password;
    localStorage.setItem(registeredAccountsKey, JSON.stringify(registeredAccounts));
  }

  ims.accounts = {
    async login(role, username, password, remember) {
      const normalizedUsername = String(username || '').trim().toLowerCase();
      const account = getAllAccounts().find(
        candidate => candidate.username.toLowerCase() === normalizedUsername
      );
      if (!account || account.password !== password) {
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
      const account = normalizeRegistration(registration);
      writeRegisteredAccount(account);
      return { ok: true, account };
    },
    async updateEmployeeId(username, employeeId) {
      const normalizedUsername = String(username || '').trim().toLowerCase();
      const normalizedEmployeeId = String(employeeId || '').trim().toUpperCase();
      if (!/^[A-Z0-9-]{3,24}$/.test(normalizedEmployeeId)) {
        throw new Error('Enter an employee ID using 3–24 letters, numbers, or hyphens.');
      }
      const registeredAccounts = readRegisteredAccounts();
      const duplicate = [...registeredAccounts, ...Object.values(accounts)].some(account =>
        account.username.toLowerCase() !== normalizedUsername
        && String(account.employeeId || '').trim().toUpperCase() === normalizedEmployeeId
      );
      if (duplicate) throw new Error('That employee ID is already used by another account.');
      const account = registeredAccounts.find(entry => entry.username.toLowerCase() === normalizedUsername);
      if (!account) throw new Error('Only registered end-user accounts can update their employee ID here.');
      account.employeeId = normalizedEmployeeId;
      localStorage.setItem(registeredAccountsKey, JSON.stringify(registeredAccounts));
      const session = readSession();
      if (session?.username?.toLowerCase() === normalizedUsername) {
        session.employeeId = normalizedEmployeeId;
        sessionStorage.setItem(sessionKey, JSON.stringify(session));
        if (localStorage.getItem(sessionKey)) localStorage.setItem(sessionKey, JSON.stringify(session));
        ims.currentUser = session;
      }
      return { ok: true, employeeId: normalizedEmployeeId };
    },
    async requestPasswordReset(username) {
      const account = findAccount(username);
      if (!account) throw new Error('No account was found with that username.');
      if (!canResetPassword(account)) {
        throw new Error('Password resets are available only for staff and end-user accounts.');
      }
      const normalizedUsername = account.username.toLowerCase();
      const requests = readPasswordResetRequests();
      if (requests.some(request => request.username === normalizedUsername
        && ['Pending', 'Approved'].includes(request.status))) {
        throw new Error('A password reset request is already active for this account.');
      }
      const request: PasswordResetRequest = {
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
      if (!canResetPassword(account)) {
        throw new Error('Only staff and end-user passwords can be reset.');
      }
      if (!validatePassword(password)) {
        throw new Error('Password must be 8-64 characters and contain at least one letter and one number.');
      }
      const normalizedUsername = account.username.toLowerCase();
      const requests = readPasswordResetRequests();
      const approvedRequest = requests.find(request =>
        request.username === normalizedUsername && request.status === 'Approved'
      );
      if (!approvedRequest) throw new Error('This password reset request has not been approved.');
      saveAccountPassword(account, password);
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
      if (ims.currentUser?.role !== 'admin') {
        throw new Error('Only an administrator can approve password reset requests.');
      }
      const requests = readPasswordResetRequests();
      const request = requests.find(entry => entry.id === requestId);
      if (!request || request.status !== 'Pending') throw new Error('This password reset request is no longer pending.');
      if (!canResetPassword(findAccount(request.username))) {
        throw new Error('Only staff and end-user passwords can be reset.');
      }
      request.status = 'Approved';
      request.approvedAt = new Date().toISOString();
      writePasswordResetRequests(requests);
      window.dispatchEvent(new CustomEvent('ims:password-reset-updated'));
      return { ok: true, request };
    },
    async rejectPasswordReset(requestId) {
      if (ims.currentUser?.role !== 'admin') {
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
