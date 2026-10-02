import React, { useCallback, useEffect, useState } from 'react';
import { documentService } from '../../services/documentService';
import { diffFieldData, formatCellDiffValue, formatDiffValue } from './documentFieldDiff';
import styles from './DocumentsApp.module.css';

export default function DocumentProposalReviewPanel({
  documentId,
  currentFieldData = {},
  currentTitle = '',
  sheetBlocks = null,
  onAccepted,
  onRejected,
}) {
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);
  const [expandedProposalId, setExpandedProposalId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [proposalRows] = await Promise.all([
        documentService.getProposals(documentId, 'submitted'),
      ]);
      setProposals(Array.isArray(proposalRows) ? proposalRows : []);
    } catch (e) {
      setError(e?.response?.data?.detail || 'Не удалось загрузить предложения');
      setProposals([]);
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAccept = async (proposalId) => {
    setBusyId(proposalId);
    setError(null);
    try {
      await documentService.acceptProposal(documentId, proposalId);
      await load();
      onAccepted?.();
    } catch (e) {
      setError(e?.response?.data?.detail || 'Не удалось принять предложение');
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (proposalId) => {
    setBusyId(proposalId);
    setError(null);
    try {
      await documentService.rejectProposal(documentId, proposalId);
      await load();
      onRejected?.();
    } catch (e) {
      setError(e?.response?.data?.detail || 'Не удалось отклонить предложение');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <div className={styles.proposalReviewPanel}>Загрузка предложений…</div>;
  }

  return (
    <div className={styles.proposalReviewPanel}>
      <h3 className={styles.proposalReviewTitle}>Предложения изменений</h3>
      {error && <div className={styles.error} role="alert">{error}</div>}

      {proposals.length === 0 ? (
        <p className={styles.proposalReviewEmpty}>Нет ожидающих предложений.</p>
      ) : (
        <ul className={styles.proposalList}>
          {proposals.map((proposal) => {
            const titleChanged = proposal.title !== currentTitle;
            const fieldDiff = diffFieldData(currentFieldData, proposal.field_data || {}, { sheetBlocks });
            const expanded = expandedProposalId === proposal.id;
            return (
              <li key={proposal.id} className={styles.proposalItem}>
                <div className={styles.proposalItemHeader}>
                  <div>
                    <strong>{proposal.editor_name || `Редактор #${proposal.editor_id}`}</strong>
                    {proposal.submitted_at && (
                      <span className={styles.proposalMeta}>
                        {' '}
                        · {new Date(proposal.submitted_at).toLocaleString('ru-RU')}
                      </span>
                    )}
                  </div>
                  <div className={styles.proposalActions}>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={() => setExpandedProposalId(expanded ? null : proposal.id)}
                    >
                      {expanded ? 'Скрыть diff' : 'Показать diff'}
                    </button>
                    <button
                      type="button"
                      className={styles.primaryButton}
                      disabled={busyId === proposal.id}
                      onClick={() => handleAccept(proposal.id)}
                    >
                      Принять
                    </button>
                    <button
                      type="button"
                      className={styles.dangerButton}
                      disabled={busyId === proposal.id}
                      onClick={() => handleReject(proposal.id)}
                    >
                      Отклонить
                    </button>
                  </div>
                </div>
                {proposal.editor_comment && (
                  <div className={styles.proposalEditorComment}>
                    <span className={styles.proposalEditorCommentLabel}>Комментарий автора изменений</span>
                    <p className={styles.proposalEditorCommentText}>{proposal.editor_comment}</p>
                  </div>
                )}
                {expanded && (
                  <div className={styles.proposalDiff}>
                    {titleChanged && (
                      <div className={styles.proposalDiffBlock}>
                        <div className={styles.proposalDiffLabel}>Заголовок</div>
                        <div className={styles.proposalDiffRow}>
                          <span className={styles.proposalDiffBefore}>{formatDiffValue(currentTitle)}</span>
                          <span className={styles.proposalDiffArrow}>→</span>
                          <span className={styles.proposalDiffAfter}>{formatDiffValue(proposal.title)}</span>
                        </div>
                      </div>
                    )}
                    {fieldDiff.length === 0 && !titleChanged ? (
                      <p>Изменений не обнаружено.</p>
                    ) : (
                      fieldDiff.map((change) => (
                        <div key={change.field} className={styles.proposalDiffBlock}>
                          <div className={styles.proposalDiffLabel}>{change.field}</div>
                          {(change.type === 'table' || change.type === 'spreadsheet') && change.cellChanges?.length > 0 ? (
                            <>
                              <table className={styles.proposalCellDiffTable}>
                                <thead>
                                  <tr>
                                    <th>Ячейка</th>
                                    <th>Было</th>
                                    <th>Стало</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {change.cellChanges.map((cell) => (
                                    <tr key={`${change.field}-${cell.address}-${cell.rowIndex}-${cell.colKey}`}>
                                      <td className={styles.proposalCellDiffAddress}>{cell.address}</td>
                                      <td className={styles.proposalCellDiffBefore}>{formatCellDiffValue(cell.before)}</td>
                                      <td className={styles.proposalCellDiffAfter}>{formatCellDiffValue(cell.after)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              {change.truncated && (
                                <p className={styles.proposalCellDiffTruncated}>
                                  Показаны первые {change.cellChanges.length} изменённых ячеек.
                                </p>
                              )}
                            </>
                          ) : (
                            <div className={styles.proposalDiffRow}>
                              <pre className={styles.proposalDiffBefore}>{formatDiffValue(change.before)}</pre>
                              <span className={styles.proposalDiffArrow}>→</span>
                              <pre className={styles.proposalDiffAfter}>{formatDiffValue(change.after)}</pre>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
