import React from 'react';
import FieldEditor from './FieldEditor.jsx';
import RowEditor from './RowEditor.jsx';
import { sanitizeIdentifier, validateIdentifier } from './schema.js';
import styles from './InteractiveDataSource.module.css';

export default function TableEditor({ table, onChange, modelId = null }) {
  const nameError = validateIdentifier(table.name);

  const updateTable = (patch) => onChange({ ...table, ...patch });

  const handleFieldsChange = (fields) => {
    const colCount = fields.length;
    const rows = table.rows.map((row) => {
      const arr = Array.isArray(row) ? [...row] : [];
      while (arr.length < colCount) arr.push('');
      return arr.slice(0, colCount);
    });
    updateTable({ fields, rows });
  };

  return (
    <div className={styles.tableEditor}>
      <div className={styles.fieldGroup}>
        <label className={styles.label}>Название таблицы</label>
        <input
          className={`${styles.input} ${nameError ? styles.inputInvalid : ''}`}
          value={table.name}
          onChange={(e) => updateTable({ name: sanitizeIdentifier(e.target.value, table.name) })}
          placeholder="users"
        />
        {nameError && <div className={styles.validationError}>{nameError}</div>}
      </div>
      <FieldEditor fields={table.fields} onChange={handleFieldsChange} />
      <RowEditor
        fields={table.fields}
        rows={table.rows}
        onChange={(rows) => updateTable({ rows })}
        modelId={modelId}
      />
    </div>
  );
}
