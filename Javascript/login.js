document.addEventListener('DOMContentLoaded', () => {
  const togglePass = document.getElementById('togglePass');
  const passInput = document.getElementById('password');
  const loginForm = document.getElementById('loginForm');
  const errorMessage = document.getElementById('loginErr');

  togglePass?.addEventListener('click', () => {
    const showing = passInput.type === 'password';
    passInput.type = showing ? 'text' : 'password';
    togglePass.setAttribute('aria-label', showing ? 'Hide password' : 'Show password');
  });

  loginForm?.addEventListener('submit', event => {
    event.preventDefault();
    const username = document.getElementById('username').value.trim().toLowerCase();
    const password = passInput.value;
    const role = loginForm.querySelector('input[name="role"]:checked')?.value;
    errorMessage.classList.add('hidden');
    window.IMS.accounts.login(role, username, password, document.getElementById('rememberMe').checked)
      .then(() => { window.location.href = role === 'admin' ? 'dashboard.html' : 'inventory.html'; })
      .catch(error => {
        console.error('Login request failed.', error);
        errorMessage.textContent = error.message || 'Username or password is incorrect for the selected workspace.';
        errorMessage.classList.remove('hidden');
      });
  });
});
