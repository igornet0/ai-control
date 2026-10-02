import React from 'react';
import {
  normalizeColumnDataType,
  prepareDateInputForControl,
  columnDefaultBooleanSelectValue,
} from './spreadsheetGridUtils';
import SpreadsheetFormulaInput from './SpreadsheetFormulaInput';
import s from './SpreadsheetTemplatePanel.module.css';

const BOOL_OPTIONS = [
  { value: '', label: '—' },
  { value: 'да', label: 'да' },
  { value: 'нет', label: 'нет' },
  { value: '1', label: '1 (да)' },
  { value: '0', label: '0 (нет)' },
];

function isDefaultFormulaMode(value) {
  const s = String(value ?? '').trim();
  return s.startsWith('=');
}

function stopGridPointer(e, onMouseDown) {
  e.stopPropagation();
  onMouseDown?.(e);
}

/**
 * Значение по умолчанию столбца в шаблоне: литерал или формула (=ЕСЛИ, =DATE, =TODAY).
 */
export default function SpreadsheetColumnDefaultInput({
  dataType,
  value,
  onChange,
  columnLabel,
  onMouseDown,
}) {
  const dt = normalizeColumnDataType(dataType);
  const formula = isDefaultFormulaMode(value);

  const toggleFormula = () => {
    if (formula) onChange('');
    else onChange('=');
  };

  const wrapProps = {
    className: s.colDefaultWrap,
    onMouseDown: (e) => stopGridPointer(e, onMouseDown),
    onClick: (e) => e.stopPropagation(),
  };

  const formulaBtn = (
    <button
      type="button"
      className={`${s.colDefaultFormulaBtn} ${formula ? s.colDefaultFormulaBtnActive : ''}`}
      title={formula ? 'Обычное значение' : 'Формула (=ЕСЛИ, =DATE, =TODAY)'}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleFormula();
      }}
    >
      ƒ
    </button>
  );

  if (formula) {
    const placeholder = dt === 'boolean'
      ? '=ЕСЛИ(B>0, 1, 0)'
      : dt === 'date'
        ? '=DATE(2026,1,15) или =TODAY()'
        : '=...';
    return (
      <div {...wrapProps}>
        <SpreadsheetFormulaInput
          className={s.colDefaultInput}
          value={value ?? ''}
          onChange={onChange}
          onMouseDown={(e) => stopGridPointer(e, onMouseDown)}
          placeholder={placeholder}
          title="Формула для новых строк (ссылки B, C — текущая строка)"
          aria-label={`Формула по умолчанию столбца ${columnLabel}`}
        />
        {formulaBtn}
      </div>
    );
  }

  if (dt === 'boolean') {
    return (
      <div {...wrapProps}>
        <select
          className={s.colDefaultInput}
          value={columnDefaultBooleanSelectValue(value)}
          onChange={(e) => onChange(e.target.value)}
          title="Значение для новых строк: да/нет или формула через ƒ"
          aria-label={`Значение по умолчанию столбца ${columnLabel}`}
        >
          {BOOL_OPTIONS.map((o) => (
            <option key={o.value || 'empty'} value={o.value}>{o.label}</option>
          ))}
        </select>
        {formulaBtn}
      </div>
    );
  }

  if (dt === 'date') {
    const prep = prepareDateInputForControl(value);
    return (
      <div {...wrapProps}>
        {prep.useNative ? (
          <input
            className={s.colDefaultInput}
            type="date"
            value={prep.value}
            onChange={(e) => onChange(e.target.value)}
            title="Дата для новых строк или формула через ƒ"
            aria-label={`Дата по умолчанию столбца ${columnLabel}`}
          />
        ) : (
          <input
            className={s.colDefaultInput}
            type="text"
            value={prep.value}
            placeholder="ДД.ММ.ГГГГ"
            onChange={(e) => onChange(e.target.value)}
            title="Дата для новых строк или формула через ƒ"
            aria-label={`Дата по умолчанию столбца ${columnLabel}`}
          />
        )}
        {formulaBtn}
      </div>
    );
  }

  return (
    <div {...wrapProps}>
      <input
        className={s.colDefaultInput}
        type="text"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="По умолчанию"
        title="Значение для новых строк (можно формула через ƒ)"
        aria-label={`Значение по умолчанию столбца ${columnLabel}`}
      />
      {formulaBtn}
    </div>
  );
}
