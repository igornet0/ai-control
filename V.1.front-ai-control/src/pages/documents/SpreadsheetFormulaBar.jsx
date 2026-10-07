import React, { forwardRef, useMemo } from 'react';
import SpreadsheetFormulaInput from './SpreadsheetFormulaInput';
import FormulaReferenceButton from './FormulaReferencePopover';
import { formatSheetCellRef, isCellFormula, resolveCellDisplayValue } from './spreadsheetCellFormula';
import { excelColumnLabel } from './spreadsheetGridUtils';
import styles from './DocumentsApp.module.css';

/**
 * Always-visible formula bar: name box + fx + editor + live result.
 */
const SpreadsheetFormulaBar = forwardRef(function SpreadsheetFormulaBar({
  selected,
  value,
  onChange,
  onFocus,
  onBlur,
  onKeyDown,
  model,
  tableColumns,
  workbook = null,
  sheetName = null,
  viewSheetName = null,
  readOnly = false,
  resultPreview = null,
}, ref) {
  const addr = useMemo(() => {
    if (!selected) return '—';
    return formatSheetCellRef(selected.r, selected.c, sheetName, viewSheetName)
      || `${excelColumnLabel(selected.c)}${selected.r + 1}`;
  }, [selected, sheetName, viewSheetName]);

  const isFormula = isCellFormula(value) || String(value ?? '').startsWith('=');
  // Пока введено только «=» — результата ещё нет (раньше показывалось «= =»).
  const preview = resultPreview != null
    ? resultPreview
    : (isCellFormula(value) && model && selected
      ? resolveCellDisplayValue(value, model, selected.r, selected.c, tableColumns, workbook)
      : '');

  return (
    <div className={styles.spreadsheetFormulaBarDock} data-formula-bar-dock="1" data-formula-editing={isFormula ? '1' : '0'}>
      <div className={styles.spreadsheetFormulaNameBox} title="Адрес ячейки">
        {addr}
      </div>
      <span className={styles.spreadsheetFormulaFx} title="Формула начинается с =">ƒx</span>
      <label className={styles.spreadsheetFormulaBar} title="Введите значение или формулу (=A1, =Лист2!B3, =СУММ(B2:B10))">
        <SpreadsheetFormulaInput
          ref={ref}
          className={styles.spreadsheetFormulaInput}
          value={value ?? ''}
          onChange={onChange}
          onFocus={onFocus}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          spellCheck={false}
          aria-label="Строка формулы"
          title={readOnly ? 'Только просмотр' : 'Клик по ячейке вставляет ссылку в формулу'}
        />
      </label>
      {isFormula && (
        <span className={styles.spreadsheetFormulaResult} title="Результат формулы">
          {preview !== '' ? `= ${preview}` : '…'}
        </span>
      )}
      <FormulaReferenceButton />
    </div>
  );
});

SpreadsheetFormulaBar.displayName = 'SpreadsheetFormulaBar';

export default SpreadsheetFormulaBar;
