/**
 * Итоговая строка таблицы (footer / summary) — расширяемая модель и безопасные формулы.
 */
import {
  excelColumnLabel,
  getCellState,
  gridModelToTableColumns,
  normalizeColumnDataType,
  parseNumericCellValue,
} from './spreadsheetGridUtils';
import {
  evaluateCellFormula,
  formatFormulaNumber,
  isCellFormula,
} from './spreadsheetCellFormula';

export const SUMMARY_TYPES = [
  { value: 'none', label: 'Нет' },
  { value: 'sum', label: 'Сумма' },
  { value: 'avg', label: 'Среднее' },
  { value: 'min', label: 'Минимум' },
  { value: 'max', label: 'Максимум' },
  { value: 'count', label: 'Количество заполненных' },
  { value: 'formula', label: 'Формула' },
  { value: 'custom_text', label: 'Произвольный текст' },
];

const NUMERIC_DATA_TYPES = new Set(['number', 'int', 'float', 'currency', 'percent']);

const DEFAULT_COLUMN_SUMMARY = { type: 'none', formula: '', customText: '' };

/** @returns {{ enabled: boolean, columns: Record<string, { type: string, formula?: string, customText?: string }> }} */
export function createDefaultSummary() {
  return { enabled: false, columns: {} };
}

export function normalizeColumnSummaryConfig(raw) {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_COLUMN_SUMMARY };
  const type = SUMMARY_TYPES.some((t) => t.value === raw.type) ? raw.type : 'none';
  return {
    type,
    formula: raw.formula != null ? String(raw.formula) : '',
    customText: raw.customText != null ? String(raw.customText) : '',
  };
}

/**
 * @param {unknown} summary
 * @param {Array<{ key: string }>} tableColumns
 */
export function normalizeSummaryConfig(summary, tableColumns = []) {
  const cols = Array.isArray(tableColumns) ? tableColumns : [];
  const src = summary && typeof summary === 'object' ? summary : {};
  const columns = { ...(src.columns && typeof src.columns === 'object' ? src.columns : {}) };
  cols.forEach((col) => {
    const key = col?.key;
    if (!key) return;
    columns[key] = normalizeColumnSummaryConfig(columns[key]);
  });
  Object.keys(columns).forEach((key) => {
    if (!cols.some((c) => c.key === key)) delete columns[key];
  });
  return {
    enabled: !!src.enabled,
    columns,
  };
}

export function setSummaryEnabled(model, enabled, tableColumns) {
  const summary = normalizeSummaryConfig(
    { ...normalizeSummaryConfig(model?.summary, tableColumns), enabled: !!enabled },
    tableColumns,
  );
  return { ...model, summary };
}

export function patchSummaryColumn(model, colKey, patch, tableColumns) {
  const summary = normalizeSummaryConfig(model?.summary, tableColumns);
  const prev = normalizeColumnSummaryConfig(summary.columns[colKey]);
  summary.columns[colKey] = normalizeColumnSummaryConfig({ ...prev, ...patch });
  return { ...model, summary };
}

function getDataRowBounds(model) {
  const rowCount = model.rowCount || 0;
  const dataStart = model.hasHeaderRow ? 1 : 0;
  return { dataStart, dataEnd: rowCount - 1, rowCount };
}

function cellRawValue(model, r, c) {
  return getCellState(model.cells || {}, r, c).value;
}

/**
 * Числовое значение ячейки для агрегатов итога: константа или результат формулы.
 * @returns {{ numeric: number|null, filled: boolean }}
 */
function cellNumericForSummary(model, r, c, tableColumns, workbook = null) {
  const raw = cellRawValue(model, r, c);
  if (!isFilledValue(raw)) return { numeric: null, filled: false };

  const col = tableColumns[c];
  if (isCellFormula(raw)) {
    const result = evaluateCellFormula(
      raw,
      model,
      r,
      c,
      tableColumns,
      new Set(),
      workbook,
    );
    if (result == null) return { numeric: null, filled: true };
    if (typeof result === 'number') {
      return { numeric: Number.isFinite(result) ? result : null, filled: true };
    }
    const asStr = typeof result === 'string' ? result : formatFormulaNumber(result);
    return { numeric: parseNumericCellValue(asStr, col?.dataType), filled: true };
  }

  if (shouldParseAsNumeric(col?.dataType)) {
    return { numeric: parseNumericCellValue(raw, col?.dataType), filled: true };
  }
  return { numeric: null, filled: true };
}

