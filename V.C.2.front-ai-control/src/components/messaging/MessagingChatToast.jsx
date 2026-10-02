import React, { useEffect } from 'react';
import { ChatBubbleLeftRightIcon, XMarkIcon } from '@heroicons/react/24/outline';
import styles from './MessagingChatToast.module.css';

export default function MessagingChatToast({ toast, onOpen, onDismiss }) {
  useEffect(() => {
    if (!toast?.id || !onDismiss) return undefined;
    const timer = window.setTimeout(() => onDismiss(toast.id), toast.durationMs ?? 8000);
    return () => window.clearTimeout(timer);
  }, [toast?.id, toast?.durationMs, onDismiss]);

  if (!toast) return null;

  return (
    <div className={styles.toast} role="status">
      <div className={styles.icon} aria-hidden>
        <ChatBubbleLeftRightIcon />
      </div>
      <div className={styles.body}>
        <p className={styles.title}>{toast.title}</p>
        <p className={styles.preview}>{toast.preview || 'Новое сообщение'}</p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.openBtn}
            onClick={() => onOpen?.(toast)}
          >
            Открыть в чате
          </button>
          <button
            type="button"
            className={styles.dismissBtn}
            onClick={() => onDismiss?.(toast.id)}
          >
            Скрыть
          </button>
        </div>
      </div>
      <button
        type="button"
        className={styles.close}
        onClick={() => onDismiss?.(toast.id)}
        aria-label="Закрыть"
      >
        <XMarkIcon />
      </button>
    </div>
  );
}
