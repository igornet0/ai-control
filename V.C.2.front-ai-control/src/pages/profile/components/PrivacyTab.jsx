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
  { id: 'account', label: 'Аккаунт' },
  { id: 'projects', label: 'Проекты и дашборды' },
  { id: 'workflows', label: 'Рабочие процессы' },
  { id: 'ai', label: 'Диалоги с ИИ' },
  { id: 'files', label: 'Файлы' },
  { id: 'logs', label: 'Журнал активности' },
  { id: 'connections', label: 'Метаданные подключений (без секретов)' },
];

const REQUEST_TYPE_LABELS = {
  ACCESS: 'Доступ к данным',
  PORTABILITY: 'Экспорт данных',
  ERASURE: 'Удаление аккаунта',
  RECTIFICATION: 'Исправление данных',
  OBJECTION: 'Возражение против обработки',
  CONSENT_WITHDRAWAL: 'Отзыв согласия',
};

const REQUEST_STATUS_LABELS = {
  QUEUED_LOCAL: 'В локальной очереди',
};

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
    setMessage(
      `Запрос «${REQUEST_TYPE_LABELS[type] || type}» создан (${item.id}). Статус: в локальной очереди.`,
    );
  };

  return (
    <section className={styles.wrap} aria-labelledby="privacy-dash-title">
      <header className={styles.header}>
        <p className={styles.eyebrow}>Конфиденциальность и данные</p>
        <h2 id="privacy-dash-title" className={styles.title}>
          Ваши данные
        </h2>
        <p className={styles.subtitle}>
          Управление персональными данными по GDPR. Пока серверный API не подключён, запросы
          сохраняются локально — продублируйте их на legal@2a.local. Учётные данные и секреты не
          экспортируются.
        </p>
        <div className={styles.links}>
          <Link to="/legal/privacy">Политика конфиденциальности</Link>
          <Link to="/legal/data-subject-rights">Ваши права</Link>
          <Link to="/legal/ai-data">ИИ и данные</Link>
        </div>
      </header>

      {message ? <p className={styles.toast} role="status">{message}</p> : null}

      <div className={styles.grid}>
        <article className={styles.card}>
          <h3 className={styles.cardTitle}>Скачать мои данные</h3>
          <p className={styles.cardText}>Выберите категории данных и формат выгрузки.</p>
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
            Запросить выгрузку
          </button>
        </article>

        <article className={styles.card}>
          <h3 className={styles.cardTitle}>Личная информация</h3>
          <p className={styles.cardText}>Изменить данные можно в разделе «Профиль» или отправить запрос на проверку.</p>
          <button type="button" className={styles.secondary} onClick={() => queue(PRIVACY_REQUEST_TYPES.RECTIFICATION, { account: email })}>
            Запросить исправление
          </button>
        </article>

        <article className={styles.card}>
          <h3 className={styles.cardTitle}>Настройки конфиденциальности</h3>
          <p className={styles.cardText}>Согласие на cookie управляется отдельно от принятия условий использования.</p>
          <button type="button" className={styles.secondary} onClick={() => openCookieSettingsEvent()}>
            Настроить cookie
          </button>
        </article>

        <article className={styles.card}>
          <h3 className={styles.cardTitle}>Данные ИИ</h3>
          <p className={styles.cardText}>Ограничение контекста ИИ и запросы по истории диалогов с ИИ.</p>
          <div className={styles.rowActions}>
            <Link className={styles.linkBtn} to="/legal/ai-data">
              Политика ИИ и данных
            </Link>
            <button
              type="button"
              className={styles.secondary}
              onClick={() => queue(PRIVACY_REQUEST_TYPES.OBJECTION, { scope: 'ai_optional' })}
            >
              Отказаться от доп. аналитики ИИ
            </button>
          </div>
        </article>

        <article className={`${styles.card} ${styles.dangerCard}`}>
          <h3 className={styles.cardTitle}>Удаление аккаунта</h3>
          <p className={styles.cardText}>
            Удаление профиля, проектов, рабочих процессов, истории ИИ, файлов и подключений. Часть
            данных может сохраняться, если этого требует закон (платёжные данные, журналы безопасности).
          </p>
          {!deleteConfirm ? (
            <button type="button" className={styles.danger} onClick={() => setDeleteConfirm(true)}>
              Удалить аккаунт
            </button>
          ) : (
            <div className={styles.deleteBox}>
              <p>Данные аккаунта {email} будут удалены безвозвратно.</p>
              <div className={styles.rowActions}>
                <button type="button" className={styles.secondary} onClick={() => setDeleteConfirm(false)}>
                  Отмена
                </button>
                <button
                  type="button"
                  className={styles.danger}
                  onClick={() => {
                    queue(PRIVACY_REQUEST_TYPES.ERASURE, { account: email });
                    setDeleteConfirm(false);
                  }}
                >
                  Удалить навсегда
                </button>
              </div>
            </div>
          )}
        </article>

        <article className={styles.card}>
          <h3 className={styles.cardTitle}>Подключённые сервисы</h3>
          <p className={styles.cardText}>Интеграции настраиваются в разделе источников данных.</p>
          <Link className={styles.linkBtn} to="/data-models">
            Управлять интеграциями
          </Link>
        </article>
      </div>

      <section className={styles.requests} aria-label="Запросы по данным">
        <h3 className={styles.cardTitle}>Запросы по данным</h3>
        {requests.length === 0 ? (
          <p className={styles.cardText}>Пока нет запросов.</p>
        ) : (
          <ul className={styles.reqList}>
            {requests.map((r) => (
              <li key={r.id} className={styles.reqItem}>
                <span className={styles.reqType}>{REQUEST_TYPE_LABELS[r.type] || r.type}</span>
                <span className={styles.reqStatus}>{REQUEST_STATUS_LABELS[r.status] || r.status}</span>
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
