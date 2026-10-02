import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { openCookieSettingsEvent } from '../../../services/cookieConsent.js';
import {
  PRIVACY_REQUEST_TYPES,
  createPrivacyRequest,
  listPrivacyRequests,
} from '../../../services/privacyRequests.js';
import styles from './PrivacyTab.module.css';

const EXPORT_OPTIONS = [
  { id: 'account', label: 'Account' },
  { id: 'projects', label: 'Projects / dashboards' },
  { id: 'workflows', label: 'Workflows' },
  { id: 'ai', label: 'AI conversations' },
  { id: 'files', label: 'Files' },
  { id: 'logs', label: 'Activity logs' },
  { id: 'connections', label: 'Connections metadata (без секретов)' },
];

const PrivacyTab = ({ activeTab, user }) => {
  const [requests, setRequests] = useState(() => listPrivacyRequests());
  const [exportSel, setExportSel] = useState(() =>
    Object.fromEntries(EXPORT_OPTIONS.map((o) => [o.id, true])),
  );
  const [format, setFormat] = useState('json');
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [message, setMessage] = useState('');

  const visible = activeTab === 'privacy';
  const email = user?.email || 'ваш email';

  const selectedExport = useMemo(
    () => EXPORT_OPTIONS.filter((o) => exportSel[o.id]).map((o) => o.id),
    [exportSel],
  );

  if (!visible) return null;

  const queue = (type, payload) => {
    const item = createPrivacyRequest({ type, payload });
    setRequests(listPrivacyRequests());
    setMessage(`Запрос ${type} создан (${item.id}). Статус: локальная очередь.`);
  };

  return (
    <section className={styles.wrap} aria-labelledby="privacy-dash-title">
      <header className={styles.header}>
        <p className={styles.eyebrow}>Privacy & Data</p>
        <h2 id="privacy-dash-title" className={styles.title}>
          Your data
        </h2>
        <p className={styles.subtitle}>
          GDPR-действия в продукте. Пока backend privacy API не готов, запросы пишутся локально —
          продублируйте на legal@2a.local. Не экспортируем raw credentials.
        </p>
        <div className={styles.links}>
          <Link to="/legal/privacy">Privacy Policy</Link>
          <Link to="/legal/data-subject-rights">Your Rights</Link>
          <Link to="/legal/ai-data">AI & Data</Link>
        </div>
      </header>

      {message ? <p className={styles.toast} role="status">{message}</p> : null}

      <div className={styles.grid}>
        <article className={styles.card}>
          <h3 className={styles.cardTitle}>Download my data</h3>
          <p className={styles.cardText}>Portability / Access — выберите категории и формат.</p>
          <ul className={styles.checkList}>
            {EXPORT_OPTIONS.map((opt) => (
              <li key={opt.id}>
                <label className={styles.check}>
                  <input
                    type="checkbox"
                    checked={Boolean(exportSel[opt.id])}
                    onChange={() =>
                      setExportSel((prev) => ({ ...prev, [opt.id]: !prev[opt.id] }))
                    }
                  />
                  {opt.label}
                </label>
              </li>
            ))}
          </ul>
          <div className={styles.formats} role="radiogroup" aria-label="Формат экспорта">
            {['json', 'csv', 'zip'].map((f) => (
              <label key={f} className={styles.radio}>
                <input
                  type="radio"
                  name="export-format"
                  checked={format === f}
                  onChange={() => setFormat(f)}
                />
                {f.toUpperCase()}
              </label>
            ))}
          </div>
          <button
            type="button"
            className={styles.primary}
            onClick={() =>
              queue(PRIVACY_REQUEST_TYPES.PORTABILITY, {
                categories: selectedExport,
                format,
                account: email,
              })
            }
          >
            Request export
          </button>
        </article>

        <article className={styles.card}>
          <h3 className={styles.cardTitle}>Personal information</h3>
          <p className={styles.cardText}>Rectification — правки профиля через раздел «Профиль».</p>
          <button type="button" className={styles.secondary} onClick={() => queue(PRIVACY_REQUEST_TYPES.RECTIFICATION, { account: email })}>
            Request correction review
          </button>
        </article>

        <article className={styles.card}>
          <h3 className={styles.cardTitle}>Privacy preferences</h3>
          <p className={styles.cardText}>Управление cookie consent (не смешивается с принятием Terms).</p>
          <button type="button" className={styles.secondary} onClick={() => openCookieSettingsEvent()}>
            Manage cookies
          </button>
        </article>

        <article className={styles.card}>
          <h3 className={styles.cardTitle}>AI data</h3>
          <p className={styles.cardText}>Ограничение AI-контекста и запросы по AI-истории.</p>
          <div className={styles.rowActions}>
            <Link className={styles.linkBtn} to="/legal/ai-data">
              AI & Data policy
            </Link>
            <button
              type="button"
              className={styles.secondary}
              onClick={() => queue(PRIVACY_REQUEST_TYPES.OBJECTION, { scope: 'ai_optional' })}
            >
              Object to optional AI analytics
            </button>
          </div>
        </article>

        <article className={`${styles.card} ${styles.dangerCard}`}>
          <h3 className={styles.cardTitle}>Delete account</h3>
          <p className={styles.cardText}>
            Удаление профиля, проектов, workflow, AI history, файлов и connections. Часть данных может
            сохраняться, если требуется законом (billing / security logs).
          </p>
          {!deleteConfirm ? (
            <button type="button" className={styles.danger} onClick={() => setDeleteConfirm(true)}>
              Delete account
            </button>
          ) : (
            <div className={styles.deleteBox}>
              <p>This will permanently remove account data for {email}.</p>
              <div className={styles.rowActions}>
                <button type="button" className={styles.secondary} onClick={() => setDeleteConfirm(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className={styles.danger}
                  onClick={() => {
                    queue(PRIVACY_REQUEST_TYPES.ERASURE, { account: email });
                    setDeleteConfirm(false);
                  }}
                >
                  Permanently delete
                </button>
              </div>
            </div>
          )}
        </article>

        <article className={styles.card}>
          <h3 className={styles.cardTitle}>Connected services</h3>
          <p className={styles.cardText}>Управление интеграциями — в настройках источников данных.</p>
          <Link className={styles.linkBtn} to="/data-models">
            Manage integrations
          </Link>
        </article>
      </div>

      <section className={styles.requests} aria-label="Privacy requests">
        <h3 className={styles.cardTitle}>Privacy requests</h3>
        {requests.length === 0 ? (
          <p className={styles.cardText}>Пока нет запросов.</p>
        ) : (
          <ul className={styles.reqList}>
            {requests.map((r) => (
              <li key={r.id} className={styles.reqItem}>
                <span className={styles.reqType}>{r.type}</span>
                <span className={styles.reqStatus}>{r.status}</span>
                <span className={styles.reqDate}>{new Date(r.createdAt).toLocaleString('ru-RU')}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
};

export default PrivacyTab;
