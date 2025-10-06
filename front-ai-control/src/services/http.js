import api from './api';

export async function authFetch(path, options = {}) {
  const base = (api && api.defaults && api.defaults.baseURL) || (typeof import.meta !== 'undefined' ? import.meta.env.VITE_API_URL : '') || '';
  const token = localStorage.getItem('access_token');
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && (!options.body || typeof options.body === 'object')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(base + path, { ...options, headers, body: options.body && typeof options.body === 'object' && headers.get('Content-Type') === 'application/json' ? JSON.stringify(options.body) : options.body });
  const ct = res.headers.get('content-type') || '';
  if (!res.ok) {
    let detail;
    try { detail = ct.includes('application/json') ? await res.json() : await res.text(); } catch { detail = res.statusText; }
    throw new Error(typeof detail === 'string' ? detail : (detail.detail || JSON.stringify(detail)));
  }
  if (ct.includes('application/json')) return res.json();
  return res.text();
}
