import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { XMarkIcon } from '@heroicons/react/24/outline';
import styles from './CreateRoomModal.module.css';

export default function RenameRoomModal({
  open,
  roomName = '',
  onClose,
  onSubmit,
  submitting = false,
}) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setName(roomName);
      setError('');
    }
  }, [open, roomName]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Введите название комнаты');
      return;
    }
    if (trimmed === roomName.trim()) {
      onClose?.();
      return;
    }
    setError('');
    try {
      await onSubmit?.(trimmed);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Не удалось переименовать');
    }
  };

  if (!open) return null;

  return createPortal(
    <div className={styles.backdrop} onClick={onClose} role="presentation">
      <div
        className={styles.panel}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Переименовать комнату"
      >
        <div className={styles.head}>
          <h3>Переименовать комнату</h3>
          <button type="button" onClick={onClose} aria-label="Закрыть">
            <XMarkIcon />
          </button>
        </div>

        <form className={styles.body} onSubmit={handleSubmit}>
          <label className={styles.field}>
            <span>Название</span>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Название комнаты"
              maxLength={120}
              autoFocus
              disabled={submitting}
            />
          </label>

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.footer}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={onClose}
              disabled={submitting}
            >
              Отмена
            </button>
            <button type="submit" className={styles.submitBtn} disabled={submitting}>
              {submitting ? 'Сохранение…' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
