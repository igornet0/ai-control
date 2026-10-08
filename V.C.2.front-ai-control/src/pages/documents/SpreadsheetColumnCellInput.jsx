import React, { forwardRef, useState } from 'react';
import {
  resolveSpreadsheetCellInputDescriptor,
  prepareDateInputForControl,
  booleanToSelectValue,
  valueFromBooleanSelect,
  effectiveCellTextAlign,
} from './spreadsheetGridUtils';
import { isCellFormula } from './spreadsheetCellFormula';
import SpreadsheetFormulaInput from './SpreadsheetFormulaInput';

/** @typedef {'up' | 'down' | 'left' | 'right'} NavigateDirection */

function handleArrowNavigate(e, onNavigate, { allowVertical = true } = {}) {
  if (!onNavigate || e.defaultPrevented) return;
  const el = e.target;
  const isTextInput = el instanceof HTMLInputElement && el.type !== 'date';
  const extend = !!e.shiftKey;

  if (e.key === 'ArrowUp' && allowVertical) {
    e.preventDefault();
    onNavigate('up', { extend });
    return;
  }
  if (e.key === 'ArrowDown' && allowVertical) {
    e.preventDefault();
    onNavigate('down', { extend });
    return;
  }
  if (e.key === 'ArrowLeft') {
    if (!isTextInput || (el.selectionStart === 0 && el.selectionEnd === 0)) {
      e.preventDefault();
      onNavigate('left', { extend });
    }
    return;
  }
  if (e.key === 'ArrowRight') {
    if (!isTextInput || (el.selectionStart === el.value.length && el.selectionEnd === el.value.length)) {
      e.preventDefault();
      onNavigate('right', { extend });
    }
  }
}

function isFormulaCellValue(raw) {
  return isCellFormula(raw);
}

function isFormulaDraftValue(raw) {
  const s = String(raw ?? '');
  return s.startsWith('=') && !isCellFormula(raw);
}

/**
 * Поле ввода ячейки с учётом типа столбца (dataType) и format-типа ячейки для столбца «текст».
 */
