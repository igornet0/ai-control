import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { dataModelService } from '../../../services/dataModelService';
import styles from './ModelSchemaViewer.module.css';

const PAGE_SIZE = 50;

const SOURCE_LABELS = {
  data_input: 'Data input',
  api_ingest: 'API ingest',
  snapshot: 'Snapshot',
  unknown: 'Неизвестно',
};

function formatCell(value) {
  if (value == null) return '';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function rowKey(row, pkColumns) {
  if (pkColumns?.length) {
    return pkColumns.map((k) => `${k}=${formatCell(row?.[k])}`).join('|');
  }
  return JSON.stringify(row);
}

function extractKeys(row, pkColumns) {
  const keys = {};
  for (const k of pkColumns || []) keys[k] = row[k];
  return keys;
}

/**
 * Data browser / editor for a selected model table inside ModelSchemaViewer.
 */
export default function ModelTableDataPanel({
  modelId,
  tableName,
  layer = 'compiled',
  canEdit = true,
  onRowCountChange,
}) {
  const [subTab, setSubTab] = useState('rows');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [columns, setColumns] = useState([]);
  const [pkColumns, setPkColumns] = useState([]);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [editable, setEditable] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [busy, setBusy] = useState(false);

  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);
  const [historyItems, setHistoryItems] = useState([]);
  const [expandedHistoryId, setExpandedHistoryId] = useState(null);

  const [editRow, setEditRow] = useState(null);
  const [editDraft, setEditDraft] = useState({});
  const [editError, setEditError] = useState(null);

  const displayColumns = useMemo(
    () => (columns || []).filter((c) => !String(c).startsWith('_')),
    [columns],
  );

  const allowEdit = Boolean(editable && canEdit);

  const layerHint = useMemo(() => {
    if (layer === 'api') {
      return 'Слой API: строки хранятся в скомпилированной таблице модели. При праве редактирования можно изменить или удалить записи; «Удалить API» в шапке сбрасывает весь API-источник.';
    }
    if (layer === 'data_input') {
      return 'Слой DataInput: схема полей из виджетов ввода. Строки пишутся в ту же таблицу модели — их можно изменить или удалить при праве редактирования.';
    }
    return null;
  }, [layer]);

  const loadRows = useCallback(
    async (nextOffset = 0) => {
      if (!modelId || !tableName) return;
      setLoading(true);
      setError(null);
      try {
        const res = await dataModelService.getModelTableRows(modelId, tableName, {
          limit: PAGE_SIZE,
          offset: nextOffset,
          includeSource: true,
        });
        setColumns(res.columns || []);
        setPkColumns(res.pk_columns || []);
        setRows(Array.isArray(res.rows) ? res.rows : []);
        setTotal(Number(res.total) || 0);
        setOffset(Number(res.offset) || nextOffset);
        setEditable(!!res.editable);
        setSelected(new Set());
        onRowCountChange?.(tableName, Number(res.total) || 0);
      } catch (err) {
        setRows([]);
        setError(err?.response?.data?.detail || err?.message || 'Не удалось загрузить данные');
      } finally {
        setLoading(false);
      }
    },
    [modelId, tableName, onRowCountChange],
  );

  const loadHistory = useCallback(async () => {
    if (!modelId || !tableName) return;
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await dataModelService.getModelTableIngestHistory(modelId, tableName, {
        limit: 50,
      });
      setHistoryItems(Array.isArray(res?.items) ? res.items : []);
    } catch (err) {
      setHistoryItems([]);
      setHistoryError(
        err?.response?.data?.detail || err?.message || 'Не удалось загрузить историю ingest',
      );
    } finally {
      setHistoryLoading(false);
    }
  }, [modelId, tableName]);

  useEffect(() => {
    setSubTab('rows');
    setExpandedHistoryId(null);
    setEditRow(null);
    void loadRows(0);
  }, [loadRows]);

  useEffect(() => {
    if (subTab === 'history') void loadHistory();
  }, [subTab, loadHistory]);

  const toggleSelect = (key) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!allowEdit || !pkColumns.length) return;
    const allKeys = rows.map((r) => rowKey(r, pkColumns));
    const allSelected = allKeys.length > 0 && allKeys.every((k) => selected.has(k));
    setSelected(allSelected ? new Set() : new Set(allKeys));
  };

  const openEdit = (row) => {
    if (!allowEdit) return;
    const draft = {};
    for (const col of displayColumns) {
      if (pkColumns.includes(col)) continue;
      draft[col] = row[col] ?? '';
    }
    setEditRow(row);
    setEditDraft(draft);
    setEditError(null);
  };

  const saveEdit = async () => {
    if (!editRow || !allowEdit) return;
    setBusy(true);
    setEditError(null);
    try {
      const keys = extractKeys(editRow, pkColumns);
      const data = {};
      for (const [k, v] of Object.entries(editDraft)) {
        data[k] = v === '' ? null : v;
      }
      await dataModelService.updateModelTableRow(modelId, tableName, keys, data);
      setEditRow(null);
      await loadRows(offset);
      if (subTab === 'history') await loadHistory();
    } catch (err) {
      setEditError(err?.response?.data?.detail || err?.message || 'Не удалось сохранить');
    } finally {
      setBusy(false);
    }
  };

  const deleteSelected = async () => {
    if (!allowEdit || selected.size === 0) return;
    const ok = window.confirm(`Удалить выбранные строки (${selected.size})?`);
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      const keys = rows
        .filter((r) => selected.has(rowKey(r, pkColumns)))
        .map((r) => extractKeys(r, pkColumns));
      await dataModelService.deleteModelTableRows(modelId, tableName, keys);
      await loadRows(offset);
      if (subTab === 'history') await loadHistory();
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Не удалось удалить');
    } finally {
      setBusy(false);
    }
  };

  const pageFrom = total === 0 ? 0 : offset + 1;
  const pageTo = Math.min(offset + rows.length, total);
  const canPrev = offset > 0;
  const canNext = offset + rows.length < total;

  return (
    <div className={styles.dataPanel}>
      {layerHint && <div className={styles.dataLayerHint}>{layerHint}</div>}
      <div className={styles.dataSubTabs}>
        <button
          type="button"
          className={`${styles.dataSubTab}${subTab === 'rows' ? ` ${styles.dataSubTabActive}` : ''}`}
          onClick={() => setSubTab('rows')}
        >
          Строки
        </button>
        <button
          type="button"
          className={`${styles.dataSubTab}${subTab === 'history' ? ` ${styles.dataSubTabActive}` : ''}`}
          onClick={() => setSubTab('history')}
        >
          История ingest
        </button>
      </div>

      {subTab === 'rows' && (
        <>
          <div className={styles.dataToolbar}>
            <div className={styles.dataToolbarMeta}>
              {total > 0 ? `${pageFrom}–${pageTo} из ${total}` : 'Нет строк'}
              {!canEdit && (
                <span className={styles.dataHint}> · только просмотр (нет права редактирования)</span>
              )}
              {canEdit && !editable && (
                <span className={styles.dataHint}> · нет PK — только просмотр</span>
              )}
            </div>
            <div className={styles.dataToolbarActions}>
              <button
                type="button"
                className={styles.toolBtn}
                disabled={loading || busy}
                onClick={() => loadRows(offset)}
              >
                Обновить
              </button>
              <button
                type="button"
                className={styles.toolBtn}
                disabled={!allowEdit || selected.size !== 1 || busy}
                onClick={() => {
                  const row = rows.find((r) => selected.has(rowKey(r, pkColumns)));
                  if (row) openEdit(row);
                }}
              >
                Изменить
              </button>
              <button
                type="button"
                className={`${styles.toolBtn} ${styles.toolBtnDanger}`}
                disabled={!allowEdit || selected.size === 0 || busy}
                onClick={() => void deleteSelected()}
              >
                Удалить ({selected.size})
              </button>
            </div>
          </div>

          {loading && (
            <div className={styles.stateBox} style={{ position: 'relative', minHeight: 100 }}>
              <div className={styles.spinner} />
            </div>
          )}
          {!loading && error && <div className={styles.dataError}>{String(error)}</div>}
          {!loading && !error && rows.length === 0 && (
            <div className={styles.dataEmpty}>Нет строк</div>
          )}
          {!loading && !error && rows.length > 0 && (
            <div className={styles.dataTableWrap}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th className={styles.checkCol}>
                      <input
                        type="checkbox"
                        checked={
                          rows.length > 0 &&
                          allowEdit &&
                          rows.every((r) => selected.has(rowKey(r, pkColumns)))
                        }
                        disabled={!allowEdit}
                        onChange={toggleSelectAll}
                        aria-label="Выбрать все"
                      />
                    </th>
                    {displayColumns.map((name) => (
                      <th key={name}>
                        {name}
                        {pkColumns.includes(name) ? (
                          <span className={styles.pkBadge}>PK</span>
                        ) : null}
                      </th>
                    ))}
                    <th>Источник</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const key = rowKey(row, pkColumns);
                    const source = row._source || 'unknown';
                    return (
                      <tr
                        key={key}
                        className={selected.has(key) ? styles.dataRowSelected : undefined}
                        onDoubleClick={() => openEdit(row)}
                      >
                        <td className={styles.checkCol}>
                          <input
                            type="checkbox"
                            checked={selected.has(key)}
                            disabled={!allowEdit}
                            onChange={() => toggleSelect(key)}
                            aria-label="Выбрать строку"
                          />
                        </td>
                        {displayColumns.map((name) => (
                          <td
                            key={name}
                            className={styles.dataCell}
                            title={formatCell(row[name])}
                          >
                            {formatCell(row[name])}
                          </td>
                        ))}
                        <td>
                          <span
                            className={`${styles.sourceBadge} ${styles[`source_${source}`] || ''}`}
                            title={
                              row._ingest_request_id
                                ? `ingest #${row._ingest_request_id}`
                                : undefined
                            }
                          >
                            {SOURCE_LABELS[source] || source}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className={styles.dataPager}>
            <button
              type="button"
              className={styles.toolBtn}
              disabled={!canPrev || loading || busy}
              onClick={() => void loadRows(Math.max(0, offset - PAGE_SIZE))}
            >
              Назад
            </button>
            <button
              type="button"
              className={styles.toolBtn}
              disabled={!canNext || loading || busy}
              onClick={() => void loadRows(offset + PAGE_SIZE)}
            >
              Вперёд
            </button>
          </div>
        </>
      )}

      {subTab === 'history' && (
        <>
          <div className={styles.dataToolbar}>
            <button
              type="button"
              className={styles.toolBtn}
              disabled={historyLoading}
              onClick={() => void loadHistory()}
            >
              Обновить
            </button>
          </div>
          {historyLoading && (
            <div className={styles.stateBox} style={{ position: 'relative', minHeight: 100 }}>
              <div className={styles.spinner} />
            </div>
          )}
          {!historyLoading && historyError && (
            <div className={styles.dataError}>{String(historyError)}</div>
          )}
          {!historyLoading && !historyError && historyItems.length === 0 && (
            <div className={styles.dataEmpty}>История ingest пуста</div>
          )}
          {!historyLoading && !historyError && historyItems.length > 0 && (
            <ul className={styles.historyList}>
              {historyItems.map((item) => {
                const open = expandedHistoryId === item.id;
                return (
                  <li key={item.id} className={styles.historyItem}>
                    <button
                      type="button"
                      className={styles.historyHeader}
                      onClick={() => setExpandedHistoryId(open ? null : item.id)}
                    >
                      <span className={styles.historyId}>#{item.id}</span>
                      <span className={styles.historyMode}>{item.mode}</span>
                      <span className={styles.historyStatus}>{item.deploy_status}</span>
                      <span
                        className={`${styles.sourceBadge} ${styles[`source_${item.source}`] || ''}`}
                      >
                        {SOURCE_LABELS[item.source] || item.source}
                      </span>
                      <span className={styles.historyMeta}>
                        {item.row_count != null ? `${item.row_count} стр.` : '—'} ·{' '}
                        {item.created_at || '—'}
                      </span>
                    </button>
                    {open && (
                      <div className={styles.historyPreview}>
                        {item.preview?.length ? (
                          <pre>{JSON.stringify(item.preview, null, 2)}</pre>
                        ) : (
                          <div className={styles.dataEmpty}>Нет preview</div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {editRow && (
        <div className={styles.editModalOverlay} role="dialog" aria-modal="true">
          <div className={styles.editModal}>
            <div className={styles.editModalHeader}>
              <h3>Изменить строку</h3>
              <button
                type="button"
                className={styles.toolBtn}
                onClick={() => setEditRow(null)}
                disabled={busy}
              >
                Закрыть
              </button>
            </div>
            <div className={styles.editModalBody}>
              {pkColumns.map((pk) => (
                <label key={pk} className={styles.editField}>
                  <span>
                    {pk} <span className={styles.pkBadge}>PK</span>
                  </span>
                  <input type="text" value={formatCell(editRow[pk])} readOnly disabled />
                </label>
              ))}
              {Object.keys(editDraft).map((col) => (
                <label key={col} className={styles.editField}>
                  <span>{col}</span>
                  <input
                    type="text"
                    value={editDraft[col] ?? ''}
                    disabled={busy}
                    onChange={(e) =>
                      setEditDraft((prev) => ({ ...prev, [col]: e.target.value }))
                    }
                  />
                </label>
              ))}
              {editError && <div className={styles.dataError}>{String(editError)}</div>}
            </div>
            <div className={styles.editModalFooter}>
              <button
                type="button"
                className={styles.toolBtn}
                disabled={busy}
                onClick={() => setEditRow(null)}
              >
                Отмена
              </button>
              <button
                type="button"
                className={`${styles.toolBtn} ${styles.toolBtnPrimary}`}
                disabled={busy}
                onClick={() => void saveEdit()}
              >
                {busy ? 'Сохранение…' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
