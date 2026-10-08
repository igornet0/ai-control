import React, { useEffect, useRef, useState } from 'react';
import chrome from './DocumentEditorChrome.module.css';

/**
 * Меню «⋯» для редких действий редактора (печать, экспорт, откат, удаление).
 * @param {{ items: Array<{ id: string, label: string, onSelect: () => void, danger?: boolean, separatorBefore?: boolean, hidden?: boolean, hint?: string, icon?: React.ReactNode }> }} props
 * trigger / triggerClassName — своя кнопка вместо «⋯» (например, «Создать ▾»); align — край, к которому прижато меню.
 */
export default function EditorOverflowMenu({
  items,
  label = 'Ещё действия',
  trigger = null,
  triggerClassName = '',
  align = 'right',
}) {
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

  // Все пункты скрыты — кнопку не показываем, иначе раскрывается пустое меню.
  if (visible.length === 0) return null;

  return (
    <div className={chrome.menuRoot} ref={rootRef}>
      <button
        type="button"
        className={trigger ? triggerClassName : `${chrome.iconBtn} ${open ? chrome.iconBtnActive : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={trigger ? undefined : label}
      >
        {trigger || (
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="5" cy="12" r="1.7" fill="currentColor" />
            <circle cx="12" cy="12" r="1.7" fill="currentColor" />
            <circle cx="19" cy="12" r="1.7" fill="currentColor" />
          </svg>
        )}
      </button>
      {open && (
        <ul className={`${chrome.menu} ${align === 'left' ? chrome.menuLeft : ''}`} role="menu">
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
                {item.icon && <span className={chrome.menuIcon} aria-hidden>{item.icon}</span>}
                {item.checked !== undefined && (
                  <span className={`${chrome.menuCheck} ${item.checked ? chrome.menuCheckOn : ''}`} aria-hidden>
                    {item.checked ? '✓' : ''}
                  </span>
                )}
                <span className={chrome.menuText}>
                  {item.label}
                  {item.hint && <span className={chrome.menuHint}>{item.hint}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
