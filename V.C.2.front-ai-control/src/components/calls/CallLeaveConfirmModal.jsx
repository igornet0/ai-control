import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import styles from './CallLeaveConfirmModal.module.css';

export default function CallLeaveConfirmModal({
  open,
  destinationLabel = '',
  onCancel,
  onConfirm,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onCancel]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className={styles.backdrop} onClick={onCancel} role="presentation">
      <div
        className={styles.panel}
        onClick={(event) => event.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="call-leave-title"
        aria-describedby="call-leave-desc"
      >
        <div className={styles.head}>
          <h3 id="call-leave-title">Выйти из звонка?</h3>
          <button type="button" onClick={onCancel} aria-label="Закрыть">
            <XMarkIcon />
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.warn}>
            <ExclamationTriangleIcon />
            <p id="call-leave-desc">
              {destinationLabel
                ? `Переход «${destinationLabel}» завершит текущий видеозвонок.`
                : 'Переход на другую страницу завершит текущий видеозвонок.'}
            </p>
          </div>

          <div className={styles.footer}>
            <button type="button" className={styles.cancelBtn} onClick={onCancel}>
              Отмена
            </button>
            <button type="button" className={styles.confirmBtn} onClick={onConfirm}>
              Выйти из звонка
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
