const KEY = 'aic_privacy_requests_v1';

export const PRIVACY_REQUEST_TYPES = {
  ACCESS: 'ACCESS',
  PORTABILITY: 'PORTABILITY',
  ERASURE: 'ERASURE',
  RECTIFICATION: 'RECTIFICATION',
  OBJECTION: 'OBJECTION',
  CONSENT_WITHDRAWAL: 'CONSENT_WITHDRAWAL',
};

export function listPrivacyRequests() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

export function createPrivacyRequest({ type, payload = {} }) {
  const item = {
    id: `pr_${Date.now()}`,
    type,
    status: 'QUEUED_LOCAL',
    createdAt: new Date().toISOString(),
    payload,
    note: 'Локальная очередь до подключения backend privacy_requests. продублируйте запрос на legal@2a.local.',
  };
  const next = [item, ...listPrivacyRequests()].slice(0, 50);
  localStorage.setItem(KEY, JSON.stringify(next));
  return item;
}
