import React, { useState, useEffect } from 'react';
import {
  SUMMARY_TYPES,
  normalizeColumnSummaryConfig,
  previewSummaryColumn,
} from './spreadsheetSummary';
import { excelColumnLabel } from './spreadsheetGridUtils';
import s from './SpreadsheetTemplatePanel.module.css';

const SpreadsheetSummarySettings = ({
  open,
  colIndex,
  colKey,
  colLabel,
  model,
  anchor,
  onApply,
  onClose,
}) => {
  const [draft, setDraft] = useState(() => normalizeColumnSummaryConfig({}));

  useEffect(() => {
    if (!open || !colKey) return;
    const summary = model?.summary;
    const cfg = summary?.columns?.[colKey];
    setDraft(normalizeColumnSummaryConfig(cfg));
  }, [open, colKey, model?.summary]);

  if (!open || colIndex == null || !colKey) return null;

  const previewModel = {
    ...model,
    summary: {
      ...model.summary,
      enabled: true,
      columns: {
        ...(model.summary?.columns || {}),
        [colKey]: draft,
      },
    },
  };
  const preview = previewSummaryColumn(previewModel, colKey);

  const handleApply = () => {
    onApply?.(colKey, draft);
    onClose?.();
  };

  const left = anchor?.x != null ? Math.min(anchor.x, (typeof window !== 'undefined' ? window.innerWidth : 800) - 300) : 0;
  const top = anchor?.y != null ? Math.min(anchor.y, (typeof window !== 'undefined' ? window.innerHeight : 600) - 280) : 0;

  return (
    <>
      <div
        className={s.summaryBackdrop}
        role="presentation"
        onClick={onClose}
      />
      <div
        className={s.summaryPopover}
        style={{ left, top }}
        role="dialog"
        aria-label={`Итог столбца ${colLabel || excelColumnLabel(colIndex)}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h4 className={s.summaryPopoverTitle}>
          Итог: {colLabel || `Столбец ${excelColumnLabel(colIndex)}`}
        </h4>
        <label className={s.summaryPopoverLabel}>
          Тип итогового значения
          <select
            className={s.summaryPopoverSelect}
            value={draft.type}
            onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value }))}
          >
            {SUMMARY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </label>
        {draft.type === 'formula' && (
          <label className={s.summaryPopoverLabel}>
            Формула
            <input
              type="text"
              className={s.summaryPopoverInput}
              value={draft.formula}
              onChange={(e) => setDraft((d) => ({ ...d, formula: e.target.value }))}
              placeholder="=SUM(B2:B100) или B_SUM * C_SUM"
            />
            <span className={s.summaryPopoverHint}>
              Переменные: A_SUM, B_AVG, col_0_SUM. Функции: SUM(), AVG(), MIN(), MAX(), COUNT().
            </span>
          </label>
        )}
        {draft.type === 'custom_text' && (
          <label className={s.summaryPopoverLabel}>
            Текст
            <input
              type="text"
              className={s.summaryPopoverInput}
              value={draft.customText}
              onChange={(e) => setDraft((d) => ({ ...d, customText: e.target.value }))}
              placeholder="ИТОГО"
            />
          </label>
        )}
        <div className={s.summaryPreview}>
          <span className={s.summaryPreviewLabel}>Предпросмотр</span>
          <span className={s.summaryPreviewValue}>{preview || '—'}</span>
        </div>
        <div className={s.summaryPopoverActions}>
          <button type="button" className={s.toolbarBtn} onClick={onClose}>
            Отмена
          </button>
          <button type="button" className={`${s.toolbarBtn} ${s.toolbarBtnActive}`} onClick={handleApply}>
            Применить
          </button>
        </div>
      </div>
    </>
  );
};

export default SpreadsheetSummarySettings;
