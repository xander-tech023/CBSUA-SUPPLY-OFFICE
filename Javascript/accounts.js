window.IMS = window.IMS || {};

(() => {
  const backendHint = 'Database login requires XAMPP. Start Apache and MySQL, then open http://localhost/CBSUA-SUPPLY-OFFICE/html/index.html instead of Live Server.';

  async function readResponse(response) {
    if (!response.headers.get('content-type')?.toLowerCase().includes('application/json')) {
      throw new Error(backendHint);
    }
    try {
      return await response.json();
    } catch {
      throw new Error(`The XAMPP login API returned an invalid response. ${backendHint}`);
    }
  }

  async function request(action, payload = {}) {
    let response;
    try {
      response = await fetch('../api.php', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload })
      });
    } catch {
      throw new Error(backendHint);
    }
    const result = await readResponse(response);
    if (!response.ok || !result.ok) {
      throw new Error(result.error || 'The server could not complete the request.');
    }
    return result;
  }

  window.IMS.accounts = {
    login: (role, username, password, remember) => request('login', { role, username, password, remember }),
    async getSession() {
      let response;
      try {
        response = await fetch('../api.php?action=session', { credentials: 'same-origin' });
      } catch {
        throw new Error(backendHint);
      }
      const result = await readResponse(response);
      if (response.status === 401) return null;
      if (!response.ok || !result.ok) throw new Error(result.error || 'The session could not be checked.');
      return result.user;
    },
    logout: () => request('logout')
  };
})();
