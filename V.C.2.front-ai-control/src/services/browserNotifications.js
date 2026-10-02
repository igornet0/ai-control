export function formatUnreadCount(value) {
  const n = Number(value) || 0;
  if (n <= 0) return '';
  if (n > 99) return '99+';
  return String(n);
}

export function notificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return window.Notification.permission;
}

export async function ensureBrowserPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (window.Notification.permission === 'granted') return true;
  if (window.Notification.permission === 'denied') return false;
  try {
    const result = await window.Notification.requestPermission();
    return result === 'granted';
  } catch {
    return false;
  }
}

/**
 * @param {string} title
 * @param {string} body
 * @param {{ tag?: string, onClick?: () => void, requireInteraction?: boolean }} [options]
 */
export function showBrowserNotification(title, body, { tag, onClick, requireInteraction = false } = {}) {
  if (typeof window === 'undefined' || !('Notification' in window)) return null;
  if (window.Notification.permission !== 'granted') return null;
  try {
    const n = new window.Notification(title || 'Сообщения', {
      body: body || '',
      tag: tag || `mmm-${String(title || 'msg')}-${String(body || '').slice(0, 24)}`,
      requireInteraction: Boolean(requireInteraction),
    });
    if (typeof onClick === 'function') {
      n.onclick = () => {
        try {
          window.focus();
        } catch {
          /* ignore */
        }
        onClick();
        n.close();
      };
    }
    if (!requireInteraction) {
      setTimeout(() => {
        try {
          n.close();
        } catch {
          /* ignore */
        }
      }, 8000);
    }
    return n;
  } catch {
    return null;
  }
}
