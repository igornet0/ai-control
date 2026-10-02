import React from 'react';
import { DocumentTextIcon } from '@heroicons/react/24/outline';
import styles from '../PropertiesPanel.module.css';

/**
 * Кнопка открытия редактора DataCode с индикатором ручных правок.
 */
export default function DataCodeOpenButton({
  onClick,
  disabled = false,
  title = 'Открыть редактор DataCode',
  modified = false,
  onRegenerate,
  className = '',
}) {
  return (
    <div className={styles.dataCodeOpenGroup}>
      {modified && (
        <div className={styles.dataCodeModifiedBanner}>
          <span className={styles.dataCodeModifiedText}>
            Код изменён вручную и может отличаться от автогенерации.
          </span>
          {onRegenerate && (
            <button
              type="button"
              className={styles.dataCodeRegenerateBtn}
              onClick={onRegenerate}
              title="Сбросить правки и перегенерировать код из настроек виджета"
            >
              ↺ Перегенерировать
            </button>
          )}
        </div>
      )}
      <button
        type="button"
        className={`${styles.datacodeButton} ${modified ? styles.datacodeButtonModified : ''} ${className}`.trim()}
        onClick={() => onClick?.()}
        disabled={disabled}
        title={title}
      >
        <DocumentTextIcon style={{ width: '1rem', height: '1rem' }} />
        <span>DataCode</span>
        {modified && <span className={styles.dataCodeModifiedBadge}>изменён</span>}
      </button>
    </div>
  );
}
