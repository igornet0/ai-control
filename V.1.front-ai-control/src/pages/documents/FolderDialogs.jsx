import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DocIcon } from './DocumentIcons';
import { flattenFolderTree, SCOPE_ICONS } from './documentFolderUtils';
import s from './TemplateAccess.module.css';
import f from './DocumentFolders.module.css';

export function errorText(e, fallback) {
  const detail = e?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map((item) => item?.msg || item).filter(Boolean).join('; ');
  return fallback;
}

/** Общая оболочка модального окна раздела «Папки» (портал, Esc, клик по фону). */
export function FolderDialogShell({ title, subtitle, onClose, busy = false, footer, children, labelId, wide = false, zIndex }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) {
        e.stopPropagation();
        onClose?.();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [busy, onClose]);

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      className={s.backdrop}
      style={zIndex ? { zIndex } : undefined}
      onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose?.()}
      role="presentation"
    >
      <div
        className={s.dialog}
        style={wide ? { maxWidth: 620 } : undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
      >
        <div className={s.header}>
          <div>
            <h3 id={labelId} className={s.title}>{title}</h3>
            {subtitle && <p className={s.subtitle}>{subtitle}</p>}
          </div>
          <button type="button" className={s.closeBtn} onClick={onClose} disabled={busy} aria-label="Закрыть">×</button>
        </div>
        <div className={s.body}>{children}</div>
        {footer && <div className={s.footer}>{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/** Создание или переименование папки. */
export function FolderNameDialog({ title, subtitle, initialName = '', confirmLabel = 'Сохранить', onSubmit, onClose }) {
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const trimmed = name.trim();
  const submit = async (e) => {
    e?.preventDefault();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(trimmed);
      onClose?.();
    } catch (err) {
      setError(errorText(err, 'Не удалось сохранить папку'));
      setBusy(false);
    }
  };

  return (
    <FolderDialogShell
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      busy={busy}
      labelId="folder-name-title"
      footer={(
        <>
          <span className={s.footerNote} />
          <button type="button" className={s.cancelBtn} onClick={onClose} disabled={busy}>Отмена</button>
          <button type="button" className={s.saveBtn} onClick={submit} disabled={busy || !trimmed}>
            {busy ? 'Сохранение…' : confirmLabel}
          </button>
        </>
      )}
    >
      <form onSubmit={submit}>
        {error && <div className={s.error} role="alert">{error}</div>}
        <label className={f.fieldLabel} htmlFor="folder-name-input">Название</label>
        <input
          id="folder-name-input"
          ref={inputRef}
          className={f.textInput}
          value={name}
          maxLength={200}
          onChange={(e) => setName(e.target.value)}
          placeholder="Например, Договоры 2026"
          autoComplete="off"
        />
      </form>
    </FolderDialogShell>
  );
}

/**
 * Выбор папки (для перемещения документа или папки). Доступны только папки с правом «Изменение».
 * rootOption — пункт «Без папки» / «В корень» (value null).
 */
export function FolderPickerDialog({
  title,
  subtitle,
  folders,
  currentFolderId = null,
  disabledIds = null,
  rootOption = null,
  confirmLabel = 'Переместить',
  onPick,
  onClose,
  zIndex,
}) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const q = query.trim().toLowerCase();
  const rows = useMemo(
    () => flattenFolderTree(folders).filter(({ folder }) => !q || String(folder.name).toLowerCase().includes(q)),
    [folders, q],
  );

  const isDisabled = useCallback(
    (folder) => !folder.can_edit || folder.id === currentFolderId || Boolean(disabledIds?.has(folder.id)),
    [currentFolderId, disabledIds],
  );

  const confirm = async () => {
    if (selected === undefined || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onPick(selected);
      onClose?.();
    } catch (err) {
      setError(errorText(err, 'Не удалось переместить'));
      setBusy(false);
    }
  };

  return (
    <FolderDialogShell
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      busy={busy}
      zIndex={zIndex}
      labelId="folder-picker-title"
      footer={(
        <>
          <span className={s.footerNote} />
          <button type="button" className={s.cancelBtn} onClick={onClose} disabled={busy}>Отмена</button>
          <button type="button" className={s.saveBtn} onClick={confirm} disabled={busy || selected === undefined}>
            {busy ? 'Перемещение…' : confirmLabel}
          </button>
        </>
      )}
    >
      {error && <div className={s.error} role="alert">{error}</div>}
      <input
        className={f.textInput}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Поиск папки…"
        aria-label="Поиск папки"
        autoFocus
      />
      <ul className={f.pickList} role="listbox" aria-label="Папки">
        {rootOption && !q && (
          <li>
            <button
              type="button"
              role="option"
              aria-selected={selected === null}
              className={`${f.pickItem} ${selected === null ? f.pickItemActive : ''}`}
              onClick={() => setSelected(null)}
              disabled={currentFolderId == null && rootOption.disabledWhenRoot}
            >
              <span className={f.pickItemIcon}><DocIcon name="documentStack" size={16} /></span>
              <span className={f.pickItemText}>
                <span className={f.pickItemTitle}>{rootOption.label}</span>
                {rootOption.hint && <span className={f.pickItemMeta}>{rootOption.hint}</span>}
              </span>
            </button>
          </li>
        )}
        {rows.length === 0 ? (
          <li className={f.pickEmpty}>Папки не найдены</li>
        ) : rows.map(({ folder, depth }) => {
          const disabled = isDisabled(folder);
          return (
            <li key={folder.id}>
              <button
                type="button"
                role="option"
                aria-selected={selected === folder.id}
                className={`${f.pickItem} ${selected === folder.id ? f.pickItemActive : ''}`}
                style={{ '--depth': q ? 0 : depth }}
                onClick={() => setSelected(folder.id)}
                disabled={disabled}
                title={!folder.can_edit ? 'Нет права добавлять в эту папку' : undefined}
              >
                <span className={f.pickItemIcon}><DocIcon name={SCOPE_ICONS[folder.is_system ? folder.scope_type : 'custom']} size={16} /></span>
                <span className={f.pickItemText}>
                  <span className={f.pickItemTitle}>{folder.name}</span>
                  {folder.id === currentFolderId && <span className={f.pickItemMeta}>Текущая папка</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </FolderDialogShell>
  );
}

/** Выбор элемента из списка (шаблон для нового документа или существующий документ). */
export function ItemPickerDialog({
  title,
  subtitle,
  items,
  emptyText = 'Ничего не найдено',
  searchPlaceholder = 'Поиск…',
  confirmLabel = 'Выбрать',
  busyLabel = 'Подождите…',
  onPick,
  onClose,
}) {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const q = query.trim().toLowerCase();
  const visible = useMemo(
    () => items.filter((item) => !q || `${item.title} ${item.meta || ''}`.toLowerCase().includes(q)),
    [items, q],
  );

  const confirm = async (item) => {
    const target = item || items.find((x) => x.key === selectedId);
    if (!target || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onPick(target);
      onClose?.();
    } catch (err) {
      setError(errorText(err, 'Не удалось выполнить действие'));
      setBusy(false);
    }
  };

  return (
    <FolderDialogShell
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      busy={busy}
      labelId="item-picker-title"
      footer={(
        <>
          <span className={s.footerNote} />
          <button type="button" className={s.cancelBtn} onClick={onClose} disabled={busy}>Отмена</button>
          <button type="button" className={s.saveBtn} onClick={() => confirm()} disabled={busy || selectedId == null}>
            {busy ? busyLabel : confirmLabel}
          </button>
        </>
      )}
    >
      {error && <div className={s.error} role="alert">{error}</div>}
      <input
        className={f.textInput}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={searchPlaceholder}
        aria-label={searchPlaceholder}
        autoFocus
      />
      <ul className={f.pickList} role="listbox" aria-label={title}>
        {visible.length === 0 ? (
          <li className={f.pickEmpty}>{emptyText}</li>
        ) : visible.map((item) => (
          <li key={item.key}>
            <button
              type="button"
              role="option"
              aria-selected={selectedId === item.key}
              className={`${f.pickItem} ${selectedId === item.key ? f.pickItemActive : ''}`}
              onClick={() => setSelectedId(item.key)}
              onDoubleClick={() => confirm(item)}
              disabled={busy}
            >
              <span className={f.pickItemIcon}><DocIcon name={item.icon || 'documentStack'} size={16} /></span>
              <span className={f.pickItemText}>
                <span className={f.pickItemTitle}>{item.title}</span>
                {item.meta && <span className={f.pickItemMeta}>{item.meta}</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </FolderDialogShell>
  );
}