function isFilledValue(raw) {
  return raw != null && String(raw).trim() !== '';
}

function shouldParseAsNumeric(dataType) {
  const dt = normalizeColumnDataType(dataType);
  return NUMERIC_DATA_TYPES.has(dt) || dt === 'string';
}

/** @param {object} model @param {number} colIndex */
export function collectColumnValues(model, colIndex, tableColumns, workbook = null) {
  const cols = tableColumns || gridModelToTableColumns(model);
  const col = cols[colIndex];
  if (!col) return { numbers: [], filledCount: 0 };
  const { dataStart, dataEnd } = getDataRowBounds(model);
  const numbers = [];
  let filledCount = 0;
  for (let r = dataStart; r <= dataEnd; r += 1) {
    const { numeric, filled } = cellNumericForSummary(model, r, colIndex, cols, workbook);
    if (!filled) continue;
    filledCount += 1;
    if (numeric != null) numbers.push(numeric);
  }
  return { numbers, filledCount };
}

function runAggregate(type, numbers, filledCount) {
  if (type === 'count') return filledCount;
  if (!numbers.length) return null;
  if (type === 'sum') return numbers.reduce((a, b) => a + b, 0);
  if (type === 'avg') return numbers.reduce((a, b) => a + b, 0) / numbers.length;
  if (type === 'min') return Math.min(...numbers);
  if (type === 'max') return Math.max(...numbers);
  return null;
}

function formatNumber(n) {
  if (n == null || Number.isNaN(n)) return '';
  if (Number.isInteger(n)) return String(n);
  const rounded = Math.round(n * 10000) / 10000;
  return String(rounded);
}

function parseCellRef(ref) {
  const m = String(ref).trim().toUpperCase().match(/^([A-Z]+)(\d+)$/);
  if (!m) return null;
  const letters = m[1];
  let col = 0;
  for (let i = 0; i < letters.length; i += 1) {
    col = col * 26 + (letters.charCodeAt(i) - 64);
  }
  return { r: parseInt(m[2], 10) - 1, c: col - 1 };
}

function sumRange(model, startRef, endRef, workbook = null) {
  const a = parseCellRef(startRef);
  const b = parseCellRef(endRef);
  if (!a || !b) return 0;
  const r0 = Math.min(a.r, b.r);
  const r1 = Math.max(a.r, b.r);
  const c0 = Math.min(a.c, b.c);
  const c1 = Math.max(a.c, b.c);
  const cols = gridModelToTableColumns(model);
  let total = 0;
  for (let r = r0; r <= r1; r += 1) {
    for (let c = c0; c <= c1; c += 1) {
      const { numeric } = cellNumericForSummary(model, r, c, cols, workbook);
      if (numeric != null) total += numeric;
    }
  }
  return total;
}

function avgRange(model, a, b, workbook = null) {
  const s = sumRange(model, a, b, workbook);
  const pa = parseCellRef(a);
  const pb = parseCellRef(b);
  if (!pa || !pb) return 0;
  const rows = Math.abs(pb.r - pa.r) + 1;
  const cols = Math.abs(pb.c - pa.c) + 1;
  const cnt = rows * cols;
  return cnt ? s / cnt : 0;
}

function expandExcelFunctions(expr, model, workbook = null) {
  let out = expr;
  out = out.replace(/SUM\s*\(\s*([A-Za-z]+\d+)\s*:\s*([A-Za-z]+\d+)\s*\)/gi, (_, a, b) => String(sumRange(model, a, b, workbook)));
  out = out.replace(/AVG\s*\(\s*([A-Za-z]+\d+)\s*:\s*([A-Za-z]+\d+)\s*\)/gi, (_, a, b) => String(avgRange(model, a, b, workbook)));
  out = out.replace(/MIN\s*\(\s*([A-Za-z]+\d+)\s*:\s*([A-Za-z]+\d+)\s*\)/gi, (_, a, b) => {
    const nums = rangeNumbers(model, a, b, workbook);
    return nums.length ? String(Math.min(...nums)) : '0';
  });
  out = out.replace(/MAX\s*\(\s*([A-Za-z]+\d+)\s*:\s*([A-Za-z]+\d+)\s*\)/gi, (_, a, b) => {
    const nums = rangeNumbers(model, a, b, workbook);
    return nums.length ? String(Math.max(...nums)) : '0';
  });
  out = out.replace(/COUNT\s*\(\s*([A-Za-z]+\d+)\s*:\s*([A-Za-z]+\d+)\s*\)/gi, (_, a, b) => String(countRangeFilled(model, a, b)));
  return out;
}

