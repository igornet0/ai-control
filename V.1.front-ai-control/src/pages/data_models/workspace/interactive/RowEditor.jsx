import React, { useCallback, useMemo, useRef, useState } from 'react';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import apiClient from '../../../../services/apiClient';
import { buildNewRow, fillPrimaryKeysInRows, MEDIA_FIELD_TYPES } from './schema.js';
import styles from './InteractiveDataSource.module.css';

const ROW_HEIGHT = 36;
const OVERSCAN = 8;

const MEDIA_ACCEPT = {
  image: 'image/*',
  audio: 'audio/*',
  video: 'video/*',
  file: '*/*',
};

function JsonCellEditor({ value, onSave, onClose }) {
  const [text, setText] = useState(() => {
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value ?? '');
  });
  const [error, setError] = useState('');

  const handleSave = () => {
    try {
      const parsed = JSON.parse(text);
      onSave(parsed);
      onClose();
    } catch {
      setError('Невалидный JSON');
    }
  };

  return (
    <div className={styles.popupOverlay} onClick={onClose}>
      <div className={styles.popupEditor} onClick={(e) => e.stopPropagation()}>
        <textarea
          className={styles.popupTextarea}
          value={text}
          onChange={(e) => { setText(e.target.value); setError(''); }}
          rows={8}
          autoFocus
        />
        {error && <div className={styles.validationError}>{error}</div>}
        <div className={styles.popupActions}>
          <button type="button" className={styles.addBtn} onClick={handleSave}>Сохранить</button>
          <button type="button" className={styles.ghostBtn} onClick={onClose}>Отмена</button>
        </div>
      </div>
    </div>
  );
}

function MediaCellInput({ field, value, rowIndex, colIndex, modelId, onFocus, onChange }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const display = String(value ?? '');
  const short = display.length > 22 ? `${display.slice(0, 10)}…${display.slice(-8)}` : display;

  const upload = async (file) => {
    if (!modelId) {
      setError('Сохраните модель, чтобы загружать медиа');
      return;
    }
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('kind', field.type);
      form.append('filename', file.name);
      if (file.type) form.append('mime_type', file.type);
      // apiClient baseURL is already `/api`
      const { data } = await apiClient.post(`/data-models/${modelId}/assets`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onChange(rowIndex, colIndex, data?.uri || '');
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Ошибка загрузки');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.mediaCell} onFocus={() => onFocus(rowIndex, colIndex)}>
      <button
        type="button"
        className={styles.cellJsonBtn}
        disabled={busy || !modelId}
        title={display || 'Загрузить файл'}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? '…' : short || 'Загрузить'}
      </button>
      {display ? (
        <button
          type="button"
          className={styles.iconBtnDanger}
          title="Очистить"
          onClick={() => onChange(rowIndex, colIndex, '')}
        >
          <TrashIcon className={styles.iconSm} />
        </button>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept={MEDIA_ACCEPT[field.type] || '*/*'}
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          upload(file);
        }}
      />
      {error ? <div className={styles.validationError}>{error}</div> : null}
    </div>
  );
}

