import React, { useEffect, useState } from 'react';
import ConfirmDialog from './ConfirmDialog';

/**
 * Подтверждение действия окном внутри приложения вместо window.confirm.
 * Встроенные браузеры и webview нередко подавляют системные окна — тогда
 * window.confirm молча возвращает false и действие «не работает».
 *
 *   if (!(await confirmAction({ title: 'Удалить задачу?', confirmLabel: 'Удалить', danger: true }))) return;
 *
 * Нужен смонтированный <ConfirmActionHost /> (подключён в App.jsx).
 */
let showListener = null;

export function confirmAction({
  title,
  message = '',
  confirmLabel = 'Подтвердить',
  cancelLabel = 'Отмена',
  danger = false,
} = {}) {
  if (!showListener) {
    // Хост не смонтирован (например, в изолированном тесте) — не теряем подтверждение совсем
    return Promise.resolve(window.confirm([title, message].filter(Boolean).join('\n\n')));
  }
  return new Promise((resolve) => {
    showListener({ title, message, confirmLabel, cancelLabel, danger, resolve });
  });
}

export function ConfirmActionHost() {
  const [request, setRequest] = useState(null);

  useEffect(() => {
    showListener = (next) => {
      setRequest((prev) => {
        // Новое подтверждение поверх незакрытого старого — старое считаем отменённым
        prev?.resolve(false);
        return next;
      });
    };
    return () => {
      showListener = null;
    };
  }, []);

  const finish = (result) => {
    setRequest((prev) => {
      prev?.resolve(result);
      return null;
    });
  };

  // Esc закрывает только подтверждение, а не окно (задачу, модалку) под ним
  useEffect(() => {
    if (!request) return undefined;
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      finish(false);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [request]);

  return (
    <ConfirmDialog
      open={Boolean(request)}
      title={request?.title}
      message={request?.message}
      confirmLabel={request?.confirmLabel}
      cancelLabel={request?.cancelLabel}
      variant={request?.danger ? 'danger' : 'primary'}
      onConfirm={() => finish(true)}
      onCancel={() => finish(false)}
      zIndex={10080}
    />
  );
}
