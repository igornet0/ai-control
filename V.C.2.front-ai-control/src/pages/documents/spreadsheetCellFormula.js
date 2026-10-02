/**
 * Формулы в ячейках документа: =B*D, =B2*D2, =SUM(B2:B10), =СУММ(B), =ЕСЛИ(C, B*D, 0) и т.п.
 * Буква столбца без номера строки — значение в той же строке, что и формула.
 * Агрегация по одной букве столбца (B) — вся колонка сверху донизу.
 */
import {
  cellKey,
  excelColumnLabel,
  getCellState,
  getEffectiveCellValue,
  gridModelToTableColumns,
  normalizeColumnDataType,
  parseNumericCellValue,
} from './spreadsheetGridUtils';

export function isCellFormula(raw) {
  const s = String(raw ?? '').trim();
  return s.startsWith('=') && s.length > 1;
}

export function formatFormulaNumber(n) {
  if (n == null || Number.isNaN(n)) return '';
  if (Number.isInteger(n)) return String(n);
  const rounded = Math.round(n * 10000) / 10000;
  return String(rounded);
}

export function dateToExcelSerial(year, month, day) {
  const y = Math.floor(Number(year));
  const m = Math.floor(Number(month));
  const d = Math.floor(Number(day));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return 0;
  const utc = Date.UTC(y, m - 1, d);
  const epoch = Date.UTC(1899, 11, 30);
  return Math.round((utc - epoch) / 86400000);
}

export function todayExcelSerial() {
  const now = new Date();
  return dateToExcelSerial(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function excelSerialToIsoDate(serial) {
  if (!Number.isFinite(serial)) return '';
  const epoch = Date.UTC(1899, 11, 30);
  const ms = epoch + Math.round(serial) * 86400000;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

function columnLabelToIndex(label) {
  const letters = String(label).toUpperCase();
  if (!/^[A-Z]+$/.test(letters)) return -1;
  let col = 0;
  for (let i = 0; i < letters.length; i += 1) {
    col = col * 26 + (letters.charCodeAt(i) - 64);
  }
  return col - 1;
}

function parseCellRef(ref) {
  const m = String(ref).trim().toUpperCase().match(/^([A-Z]+)(\d+)$/);
  if (!m) return null;
  const col = columnLabelToIndex(m[1]);
  if (col < 0) return null;
  return { r: parseInt(m[2], 10) - 1, c: col };
}

/** Resolve sheet by name (case-insensitive) from workbook.sheets */
function findSheetInWorkbook(workbook, sheetName) {
  const sheets = workbook?.sheets;
  if (!Array.isArray(sheets) || !sheetName) return null;
  const want = String(sheetName).trim().toLowerCase();
  return sheets.find((s) => String(s?.name || '').trim().toLowerCase() === want) || null;
}

/**
 * Parse A1, Sheet!A1, 'Sheet Name'!A1.
 * @returns {{ sheetName: string|null, r: number, c: number } | null}
 */
function parseSheetCellRef(ref) {
  const raw = String(ref ?? '').trim();
  if (!raw) return null;
  const withSheet = raw.match(/^(?:'([^']+)'|([^'!\n]+))!([A-Za-z]+\d+)$/u);
  if (withSheet) {
    const sheetName = (withSheet[1] || withSheet[2] || '').trim();
    const cell = parseCellRef(withSheet[3]);
    if (!cell || !sheetName) return null;
    return { sheetName, ...cell };
  }
  const cell = parseCellRef(raw);
  if (!cell) return null;
  return { sheetName: null, ...cell };
}

function resolveModelForSheetRef(sheetName, model, workbook) {
  if (!sheetName) return model;
  const sheet = findSheetInWorkbook(workbook, sheetName);
  return sheet || null;
}

function quoteFormulaString(s) {
  return `"${String(s).replace(/"/g, '""')}"`;
}

function formatBranchValue(v) {
  if (typeof v === 'string') return quoteFormulaString(v);
  if (v == null || Number.isNaN(v)) return '0';
  return String(v);
}

function isFilledValue(raw) {
  return raw != null && String(raw).trim() !== '';
}

function cellRawValue(model, r, c) {
  const cols = Array.isArray(model.tableColumns) && model.tableColumns.length > 0
    ? model.tableColumns
    : gridModelToTableColumns(model);
  const raw = getEffectiveCellValue(model.cells || {}, r, c, cols, !!model.hasHeaderRow);
  if (isFilledValue(raw)) return raw;
  // Header row: fall back to column title when cell is empty
  if (model.hasHeaderRow && r === 0) {
    const label = cols[c]?.label;
    if (isFilledValue(label)) return String(label);
  }
  return raw;
}

