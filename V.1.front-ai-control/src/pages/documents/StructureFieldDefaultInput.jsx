import React, { useState, useEffect } from 'react';
import { defaultValueToEditString, parseDefaultFromEditString } from './structureFieldUtils';
import { copyDefaultTableColumns } from './documentTableColumns';
import TableDefaultValueModal from './TableDefaultValueModal';
import styles from './DocumentsApp.module.css';

/** Редактор значения по умолчанию для поля структуры */
const StructureFieldDefaultInput = ({ field, onCommit }) => {
  const type = field.type || 'string';
  const [draft, setDraft] = useState(() => defaultValueToEditString(field.default, type));
  const [tableModalOpen, setTableModalOpen] = useState(false);

  useEffect(() => {
    setDraft(defaultValueToEditString(field.default, type));
  }, [field.default, field.type, field.name]);

  if (type === 'boolean') {
    const val = field.default === true ? 'true' : field.default === false ? 'false' : '';
    return (
      <select
        value={val}
        onChange={(e) => {
          const v = e.target.value;
          onCommit(v === '' ? undefined : v === 'true');
        }}
        className={styles.fieldSelect}
        aria-label="Значение по умолчанию"
      >
        <option value="">—</option>
        <option value="true">Да</option>
        <option value="false">Нет</option>
      </select>
    );
  }

  if (type === 'table') {
    const rows = Array.isArray(field.default) ? field.default : [];
    const rowLabel = rows.length === 0 ? 'Пусто' : `${rows.length} ${rows.length === 1 ? 'строка' : rows.length < 5 ? 'строки' : 'строк'}`;
    const columns = Array.isArray(field.columns) && field.columns.length > 0
      ? field.columns
      : copyDefaultTableColumns();

    return (
      <>
        <div className={styles.tableDefaultInputRow}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => setTableModalOpen(true)}
          >
            Редактировать таблицу
          </button>
          <span className={styles.tableDefaultInputHint}>{rowLabel}</span>
        </div>
        <TableDefaultValueModal
          open={tableModalOpen}
          columns={columns}
          value={field.default}
          onSave={onCommit}
          onClose={() => setTableModalOpen(false)}
        />
      </>
    );
  }

  const inputType = type === 'number' ? 'number' : type === 'date' ? 'date' : 'text';
  return (
    <input
      type={inputType}
      className={styles.fieldInput}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => onCommit(parseDefaultFromEditString(draft, type))}
      placeholder={type === 'date' ? 'ГГГГ-ММ-ДД' : ''}
      aria-label="Значение по умолчанию"
    />
  );
};

export default StructureFieldDefaultInput;
