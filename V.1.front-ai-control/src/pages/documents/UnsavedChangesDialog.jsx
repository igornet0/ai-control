import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import styles from './DocumentsApp.module.css';

/**
 * Вопрос при закрытии редактора с несохранёнными изменениями:
 * «Отмена» — вернуться к редактированию, «Не сохранять» — закрыть без сохранения,
 * «Сохранить» — сохранить и закрыть.
 */
const UnsavedChangesDialog = ({
  open,
  entityLabel = 'документе',
  entityName,
  saving = false,
  error = null,
  onCancel,
  onDiscard,
  onSave,
  zIndex = 10060,
}) => {
  const dialogRef = useRef(null);
  const saveButtonRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    saveButtonRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onCancel?.();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      // Держим фокус внутри диалога.
      const buttons = [...dialogRef.current.querySelectorAll('button:not(:disabled)')];
      if (buttons.length === 0) return;
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [open, onCancel]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={styles.unsavedDialogBackdrop}
      style={{ zIndex }}
      onClick={(e) => e.target === e.currentTarget && onCancel?.()}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className={styles.unsavedDialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="unsaved-dialog-title"
        aria-describedby="unsaved-dialog-text"
      >
        <h3 id="unsaved-dialog-title" className={styles.unsavedDialogTitle}>
          Сохранить изменения?
        </h3>
        <p id="unsaved-dialog-text" className={styles.unsavedDialogText}>
          В {entityLabel}
          {entityName ? <> «<strong>{entityName}</strong>»</> : null}
          {' '}есть несохранённые изменения. Если закрыть без сохранения, они будут потеряны.
        </p>
        {error && (
          <p className={styles.unsavedDialogError} role="alert">{error}</p>
        )}
        <div className={styles.unsavedDialogActions}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={onCancel}
            disabled={saving}
          >
            Отмена
          </button>
          <div className={styles.unsavedDialogActionsMain}>
            <button
              type="button"
              className={styles.unsavedDialogDiscard}
              onClick={onDiscard}
              disabled={saving}
            >
              Не сохранять
            </button>
            <button
              ref={saveButtonRef}
              type="button"
              className={styles.primaryButton}
              onClick={onSave}
              disabled={saving}
            >
              {saving ? 'Сохранение…' : 'Сохранить'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default UnsavedChangesDialog;