const SpreadsheetColumnCellInput = forwardRef(function SpreadsheetColumnCellInput({
  colDataType,
  displayType,
  inHeader,
  value: cellValue,
  align: cellAlign,
  bold,
  italic,
  onChange,
  onFocus,
  onMouseDown,
  onNavigate,
  className,
  errorClassName,
  title,
  invalid,
  ariaLabel,
  displayValue,
  readOnly = false,
  wrapText = false,
  onBlur,
  /** Раскрашивать ссылки формулы при правке (как рамки диапазонов на сетке). */
  highlightRefs = false,
}, ref) {
  const [focused, setFocused] = useState(false);
  const handleBlur = (e) => {
    setFocused(false);
    onBlur?.(e);
  };
  const isFormulaCell = isFormulaCellValue(cellValue);
  const isFormulaDraft = isFormulaDraftValue(cellValue);
  const useFormulaInput = isFormulaCell || isFormulaDraft;
  const formulaInputValue = (isFormulaCell && !focused && !isFormulaDraft)
    ? (displayValue ?? cellValue ?? '')
    : (cellValue ?? '');
  const desc = resolveSpreadsheetCellInputDescriptor(colDataType, displayType, inHeader);
  const align = effectiveCellTextAlign(cellAlign, desc.variant);
  const style = {
    textAlign: align === 'center' ? 'center' : align === 'right' ? 'right' : 'left',
    fontWeight: bold ? 'bold' : undefined,
    fontStyle: italic ? 'italic' : undefined,
  };
  const baseClass = `${className || ''} ${invalid && errorClassName ? errorClassName : ''}`.trim();
  const onKeyDown = (e) => handleArrowNavigate(e, onNavigate, { allowVertical: true });
  const handleMouseDown = (e) => {
    onMouseDown?.(e);
    if (onMouseDown) e.stopPropagation();
  };

  if (readOnly) {
    const display = (!focused && isFormulaCell && displayValue != null)
      ? String(displayValue)
      : (cellValue !== '' && cellValue != null ? String(cellValue) : '—');
    const readStyle = wrapText
      ? { ...style, whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'anywhere', display: 'block' }
      : style;
    return (
      <span className={baseClass} style={readStyle} title={title} aria-label={ariaLabel}>
        {display === '' ? '—' : display}
      </span>
    );
  }

  if (desc.variant === 'boolean' && !inHeader) {
    if (!isFormulaCell && !isFormulaDraft) {
      const raw = String(cellValue ?? '').trim();
      const selectValue = raw === '1' || raw === '0'
        ? (raw === '1' ? 'да' : 'нет')
        : booleanToSelectValue(cellValue);
      return (
        <select
          ref={ref}
          className={baseClass}
          style={style}
          value={selectValue}
          onChange={(e) => onChange(valueFromBooleanSelect(e.target.value))}
          onFocus={(e) => { setFocused(true); onFocus?.(e); }}
          onBlur={handleBlur}
          onMouseDown={handleMouseDown}
          onKeyDown={onKeyDown}
          title={title}
          aria-invalid={invalid ? true : undefined}
          aria-label={ariaLabel}
        >
          <option value="">—</option>
          <option value="да">да</option>
          <option value="нет">нет</option>
        </select>
      );
    }
  }

  // text/number/formula — один и тот же input, иначе при вводе «=» remount сбрасывает фокус
  const useStableTextInput = useFormulaInput
    || desc.variant === 'text'
    || desc.variant === 'number'
    || (desc.variant === 'date' && (useFormulaInput || String(cellValue ?? '').startsWith('=')));

  if (useStableTextInput) {
    return (
      <SpreadsheetFormulaInput
        ref={ref}
        className={baseClass}
        style={style}
        value={formulaInputValue}
        onChange={onChange}
        onFocus={(e) => { setFocused(true); onFocus?.(e); }}
        onBlur={handleBlur}
        onMouseDown={handleMouseDown}
        onKeyDown={onKeyDown}
        title={title}
        invalid={invalid}
        errorClassName={errorClassName}
        aria-label={ariaLabel}
        inputMode={desc.variant === 'number' && !useFormulaInput ? (desc.inputMode || 'decimal') : undefined}
        wrapText={wrapText}
        highlightRefs={highlightRefs && focused}
      />
    );
  }

  if (desc.variant === 'date') {
    const prep = prepareDateInputForControl(cellValue);
    if (prep.useNative) {
      return (
        <input
          ref={ref}
          className={baseClass}
          style={style}
          type="date"
          value={prep.value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={(e) => { setFocused(true); onFocus?.(e); }}
          onBlur={handleBlur}
          onMouseDown={handleMouseDown}
          onKeyDown={onKeyDown}
          title={title}
          aria-invalid={invalid ? true : undefined}
          aria-label={ariaLabel}
        />
      );
    }
    return (
      <input
        ref={ref}
        className={baseClass}
        style={style}
        type="text"
        value={prep.value}
        placeholder="ДД.ММ.ГГГГ или ГГГГ-ММ-ДД"
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => { setFocused(true); onFocus?.(e); }}
        onBlur={handleBlur}
        onMouseDown={handleMouseDown}
        onKeyDown={onKeyDown}
        title={title}
        aria-invalid={invalid ? true : undefined}
        aria-label={ariaLabel}
      />
    );
  }

  return (
    <SpreadsheetFormulaInput
      ref={ref}
      className={baseClass}
      style={style}
      value={formulaInputValue}
      onChange={onChange}
      onFocus={(e) => { setFocused(true); onFocus?.(e); }}
      onBlur={handleBlur}
      onMouseDown={handleMouseDown}
      onKeyDown={onKeyDown}
      title={title}
      invalid={invalid}
      errorClassName={errorClassName}
      aria-label={ariaLabel}
      wrapText={wrapText}
      highlightRefs={highlightRefs && focused}
    />
  );
});

export default SpreadsheetColumnCellInput;
