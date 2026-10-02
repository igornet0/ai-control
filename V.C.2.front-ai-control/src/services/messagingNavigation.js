export const MMM_OPEN_DIRECT_EVENT = 'mmm:open-direct';
export const MMM_OPEN_ROOM_EVENT = 'mmm:open-room';
export const MMM_OPEN_MAIL_EVENT = 'mmm:open-mail';

/** @param {number} userId */
export function requestDirectMessage(userId) {
  const id = Number(userId);
  if (!id) return;
  window.dispatchEvent(
    new CustomEvent(MMM_OPEN_DIRECT_EVENT, { detail: { userId: id } })
  );
}

/**
 * Open a chat room in the site-wide mini chat (does not navigate away).
 * @param {number} roomId
 * @param {{ messageId?: number|null }} [opts]
 */
export function requestOpenRoom(roomId, opts = {}) {
  const id = Number(roomId);
  if (!id) return;
  const messageId = opts.messageId != null ? Number(opts.messageId) : null;
  window.dispatchEvent(
    new CustomEvent(MMM_OPEN_ROOM_EVENT, {
      detail: {
        roomId: id,
        messageId: Number.isFinite(messageId) && messageId > 0 ? messageId : null,
      },
    })
  );
}
