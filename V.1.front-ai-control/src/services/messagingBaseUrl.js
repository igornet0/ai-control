import { getAccessToken } from './tokenRefresh';
/**
 * Базовый URL MailMessageManager.
 * В Vite dev без VITE_MESSAGING_URL: '' — запросы на тот же origin, прокси /api/messaging в vite.config.ts.
 */
export function getMessagingBaseUrl() {
  const env = import.meta.env;
  const raw = env.VITE_MESSAGING_URL;
  if (raw && String(raw).trim()) {
    return String(raw).trim().replace(/\/$/, '');
  }
  return '';
}

export function getMessagingWsUrl() {
  const base = getMessagingBaseUrl();
  const token = getAccessToken() || '';
  const path = `/api/messaging/ws/chat?token=${encodeURIComponent(token)}`;
  if (!base) {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}${path}`;
  }
  const wsBase = base.replace(/^http/, 'ws');
  return `${wsBase}${path}`;
}

/** URL вложения чата с token query для <img src> и ссылок скачивания. */
export function getAttachmentUrl(attachmentId) {
  const token = getAccessToken() || '';
  const base = getMessagingBaseUrl();
  const path = `/api/messaging/attachments/${attachmentId}?token=${encodeURIComponent(token)}`;
  return base ? `${base}${path}` : path;
}

/** URL вложения почты. */
export function getMailAttachmentUrl(attachmentId) {
  const token = getAccessToken() || '';
  const base = getMessagingBaseUrl();
  const path = `/api/messaging/mail/attachments/${attachmentId}?token=${encodeURIComponent(token)}`;
  return base ? `${base}${path}` : path;
}
