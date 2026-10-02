import React, { useState } from 'react';
import { dashboardLinkService } from '../../../services/dashboardLinkService';
import styles from './ShareLinkModal.module.css';

/**
 * @param {{ dashboardId: number | string, open: boolean, onClose: () => void }} props
 */
export default function ShareLinkModal({ dashboardId, open, onClose }) {
  const [permission, setPermission] = useState('read');
  const [sessionType, setSessionType] = useState('shared');
  const [busy, setBusy] = useState(false);
  const [createdUrl, setCreatedUrl] = useState('');
  const [error, setError] = useState('');

  if (!open) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const handleCreate = async () => {
    setBusy(true);
    setError('');
    setCreatedUrl('');
    try {
      const row = await dashboardLinkService.createLink(dashboardId, {
        permission,
        session_type: sessionType,
        expires_at: null,
        label: null,
      });
      const url = `${origin}/share/${encodeURIComponent(row.token)}`;
      setCreatedUrl(url);
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || 'Ошибка');
    } finally {
      setBusy(false);
    }
  };

  const copy = () => {
    if (!createdUrl) return;
    void navigator.clipboard?.writeText(createdUrl);
  };

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
    >
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>Ссылка на дашборд</h2>
          <p className={styles.subtitle}>Создайте публичную ссылку с выбранными правами доступа.</p>
        </div>

        <label className={styles.field}>
          <span className={styles.label}>Права</span>
          <select
            className={`form-select ${styles.select}`}
            value={permission}
            onChange={(e) => setPermission(e.target.value)}
          >
            <option value="read">Только просмотр (без входа)</option>
            <option value="edit">Редактирование</option>
          </select>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Режим синхронизации</span>
          <select
            className={`form-select ${styles.select}`}
            value={sessionType}
            onChange={(e) => setSessionType(e.target.value)}
          >
            <option value="shared">Общий (collaboration)</option>
            <option value="isolated">Индивидуальный</option>
          </select>
        </label>

        {error && <p className={styles.error}>{error}</p>}

        {createdUrl && (
          <div className={styles.result}>
            <div className={styles.resultLabel}>Ссылка:</div>
            <code className={styles.code}>{createdUrl}</code>
            <button type="button" className="btn btn-secondary btn-sm" onClick={copy}>
              Копировать
            </button>
          </div>
        )}

        <div className={styles.actions}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Закрыть
          </button>
          <button type="button" className="btn btn-primary" onClick={handleCreate} disabled={busy}>
            {busy ? 'Создание…' : createdUrl ? 'Создать ещё' : 'Создать ссылку'}
          </button>
        </div>
      </div>
    </div>
  );
}
