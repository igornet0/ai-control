import React, { useEffect, useState } from 'react';
import {
  COOKIE_CATEGORIES,
  acceptAllCookies,
  readCookieConsent,
  rejectOptionalCookies,
  writeCookieConsent,
} from '../../services/cookieConsent.js';
import styles from './CookieConsent.module.css';

export function CookieSettingsPanel({ compact = false }) {
  const [prefs, setPrefs] = useState(() => readCookieConsent());

  useEffect(() => {
    const sync = () => setPrefs(readCookieConsent());
    window.addEventListener('aic:cookie-consent', sync);
    return () => window.removeEventListener('aic:cookie-consent', sync);
  }, []);

  const toggle = (id) => {
    const cat = COOKIE_CATEGORIES.find((c) => c.id === id);
    if (!cat || cat.locked) return;
    const next = writeCookieConsent({ [id]: !prefs[id] });
    setPrefs(next);
  };

  return (
    <div className={`${styles.settings} ${compact ? styles.settingsCompact : ''}`}>
      <ul className={styles.catList}>
        {COOKIE_CATEGORIES.map((cat) => (
          <li key={cat.id} className={styles.catRow}>
            <div>
              <p className={styles.catLabel}>{cat.label}</p>
              <p className={styles.catDesc}>{cat.description}</p>
            </div>
            {cat.locked ? (
              <span className={styles.alwaysOn}>Always on</span>
            ) : (
              <button
                type="button"
                role="switch"
                aria-checked={Boolean(prefs[cat.id])}
                className={`${styles.switch} ${prefs[cat.id] ? styles.switchOn : ''}`}
                onClick={() => toggle(cat.id)}
              >
                <span className={styles.switchThumb} />
              </button>
            )}
          </li>
        ))}
      </ul>
      <p className={styles.savedHint}>
        {prefs.decided
          ? `Сохранено: ${prefs.updatedAt ? new Date(prefs.updatedAt).toLocaleString('ru-RU') : '—'}`
          : 'Выбор ещё не сохранён'}
      </p>
    </div>
  );
}

const CookieConsentBanner = () => {
  const [visible, setVisible] = useState(() => !readCookieConsent().decided);
  const [customize, setCustomize] = useState(false);

  useEffect(() => {
    const onOpen = () => {
      setVisible(true);
      setCustomize(true);
    };
    const onSaved = () => {
      if (readCookieConsent().decided) setVisible(false);
    };
    window.addEventListener('aic:open-cookie-settings', onOpen);
    window.addEventListener('aic:cookie-consent', onSaved);
    return () => {
      window.removeEventListener('aic:open-cookie-settings', onOpen);
      window.removeEventListener('aic:cookie-consent', onSaved);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className={styles.banner} role="dialog" aria-label="Cookie consent">
      <div className={styles.bannerInner}>
        <div className={styles.bannerCopy}>
        <h2 className={styles.bannerTitle}>Мы используем cookies</h2>
          <p className={styles.bannerText}>
            Обязательные cookies нужны для работы платформы. Опциональные помогают понимать использование
            и улучшать продукт. Согласие с Terms не заменяет cookie consent.
          </p>
        </div>

        {customize ? <CookieSettingsPanel compact /> : null}

        <div className={styles.bannerActions}>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => {
              acceptAllCookies();
              setVisible(false);
            }}
          >
            Принять все
          </button>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={() => {
              rejectOptionalCookies();
              setVisible(false);
            }}
          >
            Отклонить опциональные
          </button>
          <button
            type="button"
            className={styles.btnGhost}
            onClick={() => setCustomize((v) => !v)}
          >
            {customize ? 'Скрыть' : 'Настроить'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CookieConsentBanner;
