export async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  let response;
  try {
    response = await fetch(path, {
      ...options,
      headers,
      credentials: 'same-origin'
    });
  } catch {
    throw new Error('Could not connect to the API server. Start it with "npm run api" from the repository root.');
  }
  const responseBody = await response.text();
  let payload;
  try {
    payload = JSON.parse(responseBody);
  } catch {
    if (response.status >= 500) {
      throw new Error('The API server returned an error. Check that it is running with "npm run api" and review its terminal output.');
    }
    throw new Error('The server returned an invalid response.');
  }
  if (!response.ok) throw new Error(payload.error || `The request failed with status ${response.status}.`);
  return payload;
}

export function jsonRequest(method, body) {
  return { method, body: JSON.stringify(body) };
}
