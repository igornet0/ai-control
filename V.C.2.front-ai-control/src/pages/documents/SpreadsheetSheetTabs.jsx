import React, { useState } from 'react';
import styles from './DocumentsApp.module.css';

/**
 * Таб-бар листов (как в Excel): переключение, добавление, переименование, удаление.
 */
const SpreadsheetSheetTabs = ({
  sheets = [],
  activeSheetId,
  onSelect,
  onAdd,
  onRename,
  onDelete,
  maxSheets = 32,
  addLabel = '+ Лист',
  editable = true,
}) => {
  const [renamingId, setRenamingId] = useState(null);
  const [renameDraft, setRenameDraft] = useState('');

  const startRename = (sheet) => {
    setRenamingId(sheet.id);
    setRenameDraft(sheet.name || '');
  };

  const commitRename = () => {
    if (renamingId && renameDraft.trim()) {
      onRename?.(renamingId, renameDraft.trim());
    }
    setRenamingId(null);
    setRenameDraft('');
  };

  const cancelRename = () => {
    setRenamingId(null);
    setRenameDraft('');
  };

  if (!sheets.length) return null;

  return (
    <div className={styles.spreadsheetSheetTabs} role="tablist" aria-label="Листы таблицы">
      <div className={styles.spreadsheetSheetTabsScroll}>
        {sheets.map((sheet) => {
          const isActive = sheet.id === activeSheetId;
          const isRenaming = renamingId === sheet.id;
          return (
            <div
              key={sheet.id}
              className={`${styles.spreadsheetSheetTab} ${isActive ? styles.spreadsheetSheetTabActive : ''}`}
              role="presentation"
            >
              {isRenaming ? (
                <input
                  className={styles.spreadsheetSheetTabRename}
                  type="text"
                  value={renameDraft}
                  onChange={(e) => setRenameDraft(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      commitRename();
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      cancelRename();
                    }
                  }}
                  autoFocus
                  aria-label="Имя листа"
                />
              ) : (
                <button
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={styles.spreadsheetSheetTabBtn}
                  onMouseDown={(e) => {
                    // Не забирать фокус у строки формулы — иначе сбрасывается вставка ссылок с другого листа
                    if (e.button === 0) e.preventDefault();
                  }}
                  onClick={() => onSelect?.(sheet.id)}
                  onDoubleClick={editable ? (e) => {
                    e.preventDefault();
                    startRename(sheet);
                  } : undefined}
                  title="Двойной клик — переименовать"
                >
                  {sheet.name || 'Лист'}
                </button>
              )}
              {editable && sheets.length > 1 && isActive && !isRenaming && (
                <button
                  type="button"
                  className={styles.spreadsheetSheetTabDelete}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`Удалить лист «${sheet.name}»?`)) {
                      onDelete?.(sheet.id);
                    }
                  }}
                  aria-label={`Удалить лист ${sheet.name}`}
                  title="Удалить лист"
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>
      {editable && sheets.length < maxSheets && (
        <button
          type="button"
          className={styles.spreadsheetSheetTabAdd}
          onClick={onAdd}
          aria-label="Добавить лист"
        >
          {addLabel}
        </button>
      )}
    </div>
  );
};

export default SpreadsheetSheetTabs;
