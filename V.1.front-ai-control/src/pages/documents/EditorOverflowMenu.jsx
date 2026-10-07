import React, { useEffect, useRef, useState } from 'react';
import chrome from './DocumentEditorChrome.module.css';

/**
 * Меню «⋯» для редких действий редактора (печать, экспорт, откат, удаление).
 * @param {{ items: Array<{ id: string, label: string, onSelect: () => void, danger?: boolean, separatorBefore?: boolean, hidden?: boolean }> }} props
 */
export default function EditorOverflowMenu({ items, label = 'Ещё действия' }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const visible = items.filter((item) => !item.hidden);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  return (
    <div className={chrome.menuRoot} ref={rootRef}>
      <button
        type="button"
        className={`${chrome.iconBtn} ${open ? chrome.iconBtnActive : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="5" cy="12" r="1.7" fill="currentColor" />
          <circle cx="12" cy="12" r="1.7" fill="currentColor" />
          <circle cx="19" cy="12" r="1.7" fill="currentColor" />
        </svg>
      </button>
      {open && (
        <ul className={chrome.menu} role="menu">
          {visible.map((item) => (
            <li key={item.id} role="none" className={item.separatorBefore ? chrome.menuSeparated : undefined}>
              <button
                type="button"
                role={item.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
                aria-checked={item.checked === undefined ? undefined : item.checked}
                className={`${chrome.menuItem} ${item.danger ? chrome.menuItemDanger : ''}`}
                disabled={item.disabled}
                onClick={() => {
                  if (!item.keepOpen) setOpen(false);
                  item.onSelect();
                }}
              >
                {item.checked !== undefined && (
                  <span className={`${chrome.menuCheck} ${item.checked ? chrome.menuCheckOn : ''}`} aria-hidden>
                    {item.checked ? '✓' : ''}
                  </span>
                )}
                {item.label}
                {item.hint && <span className={chrome.menuHint}>{item.hint}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