function CellInput({ field, value, rowIndex, colIndex, focused, onFocus, onChange, onKeyDown, modelId }) {
  const canAutoFillPk = field.primaryKey && (field.type === 'int' || field.type === 'float');
  const [popup, setPopup] = useState(null);

  if (MEDIA_FIELD_TYPES.has(field.type)) {
    return (
      <MediaCellInput
        field={field}
        value={value}
        rowIndex={rowIndex}
        colIndex={colIndex}
        modelId={modelId}
        onFocus={onFocus}
        onChange={onChange}
      />
    );
  }

  if (field.type === 'bool') {
    return (
      <input
        type="checkbox"
        className={styles.cellCheckbox}
        checked={value === true || value === 'true' || value === 1}
        onChange={(e) => onChange(rowIndex, colIndex, e.target.checked)}
        onFocus={() => onFocus(rowIndex, colIndex)}
      />
    );
  }

  if (field.type === 'datetime') {
    const raw = value != null ? String(value).trim() : '';
    const withT = raw.replace(' ', 'T').replace(/Z$/i, '').replace(/[+-]\d{2}:\d{2}$/, '');
    const dt = withT ? withT.slice(0, 16) : '';
    return (
      <input
        type="datetime-local"
        className={styles.cellInput}
        value={dt}
        step="1"
        onChange={(e) => onChange(rowIndex, colIndex, e.target.value)}
        onFocus={() => onFocus(rowIndex, colIndex)}
        onKeyDown={(e) => onKeyDown(e, rowIndex, colIndex)}
        data-focused={focused ? 'true' : undefined}
      />
    );
  }

  if (field.type === 'array' || field.type === 'object') {
    const display = typeof value === 'object' ? JSON.stringify(value) : String(value ?? '');
    return (
      <>
        <button
          type="button"
          className={styles.cellJsonBtn}
          onClick={() => setPopup({ rowIndex, colIndex })}
          onFocus={() => onFocus(rowIndex, colIndex)}
        >
          {display.slice(0, 24) || '{}'}
          {display.length > 24 ? '…' : ''}
        </button>
        {popup && (
          <JsonCellEditor
            value={value}
            onSave={(v) => onChange(rowIndex, colIndex, v)}
            onClose={() => setPopup(null)}
          />
        )}
      </>
    );
  }

  if (canAutoFillPk) {
    return (
      <input
        type="number"
        step={field.type === 'float' ? 'any' : '1'}
        className={styles.cellInput}
        value={value ?? ''}
        onChange={(e) => onChange(rowIndex, colIndex, e.target.value)}
        onFocus={() => onFocus(rowIndex, colIndex)}
        onKeyDown={(e) => onKeyDown(e, rowIndex, colIndex)}
        data-focused={focused ? 'true' : undefined}
      />
    );
  }

  return (
    <input
      type={field.type === 'int' || field.type === 'float' ? 'number' : 'text'}
      step={field.type === 'float' ? 'any' : field.type === 'int' ? '1' : undefined}
      className={styles.cellInput}
      value={value ?? ''}
      onChange={(e) => onChange(rowIndex, colIndex, e.target.value)}
      onFocus={() => onFocus(rowIndex, colIndex)}
      onKeyDown={(e) => onKeyDown(e, rowIndex, colIndex)}
      data-focused={focused ? 'true' : undefined}
    />
  );
}

