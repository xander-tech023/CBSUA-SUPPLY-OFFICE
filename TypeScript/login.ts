(() => {
  interface ResetRequest {
    id: string;
    username: string;
    role: string;
    status: string;
    requestedAt: string;
  }

  interface Registration {
    firstName: string;
    middleName: string;
    surname: string;
    employeeId: string;
    username: string;
    office: string;
    position: string;
    email: string;
    acceptedTerms: boolean;
    password: string;
  }

  interface LoginIMS {
    accounts: {
      getOfficeId(office: unknown): string;
      readPasswordResetRequests(): ResetRequest[];
      requestPasswordReset(username: string): Promise<unknown>;
      resetPassword(username: string | null, password: string): Promise<unknown>;
      register(registration: Registration): Promise<unknown>;
      login(role: unknown, username: string, password: string, remember: boolean): Promise<{ user: { role: string } }>;
    };
  }

  const browser = window as Window & { IMS?: LoginIMS };
  document.addEventListener('DOMContentLoaded', () => {
  const ims = browser.IMS!;
  document.querySelectorAll<HTMLInputElement>('input[type="password"]').forEach(input => {
    ['copy', 'cut', 'paste', 'drop'].forEach(eventName => {
      input.addEventListener(eventName, event => event.preventDefault());
    });
  });

  const passInput = document.getElementById('password') as HTMLInputElement;
  const loginForm = document.getElementById('loginForm') as HTMLFormElement | null;
  const errorMessage = document.getElementById('loginErr')!;
  const loginHeading = document.getElementById('loginHeading');
  const registrationForm = document.getElementById('registrationForm') as HTMLFormElement | null;
  const showRegistration = document.getElementById('showRegistration');
  const showLogin = document.getElementById('showLogin');
  const confirmPassword = document.getElementById('confirmPassword') as HTMLInputElement;
  const registrationPassword = document.getElementById('registerPassword') as HTMLInputElement;
  const registrationErr = document.getElementById('registrationErr')!;
  const registrationSuccess = document.getElementById('registrationSuccess')!;
  const resetPasswordRequestForm = document.getElementById('resetPasswordRequestForm') as HTMLFormElement | null;
  const resetPasswordRequestErr = document.getElementById('resetPasswordRequestErr')!;
  const showResetPassword = document.getElementById('showResetPassword') as HTMLButtonElement;
  const cancelResetPassword = document.getElementById('cancelResetPassword');
  const changePasswordForm = document.getElementById('changePasswordForm') as HTMLFormElement | null;
  const cancelChangePassword = document.getElementById('cancelChangePassword');
  const newAccountPassword = document.getElementById('newAccountPassword') as HTMLInputElement;
  const confirmNewAccountPassword = document.getElementById('confirmNewAccountPassword') as HTMLInputElement;
  const changePasswordErr = document.getElementById('changePasswordErr')!;
  const changePasswordUsername = document.getElementById('changePasswordUsername')!;
  const lastResetUsernameKey = 'cbsuaLastPasswordResetUsername';

  const officeSelect = document.getElementById('registerOffice') as HTMLSelectElement;
  if (officeSelect) {
    Array.from(officeSelect.options).forEach(option => {
      if (!option.value) return;
      option.value = option.textContent!.trim();
      option.textContent = `${ims.accounts.getOfficeId(option.value)} — ${option.value}`;
    });
  }

  function setChangePasswordMode(enabled: boolean, username?: string | null): void {
    if (enabled) registrationSuccess.classList.add('hidden');
    loginForm?.classList.toggle('hidden', enabled);
    registrationForm?.classList.toggle('hidden', true);
    resetPasswordRequestForm?.classList.toggle('hidden', true);
    changePasswordForm?.classList.toggle('hidden', !enabled);
    loginHeading?.classList.toggle('hidden', enabled);
    if (enabled) {
      changePasswordUsername.textContent = `@${username}`;
      newAccountPassword.focus();
    }
  }

  function renderResetStatus(): void {
    const username = localStorage.getItem(lastResetUsernameKey);
    if (!username) {
      showResetPassword.textContent = 'Change password';
      showResetPassword.disabled = false;
      return;
    }
    const latestRequest = ims.accounts.readPasswordResetRequests()
      .filter(request => request.username === username && ['staff', 'end-user'].includes(request.role))
      .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime())[0];
    if (!latestRequest) {
      showResetPassword.textContent = 'Change password';
      showResetPassword.disabled = false;
      return;
    }

    if (latestRequest.status === 'Approved') {
      showResetPassword.textContent = 'Change password';
      showResetPassword.disabled = false;
      return;
    }
    const requestPending = latestRequest.status === 'Pending';
    showResetPassword.textContent = requestPending ? 'Request pending' : 'Change password';
    showResetPassword.disabled = requestPending;
  }

  function setResetPasswordMode(requesting: boolean): void {
    if (requesting) registrationSuccess.classList.add('hidden');
    loginForm?.classList.toggle('hidden', requesting);
    registrationForm?.classList.toggle('hidden', true);
    resetPasswordRequestForm?.classList.toggle('hidden', !requesting);
    changePasswordForm?.classList.toggle('hidden', true);
    loginHeading?.classList.toggle('hidden', requesting);
    if (requesting) document.getElementById('resetUsername')?.focus();
  }

  showResetPassword?.addEventListener('click', () => {
    const username = localStorage.getItem(lastResetUsernameKey);
    const approved = username && ims.accounts.readPasswordResetRequests().some(request =>
      request.username === username
      && ['staff', 'end-user'].includes(request.role)
      && request.status === 'Approved'
    );
    if (approved) setChangePasswordMode(true, username);
    else setResetPasswordMode(true);
  });
  cancelResetPassword?.addEventListener('click', () => setResetPasswordMode(false));

  resetPasswordRequestForm?.addEventListener('submit', event => {
    event.preventDefault();
    resetPasswordRequestErr.classList.add('hidden');
    if (!resetPasswordRequestForm.checkValidity()) {
      resetPasswordRequestForm.reportValidity();
      return;
    }
    const username = (document.getElementById('resetUsername') as HTMLInputElement).value.trim();
    ims.accounts.requestPasswordReset(username)
      .then(() => {
        localStorage.setItem(lastResetUsernameKey, username.toLowerCase());
        resetPasswordRequestForm.reset();
        registrationSuccess.textContent = 'Password change request sent to the administrator for approval.';
        registrationSuccess.classList.remove('hidden');
        setResetPasswordMode(false);
        renderResetStatus();
      })
      .catch((error: unknown) => {
        resetPasswordRequestErr.textContent = (error as Error).message || 'The password change request could not be submitted.';
        resetPasswordRequestErr.classList.remove('hidden');
      });
  });

  cancelChangePassword?.addEventListener('click', () => setChangePasswordMode(false));

  confirmNewAccountPassword?.addEventListener('input', () => {
    confirmNewAccountPassword.setCustomValidity(
      confirmNewAccountPassword.value !== newAccountPassword.value ? 'Passwords do not match.' : ''
    );
  });
  newAccountPassword?.addEventListener('input', () => {
    if (confirmNewAccountPassword.value) {
      confirmNewAccountPassword.setCustomValidity(
        confirmNewAccountPassword.value !== newAccountPassword.value ? 'Passwords do not match.' : ''
      );
    }
  });

  changePasswordForm?.addEventListener('submit', event => {
    event.preventDefault();
    changePasswordErr.classList.add('hidden');
    if (!changePasswordForm.checkValidity()) {
      changePasswordForm.reportValidity();
      return;
    }
    const username = localStorage.getItem(lastResetUsernameKey);
    ims.accounts.resetPassword(username, newAccountPassword.value)
      .then(() => {
        changePasswordForm.reset();
        localStorage.removeItem(lastResetUsernameKey);
        setChangePasswordMode(false);
        (document.getElementById('username') as HTMLInputElement).value = username!;
        registrationSuccess.className = 'text-green-700 text-sm mt-3 text-center';
        registrationSuccess.textContent = 'Password changed successfully. Please log in with your new password.';
        registrationSuccess.classList.remove('hidden');
      })
      .catch((error: unknown) => {
        changePasswordErr.textContent = (error as Error).message || 'The password could not be changed.';
        changePasswordErr.classList.remove('hidden');
      });
  });

  function setAccountMode(registering: boolean): void {
    loginForm?.classList.toggle('hidden', registering);
    registrationForm?.classList.toggle('hidden', !registering);
    showRegistration?.classList.toggle('hidden', registering);
    loginHeading?.classList.toggle('hidden', registering);
    if (registering) document.getElementById('firstName')?.focus();
  }

  showRegistration?.addEventListener('click', () => setAccountMode(true));
  showLogin?.addEventListener('click', () => setAccountMode(false));

  confirmPassword?.addEventListener('input', () => {
    confirmPassword.setCustomValidity(
      confirmPassword.value !== registrationPassword.value ? 'Passwords do not match.' : ''
    );
  });
  registrationPassword?.addEventListener('input', () => {
    if (confirmPassword.value) {
      confirmPassword.setCustomValidity(
        confirmPassword.value !== registrationPassword.value ? 'Passwords do not match.' : ''
      );
    }
  });

  registrationForm?.addEventListener('submit', event => {
    event.preventDefault();
    registrationErr.classList.add('hidden');
    registrationSuccess.classList.add('hidden');

    if (!registrationForm.checkValidity()) {
      registrationForm.reportValidity();
      return;
    }

    const registration = {
      firstName: (document.getElementById('firstName') as HTMLInputElement).value.trim(),
      middleName: (document.getElementById('middleName') as HTMLInputElement).value.trim(),
      surname: (document.getElementById('surname') as HTMLInputElement).value.trim(),
      employeeId: (document.getElementById('registerEmployeeId') as HTMLInputElement).value.trim(),
      username: (document.getElementById('registerUsername') as HTMLInputElement).value.trim(),
      office: (document.getElementById('registerOffice') as HTMLSelectElement).value,
      position: (document.getElementById('registerPosition') as HTMLInputElement).value.trim(),
      email: (document.getElementById('institutionalEmail') as HTMLInputElement).value.trim(),
      acceptedTerms: (document.getElementById('acceptTerms') as HTMLInputElement).checked,
      password: registrationPassword.value
    };

    ims.accounts.register(registration)
      .then(() => {
        registrationForm.reset();
        registrationSuccess.textContent = 'Account created successfully. You can now log in.';
        registrationSuccess.classList.remove('hidden');
        setAccountMode(false);
      })
      .catch((error: unknown) => {
        registrationErr.textContent = (error as Error).message || 'The account could not be created.';
        registrationErr.classList.remove('hidden');
      });
  });

  loginForm?.addEventListener('submit', event => {
    event.preventDefault();
    const username = (document.getElementById('username') as HTMLInputElement).value.trim().toLowerCase();
    const password = passInput.value;
    errorMessage.classList.add('hidden');
    ims.accounts.login(null, username, password, (document.getElementById('rememberMe') as HTMLInputElement).checked)
      .then(result => {
        const home = result.user.role === 'admin'
          ? 'dashboard.html'
          : result.user.role === 'end-user'
            ? 'end_user_dashboard.html'
            : 'inventory.html';
        window.location.href = home;
      })
      .catch((error: unknown) => {
        console.error('Login request failed.', error);
        errorMessage.textContent = (error as Error).message || 'Username or password is incorrect for the selected workspace.';
        errorMessage.classList.remove('hidden');
      });
  });

  window.addEventListener('ims:password-reset-updated', renderResetStatus);
  window.addEventListener('storage', event => {
    if (event.key === 'cbsuaSupplyPasswordResetRequests') renderResetStatus();
  });
  renderResetStatus();
});
})();