function rangeNumbers(model, startRef, endRef, workbook = null) {
  const a = parseCellRef(startRef);
  const b = parseCellRef(endRef);
  if (!a || !b) return [];
  const r0 = Math.min(a.r, b.r);
  const r1 = Math.max(a.r, b.r);
  const c0 = Math.min(a.c, b.c);
  const c1 = Math.max(a.c, b.c);
  const cols = gridModelToTableColumns(model);
  const nums = [];
  for (let r = r0; r <= r1; r += 1) {
    for (let c = c0; c <= c1; c += 1) {
      const { numeric } = cellNumericForSummary(model, r, c, cols, workbook);
      if (numeric != null) nums.push(numeric);
    }
  }
  return nums;
}

function countRangeFilled(model, startRef, endRef) {
  const a = parseCellRef(startRef);
  const b = parseCellRef(endRef);
  if (!a || !b) return 0;
  const r0 = Math.min(a.r, b.r);
  const r1 = Math.max(a.r, b.r);
  const c0 = Math.min(a.c, b.c);
  const c1 = Math.max(a.c, b.c);
  let n = 0;
  for (let r = r0; r <= r1; r += 1) {
    for (let c = c0; c <= c1; c += 1) {
      if (isFilledValue(cellRawValue(model, r, c))) n += 1;
    }
  }
  return n;
}

/** Агрегаты по столбцам для подстановки в формулы (A_SUM, col_0_AVG, FOOTER_col_0). */
export function buildSummaryVariableMap(model, tableColumns, footerValues = {}, workbook = null) {
  const cols = tableColumns || gridModelToTableColumns(model);
  const vars = { ...footerValues };
  const aggSuffixes = ['SUM', 'AVG', 'MIN', 'MAX', 'COUNT'];
  cols.forEach((col, c) => {
    const { numbers, filledCount } = collectColumnValues(model, c, cols, workbook);
    const aggs = {
      SUM: runAggregate('sum', numbers, filledCount),
      AVG: runAggregate('avg', numbers, filledCount),
      MIN: runAggregate('min', numbers, filledCount),
      MAX: runAggregate('max', numbers, filledCount),
      COUNT: runAggregate('count', numbers, filledCount),
    };
    const letter = excelColumnLabel(c);
    aggSuffixes.forEach((suffix) => {
      const val = aggs[suffix];
      if (val != null) {
        vars[`${letter}_${suffix}`] = val;
        vars[`${col.key}_${suffix}`] = val;
      }
    });
  });
  return vars;
}

function tokenize(expr) {
  const tokens = [];
  let i = 0;
  const s = expr.replace(/\s+/g, '');
  while (i < s.length) {
    const ch = s[i];
    if ('+-*/()'.includes(ch)) {
      tokens.push({ t: ch });
      i += 1;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j += 1;
      tokens.push({ t: 'num', v: parseFloat(s.slice(i, j)) });
      i = j;
      continue;
    }
    if (/[A-Za-z_][A-Za-z0-9_]*/.test(ch)) {
      let j = i;
      while (j < s.length && /[A-Za-z0-9_]/.test(s[j])) j += 1;
      tokens.push({ t: 'id', v: s.slice(i, j).toUpperCase() });
      i = j;
      continue;
    }
    i += 1;
  }
  return tokens;
}

