/**
 * Базовый URL PartyHome signaling.
 * В Vite dev без VITE_PARTYHOME_URL: '' — запросы на тот же origin, прокси /api/partyhome.
 */
export function getPartyhomeBaseUrl() {
  const raw = import.meta.env.VITE_PARTYHOME_URL;
  if (raw && String(raw).trim()) {
    return String(raw).trim().replace(/\/$/, '');
  }
  return '';
}

function runtimePartyhomeToken() {
  if (typeof window === 'undefined') return '';
  const rt = window.__AICONTROL_RUNTIME__;
  if (!rt || typeof rt !== 'object') return '';
  const raw = rt.partyhomeToken;
  if (raw === undefined || raw === null) return '';
  return String(raw).trim();
}

export function getPartyhomeToken() {
  const fromRuntime = runtimePartyhomeToken();
  if (fromRuntime) return fromRuntime;
  const raw = import.meta.env.VITE_PARTYHOME_TOKEN;
  if (raw && String(raw).trim()) {
    return String(raw).trim();
  }
  return 'dev';
}

/** HTTP path prefix when using same-origin proxy. */
export function getPartyhomeApiPrefix() {
  const base = getPartyhomeBaseUrl();
  return base ? '' : '/api/partyhome';
}

/**
 * @param {string} partyRoomId
 * @param {string} [token]
 */
export function getPartyhomeWsUrl(partyRoomId, token = getPartyhomeToken()) {
  const base = getPartyhomeBaseUrl();
  const path = `/ws?room_id=${encodeURIComponent(partyRoomId)}&token=${encodeURIComponent(token)}`;
  if (!base) {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/api/partyhome${path}`;
  }
  const wsBase = base.replace(/^http/, 'ws');
  return `${wsBase}${path}`;
}