export default function RowEditor({ fields, rows, onChange, modelId = null }) {
  const scrollRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [focusCell, setFocusCell] = useState({ row: 0, col: 0 });
  const [viewportH, setViewportH] = useState(280);

  const colCount = fields.length;

  const ensureRow = useCallback(
    (rowIndex) => {
      const next = [...rows];
      while (next.length <= rowIndex) {
        next.push(fields.map((f) => (f.type === 'bool' ? false : '')));
      }
      return next;
    },
    [rows, fields]
  );

  const updateCell = (rowIndex, colIndex, value) => {
    const next = ensureRow(rowIndex);
    next[rowIndex] = [...next[rowIndex]];
    next[rowIndex][colIndex] = value;
    onChange(next);
  };

  const addRow = () => {
    onChange([...rows, buildNewRow(fields, rows)]);
  };

  const removeRow = (index) => {
    onChange(rows.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e, rowIndex, colIndex) => {
    const maxRow = Math.max(rows.length - 1, 0);
    const maxCol = colCount - 1;

    if (e.key === 'Tab') {
      e.preventDefault();
      if (!e.shiftKey && colIndex >= maxCol && rowIndex >= maxRow) {
        addRow();
        setFocusCell({ row: rowIndex + 1, col: 0 });
      } else if (e.shiftKey) {
        setFocusCell({
          row: colIndex > 0 ? rowIndex : Math.max(0, rowIndex - 1),
          col: colIndex > 0 ? colIndex - 1 : maxCol,
        });
      } else {
        setFocusCell({
          row: colIndex < maxCol ? rowIndex : Math.min(rowIndex + 1, rows.length),
          col: colIndex < maxCol ? colIndex + 1 : 0,
        });
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusCell({ row: Math.min(rowIndex + 1, rows.length - 1), col: colIndex });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusCell({ row: Math.max(0, rowIndex - 1), col: colIndex });
    } else if (e.key === 'ArrowRight' && e.target.selectionStart === e.target.value?.length) {
      setFocusCell({ row: rowIndex, col: Math.min(colIndex + 1, maxCol) });
    } else if (e.key === 'ArrowLeft' && e.target.selectionStart === 0) {
      setFocusCell({ row: rowIndex, col: Math.max(0, colIndex - 1) });
    }
  };

  const handlePaste = useCallback(
    (e) => {
      const text = e.clipboardData?.getData('text');
      if (!text || !text.includes('\t') && !text.includes('\n')) return;
      e.preventDefault();
      const lines = text.trim().split(/\r?\n/).filter(Boolean);
      const pasted = lines.map((line) => {
        const cells = line.includes('\t') ? line.split('\t') : line.split(',');
        const row = cells.map((c) => c.trim());
        while (row.length < colCount) row.push('');
        return row.slice(0, colCount);
      });
      const filled = fillPrimaryKeysInRows(fields, rows, pasted);
      onChange([...rows, ...filled]);
    },
    [rows, colCount, fields, onChange]
  );

  const { startIndex, endIndex, offsetY } = useMemo(() => {
    const total = rows.length;
    const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
    const visible = Math.ceil(viewportH / ROW_HEIGHT) + OVERSCAN * 2;
    const end = Math.min(total, start + visible);
    return { startIndex: start, endIndex: end, offsetY: start * ROW_HEIGHT };
  }, [scrollTop, viewportH, rows.length]);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => setViewportH(el.clientHeight));
    ro.observe(el);
    setViewportH(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  React.useEffect(() => {
    const sel = scrollRef.current?.querySelector('[data-focused="true"]');
    sel?.focus();
  }, [focusCell]);

  if (colCount === 0) {
    return <div className={styles.infoText}>Добавьте поля, чтобы редактировать строки</div>;
  }

  return (
    <div className={styles.rowEditor}>
      <div className={styles.sectionHeader}>
        <h4 className={styles.subTitle}>Данные ({rows.length} строк)</h4>
        <button type="button" className={styles.addBtn} onClick={addRow}>
          <PlusIcon className={styles.iconSm} /> Строка
        </button>
      </div>
      <div
        ref={scrollRef}
        className={styles.spreadsheetScroll}
        onScroll={(e) => setScrollTop(e.target.scrollTop)}
        onPaste={handlePaste}
      >
        <table className={styles.spreadsheet}>
          <thead>
            <tr>
              <th className={styles.rowNumHead}>#</th>
              {fields.map((f) => (
                <th key={f.id}>{f.name}</th>
              ))}
              <th className={styles.rowActionsHead} />
            </tr>
          </thead>
          <tbody style={{ height: rows.length * ROW_HEIGHT }}>
            <tr style={{ height: offsetY }} aria-hidden><td colSpan={colCount + 2} /></tr>
            {rows.slice(startIndex, endIndex).map((row, vi) => {
              const ri = startIndex + vi;
              return (
                <tr key={ri} style={{ height: ROW_HEIGHT }}>
                  <td className={styles.rowNum}>{ri + 1}</td>
                  {fields.map((field, ci) => (
                    <td key={field.id}>
                      <CellInput
                        field={field}
                        value={row[ci]}
                        rowIndex={ri}
                        colIndex={ci}
                        focused={focusCell.row === ri && focusCell.col === ci}
                        onFocus={setFocusCell}
                        onChange={updateCell}
                        onKeyDown={handleKeyDown}
                        modelId={modelId}
                      />
                    </td>
                  ))}
                  <td>
                    <button type="button" className={styles.iconBtnDanger} onClick={() => removeRow(ri)} title="Удалить строку">
                      <TrashIcon className={styles.iconSm} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
