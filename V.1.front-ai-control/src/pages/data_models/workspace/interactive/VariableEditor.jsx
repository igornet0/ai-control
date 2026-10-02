import React from 'react';
import { VARIABLE_TYPES, sanitizeIdentifier, validateIdentifier } from './schema.js';
import styles from './InteractiveDataSource.module.css';

export default function VariableEditor({ variable, onChange }) {
  const nameError = validateIdentifier(variable.name);

  const renderValueInput = () => {
    switch (variable.type) {
      case 'bool':
        return (
          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={variable.value === true || variable.value === 'true'}
              onChange={(e) => onChange({ value: e.target.checked })}
            />
            <span>{variable.value ? 'true' : 'false'}</span>
          </label>
        );
      case 'int':
      case 'float':
        return (
          <input
            type="number"
            step={variable.type === 'float' ? 'any' : '1'}
            className={styles.input}
            value={variable.value ?? ''}
            onChange={(e) => onChange({ value: e.target.value })}
          />
        );
      case 'array':
      case 'object':
        return (
          <textarea
            className={styles.textarea}
            rows={5}
            value={
              typeof variable.value === 'object'
                ? JSON.stringify(variable.value, null, 2)
                : String(variable.value ?? variable.type === 'array' ? '[]' : '{}')
            }
            onChange={(e) => onChange({ value: e.target.value })}
            placeholder={variable.type === 'array' ? '[1, 2, 3]' : '{"key": "value"}'}
          />
        );
      default:
        return (
          <input
            type="text"
            className={styles.input}
            value={variable.value ?? ''}
            onChange={(e) => onChange({ value: e.target.value })}
            placeholder="Значение"
          />
        );
    }
  };

  return (
    <div className={styles.variableEditor}>
      <div className={styles.fieldGroup}>
        <label className={styles.label}>Имя переменной</label>
        <input
          className={`${styles.input} ${nameError ? styles.inputInvalid : ''}`}
          value={variable.name}
          onChange={(e) => onChange({ name: sanitizeIdentifier(e.target.value, variable.name) })}
          placeholder="my_variable"
        />
        {nameError && <div className={styles.validationError}>{nameError}</div>}
      </div>
      <div className={styles.fieldGroup}>
        <label className={styles.label}>Тип</label>
        <select
          className={styles.select}
          value={variable.type}
          onChange={(e) => onChange({ type: e.target.value })}
        >
          {VARIABLE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>
      <div className={styles.fieldGroup}>
        <label className={styles.label}>Значение</label>
        {renderValueInput()}
      </div>
    </div>
  );
}
