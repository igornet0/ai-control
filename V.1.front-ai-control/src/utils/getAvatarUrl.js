import { getApiBaseUrl } from '../services/apiBaseUrl';

function getStaticBaseUrl() {
  const base = getApiBaseUrl();
  if (base) return base;

  const env = typeof import.meta !== 'undefined' && import.meta.env != null ? import.meta.env : {};
  const proxyTarget = env.VITE_DEV_PROXY_TARGET || env.VITE_API_URL;
  if (proxyTarget && String(proxyTarget).trim()) {
    return String(proxyTarget).trim().replace(/\/$/, '');
  }

  // Vite dev: /static проксируется на бэкенд (vite.config.ts), достаточно same-origin пути
  if (env.DEV) {
    return '';
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/$/, '');
  }

  return '';
}

export function getAvatarUrl(avatarPath) {
  if (!avatarPath) return null;
  if (avatarPath.startsWith('http')) return avatarPath;

  const path = avatarPath.startsWith('/') ? avatarPath : `/${avatarPath}`;
  const base = getStaticBaseUrl();
  return `${base}${path}`;
}

export function getInitials(name) {
  if (!name) return '?';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}
