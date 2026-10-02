/** Encode AiControl user id into PartyHome display_name for roster matching. */
export function encodeCallDisplayName(user) {
  const id = Number(user?.id);
  const name = String(user?.name || user?.login || 'User').trim() || 'User';
  if (Number.isFinite(id) && id > 0) {
    return `${id}|${name}`;
  }
  return name;
}

/**
 * @param {string|null|undefined} raw
 * @returns {{ userId: number|null, name: string }}
 */
export function parseCallDisplayName(raw) {
  const s = String(raw || '').trim();
  if (!s) return { userId: null, name: 'Участник' };
  const i = s.indexOf('|');
  if (i > 0) {
    const id = Number(s.slice(0, i));
    if (Number.isFinite(id) && id > 0) {
      return { userId: id, name: s.slice(i + 1).trim() || `User ${id}` };
    }
  }
  return { userId: null, name: s };
}

/** True when two PartyHome display_names are the same AiControl user (handoff duplicate). */
export function isSameCallUser(a, b) {
  const pa = parseCallDisplayName(a);
  const pb = parseCallDisplayName(b);
  if (pa.userId != null && pb.userId != null) return pa.userId === pb.userId;
  const na = String(pa.name || '').trim().toLowerCase();
  const nb = String(pb.name || '').trim().toLowerCase();
  return Boolean(na && nb && na === nb);
}

export const CALL_HANDOFF_KEY = 'aicontrol-call-handoff';
export const CALL_HANDOFF_CHANNEL = 'aicontrol-call-handoff';
export const CALL_HANDOFF_TTL_MS = 60_000;

export function writeCallHandoff(payload) {
  const handoffId =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `h-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const record = { ...payload, handoffId, ts: Date.now() };
  localStorage.setItem(CALL_HANDOFF_KEY, JSON.stringify(record));
  return handoffId;
}

/** Read handoff without removing (survives React StrictMode remount). */
export function peekCallHandoff() {
  let raw;
  try {
    raw = localStorage.getItem(CALL_HANDOFF_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data?.partyRoomId || !data?.handoffId) return null;
  if (Date.now() - Number(data.ts || 0) > CALL_HANDOFF_TTL_MS) {
    clearCallHandoff();
    return null;
  }
  return data;
}

/** @deprecated use peekCallHandoff + clearCallHandoff */
export function readCallHandoff() {
  const data = peekCallHandoff();
  if (data) clearCallHandoff();
  return data;
}

export function clearCallHandoff() {
  try {
    localStorage.removeItem(CALL_HANDOFF_KEY);
  } catch {
    /* ignore */
  }
}
