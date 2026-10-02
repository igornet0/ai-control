import { getDashboardShareContext } from './shareLinkContext';
import { getApiWsOrigin } from './apiBaseUrl';
import { getAccessToken } from './tokenRefresh';

/** Не содержит EDIT/UPDATE/MUTATE/WRITE — realtime-sync пропускает read-only и не шлёт в Python как edit. */
export const RT_EVENT_OP_FILTERS = 'DASHBOARD_ACTIVE_FILTERS';

/** Новый клиент просит у уже подключённых актуальный снимок (фильтры), чтобы не опираться только на БД. */
export const RT_EVENT_OP_REQUEST_SESSION = 'REQUEST_DASHBOARD_SESSION';

export const RT_EVENT_OP_SESSION_HELLO = 'SESSION_HELLO';
export const RT_EVENT_OP_USER_JOIN = 'USER_JOIN';
export const RT_EVENT_OP_USER_LEAVE = 'USER_LEAVE';
export const RT_EVENT_OP_CURSOR = 'DASHBOARD_CURSOR';

function wsRootFromApi() {
  return getApiWsOrigin();
}

export function realtimeDashboardWsEnabled() {
  const v = String(import.meta.env.VITE_REALTIME_DASHBOARD_WS || '').toLowerCase();
  if (v === 'false' || v === '0' || v === 'off') return false;
  if (v === 'true' || v === '1' || v === 'on') return true;
  return Boolean(import.meta.env.DEV);
}

/**
 * @param {WebSocket} ws
 * @param {{ op: string, payload?: object, meta?: object }} body
 */
export function sendRealtimeEvent(ws, { op, payload = {}, meta = {} }) {
  if (!ws || ws.readyState !== WebSocket.OPEN || !op) return;
  const ts = Date.now();
  const metaOut =
    meta && typeof meta === 'object' && !Array.isArray(meta) ? { ...meta, ts } : { ts };
  ws.send(
    JSON.stringify({
      type: 'EVENT',
      op,
      payload: payload || {},
      meta: metaOut,
    })
  );
}

/**
 * Browser WebSocket to Python gateway → TCP `realtime-sync`.
 * @param {{ dashboardId: number, token: string, identityToken?: string, onMessage?: (msg: object) => void }} opts
 */
export function connectRealtimeDashboard({ dashboardId, token, identityToken, onMessage }) {
  const ws = new WebSocket(`${wsRootFromApi()}/ws/realtime`);
  ws.onopen = () => {
    const payload = {};
    const idTok = (identityToken || '').trim();
    if (idTok && idTok !== (token || '').trim()) {
      payload.identity_token = idTok;
    }
    ws.send(
      JSON.stringify({
        type: 'CONNECT',
        room: `dashboard:${dashboardId}`,
        token: token || '',
        payload,
        meta: { ts: Date.now() },
      })
    );
  };
  ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      const t = msg.type;
      if (t === 'PING' || t === 'Ping') {
        ws.send(JSON.stringify({ type: 'PONG', payload: {}, meta: { ts: Date.now() } }));
        return;
      }
      if (onMessage) onMessage(msg);
    } catch {
      /* ignore parse errors */
    }
  };
  return ws;
}

/** Share-link token for room access, else JWT. */
export function realtimeTokenForDashboard() {
  const s = getDashboardShareContext();
  if (s?.token) return s.token;
  return realtimeAccessToken();
}

/** Logged-in profile JWT (when present), for identity on share pages. */
export function realtimeAccessToken() {
  if (typeof localStorage !== 'undefined') {
    return getAccessToken() || '';
  }
  return '';
}

export function realtimeIdentityTokenForDashboard() {
  const access = realtimeAccessToken();
  if (!access) return '';
  const share = getDashboardShareContext()?.token;
  // Only attach identity when CONNECT uses a share token (not the JWT itself).
  if (share && share !== access) return access;
  return '';
}
