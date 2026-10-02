import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import EditableTable from './EditableTable';
import SpreadsheetDocumentGrid from './SpreadsheetDocumentGrid';
import { FIELD_DISPLAY } from './SheetEditor';
import { SPREADSHEET_BLOCK_TYPE } from './spreadsheetGridUtils';
import { resolveTableColumns } from './documentTableColumns';
import { IconClose } from './DocumentIcons';
import styles from './DocumentsApp.module.css';

export default function ShareFieldEditModal({
  open,
  target,
  fieldData,
  title,
  onSaveField,
  onSaveTitle,
  onClose,
}) {
  const [draft, setDraft] = useState('');

  const isTitle = target?.kind === 'title';
  const fieldName = target?.fieldName;
  const block = target?.block;
  const meta = target?.meta;

  useEffect(() => {
    if (!open || !target) return;
    if (isTitle) {
      setDraft(title ?? '');
      return;
    }
    const val = fieldData?.[fieldName];
    if (block?.type === SPREADSHEET_BLOCK_TYPE || block?.displayType === FIELD_DISPLAY.table || meta?.type === 'table') {
      setDraft(val ?? (block?.type === SPREADSHEET_BLOCK_TYPE ? {} : []));
      return;
    }
    setDraft(val ?? '');
  }, [open, target, isTitle, title, fieldData, fieldName, block, meta]);

  if (!open || !target) return null;

  const modalTitle = isTitle ? 'Заголовок документа' : (fieldName || 'Поле');

  const handleSave = () => {
    if (isTitle) {
      onSaveTitle?.(draft);
    } else {
      onSaveField?.(fieldName, draft);
    }
    onClose?.();
  };

  const isWide = !isTitle && (block?.type === SPREADSHEET_BLOCK_TYPE || block?.displayType === FIELD_DISPLAY.table || meta?.type === 'table');
  const useTextarea = !isTitle && !isWide
    && meta?.type !== 'date'
    && meta?.type !== 'number'
    && (meta?.type === 'text' || String(draft ?? '').includes('\n'));

  const renderEditor = () => {
    if (isTitle) {
      return (
        <input
          type="text"
          className={styles.shareFieldEditInput}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          autoFocus
          placeholder="Заголовок документа"
        />
      );
    }

    if (block?.type === SPREADSHEET_BLOCK_TYPE) {
      return (
        <SpreadsheetDocumentGrid
          block={block}
          value={draft && typeof draft === 'object' ? draft : {}}
          onChange={setDraft}
          readOnly={false}
        />
      );
    }

    const isTable = block?.displayType === FIELD_DISPLAY.table || meta?.type === 'table';
    if (isTable) {
      return (
        <EditableTable
          columns={resolveTableColumns(block, meta)}
          value={Array.isArray(draft) ? draft : []}
          onChange={setDraft}
          compact
        />
      );
    }

    if (meta?.type === 'date') {
      return (
        <input
          type="date"
          className={styles.shareFieldEditInput}
          value={typeof draft === 'string' && draft.length <= 10 ? draft : ''}
          onChange={(e) => setDraft(e.target.value)}
          autoFocus
        />
      );
    }

    if (meta?.type === 'number') {
      return (
        <input
          type="number"
          className={styles.shareFieldEditInput}
          value={draft ?? ''}
          onChange={(e) => setDraft(e.target.value)}
          autoFocus
          placeholder="Введите число"
        />
      );
    }

    if (useTextarea) {
      return (
        <textarea
          className={styles.shareFieldEditTextarea}
          value={draft ?? ''}
          onChange={(e) => setDraft(e.target.value)}
          rows={5}
          autoFocus
          placeholder="Введите значение"
        />
      );
    }

    return (
      <input
        type="text"
        className={styles.shareFieldEditInput}
        value={draft ?? ''}
        onChange={(e) => setDraft(e.target.value)}
        autoFocus
        placeholder="Введите значение"
      />
    );
  };

  return createPortal(
    <div className={styles.tableDefaultModalOverlay} onClick={onClose} role="presentation">
      <div
        className={`${styles.shareFieldEditModal} ${isWide ? styles.shareFieldEditModalWide : ''}`.trim()}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-field-edit-title"
      >
        <div className={styles.tableDefaultModalHeader}>
          <h3 id="share-field-edit-title" className={styles.tableDefaultModalTitle}>{modalTitle}</h3>
          <button type="button" className={styles.tableDefaultModalClose} onClick={onClose} aria-label="Закрыть">
            <IconClose size={18} />
          </button>
        </div>
        <div className={`${styles.shareFieldEditModalBody} ${isWide ? styles.shareFieldEditModalBodyWide : ''}`.trim()}>
          {renderEditor()}
        </div>
        <div className={styles.tableDefaultModalFooter}>
          <button type="button" className={styles.secondaryButton} onClick={onClose}>
            Отмена
          </button>
          <button type="button" className={styles.primaryButton} onClick={handleSave}>
            Применить
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
