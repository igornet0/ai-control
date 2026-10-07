/**
 * Формулы в ячейках таблиц документа — фасад над spreadsheetFormulaEngine.
 *
 * Синтаксис как в Excel / Google Таблицах: =B2*D2, =СУММ(B2:B10; 5), =ЕСЛИ(И(A2>5; B2="да"); 1; 0),
 * =ВПР(A2; Прайс!A:C; 3; ЛОЖЬ), $A$1, Лист2!B3, 'Лист 2'!A1:B5. Аргументы через «;» или «,».
 * Старые формулы работают как раньше: =B*D (ячейки текущей строки), =СУММ(B) (весь столбец).
 */
import {
  cellKey,
  excelColumnLabel,
  getEffectiveCellValue,
  gridModelToTableColumns,
  normalizeColumnDataType,
} from './spreadsheetGridUtils';
import {
  ERROR_MESSAGES,
  createFormulaSession,
  dateToExcelSerial,
  evaluateFormula,
  excelSerialToIsoDate,
  excelSerialToRuDate,
  isEmpty,
  isError,
  todayExcelSerial,
} from './spreadsheetFormulaEngine';
import { extractFormulaReferences, isFormulaText } from './spreadsheetFormulaTokens';

export { dateToExcelSerial, todayExcelSerial, excelSerialToIsoDate };

export function isCellFormula(raw) {
  return isFormulaText(raw);
}

export function formatFormulaNumber(n) {
  if (n == null || Number.isNaN(n)) return '';
  if (typeof n === 'boolean') return n ? '1' : '0';
  if (Number.isInteger(n)) return String(n);
  const rounded = Math.round(n * 10000) / 10000;
  return String(rounded);
}

const ERROR_CODE_RE = /^#(DIV\/0!|VALUE!|REF!|NAME\?|N\/A|NUM!|ERROR!)$/;

/** Текст результата — код ошибки формулы (#DIV/0!, #REF!…). */
export function isFormulaErrorText(value) {
  return typeof value === 'string' && ERROR_CODE_RE.test(value);
}

export function describeFormulaError(code) {
  return ERROR_MESSAGES[code] || 'Ошибка в формуле';
}

function withColumns(model, tableColumns) {
  if (!model) return model;
  if (Array.isArray(model.tableColumns) && model.tableColumns.length > 0) return model;
  if (!Array.isArray(tableColumns) || tableColumns.length === 0) return model;
  return { ...model, tableColumns };
}

/**
 * Подробный результат: { value, isDate, error?: { code, message } }.
 * value: number | string | boolean | null (пусто); при ошибке value — код ошибки.
 */
export function evaluateCellFormulaDetailed(formula, model, row, col, tableColumns, workbook = null, session = null) {
  if (!isCellFormula(formula)) return { value: null, isDate: false };
  const m = withColumns(model, tableColumns || gridModelToTableColumns(model));
  const { value, isDate } = evaluateFormula(formula, m, row, col, workbook, session ? { shared: session } : {});
  if (isError(value)) return { value: value.code, isDate: false, error: { code: value.code, message: value.message } };
  if (isEmpty(value) || value == null) return { value: null, isDate: false };
  return { value, isDate };
}

/**
 * @returns {number|string|boolean|null} число, текст, логическое, код ошибки («#DIV/0!») или null для пустого.
 */
export function evaluateCellFormula(formula, model, row, col, tableColumns, _visiting = null, workbook = null) {
  return evaluateCellFormulaDetailed(formula, model, row, col, tableColumns, workbook).value;
}

function displayFromResult(result, dataType) {
  const { value, isDate } = result;
  if (value == null) return '';
  if (result.error) return value;
  const dt = normalizeColumnDataType(dataType);
  if (typeof value === 'boolean') {
    if (dt === 'boolean') return value ? 'да' : 'нет';
    return value ? 'ИСТИНА' : 'ЛОЖЬ';
  }
  if (typeof value === 'string') return value;
  if (dt === 'boolean') {
    if (Math.abs(value) < 1e-9) return 'нет';
    return 'да';
  }
  if (dt === 'date') return excelSerialToIsoDate(value) || formatFormulaNumber(value);
  if (isDate) return excelSerialToRuDate(value) || formatFormulaNumber(value);
  return formatFormulaNumber(value);
}

