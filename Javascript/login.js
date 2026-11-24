document.addEventListener('DOMContentLoaded', () => {
  const passInput = document.getElementById('password');
  const loginForm = document.getElementById('loginForm');
  const errorMessage = document.getElementById('loginErr');
  const loginHeading = document.getElementById('loginHeading');
  const registrationForm = document.getElementById('registrationForm');
  const showRegistration = document.getElementById('showRegistration');
  const showLogin = document.getElementById('showLogin');
  const confirmPassword = document.getElementById('confirmPassword');
  const registrationPassword = document.getElementById('registerPassword');
  const registrationErr = document.getElementById('registrationErr');
  const registrationSuccess = document.getElementById('registrationSuccess');
  const resetPasswordRequestForm = document.getElementById('resetPasswordRequestForm');
  const resetPasswordRequestErr = document.getElementById('resetPasswordRequestErr');
  const showResetPassword = document.getElementById('showResetPassword');
  const cancelResetPassword = document.getElementById('cancelResetPassword');
  const changePasswordForm = document.getElementById('changePasswordForm');
  const cancelChangePassword = document.getElementById('cancelChangePassword');
  const newAccountPassword = document.getElementById('newAccountPassword');
  const confirmNewAccountPassword = document.getElementById('confirmNewAccountPassword');
  const changePasswordErr = document.getElementById('changePasswordErr');
  const changePasswordUsername = document.getElementById('changePasswordUsername');
  const lastResetUsernameKey = 'cbsuaLastPasswordResetUsername';

  function setChangePasswordMode(enabled, username) {
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

  function renderResetStatus() {
    const username = localStorage.getItem(lastResetUsernameKey);
    if (!username) return;
    const latestRequest = window.IMS.accounts.readPasswordResetRequests()
      .filter(request => request.username === username)
      .sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt))[0];
    if (!latestRequest) return;

    registrationSuccess.classList.remove('hidden');
    if (latestRequest.status === 'Approved') {
      registrationSuccess.innerHTML = '';
      const message = document.createElement('span');
      message.textContent = 'Your password reset request was approved.';
      const action = document.createElement('button');
      action.type = 'button';
      action.className = 'ml-2 rounded-lg bg-cbsua-primary px-3 py-1 text-sm font-medium text-white hover:bg-green-700';
      action.textContent = 'Change password';
      action.addEventListener('click', () => setChangePasswordMode(true, username));
      registrationSuccess.append(message, action);
    } else if (latestRequest.status === 'Rejected') {
      registrationSuccess.className = 'text-red-700 text-sm mt-3 text-center';
      registrationSuccess.textContent = 'Your password reset request was rejected.';
    } else if (latestRequest.status === 'Pending') {
      registrationSuccess.className = 'text-cbsua-muted text-sm mt-3 text-center';
      registrationSuccess.textContent = 'Your password reset request is pending administrator review.';
    } else {
      registrationSuccess.classList.add('hidden');
    }
  }

  function setResetPasswordMode(requesting) {
    loginForm?.classList.toggle('hidden', requesting);
    registrationForm?.classList.toggle('hidden', true);
    resetPasswordRequestForm?.classList.toggle('hidden', !requesting);
    changePasswordForm?.classList.toggle('hidden', true);
    loginHeading?.classList.toggle('hidden', requesting);
    if (requesting) document.getElementById('resetUsername')?.focus();
  }

  showResetPassword?.addEventListener('click', () => setResetPasswordMode(true));
  cancelResetPassword?.addEventListener('click', () => setResetPasswordMode(false));

  resetPasswordRequestForm?.addEventListener('submit', event => {
    event.preventDefault();
    resetPasswordRequestErr.classList.add('hidden');
    if (!resetPasswordRequestForm.checkValidity()) {
      resetPasswordRequestForm.reportValidity();
      return;
    }
    const username = document.getElementById('resetUsername').value.trim();
    window.IMS.accounts.requestPasswordReset(username)
      .then(() => {
        localStorage.setItem(lastResetUsernameKey, username.toLowerCase());
        resetPasswordRequestForm.reset();
        registrationSuccess.textContent = 'Password reset request sent to the administrator.';
        registrationSuccess.classList.remove('hidden');
        setResetPasswordMode(false);
        renderResetStatus();
      })
      .catch(error => {
        resetPasswordRequestErr.textContent = error.message || 'The reset request could not be submitted.';
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
    window.IMS.accounts.resetPassword(username, newAccountPassword.value)
      .then(() => {
        changePasswordForm.reset();
        localStorage.removeItem(lastResetUsernameKey);
        setChangePasswordMode(false);
        document.getElementById('username').value = username;
        registrationSuccess.className = 'text-green-700 text-sm mt-3 text-center';
        registrationSuccess.textContent = 'Password changed successfully. Please log in with your new password.';
        registrationSuccess.classList.remove('hidden');
      })
      .catch(error => {
        changePasswordErr.textContent = error.message || 'The password could not be changed.';
        changePasswordErr.classList.remove('hidden');
      });
  });

  function setAccountMode(registering) {
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
      firstName: document.getElementById('firstName').value.trim(),
      middleName: document.getElementById('middleName').value.trim(),
      surname: document.getElementById('surname').value.trim(),
      username: document.getElementById('registerUsername').value.trim(),
      office: document.getElementById('registerOffice').value,
      position: document.getElementById('registerPosition').value.trim(),
      email: document.getElementById('institutionalEmail').value.trim(),
      acceptedTerms: document.getElementById('acceptTerms').checked,
      password: registrationPassword.value
    };

    window.IMS.accounts.register(registration)
      .then(() => {
        registrationForm.reset();
        registrationSuccess.textContent = 'Account created successfully. You can now log in.';
        registrationSuccess.classList.remove('hidden');
        setAccountMode(false);
      })
      .catch(error => {
        registrationErr.textContent = error.message || 'The account could not be created.';
        registrationErr.classList.remove('hidden');
      });
  });

  loginForm?.addEventListener('submit', event => {
    event.preventDefault();
    const username = document.getElementById('username').value.trim().toLowerCase();
    const password = passInput.value;
    errorMessage.classList.add('hidden');
    window.IMS.accounts.login(null, username, password, document.getElementById('rememberMe').checked)
      .then(result => {
        const home = result.user.role === 'admin'
          ? 'dashboard.html'
          : result.user.role === 'end-user'
            ? 'end_user_dashboard.html'
            : 'inventory.html';
        window.location.href = home;
      })
      .catch(error => {
        console.error('Login request failed.', error);
        errorMessage.textContent = error.message || 'Username or password is incorrect for the selected workspace.';
        errorMessage.classList.remove('hidden');
      });
  });

  window.addEventListener('ims:password-reset-updated', renderResetStatus);
  window.addEventListener('storage', event => {
    if (event.key === 'cbsuaSupplyPasswordResetRequests') renderResetStatus();
  });
  renderResetStatus();
});
