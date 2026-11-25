export async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch(path, {
    ...options,
    headers,
    credentials: 'same-origin'
  });
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error('The server returned an invalid response.');
  }
  if (!response.ok) throw new Error(payload.error || `The request failed with status ${response.status}.`);
  return payload;
}

export function jsonRequest(method, body) {
  return { method, body: JSON.stringify(body) };
}