export function resolveCellDisplayValue(raw, model, row, col, tableColumns, workbook = null, session = null) {
  if (!isCellFormula(raw)) return raw != null ? String(raw) : '';
  const cols = tableColumns || gridModelToTableColumns(model);
  const result = evaluateCellFormulaDetailed(raw, model, row, col, cols, workbook, session);
  return displayFromResult(result, cols[col]?.dataType);
}

/** @returns {Record<string, string>} отображаемые значения всех формул листа */
export function computeFormulaDisplayMap(model, tableColumns, workbook = null) {
  const cols = tableColumns || gridModelToTableColumns(model);
  const m = withColumns(model, cols);
  const { rowCount = 0, colCount = 0, hasHeaderRow, cells = {} } = m;
  const dataStart = hasHeaderRow ? 1 : 0;
  // Общий кеш: зависимости вычисляются один раз на весь лист.
  const session = createFormulaSession(workbook, m);
  const out = {};
  for (let r = dataStart; r < rowCount; r += 1) {
    for (let c = 0; c < colCount; c += 1) {
      const raw = getEffectiveCellValue(cells, r, c, cols, !!hasHeaderRow);
      if (isCellFormula(raw)) {
        out[cellKey(r, c)] = resolveCellDisplayValue(raw, m, r, c, cols, workbook, session);
      }
    }
  }
  return out;
}

/** Ошибки формул листа: { "r-c": { code, message } } — для подсказок в ячейках. */
export function computeFormulaErrorMap(model, tableColumns, workbook = null) {
  const cols = tableColumns || gridModelToTableColumns(model);
  const m = withColumns(model, cols);
  const { rowCount = 0, colCount = 0, hasHeaderRow, cells = {} } = m;
  const session = createFormulaSession(workbook, m);
  const out = {};
  for (let r = hasHeaderRow ? 1 : 0; r < rowCount; r += 1) {
    for (let c = 0; c < colCount; c += 1) {
      const raw = getEffectiveCellValue(cells, r, c, cols, !!hasHeaderRow);
      if (!isCellFormula(raw)) continue;
      const res = evaluateCellFormulaDetailed(raw, m, r, c, cols, workbook, session);
      if (res.error) out[cellKey(r, c)] = res.error;
    }
  }
  return out;
}

function needsSheetQuotes(name) {
  return /[\s'!]/.test(name) || !/^[\p{L}\p{N}_]+$/u.test(name);
}

function sheetPrefix(sheetName) {
  return needsSheetQuotes(sheetName) ? `'${sheetName.replace(/'/g, "''")}'` : sheetName;
}

/** Ссылка для UI: A1 или 'Лист 2'!B3 */
export function formatSheetCellRef(r, c, sheetName = null, currentSheetName = null) {
  const addr = `${excelColumnLabel(c)}${r + 1}`;
  if (!sheetName || (currentSheetName && sheetName === currentSheetName)) return addr;
  return `${sheetPrefix(sheetName)}!${addr}`;
}

/** Диапазон: A1:B3 или Лист2!A1:B3 */
export function formatSheetRangeRef(r0, c0, r1, c1, sheetName = null, currentSheetName = null) {
  const rr0 = Math.min(r0, r1);
  const rr1 = Math.max(r0, r1);
  const cc0 = Math.min(c0, c1);
  const cc1 = Math.max(c0, c1);
  if (rr0 === rr1 && cc0 === cc1) {
    return formatSheetCellRef(rr0, cc0, sheetName, currentSheetName);
  }
  const range = `${excelColumnLabel(cc0)}${rr0 + 1}:${excelColumnLabel(cc1)}${rr1 + 1}`;
  if (!sheetName || (currentSheetName && sheetName === currentSheetName)) return range;
  return `${sheetPrefix(sheetName)}!${range}`;
}

/** Ячейки-ссылки формулы (левый верхний угол каждой ссылки) — совместимость со старым API. */
export function extractFormulaCellRefs(formula) {
  return extractFormulaReferences(formula)
    .filter((ref) => ref.kind === 'cell' || ref.kind === 'range')
    .map((ref) => ({ sheetName: ref.sheetName || null, r: ref.r0, c: ref.c0 }));
}

export { extractFormulaReferences };

export function columnIndexToLabel(c) {
  return excelColumnLabel(c);
}
