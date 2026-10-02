const STORAGE_KEY = 'aic_cookie_consent_v1';

export const COOKIE_CATEGORIES = [
  { id: 'essential', label: 'Essential', description: 'Авторизация и базовая работа сервиса', locked: true },
  { id: 'security', label: 'Security', description: 'Защита сессий и антифрод', locked: true },
  { id: 'preferences', label: 'Preferences', description: 'Язык и пользовательские настройки UI', locked: false },
  { id: 'analytics', label: 'Analytics', description: 'Понимание использования продукта', locked: false },
  { id: 'marketing', label: 'Marketing', description: 'Реклама и ремаркетинг (если подключены)', locked: false },
];

const defaultPrefs = () => ({
  essential: true,
  security: true,
  preferences: false,
  analytics: false,
  marketing: false,
  decided: false,
  version: 1,
  updatedAt: null,
});

export function readCookieConsent() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultPrefs();
    const parsed = JSON.parse(raw);
    return {
      ...defaultPrefs(),
      ...parsed,
      essential: true,
      security: true,
    };
  } catch {
    return defaultPrefs();
  }
}

export function writeCookieConsent(partial) {
  const next = {
    ...readCookieConsent(),
    ...partial,
    essential: true,
    security: true,
    decided: true,
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('aic:cookie-consent', { detail: next }));
  return next;
}

export function acceptAllCookies() {
  return writeCookieConsent({
    preferences: true,
    analytics: true,
    marketing: true,
  });
}

export function rejectOptionalCookies() {
  return writeCookieConsent({
    preferences: false,
    analytics: false,
    marketing: false,
  });
}

export function openCookieSettingsEvent() {
  window.dispatchEvent(new CustomEvent('aic:open-cookie-settings'));
}
