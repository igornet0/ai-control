import axios from 'axios';
import { getApiBaseUrl } from './apiBaseUrl';

const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'X-CSRF-Token';
// Refresh tokens rotate on every use and the cookie is shared by all tabs,
// so refreshes must be serialized across tabs (Web Locks API).
const REFRESH_LOCK_NAME = 'ai-control-auth-refresh';
// A frozen background tab (or a hung request) can hold the lock forever;
// never let that leave the current tab stuck on the loading screen.
const LOCK_WAIT_TIMEOUT_MS = 10000;
const REQUEST_TIMEOUT_MS = 10000;

let accessToken = null;
let csrfToken = null;
let refreshInFlight = null;
let legacyCleared = false;

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token) {
  accessToken = token || null;
}

export function clearAccessToken() {
  accessToken = null;
}

function readCsrfCookie() {
  if (typeof document === 'undefined') return null;
  try {
    const match = document.cookie.match(
      new RegExp(`(?:^|; )${CSRF_COOKIE_NAME}=([^;]*)`)
    );
    if (match) return decodeURIComponent(match[1]);
  } catch {
    // ignore
  }
  return null;
}

export function getCsrfToken() {
  // The cookie wins over the in-memory copy: another tab may have rotated it.
  // Memory is the fallback for a cross-origin API where the cookie is unreadable.
  const fromCookie = readCsrfCookie();
  if (fromCookie) {
    csrfToken = fromCookie;
    return fromCookie;
  }
  return csrfToken;
}

export function setCsrfToken(token) {
  csrfToken = token || null;
}

if (typeof window !== 'undefined') {
  window.__getAccessToken__ = getAccessToken;
}

/** @deprecated Prefer setAccessToken — refresh lives in HttpOnly cookie. */
export function persistAuthTokens({ access_token, csrf_token }) {
  if (access_token) {
    setAccessToken(access_token);
  }
  if (csrf_token) {
    setCsrfToken(csrf_token);
  }
  clearLegacyLocalStorageTokens();
}

export function clearLegacyLocalStorageTokens() {
  if (legacyCleared || typeof localStorage === 'undefined') return;
  legacyCleared = true;
  try {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  } catch {
    // ignore quota / private mode
  }
}

function authUrl(path) {
  const baseURL = getApiBaseUrl();
  return baseURL ? `${baseURL}${path}` : path;
}

function csrfHeaders() {
  const token = getCsrfToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers[CSRF_HEADER_NAME] = token;
  return headers;
}

/** Bootstrap CSRF cookie+token when prod CSRF is enabled (cross-origin safe). */
export async function ensureCsrfToken() {
  const existing = getCsrfToken();
  if (existing) return existing;
  try {
    const response = await axios.get(authUrl('/auth/csrf/'), {
      withCredentials: true,
      timeout: REQUEST_TIMEOUT_MS,
    });
    const { csrf_token, csrf_enabled } = response.data || {};
    if (csrf_enabled === false) return null;
    if (csrf_token) {
      setCsrfToken(csrf_token);
      return csrf_token;
    }
  } catch {
    // CSRF may be disabled on this environment
  }
  return getCsrfToken();
}

export async function clearAuthTokens() {
  clearAccessToken();
  clearLegacyLocalStorageTokens();
  try {
    await ensureCsrfToken();
    await axios.post(authUrl('/auth/logout/'), {}, {
      withCredentials: true,
      headers: csrfHeaders(),
    });
  } catch {
    // Best-effort: cookie may already be cleared / session gone
  } finally {
    setCsrfToken(null);
  }
}

async function withCrossTabLock(fn) {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : null;
  if (!locks || typeof locks.request !== 'function') return fn();
  if (typeof AbortController === 'undefined') {
    return locks.request(REFRESH_LOCK_NAME, { mode: 'exclusive' }, fn);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOCK_WAIT_TIMEOUT_MS);
  let granted = false;
  try {
    return await locks.request(
      REFRESH_LOCK_NAME,
      { mode: 'exclusive', signal: controller.signal },
      () => {
        granted = true;
        clearTimeout(timer);
        return fn();
      }
    );
  } catch (error) {
    if (granted) throw error;
    // Lock holder is stuck: refresh without the lock rather than hang.
    return fn();
  } finally {
    clearTimeout(timer);
  }
}

function postRefresh() {
  return axios.post(
    authUrl('/auth/refresh-token/'),
    {},
    {
      withCredentials: true,
      headers: csrfHeaders(),
      timeout: REQUEST_TIMEOUT_MS,
    }
  );
}

async function doRefresh() {
  await ensureCsrfToken();
  let response;
  try {
    response = await postRefresh();
  } catch (error) {
    // Stale CSRF token (e.g. rotated by another tab): fetch a fresh one, retry once.
    if (error?.response?.status !== 403) throw error;
    setCsrfToken(null);
    await ensureCsrfToken();
    response = await postRefresh();
  }
  const { access_token, csrf_token } = response.data || {};
  if (csrf_token) setCsrfToken(csrf_token);
  if (access_token) {
    setAccessToken(access_token);
    return access_token;
  }
  clearAccessToken();
  return null;
}

export async function refreshAccessToken() {
  clearLegacyLocalStorageTokens();

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        return await withCrossTabLock(doRefresh);
      } catch {
        clearAccessToken();
        return null;
      } finally {
        refreshInFlight = null;
      }
    })();
  }

  return refreshInFlight;
}

export function isAuthRelatedRequest(requestUrl = '') {
  return (
    requestUrl.includes('/auth/login_user/') ||
    requestUrl.includes('/auth/register/') ||
    requestUrl.includes('/auth/refresh-token/') ||
    requestUrl.includes('/auth/logout/') ||
    requestUrl.includes('/auth/csrf/') ||
    requestUrl.includes('/auth/invites/') ||
    requestUrl.includes('/auth/password-reset-invites/')
  );
}

export function isPublicShareRequest(requestUrl = '') {
  return requestUrl.includes('/api/public/') || requestUrl.includes('api/public/');
}

/** Landing demo / share links must stay open without an account. */
export function isGuestPublicLocation(pathname) {
  const p =
    pathname ||
    (typeof window !== 'undefined' ? window.location.pathname : '') ||
    '';
  return (
    p.startsWith('/share/') ||
    p.startsWith('/invite/') ||
    p.startsWith('/reset-password/') ||
    p.startsWith('/embed/')
  );
}
