import React, { useCallback, useEffect, useState } from 'react';
import { documentService } from '../../services/documentService';
import {
  findActiveRevision,
  formatRevisionSource,
  getRollbackTargets,
} from './documentRevisionUtils';
import styles from './DocumentsApp.module.css';

export default function DocumentRevisionRollbackPanel({
  documentId,
  currentFieldData = {},
  currentTitle = '',
  onRolledBack,
}) {
  const [revisions, setRevisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const revisionRows = await documentService.getRevisions(documentId);
      setRevisions(Array.isArray(revisionRows) ? revisionRows : []);
    } catch (e) {
      setError(e?.response?.data?.detail || 'Не удалось загрузить историю отката');
      setRevisions([]);
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRollback = async (revisionId) => {
    setBusyId(revisionId);
    setError(null);
    try {
      await documentService.rollbackRevision(documentId, revisionId);
      await load();
      onRolledBack?.();
    } catch (e) {
      setError(e?.response?.data?.detail || 'Не удалось выполнить откат');
    } finally {
      setBusyId(null);
    }
  };

  const handleDismiss = async (revisionId) => {
    setBusyId(`dismiss-${revisionId}`);
    setError(null);
    try {
      await documentService.dismissRevisionRollback(documentId, revisionId);
      await load();
      onRolledBack?.();
    } catch (e) {
      setError(e?.response?.data?.detail || 'Не удалось удалить точку отката');
    } finally {
      setBusyId(null);
    }
  };

  const activeRevision = findActiveRevision(revisions, currentFieldData, currentTitle);
  const targets = getRollbackTargets(revisions, currentFieldData, currentTitle);

  if (loading) {
    return <div className={styles.proposalReviewPanel}>Загрузка истории отката…</div>;
  }

  if (targets.length === 0) {
    return (
      <div className={styles.proposalReviewPanel}>
        {activeRevision ? (
          <p className={styles.rollbackActiveRevision}>
            Текущее состояние соответствует ревизии #{activeRevision.revision_no}.
            Других доступных откатов нет.
          </p>
        ) : (
          <p className={styles.proposalReviewEmpty}>Нет доступных откатов.</p>
        )}
      </div>
    );
  }

  return (
    <div className={styles.proposalReviewPanel}>
      <h3 className={styles.proposalReviewTitle}>Доступные откаты</h3>
      {activeRevision && (
        <p className={styles.rollbackActiveRevision}>
          Текущее состояние: ревизия #{activeRevision.revision_no}
        </p>
      )}
      <p className={styles.rollbackPanelHint}>
        Выберите точку восстановления. Ревизия, которая уже совпадает с документом, не показывается.
      </p>
      {error && <div className={styles.error} role="alert">{error}</div>}
      <ul className={styles.revisionList}>
        {targets.map((rev) => {
          const until = new Date(rev.rollback_available_until);
          return (
            <li key={rev.id} className={styles.revisionItem}>
              <span>
                Ревизия #{rev.revision_no} · {formatRevisionSource(rev.source)}
                {rev.created && (
                  <>
                    {' '}
                    · {new Date(rev.created).toLocaleString('ru-RU')}
                  </>
                )}
                {' '}
                · откат до {until.toLocaleDateString('ru-RU')}
              </span>
              <div className={styles.revisionItemActions}>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  disabled={busyId === rev.id}
                  onClick={() => handleRollback(rev.id)}
                >
                  {busyId === rev.id ? 'Откат…' : 'Откатить'}
                </button>
                <button
                  type="button"
                  className={styles.dangerButton}
                  disabled={busyId === `dismiss-${rev.id}`}
                  onClick={() => handleDismiss(rev.id)}
                  title="Удалить точку отката без восстановления документа"
                >
                  {busyId === `dismiss-${rev.id}` ? 'Удаление…' : 'Удалить откат'}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