function shouldSkipAggregateCell(r, c, ctx, sheetModel = null) {
  if (!ctx?.excludeCell) return false;
  if (r !== ctx.excludeCell.r || c !== ctx.excludeCell.c) return false;
  // Only skip the formula cell on its own sheet (not same coords on another sheet)
  if (ctx.excludeSheetModel && sheetModel && ctx.excludeSheetModel !== sheetModel) return false;
  if (ctx.excludeSheetId && sheetModel?.id && ctx.excludeSheetId !== sheetModel.id) return false;
  return true;
}

function sumRange(model, startRef, endRef, ctx) {
  const a = parseCellRef(startRef);
  const b = parseCellRef(endRef);
  if (!a || !b) return 0;
  const r0 = Math.min(a.r, b.r);
  const r1 = Math.max(a.r, b.r);
  const c0 = Math.min(a.c, b.c);
  const c1 = Math.max(a.c, b.c);
  const cols = gridModelToTableColumns(model);
  const visiting = ctx?.visiting || new Set();
  const workbook = ctx?.workbook || null;
  let total = 0;
  for (let r = r0; r <= r1; r += 1) {
    for (let c = c0; c <= c1; c += 1) {
      if (shouldSkipAggregateCell(r, c, ctx, model)) continue;
      const n = getNumericAt(model, r, c, cols, visiting, workbook);
      if (n != null) total += n;
    }
  }
  return total;
}

function columnIndexFromLetters(colLetter) {
  return columnLabelToIndex(colLetter);
}

function iterateColumnCells(model, colLetter, visitor) {
  const c = columnIndexFromLetters(colLetter);
  if (c < 0) return;
  const rowCount = model.rowCount || 0;
  const cols = gridModelToTableColumns(model);
  for (let r = 0; r < rowCount; r += 1) {
    visitor(r, c, cols);
  }
}

function sumColumn(model, colLetter, ctx) {
  const visiting = ctx?.visiting || new Set();
  const workbook = ctx?.workbook || null;
  let total = 0;
  iterateColumnCells(model, colLetter, (r, c, cols) => {
    if (shouldSkipAggregateCell(r, c, ctx, model)) return;
    const n = getNumericAt(model, r, c, cols, visiting, workbook);
    if (n != null) total += n;
  });
  return total;
}

function avgColumn(model, colLetter, ctx) {
  const visiting = ctx?.visiting || new Set();
  const workbook = ctx?.workbook || null;
  const nums = [];
  iterateColumnCells(model, colLetter, (r, c, cols) => {
    if (shouldSkipAggregateCell(r, c, ctx, model)) return;
    const n = getNumericAt(model, r, c, cols, visiting, workbook);
    if (n != null) nums.push(n);
  });
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

function minColumn(model, colLetter, ctx) {
  const visiting = ctx?.visiting || new Set();
  const workbook = ctx?.workbook || null;
  const nums = [];
  iterateColumnCells(model, colLetter, (r, c, cols) => {
    if (shouldSkipAggregateCell(r, c, ctx, model)) return;
    const n = getNumericAt(model, r, c, cols, visiting, workbook);
    if (n != null) nums.push(n);
  });
  return nums.length ? Math.min(...nums) : 0;
}

function maxColumn(model, colLetter, ctx) {
  const visiting = ctx?.visiting || new Set();
  const workbook = ctx?.workbook || null;
  const nums = [];
  iterateColumnCells(model, colLetter, (r, c, cols) => {
    if (shouldSkipAggregateCell(r, c, ctx, model)) return;
    const n = getNumericAt(model, r, c, cols, visiting, workbook);
    if (n != null) nums.push(n);
  });
  return nums.length ? Math.max(...nums) : 0;
}

function countColumnFilled(model, colLetter, ctx) {
  let n = 0;
  iterateColumnCells(model, colLetter, (r, c) => {
    if (shouldSkipAggregateCell(r, c, ctx, model)) return;
    if (isFilledValue(cellRawValue(model, r, c))) n += 1;
  });
  return n;
}

function avgRange(model, a, b, ctx) {
  const s = sumRange(model, a, b, ctx);
  const pa = parseCellRef(a);
  const pb = parseCellRef(b);
  if (!pa || !pb) return 0;
  const rows = Math.abs(pb.r - pa.r) + 1;
  const cols = Math.abs(pb.c - pa.c) + 1;
  const cnt = rows * cols;
  return cnt ? s / cnt : 0;
}

function rangeNumbers(model, startRef, endRef, ctx) {
  const a = parseCellRef(startRef);
  const b = parseCellRef(endRef);
  if (!a || !b) return [];
  const r0 = Math.min(a.r, b.r);
  const r1 = Math.max(a.r, b.r);
  const c0 = Math.min(a.c, b.c);
  const c1 = Math.max(a.c, b.c);
  const cols = gridModelToTableColumns(model);
  const visiting = ctx?.visiting || new Set();
  const workbook = ctx?.workbook || null;
  const nums = [];
  for (let r = r0; r <= r1; r += 1) {
    for (let c = c0; c <= c1; c += 1) {
      if (shouldSkipAggregateCell(r, c, ctx, model)) continue;
      const n = getNumericAt(model, r, c, cols, visiting, workbook);
      if (n != null) nums.push(n);
    }
  }
  return nums;
}

function countRangeFilled(model, startRef, endRef, ctx) {
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
      if (shouldSkipAggregateCell(r, c, ctx, model)) continue;
      if (isFilledValue(cellRawValue(model, r, c))) n += 1;
    }
  }
  return n;
}

