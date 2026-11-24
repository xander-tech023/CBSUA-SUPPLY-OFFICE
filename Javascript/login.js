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
      employeeId: document.getElementById('registerEmployeeId').value.trim(),
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
});
