import React from 'react';
import { createPortal } from 'react-dom';
import { ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import styles from './CreateRoomModal.module.css';

export default function DeleteRoomConfirmModal({
  open,
  roomName = '',
  onClose,
  onConfirm,
  submitting = false,
}) {
  if (!open) return null;

  return createPortal(
    <div className={styles.backdrop} onClick={onClose} role="presentation">
      <div
        className={`${styles.panel} ${styles.confirmPanel}`}
        onClick={(event) => event.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-room-title"
        aria-describedby="delete-room-desc"
      >
        <div className={styles.head}>
          <h3 id="delete-room-title">Удалить чат?</h3>
          <button type="button" onClick={onClose} aria-label="Закрыть">
            <XMarkIcon />
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.confirmWarn}>
            <ExclamationTriangleIcon />
            <p id="delete-room-desc">
              Вы уверены, что хотите удалить комнату{' '}
              <strong>«{roomName || 'без названия'}»</strong>? Все сообщения будут удалены без
              возможности восстановления.
            </p>
          </div>

          <div className={styles.footer}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={onClose}
              disabled={submitting}
            >
              Отмена
            </button>
            <button
              type="button"
              className={styles.dangerBtn}
              onClick={onConfirm}
              disabled={submitting}
            >
              {submitting ? 'Удаление…' : 'Да, удалить чат'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
