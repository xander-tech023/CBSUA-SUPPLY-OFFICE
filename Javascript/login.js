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
    let account;
    try {
      account = window.IMS.accounts.getAccounts()[role];
    } catch (error) {
      console.error('Saved account information could not be read.', error);
      errorMessage.textContent = 'Account information could not be read. Contact the Supply Office administrator.';
      errorMessage.classList.remove('hidden');
      return;
    }

    if (!account || username !== account.username.toLowerCase() || password !== account.password) {
      errorMessage.textContent = 'Username or password is incorrect for the selected workspace.';
      errorMessage.classList.remove('hidden');
      return;
    }

    const currentUser = { username: account.username, name: account.name, title: account.title, role };
    try {
      localStorage.removeItem('cbsuaSupplyUser');
      sessionStorage.removeItem('cbsuaSupplyUser');
      const storage = document.getElementById('rememberMe').checked ? localStorage : sessionStorage;
      storage.setItem('cbsuaSupplyUser', JSON.stringify(currentUser));
    } catch (error) {
      console.error('The workspace session could not be saved.', error);
      errorMessage.textContent = 'This browser could not save your workspace session. Enable browser storage and try again.';
      errorMessage.classList.remove('hidden');
      return;
    }
    window.location.href = role === 'admin' ? 'dashboard.html' : 'inventory.html';
  });
});