const AGGREGATION_FUNCTIONS = [
  {
    names: ['SUM', 'СУММ', 'Сумм', 'сумм'],
    range: (model, a, b, ctx) => sumRange(model, a, b, ctx),
    column: (model, col, ctx) => sumColumn(model, col, ctx),
  },
  {
    names: ['AVG', 'AVERAGE', 'СРЗНАЧ', 'СРЕДНЕЕ', 'Срзнач', 'срзнач'],
    range: (model, a, b, ctx) => avgRange(model, a, b, ctx),
    column: (model, col, ctx) => avgColumn(model, col, ctx),
  },
  {
    names: ['MIN', 'МИН', 'МИНИМУМ', 'Мин', 'мин'],
    range: (model, a, b, ctx) => {
      const nums = rangeNumbers(model, a, b, ctx);
      return nums.length ? Math.min(...nums) : 0;
    },
    column: (model, col, ctx) => minColumn(model, col, ctx),
  },
  {
    names: ['MAX', 'МАКС', 'МАКСИМУМ', 'Макс', 'макс'],
    range: (model, a, b, ctx) => {
      const nums = rangeNumbers(model, a, b, ctx);
      return nums.length ? Math.max(...nums) : 0;
    },
    column: (model, col, ctx) => maxColumn(model, col, ctx),
  },
  {
    names: ['COUNT', 'СЧЁТ', 'СЧЕТ', 'КОЛИЧЕСТВО', 'Счёт', 'счёт', 'Счет', 'счет'],
    range: (model, a, b, ctx) => countRangeFilled(model, a, b, ctx),
    column: (model, col, ctx) => countColumnFilled(model, col, ctx),
  },
];

const IF_FUNCTION_NAMES = ['IF', 'ЕСЛИ', 'Если', 'если'];
const DATE_FUNCTION_NAMES = ['DATE', 'ДАТА', 'Date', 'дата'];
const TODAY_FUNCTION_NAMES = ['TODAY', 'СЕГОДНЯ', 'Today', 'сегодня'];

