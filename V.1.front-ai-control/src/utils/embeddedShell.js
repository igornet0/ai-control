/**
 * True when this document is a nested SPA (profile dashboard iframe or /embed/ route).
 * Those shells must not run global call/chat notification hosts.
 */
export function isEmbeddedPath(pathname = '') {
  return String(pathname || '').startsWith('/embed/');
}

export function isEmbeddedShell() {
  if (typeof window === 'undefined') return false;
  try {
    if (window.top && window !== window.top) return true;
  } catch {
    return true;
  }
  return isEmbeddedPath(window.location?.pathname);
}

export function isCallPopoutPath(pathname = '') {
  const path = String(pathname || '');
  return path === '/call' || path.startsWith('/call/');
}
