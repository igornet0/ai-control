import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Подтвердить',
  cancelLabel = 'Отмена',
  altConfirmLabel,
  variant = 'primary',
  loading = false,
  onConfirm,
  onAltConfirm,
  onCancel,
  zIndex = 10050,
}) {
  useEffect(() => {
    if (!open) return undefined;

    const handleEscape = (event) => {
      if (event.key === 'Escape' && !loading) {
        onCancel?.();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, loading, onCancel]);

  if (!open || typeof document === 'undefined') {
    return null;
  }

  const confirmClassName = variant === 'danger'
    ? 'px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium disabled:opacity-50'
    : 'px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium disabled:opacity-50';

  return createPortal(
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      style={{ zIndex }}
      onClick={() => !loading && onCancel?.()}
      role="presentation"
    >
      <div
        className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-600 rounded-xl p-6 max-w-md w-full shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
      >
        <h3 id="confirm-dialog-title" className="text-lg font-semibold text-white mb-2">
          {title}
        </h3>
        {message && (
          <p className="text-slate-300 text-sm mb-6 leading-relaxed">
            {message}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          {altConfirmLabel && onAltConfirm ? (
            <button
              type="button"
              onClick={onAltConfirm}
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-slate-600 hover:bg-slate-500 text-white text-sm font-medium disabled:opacity-50"
            >
              {loading ? 'Обработка…' : altConfirmLabel}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={confirmClassName}
          >
            {loading ? 'Обработка…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