function evaluateTokens(tokens, vars) {
  let pos = 0;
  const peek = () => tokens[pos];
  const consume = () => tokens[pos++];

  function parseExpr() {
    let left = parseTerm();
    while (peek() && (peek().t === '+' || peek().t === '-')) {
      const op = consume().t;
      const right = parseTerm();
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  function parseTerm() {
    let left = parseUnary();
    while (peek() && (peek().t === '*' || peek().t === '/')) {
      const op = consume().t;
      const right = parseUnary();
      left = op === '*' ? left * right : left / right;
    }
    return left;
  }

  function parseUnary() {
    if (peek()?.t === '-') {
      consume();
      return -parseUnary();
    }
    if (peek()?.t === '+') {
      consume();
      return parseUnary();
    }
    return parsePrimary();
  }

  function parsePrimary() {
    const tok = peek();
    if (!tok) return 0;
    if (tok.t === 'num') {
      consume();
      return tok.v;
    }
    if (tok.t === 'id') {
      consume();
      const key = tok.v;
      if (Object.prototype.hasOwnProperty.call(vars, key)) return Number(vars[key]) || 0;
      if (Object.prototype.hasOwnProperty.call(vars, tok.v)) return Number(vars[tok.v]) || 0;
      return 0;
    }
    if (tok.t === '(') {
      consume();
      const v = parseExpr();
      if (peek()?.t === ')') consume();
      return v;
    }
    return 0;
  }

  const result = parseExpr();
  return Number.isFinite(result) ? result : 0;
}

export function evaluateSummaryFormula(formula, model, tableColumns, footerValues, workbook = null) {
  if (!formula || !String(formula).trim()) return null;
  let expr = String(formula).trim();
  if (expr.startsWith('=')) expr = expr.slice(1);
  try {
    expr = expandExcelFunctions(expr, model, workbook);
    const vars = buildSummaryVariableMap(model, tableColumns, footerValues, workbook);
    const tokens = tokenize(expr);
    if (!tokens.length) return null;
    return evaluateTokens(tokens, vars);
  } catch {
    return null;
  }
}

/**
 * @returns {Record<string, string>|null} отображаемые значения по col.key
 */
export function computeSummaryRow(model, workbook = null) {
  const summary = normalizeSummaryConfig(model?.summary, gridModelToTableColumns(model));
  if (!summary.enabled) return null;
  const tableColumns = gridModelToTableColumns(model);
  const footerNumeric = {};
  const out = {};

  tableColumns.forEach((col, c) => {
    const cfg = normalizeColumnSummaryConfig(summary.columns[col.key]);
    const { numbers, filledCount } = collectColumnValues(model, c, tableColumns, workbook);

    if (cfg.type === 'none') {
      out[col.key] = '';
      return;
    }
    if (cfg.type === 'custom_text') {
      out[col.key] = cfg.customText || '';
      return;
    }
    if (cfg.type === 'formula') {
      out[col.key] = '';
      return;
    }
    const agg = runAggregate(cfg.type, numbers, filledCount);
    out[col.key] = agg == null ? '' : formatNumber(agg);
    if (agg != null) footerNumeric[`FOOTER_${col.key}`] = agg;
  });

  tableColumns.forEach((col) => {
    const cfg = normalizeColumnSummaryConfig(summary.columns[col.key]);
    if (cfg.type !== 'formula') return;
    const vars = buildSummaryVariableMap(model, tableColumns, footerNumeric, workbook);
    const val = evaluateSummaryFormula(cfg.formula, model, tableColumns, vars, workbook);
    const display = val == null ? '' : formatNumber(val);
    out[col.key] = display;
    if (val != null) footerNumeric[`FOOTER_${col.key}`] = val;
  });

  return out;
}

export function previewSummaryColumn(model, colKey, workbook = null) {
  const row = computeSummaryRow(model, workbook);
  if (!row) return '';
  return row[colKey] ?? '';
}

/** Сдвиг/удаление ключей columns при удалении столбца */
export { parseNumericCellValue } from './spreadsheetGridUtils';

export function remapSummaryColumnsAfterColDelete(summary, deletedIndex, tableColumns) {
  const cols = [...(tableColumns || [])];
  if (deletedIndex < 0 || deletedIndex >= cols.length) return summary;
  const nextCols = cols.filter((_, i) => i !== deletedIndex);
  const oldKeys = cols.map((c) => c.key);
  const newColumns = {};
  nextCols.forEach((col, i) => {
    const oldIdx = i >= deletedIndex ? i + 1 : i;
    const oldKey = oldKeys[oldIdx];
    if (oldKey && summary.columns[oldKey]) {
      newColumns[col.key] = summary.columns[oldKey];
    } else {
      newColumns[col.key] = normalizeColumnSummaryConfig(summary.columns[col.key]);
    }
  });
  return { ...summary, columns: newColumns };
}

export function remapSummaryColumnsAfterColInsert(summary, insertIndex, tableColumns) {
  return normalizeSummaryConfig(summary, tableColumns);
}
