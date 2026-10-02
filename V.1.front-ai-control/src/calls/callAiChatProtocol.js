/**
 * Shared in-call AI chat payloads + soft input lock over PartyHome WS.
 *
 * Chat: ClientMessage.chat text = JSON envelope (broadcast_except → local echo).
 * Lock: ClientMessage.call_event free-form string (same broadcast_except rule).
 */

export const CALL_AI_CHAT_VERSION = 2;
export const AI_LOCK_TTL_MS = 25_000;
export const AI_LOCK_HEARTBEAT_MS = 8_000;

const LOCK_PREFIX = 'ai_lock:';

/**
 * @param {{ kind: 'ai_user'|'ai_assistant'|'ai_system', id?: string, text: string, authorName?: string, authorPeerId?: string|null, ts?: number, entityRefs?: object[] }} payload
 */
export function encodeAiChatPayload(payload) {
  const refs = Array.isArray(payload.entityRefs) ? payload.entityRefs : [];
  return JSON.stringify({
    v: CALL_AI_CHAT_VERSION,
    kind: payload.kind,
    id: payload.id || `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text: String(payload.text || ''),
    authorName: payload.authorName || '',
    authorPeerId: payload.authorPeerId || null,
    ts: payload.ts || Date.now(),
    entityRefs: refs,
  });
}

/**
 * @param {string} raw
 * @returns {null|{ v:number, kind:string, id:string, text:string, authorName:string, authorPeerId:string|null, ts:number, entityRefs:object[] }}
 */
export function parseAiChatPayload(raw) {
  const text = String(raw || '').trim();
  if (!text.startsWith('{')) return null;
  try {
    const o = JSON.parse(text);
    if (!o || (o.v !== CALL_AI_CHAT_VERSION && o.v !== 1)) return null;
    if (!['ai_user', 'ai_assistant', 'ai_system'].includes(o.kind)) return null;
    return {
      v: Number(o.v) || CALL_AI_CHAT_VERSION,
      kind: o.kind,
      id: String(o.id || `m-${Date.now()}`),
      text: String(o.text || ''),
      authorName: String(o.authorName || ''),
      authorPeerId: o.authorPeerId != null ? String(o.authorPeerId) : null,
      ts: Number(o.ts) || Date.now(),
      entityRefs: Array.isArray(o.entityRefs) ? o.entityRefs : [],
    };
  } catch {
    return null;
  }
}

/**
 * @param {'acquire'|'release'|'heartbeat'} action
 * @param {string} nonce
 * @param {string} [displayName]
 */
export function encodeAiLockEvent(action, nonce, displayName = '') {
  const n = String(nonce || '').trim();
  if (!n) throw new Error('lock nonce required');
  if (action === 'acquire') {
    const name = String(displayName || 'Участник').replace(/\|/g, ' ');
    return `${LOCK_PREFIX}acquire|${n}|${name}`;
  }
  if (action === 'release') return `${LOCK_PREFIX}release|${n}`;
  if (action === 'heartbeat') return `${LOCK_PREFIX}heartbeat|${n}`;
  throw new Error(`unknown lock action: ${action}`);
}

/**
 * @param {string} event
 * @returns {null|{ action: 'acquire'|'release'|'heartbeat', nonce: string, displayName: string }}
 */
export function parseAiLockEvent(event) {
  const raw = String(event || '');
  if (!raw.startsWith(LOCK_PREFIX)) return null;
  const rest = raw.slice(LOCK_PREFIX.length);
  const parts = rest.split('|');
  const action = parts[0];
  const nonce = parts[1] || '';
  if (!nonce) return null;
  if (action === 'acquire') {
    return {
      action: 'acquire',
      nonce,
      displayName: parts.slice(2).join('|') || 'Участник',
    };
  }
  if (action === 'release' || action === 'heartbeat') {
    return { action, nonce, displayName: '' };
  }
  return null;
}

/**
 * Apply an incoming lock event to local lock state.
 * @param {null|{ peerId: string, name: string, nonce: string, expiresAt: number }} current
 * @param {{ action: string, nonce: string, displayName: string }} parsed
 * @param {string} fromPeerId
 * @param {number} [now]
 * @param {number} [ttlMs]
 */
export function applyAiLockEvent(current, parsed, fromPeerId, now = Date.now(), ttlMs = AI_LOCK_TTL_MS) {
  if (!parsed || !fromPeerId) return current;

  if (parsed.action === 'acquire') {
    return {
      peerId: String(fromPeerId),
      name: parsed.displayName || 'Участник',
      nonce: parsed.nonce,
      expiresAt: now + ttlMs,
    };
  }

  if (!current) return null;

  if (parsed.action === 'release') {
    if (current.nonce === parsed.nonce || current.peerId === fromPeerId) return null;
    return current;
  }

  if (parsed.action === 'heartbeat') {
    if (current.nonce === parsed.nonce && current.peerId === fromPeerId) {
      return { ...current, expiresAt: now + ttlMs };
    }
    return current;
  }

  return current;
}

/**
 * Whether the local user may type given current lock.
 * @param {null|{ peerId: string, expiresAt: number }} lock
 * @param {string|null} selfPeerId
 * @param {number} [now]
 */
export function canTypeWithAiLock(lock, selfPeerId, now = Date.now()) {
  if (!lock || lock.expiresAt <= now) return true;
  if (!selfPeerId) return false;
  return String(lock.peerId) === String(selfPeerId);
}

export function newAiLockNonce() {
  return `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}
