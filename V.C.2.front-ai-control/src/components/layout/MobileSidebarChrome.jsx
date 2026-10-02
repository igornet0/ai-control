import React from 'react';
import { createPortal } from 'react-dom';

export default function MobileSidebarChrome({ open, onOpen, onClose, label = 'Открыть меню разделов' }) {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      {!open ? (
        <button type="button" className="app-mobile-sidebar-fab" onClick={onOpen} aria-label={label}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
      ) : null}
      {open ? (
        <button
          type="button"
          className="app-mobile-sidebar-backdrop"
          aria-label="Закрыть меню разделов"
          onClick={onClose}
        />
      ) : null}
    </>,
    document.body,
  );
}
