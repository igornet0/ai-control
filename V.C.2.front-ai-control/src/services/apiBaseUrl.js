/**
 * Базовый URL API.
 * Приоритет: window.__AICONTROL_RUNTIME__.apiBase (prod init_env) →
 * VITE_API_URL → (dev: '') → location.origin.
 *
 * В Vite dev без VITE_API_URL: '' — запросы на тот же origin (например :5173),
 * прокси в vite.config.ts шлёт /auth, /admin и /api на бэкенд.
 */
function runtimeApiBase() {
  if (typeof window === 'undefined') return '';
  const rt = window.__AICONTROL_RUNTIME__;
  if (!rt || typeof rt !== 'object') return '';
  const raw = rt.apiBase;
  if (raw === undefined || raw === null) return '';
  const s = String(raw).trim().replace(/\/$/, '');
  return s;
}

export function getApiBaseUrl() {
  const fromRuntime = runtimeApiBase();
  if (fromRuntime) return fromRuntime;

  const env = typeof import.meta !== 'undefined' && import.meta.env != null ? import.meta.env : {};
  const raw = env.VITE_API_URL;
  if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
    return String(raw).trim().replace(/\/$/, '');
  }
  if (env.DEV) {
    return '';
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/$/, '');
  }
  return '';
}

/** ws / wss для WebSocket (тот же origin в dev при пустой базе). */
export function getApiWsOrigin() {
  const base = getApiBaseUrl();
  if (base) {
    return base.replace(/^http/, 'ws');
  }
  if (typeof window !== 'undefined' && window.location) {
    return (window.location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + window.location.host;
  }
  return 'ws://localhost:8000';
}