function findMatchingParen(s, openIdx) {
  let depth = 0;
  let inString = false;
  let quote = '';
  for (let i = openIdx; i < s.length; i += 1) {
    const ch = s[i];
    if (inString) {
      if (ch === quote) inString = false;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = true;
      quote = ch;
      continue;
    }
    if (ch === '(') depth += 1;
    else if (ch === ')') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function splitFunctionArgs(inner) {
  const args = [];
  let depth = 0;
  let inString = false;
  let quote = '';
  let current = '';
  for (let i = 0; i < inner.length; i += 1) {
    const ch = inner[i];
    if (inString) {
      current += ch;
      if (ch === quote) inString = false;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = true;
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === '(') {
      depth += 1;
      current += ch;
      continue;
    }
    if (ch === ')') {
      depth -= 1;
      current += ch;
      continue;
    }
    if (ch === ',' && depth === 0) {
      args.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) args.push(current.trim());
  return args;
}

function findInnermostIfCall(expr) {
  let innermost = null;
  for (let ni = 0; ni < IF_FUNCTION_NAMES.length; ni += 1) {
    const name = IF_FUNCTION_NAMES[ni];
    const nameRe = new RegExp(escapeRegex(name), 'gi');
    let m = nameRe.exec(expr);
    while (m) {
      const nameStart = m.index;
      if (nameStart > 0 && /[A-Za-z0-9_А-Яа-яЁё]/.test(expr[nameStart - 1])) {
        m = nameRe.exec(expr);
        continue;
      }
      const openParenMatch = expr.slice(nameStart + m[0].length).match(/^\s*\(/);
      if (!openParenMatch) {
        m = nameRe.exec(expr);
        continue;
      }
      const openParen = nameStart + m[0].length + openParenMatch[0].indexOf('(');
      const closeParen = findMatchingParen(expr, openParen);
      if (closeParen >= 0) {
        const inner = expr.slice(openParen + 1, closeParen);
        const hasNestedIf = IF_FUNCTION_NAMES.some((n) => (
          new RegExp(`${escapeRegex(n)}\\s*\\(`, 'i').test(inner)
        ));
        const candidate = { nameStart, openParen, closeParen, inner };
        if (!hasNestedIf) return candidate;
        if (!innermost) innermost = candidate;
      }
      m = nameRe.exec(expr);
    }
  }
  return innermost;
}

function parseStringLiteral(token) {
  const t = String(token ?? '').trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return null;
}

function resolveConditionOperand(token, model, row, col, tableColumns, visiting, workbook = null) {
  const t = String(token ?? '').trim();
  const literal = parseStringLiteral(t);
  if (literal != null) {
    return { kind: 'literal', text: literal, dataType: 'string' };
  }
  if (/^-?\d+(?:[.,]\d+)?$/.test(t)) {
    return { kind: 'literal', number: parseFloat(t.replace(',', '.')), dataType: 'number' };
  }
  const sheetRef = parseSheetCellRef(t);
  if (sheetRef) {
    const targetModel = resolveModelForSheetRef(sheetRef.sheetName, model, workbook);
    if (!targetModel) return { kind: 'literal', text: '', dataType: 'string' };
    const targetCols = gridModelToTableColumns(targetModel);
    const text = getCellRawForCondition(targetModel, sheetRef.r, sheetRef.c, targetCols, visiting, workbook);
    return {
      kind: 'cell',
      text,
      dataType: targetCols[sheetRef.c]?.dataType,
      r: sheetRef.r,
      c: sheetRef.c,
    };
  }
  const colIdx = columnLabelToIndex(t.toUpperCase());
  if (colIdx >= 0 && colIdx < tableColumns.length) {
    const text = getCellRawForCondition(model, row, colIdx, tableColumns, visiting, workbook);
    return {
      kind: 'cell',
      text,
      dataType: tableColumns[colIdx]?.dataType,
      r: row,
      c: colIdx,
    };
  }
  return { kind: 'literal', text: t, dataType: 'string' };
}

function getCellRawForCondition(model, r, c, tableColumns, visiting, workbook = null) {
  const raw = cellRawValue(model, r, c);
  if (isCellFormula(raw)) {
    const n = evaluateCellFormula(raw, model, r, c, tableColumns, visiting, workbook);
    return n == null ? '' : String(n);
  }
  return raw != null ? String(raw) : '';
}

function operandText(op) {
  if (op.kind === 'literal' && op.text != null) return String(op.text);
  return String(op.text ?? '');
}

function operandNumber(op) {
  if (op.kind === 'literal' && op.number != null) return op.number;
  const text = operandText(op);
  const n = parseNumericCellValue(text, op.dataType);
  return n != null ? n : 0;
}

function isTruthyOperand(op) {
  const text = operandText(op).trim().toLowerCase();
  if (!text) return false;
  if (['нет', 'н', 'no', 'n', 'false', '0'].includes(text)) return false;
  if (['да', 'д', 'yes', 'y', 'true', '1'].includes(text)) return true;
  const n = parseNumericCellValue(text, op.dataType);
  if (n != null) return n !== 0;
  return true;
}

function compareConditionOperands(left, op, right) {
  const compareAsString = op === '!=' || op === '<>' || op === '==' || op === '=';
  if (compareAsString) {
    const ls = operandText(left);
    const rs = operandText(right);
    if (op === '!=' || op === '<>') return ls !== rs;
    return ls === rs;
  }
  const ln = operandNumber(left);
  const rn = operandNumber(right);
  if (op === '>') return ln > rn;
  if (op === '<') return ln < rn;
  if (op === '>=') return ln >= rn;
  if (op === '<=') return ln <= rn;
  return false;
}

function evaluateCondition(cond, model, row, col, tableColumns, visiting, workbook = null) {
  const normalized = String(cond ?? '').replace(/\s+/g, '');
  const cmp = normalized.match(/^(.+?)(>=|<=|<>|!=|==|=|>|<)(.+)$/);
  if (cmp) {
    const [, leftRaw, operator, rightRaw] = cmp;
    const left = resolveConditionOperand(leftRaw, model, row, col, tableColumns, visiting, workbook);
    const right = resolveConditionOperand(rightRaw, model, row, col, tableColumns, visiting, workbook);
    return compareConditionOperands(left, operator, right);
  }
  const operand = resolveConditionOperand(normalized, model, row, col, tableColumns, visiting, workbook);
  return isTruthyOperand(operand);
}

function evaluateSubExpression(expr, model, row, col, tableColumns, visiting, workbook = null) {
  let e = String(expr ?? '').trim();
  if (!e) return 0;
  const single = parseSheetCellRef(e);
  if (single) {
    const targetModel = resolveModelForSheetRef(single.sheetName, model, workbook);
    if (!targetModel) return 0;
    const targetCols = gridModelToTableColumns(targetModel);
    const v = getCellFormulaValue(targetModel, single.r, single.c, targetCols, visiting, workbook);
    if (v.kind === 'string') return v.value;
    if (v.kind === 'number') return v.value;
    return 0;
  }
  e = expandIfFunctions(e, model, row, col, tableColumns, visiting, workbook);
  e = substituteReferences(e, model, row, col, tableColumns, visiting, workbook);
  const tokens = tokenize(e);
  if (!tokens.length) return 0;
  const result = evaluateTokens(tokens);
  if (typeof result === 'string') return result;
  return Number.isFinite(result) ? result : 0;
}

function expandDateFunctions(expr, model, row, col, tableColumns, visiting, workbook = null) {
  let out = expr;
  TODAY_FUNCTION_NAMES.forEach((name) => {
    const re = new RegExp(`${escapeRegex(name)}\\s*\\(\\s*\\)`, 'gi');
    out = out.replace(re, () => String(todayExcelSerial()));
  });

  let guard = 0;
  while (guard < 32) {
    guard += 1;
    let replaced = false;
    for (let ni = 0; ni < DATE_FUNCTION_NAMES.length; ni += 1) {
      const name = DATE_FUNCTION_NAMES[ni];
      const nameRe = new RegExp(escapeRegex(name), 'i');
      const m = nameRe.exec(out);
      if (!m) continue;
      const nameStart = m.index;
      if (nameStart > 0 && /[A-Za-z0-9_А-Яа-яЁё]/.test(out[nameStart - 1])) continue;
      const openParenMatch = out.slice(nameStart + m[0].length).match(/^\s*\(/);
      if (!openParenMatch) continue;
      const openParen = nameStart + m[0].length + openParenMatch[0].indexOf('(');
      const closeParen = findMatchingParen(out, openParen);
      if (closeParen < 0) continue;
      const inner = out.slice(openParen + 1, closeParen);
      const args = splitFunctionArgs(inner);
      if (args.length !== 3) continue;
      const y = toNumber(evaluateSubExpression(args[0], model, row, col, tableColumns, visiting, workbook));
      const mo = toNumber(evaluateSubExpression(args[1], model, row, col, tableColumns, visiting, workbook));
      const d = toNumber(evaluateSubExpression(args[2], model, row, col, tableColumns, visiting, workbook));
      const serial = dateToExcelSerial(y, mo, d);
      out = `${out.slice(0, nameStart)}${serial}${out.slice(closeParen + 1)}`;
      replaced = true;
      break;
    }
    if (!replaced) break;
  }
  return out;
}

function expandIfFunctions(expr, model, row, col, tableColumns, visiting, workbook = null) {
  let out = expr;
  let guard = 0;
  while (guard < 64) {
    guard += 1;
    const call = findInnermostIfCall(out);
    if (!call) break;
    const args = splitFunctionArgs(call.inner);
    if (args.length !== 3) break;
    const [cond, ifTrue, ifFalse] = args;
    const pass = evaluateCondition(cond, model, row, col, tableColumns, visiting, workbook);
    const branchValue = evaluateSubExpression(pass ? ifTrue : ifFalse, model, row, col, tableColumns, visiting, workbook);
    out = `${out.slice(0, call.nameStart)}${formatBranchValue(branchValue)}${out.slice(call.closeParen + 1)}`;
  }
  return out;
}

function escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function aggregationNamePattern(names) {
  return names.map(escapeRegex).join('|');
}

function expandExcelFunctions(expr, model, ctx, workbook = null) {
  const wb = workbook || ctx?.workbook || null;
  let out = expr;
  AGGREGATION_FUNCTIONS.forEach((fn) => {
    const pat = aggregationNamePattern(fn.names);
    // Cross-sheet range: СУММ(Лист2!B2:B10) or СУММ('Лист 2'!B2:B10)
    out = out.replace(
      new RegExp(
        `(${pat})\\s*\\(\\s*(?:'([^']+)'|([^\\s'!]+))!([A-Za-z]+\\d+)\\s*:\\s*(?:(?:'[^']+'|[^\\s'!]+)!)?([A-Za-z]+\\d+)\\s*\\)`,
        'gi',
      ),
      (_, _name, quoted, bare, a, b) => {
        const sheetName = (quoted || bare || '').trim();
        const sheetModel = resolveModelForSheetRef(sheetName, model, wb);
        if (!sheetModel) return '0';
        return String(fn.range(sheetModel, a, b, ctx));
      },
    );
    // Cross-sheet column: СУММ(Лист2!B) or СУММ(Лист2!B:B)
    out = out.replace(
      new RegExp(
        `(${pat})\\s*\\(\\s*(?:'([^']+)'|([^\\s'!]+))!([A-Za-z]+)(?::\\4)?\\s*\\)`,
        'gi',
      ),
      (_, _name, quoted, bare, col) => {
        const sheetName = (quoted || bare || '').trim();
        const sheetModel = resolveModelForSheetRef(sheetName, model, wb);
        if (!sheetModel) return '0';
        return String(fn.column(sheetModel, col, ctx));
      },
    );
    out = out.replace(
      new RegExp(`(${pat})\\s*\\(\\s*([A-Za-z]+\\d+)\\s*:\\s*([A-Za-z]+\\d+)\\s*\\)`, 'gi'),
      (_, _name, a, b) => String(fn.range(model, a, b, ctx)),
    );
    out = out.replace(
      new RegExp(`(${pat})\\s*\\(\\s*([A-Za-z]+)(?::\\2)?\\s*\\)`, 'gi'),
      (_, _name, col) => String(fn.column(model, col, ctx)),
    );
  });
  return out;
}

function tokenize(expr) {
  const tokens = [];
  let i = 0;
  const s = String(expr ?? '');
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if ('+-*/()'.includes(ch)) {
      tokens.push({ t: ch });
      i += 1;
      continue;
    }
    if (ch === '"') {
      let j = i + 1;
      let str = '';
      while (j < s.length) {
        if (s[j] === '"' && s[j + 1] === '"') {
          str += '"';
          j += 2;
          continue;
        }
        if (s[j] === '"') break;
        str += s[j];
        j += 1;
      }
      tokens.push({ t: 'str', v: str });
      i = j < s.length ? j + 1 : j;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j += 1;
      tokens.push({ t: 'num', v: parseFloat(s.slice(i, j)) });
      i = j;
      continue;
    }
    if (/[A-Za-z_А-Яа-яЁё]/u.test(ch)) {
      let j = i;
      while (j < s.length && /[A-Za-z0-9_А-Яа-яЁё]/u.test(s[j])) j += 1;
      tokens.push({ t: 'id', v: s.slice(i, j).toUpperCase() });
      i = j;
      continue;
    }
    i += 1;
  }
  return tokens;
}

function toNumber(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function evaluateTokens(tokens) {
  let pos = 0;
  const peek = () => tokens[pos];
  const consume = () => tokens[pos++];

  function parseExpr() {
    let left = parseTerm();
    while (peek() && (peek().t === '+' || peek().t === '-')) {
      const op = consume().t;
      const right = parseTerm();
      if (op === '+' && (typeof left === 'string' || typeof right === 'string')) {
        left = `${left ?? ''}${right ?? ''}`;
      } else {
        left = op === '+' ? toNumber(left) + toNumber(right) : toNumber(left) - toNumber(right);
      }
    }
    return left;
  }

  function parseTerm() {
    let left = parseUnary();
    while (peek() && (peek().t === '*' || peek().t === '/')) {
      const op = consume().t;
      const right = parseUnary();
      left = op === '*' ? toNumber(left) * toNumber(right) : toNumber(left) / toNumber(right);
    }
    return left;
  }

  function parseUnary() {
    if (peek()?.t === '-') {
      consume();
      return -toNumber(parseUnary());
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
    if (tok.t === 'str') {
      consume();
      return tok.v;
    }
    if (tok.t === '(') {
      consume();
      const v = parseExpr();
      if (peek()?.t === ')') consume();
      return v;
    }
    if (tok.t === 'id') {
      consume();
      return 0;
    }
    return 0;
  }

  const result = parseExpr();
  if (typeof result === 'string') return result;
  return Number.isFinite(result) ? result : 0;
}

function getNumericAt(model, r, c, tableColumns, visiting, workbook = null) {
  const v = getCellFormulaValue(model, r, c, tableColumns, visiting, workbook);
  return v.kind === 'number' ? v.value : null;
}

/**
 * Resolve a cell to number or string for formulas.
 * Header / non-numeric text → { kind: 'string', value }.
 * @returns {{ kind: 'number', value: number } | { kind: 'string', value: string } | { kind: 'empty' }}
 */
function getCellFormulaValue(model, r, c, tableColumns, visiting, workbook = null) {
  if (!model || r < 0 || c < 0) return { kind: 'empty' };
  const cols = tableColumns || gridModelToTableColumns(model);
  if (c >= cols.length) return { kind: 'empty' };
  const k = cellKey(r, c);
  if (visiting.has(k)) return { kind: 'empty' };
  const raw = cellRawValue(model, r, c);
  if (!isFilledValue(raw)) return { kind: 'empty' };
  if (isCellFormula(raw)) {
    visiting.add(k);
    const result = evaluateCellFormula(raw, model, r, c, cols, visiting, workbook);
    visiting.delete(k);
    if (typeof result === 'string') return { kind: 'string', value: result };
    if (result != null && Number.isFinite(result)) return { kind: 'number', value: result };
    return { kind: 'empty' };
  }
  const n = parseNumericCellValue(raw, cols[c]?.dataType);
  if (n != null) return { kind: 'number', value: n };
  return { kind: 'string', value: String(raw) };
}

function valueForNumericContext(cellValue) {
  if (cellValue.kind === 'number') return String(cellValue.value);
  return '0';
}

function substituteReferences(expr, model, currentR, currentC, tableColumns, visiting, workbook = null) {
  const aggCtx = {
    visiting,
    excludeCell: { r: currentR, c: currentC },
    excludeSheetModel: model,
    excludeSheetId: model?.id || null,
    workbook,
  };
  let out = expandExcelFunctions(expr, model, aggCtx, workbook);

  // Cross-sheet cells: 'Sheet'!A1 or Sheet!A1
  out = out.replace(/(?:'([^']+)'|([^\s'!+\-*/(),:]+))!([A-Za-z]+\d+)/gu, (full, quoted, bare, cellAddr) => {
    const sheetName = (quoted || bare || '').trim();
    const ref = parseCellRef(cellAddr);
    if (!ref || !sheetName) return full;
    const sheetModel = resolveModelForSheetRef(sheetName, model, workbook);
    if (!sheetModel) return '0';
    const cols = gridModelToTableColumns(sheetModel);
    const v = getCellFormulaValue(sheetModel, ref.r, ref.c, cols, visiting, workbook);
    return valueForNumericContext(v);
  });

  out = out.replace(/([A-Za-z]+)(\d+)/g, (full, letters, digits) => {
    const ref = parseCellRef(`${letters}${digits}`);
    if (!ref) return full;
    const v = getCellFormulaValue(model, ref.r, ref.c, tableColumns, visiting, workbook);
    return valueForNumericContext(v);
  });

  out = out.replace(/(?<![A-Za-z0-9_])([A-Za-z]+)(?![A-Za-z0-9_])/g, (full, letters) => {
    const col = columnLabelToIndex(letters);
    if (col < 0 || col >= tableColumns.length) return '0';
    const v = getCellFormulaValue(model, currentR, col, tableColumns, visiting, workbook);
    return valueForNumericContext(v);
  });

  return out;
}

/**
 * @returns {number|string|null}
 */
export function evaluateCellFormula(formula, model, row, col, tableColumns, visiting = new Set(), workbook = null) {
  if (!isCellFormula(formula)) return null;
  const cols = tableColumns || gridModelToTableColumns(model);
  const body = String(formula).trim().slice(1).trim();
  try {
    // Single cell ref (incl. cross-sheet / header text): return name or value as-is
    const single = parseSheetCellRef(body);
    if (single) {
      const targetModel = resolveModelForSheetRef(single.sheetName, model, workbook);
      if (!targetModel) return null;
      const targetCols = gridModelToTableColumns(targetModel);
      const v = getCellFormulaValue(targetModel, single.r, single.c, targetCols, visiting, workbook);
      if (v.kind === 'string') return v.value;
      if (v.kind === 'number') return v.value;
      return null;
    }

    let expr = body;
    expr = expandDateFunctions(expr, model, row, col, cols, visiting, workbook);
    expr = expandIfFunctions(expr, model, row, col, cols, visiting, workbook);
    expr = substituteReferences(expr, model, row, col, cols, visiting, workbook);
    const tokens = tokenize(expr);
    if (!tokens.length) return null;
    const result = evaluateTokens(tokens);
    if (typeof result === 'string') return result;
    return Number.isFinite(result) ? result : null;
  } catch {
    return null;
  }
}

export function resolveCellDisplayValue(raw, model, row, col, tableColumns, workbook = null) {
  if (!isCellFormula(raw)) return raw != null ? String(raw) : '';
  const cols = tableColumns || gridModelToTableColumns(model);
  const dt = normalizeColumnDataType(cols[col]?.dataType);
  const n = evaluateCellFormula(raw, model, row, col, cols, new Set(), workbook);
  if (n == null) return '';
  if (typeof n === 'string') return n;
  if (dt === 'boolean') {
    if (Math.abs(n) < 1e-9) return 'нет';
    if (Math.abs(n - 1) < 1e-9) return 'да';
    return n > 0 ? 'да' : 'нет';
  }
  if (dt === 'date') {
    const iso = excelSerialToIsoDate(n);
    return iso || formatFormulaNumber(n);
  }
  return formatFormulaNumber(n);
}

/** @returns {Record<string, string>} */
export function computeFormulaDisplayMap(model, tableColumns, workbook = null) {
  const cols = tableColumns || gridModelToTableColumns(model);
  const { rowCount = 0, colCount = 0, hasHeaderRow, cells = {} } = model;
  const dataStart = hasHeaderRow ? 1 : 0;
  const out = {};
  for (let r = dataStart; r < rowCount; r += 1) {
    for (let c = 0; c < colCount; c += 1) {
      const raw = getEffectiveCellValue(cells, r, c, cols, !!hasHeaderRow);
      if (isCellFormula(raw)) {
        out[cellKey(r, c)] = resolveCellDisplayValue(raw, model, r, c, cols, workbook);
      }
    }
  }
  return out;
}

/** Build Excel-style ref for UI: A1 or 'Лист 2'!B3 */
export function formatSheetCellRef(r, c, sheetName = null, currentSheetName = null) {
  const addr = `${excelColumnLabel(c)}${r + 1}`;
  if (!sheetName || (currentSheetName && sheetName === currentSheetName)) return addr;
  const needsQuotes = /[\s'!]/.test(sheetName) || !/^[\p{L}\p{N}_]+$/u.test(sheetName);
  return needsQuotes ? `'${sheetName.replace(/'/g, "''")}'!${addr}` : `${sheetName}!${addr}`;
}

/** Range ref: A1:B3 or Лист2!A1:B3 */
export function formatSheetRangeRef(r0, c0, r1, c1, sheetName = null, currentSheetName = null) {
  const rr0 = Math.min(r0, r1);
  const rr1 = Math.max(r0, r1);
  const cc0 = Math.min(c0, c1);
  const cc1 = Math.max(c0, c1);
  if (rr0 === rr1 && cc0 === cc1) {
    return formatSheetCellRef(rr0, cc0, sheetName, currentSheetName);
  }
  const a = `${excelColumnLabel(cc0)}${rr0 + 1}`;
  const b = `${excelColumnLabel(cc1)}${rr1 + 1}`;
  const range = `${a}:${b}`;
  if (!sheetName || (currentSheetName && sheetName === currentSheetName)) return range;
  const needsQuotes = /[\s'!]/.test(sheetName) || !/^[\p{L}\p{N}_]+$/u.test(sheetName);
  const prefix = needsQuotes ? `'${sheetName.replace(/'/g, "''")}'` : sheetName;
  return `${prefix}!${range}`;
}

export function extractFormulaCellRefs(formula) {
  const body = isCellFormula(formula) ? String(formula).trim().slice(1) : String(formula ?? '');
  const refs = [];
  const re = /(?:'([^']+)'|([^\s'!+\-*/(),:]+))!([A-Za-z]+\d+)|(?<![A-Za-z0-9_])([A-Za-z]+\d+)/gu;
  let m = re.exec(body);
  while (m) {
    if (m[3]) {
      const cell = parseCellRef(m[3]);
      if (cell) refs.push({ sheetName: (m[1] || m[2] || '').trim(), ...cell });
    } else if (m[4]) {
      const cell = parseCellRef(m[4]);
      if (cell) refs.push({ sheetName: null, ...cell });
    }
    m = re.exec(body);
  }
  return refs;
}

export function columnIndexToLabel(c) {
  return excelColumnLabel(c);
}
