/** Distinct hues for session cursors / avatar rings. */
export const PRESENCE_COLORS = [
  '#22D3EE',
  '#A78BFA',
  '#F472B6',
  '#34D399',
  '#FBBF24',
  '#FB7185',
  '#60A5FA',
  '#C084FC',
  '#2DD4BF',
  '#F97316',
];

/** @type {Map<string, { clientId: string, x: number, y: number, sheetId?: string, visible: boolean, displayName?: string, color?: string }>} */
const presenceCursors = new Map();

export function colorForUserId(userId) {
  const s = String(userId || '');
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return PRESENCE_COLORS[h % PRESENCE_COLORS.length];
}

export function colorForPeer(peer) {
  const userId = String(peer?.userId || '');
  const key = userId.startsWith('share:') ? peer.clientId || userId : userId || peer?.clientId;
  return colorForUserId(key);
}

export function normalizePeer(raw, fallbackUser) {
  if (!raw || typeof raw !== 'object') return null;
  const clientId = raw.client_id || raw.clientId;
  const userId = raw.user_id || raw.userId || fallbackUser || '';
  if (!clientId) return null;
  const isShare = String(userId).startsWith('share:');
  const displayName =
    (raw.display_name || raw.displayName || '').trim() ||
    (isShare ? `Гость ${String(clientId).slice(0, 4)}` : 'Участник');
  const peer = {
    clientId: String(clientId),
    userId: String(userId),
    displayName,
    avatar: raw.avatar || null,
  };
  peer.color = colorForPeer(peer);
  return peer;
}

export function uniqueEmployees(peers) {
  const byKey = new Map();
  (peers || []).forEach((p) => {
    if (!p) return;
    const userId = String(p.userId || '');
    const key = userId.startsWith('share:') ? p.clientId : userId || p.clientId;
    if (!key) return;
    if (!byKey.has(key)) byKey.set(key, p);
  });
  return [...byKey.values()];
}

export function upsertPresenceCursor(data) {
  if (!data?.clientId) return;
  const clientId = String(data.clientId);
  if (data.visible === false) {
    presenceCursors.delete(clientId);
    return;
  }
  presenceCursors.set(clientId, {
    clientId,
    x: Number(data.x) || 0,
    y: Number(data.y) || 0,
    sheetId: data.sheetId,
    visible: data.visible !== false,
    displayName: data.displayName,
    color: data.color,
  });
}

export function removePresenceCursor(clientId) {
  if (!clientId) return;
  presenceCursors.delete(String(clientId));
}

export function getPresenceCursor(clientId) {
  if (!clientId) return null;
  return presenceCursors.get(String(clientId)) || null;
}

/**
 * Pan viewport so workspace point is centered.
 * @returns {{ ok: boolean, reason?: string }}
 */
export function centerViewportOnCursor(engine, clientId, currentSheetId) {
  const vc = engine?.viewportController;
  if (!vc?.viewport) return { ok: false, reason: 'no-viewport' };
  const cur = getPresenceCursor(clientId);
  if (!cur || !cur.visible) return { ok: false, reason: 'no-cursor' };
  if (
    cur.sheetId != null &&
    currentSheetId != null &&
    String(cur.sheetId) !== String(currentSheetId)
  ) {
    return { ok: false, reason: 'other-sheet' };
  }
  const rect = vc.viewport.getBoundingClientRect();
  const zoom = vc.zoom || 1;
  const offsetX = rect.width / 2 - cur.x * zoom;
  const offsetY = rect.height / 2 - cur.y * zoom;
  vc.setOffset(offsetX, offsetY);
  return { ok: true };
}
