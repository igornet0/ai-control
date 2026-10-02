import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import EditableTable from './EditableTable';
import { copyDefaultTableColumns } from './documentTableColumns';
import { normalizeTableRowsForTemplateSave } from './tableFieldUtils';
import { IconClose } from './DocumentIcons';
import styles from './DocumentsApp.module.css';

const TableDefaultValueModal = ({
  open,
  title = 'Значение по умолчанию',
  columns,
  value,
  onSave,
  onClose,
}) => {
  const [draft, setDraft] = useState([]);

  useEffect(() => {
    if (!open) return;
    setDraft(Array.isArray(value) ? value.map((row) => ({ ...row })) : []);
  }, [open, value]);

  if (!open) return null;

  const cols = Array.isArray(columns) && columns.length > 0 ? columns : copyDefaultTableColumns();

  const handleSave = () => {
    onSave?.(normalizeTableRowsForTemplateSave(draft, cols));
    onClose?.();
  };

  return createPortal(
    <div
      className={styles.tableDefaultModalOverlay}
      onClick={onClose}
      role="presentation"
    >
      <div
        className={styles.tableDefaultModal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="table-default-modal-title"
      >
        <div className={styles.tableDefaultModalHeader}>
          <h3 id="table-default-modal-title" className={styles.tableDefaultModalTitle}>{title}</h3>
          <button type="button" className={styles.tableDefaultModalClose} onClick={onClose} aria-label="Закрыть">
            <IconClose size={18} />
          </button>
        </div>
        <div className={styles.tableDefaultModalBody}>
          <EditableTable columns={cols} value={draft} onChange={setDraft} compact />
        </div>
        <div className={styles.tableDefaultModalFooter}>
          <button type="button" className={styles.secondaryButton} onClick={onClose}>
            Отмена
          </button>
          <button type="button" className={styles.primaryButton} onClick={handleSave}>
            Готово
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default TableDefaultValueModal;
