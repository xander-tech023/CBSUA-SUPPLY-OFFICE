document.addEventListener('DOMContentLoaded', () => {
  const togglePass = document.getElementById('togglePass');
  const passInput = document.getElementById('password');
  togglePass.addEventListener('click', () => {
    passInput.type = passInput.type === 'password' ? 'text' : 'password';
  });

  const loginForm = document.getElementById('loginForm');
  loginForm.addEventListener('submit', event => {
    event.preventDefault();
    const user = document.getElementById('username');
    const pass = document.getElementById('password');
    const userErr = document.getElementById('userErr');
    const passErr = document.getElementById('passErr');
    let valid = true;
    [[user, userErr], [pass, passErr]].forEach(([input, error]) => {
      const invalid = !input.value.trim();
      error.classList.toggle('hidden', !invalid);
      input.classList.toggle('border-red-500', invalid);
      valid = valid && !invalid;
    });
    if (valid) window.location.href = 'dashboard.html';
  });
});
