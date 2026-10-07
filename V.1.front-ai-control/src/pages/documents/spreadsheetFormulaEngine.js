/**
 * Вычислитель формул таблиц: парсер → дерево → вычисление с ошибками как в Excel.
 *
 * Совместимость со старыми формулами сохранена:
 *  - голая буква столбца (=B*D) — ячейка этого столбца в строке формулы;
 *  - СУММ(B) — весь столбец; формула не учитывает саму себя в агрегатах;
 *  - операторы != и == в условиях; строки в одинарных кавычках;
 *  - A1 в строке заголовков без значения — название столбца.
 */
import {
  getEffectiveCellValue,
  gridModelToTableColumns,
  normalizeColumnDataType,
  parseNumericCellValue,
} from './spreadsheetGridUtils';
import {
  columnLabelToIndex,
  isBareColumnIdent,
  tokenizeFormulaBody,
} from './spreadsheetFormulaTokens';
import { FORMULA_FUNCTIONS, lookupFormulaFunction } from './spreadsheetFormulaFunctions';

/* ───────────────────────────── значения ───────────────────────────── */

export class FormulaError {
  constructor(code, message = '') {
    this.code = code;
    this.message = message;
  }

  toString() {
    return this.code;
  }
}

export const ERROR_MESSAGES = {
  '#DIV/0!': 'Деление на ноль',
  '#VALUE!': 'Неверный тип значения',
  '#REF!': 'Неверная ссылка',
  '#NAME?': 'Неизвестная функция или имя',
  '#N/A': 'Значение не найдено',
  '#NUM!': 'Неверное число',
  '#ERROR!': 'Ошибка в формуле',
};

export const err = (code, message) => new FormulaError(code, message || ERROR_MESSAGES[code] || '');
export const isError = (v) => v instanceof FormulaError;

/** Пустая ячейка (в арифметике 0, в тексте ""). */
export const EMPTY = Object.freeze({ empty: true, toString: () => '' });
export const isEmpty = (v) => v === EMPTY;

/** Ссылка на прямоугольник ячеек листа; значения читаются лениво. */
export class RangeRef {
  constructor(ctx, model, r0, c0, r1, c1) {
    this.ctx = ctx;
    this.model = model;
    this.r0 = Math.min(r0, r1);
    this.r1 = Math.max(r0, r1);
    this.c0 = Math.min(c0, c1);
    this.c1 = Math.max(c0, c1);
  }

  get rows() {
    return this.r1 - this.r0 + 1;
  }

  get cols() {
    return this.c1 - this.c0 + 1;
  }

  /** Значение по смещению внутри диапазона. */
  get(i, j) {
    return getCellValue(this.ctx, this.model, this.r0 + i, this.c0 + j);
  }

  /** Обход ячеек построчно; собственная ячейка формулы пропускается (как в старой версии). */
  forEach(visitor) {
    const self = this.ctx.self;
    for (let r = this.r0; r <= this.r1; r += 1) {
      for (let c = this.c0; c <= this.c1; c += 1) {
        if (self && self.model === this.model && self.r === r && self.c === c) continue;
        visitor(getCellValue(this.ctx, this.model, r, c), r - this.r0, c - this.c0);
      }
    }
  }

  /** Двумерный массив значений (собственная ячейка → EMPTY). */
  toMatrix() {
    const out = [];
    const self = this.ctx.self;
    for (let r = this.r0; r <= this.r1; r += 1) {
      const row = [];
      for (let c = this.c0; c <= this.c1; c += 1) {
        const isSelf = self && self.model === this.model && self.r === r && self.c === c;
        row.push(isSelf ? EMPTY : getCellValue(this.ctx, this.model, r, c));
      }
      out.push(row);
    }
    return out;
  }
}

export const isRange = (v) => v instanceof RangeRef;

/* ───────────────────────────── даты ───────────────────────────── */

const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);

export function dateToExcelSerial(year, month, day) {
  const y = Math.floor(Number(year));
  const m = Math.floor(Number(month));
  const d = Math.floor(Number(day));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return 0;
  return Math.round((Date.UTC(y, m - 1, d) - EXCEL_EPOCH_UTC) / 86400000);
}

export function excelSerialToDate(serial) {
  const d = new Date(EXCEL_EPOCH_UTC + Math.floor(serial) * 86400000);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), wd: d.getUTCDay() };
}

export function excelSerialToIsoDate(serial) {
  if (!Number.isFinite(serial)) return '';
  const { y, m, d } = excelSerialToDate(serial);
  const p = (n) => String(n).padStart(2, '0');
  return `${y}-${p(m)}-${p(d)}`;
}

export function excelSerialToRuDate(serial) {
  if (!Number.isFinite(serial)) return '';
  const { y, m, d } = excelSerialToDate(serial);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d)}.${p(m)}.${y}`;
}

export function todayExcelSerial() {
  const now = new Date();
  return dateToExcelSerial(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/** «2026-03-01», «01.03.2026», «1.3.26» → серийный номер даты Excel; иначе null. */
export function parseDateTextToSerial(text) {
  const s = String(text ?? '').trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
  if (m) return dateToExcelSerial(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/);
  if (m) {
    let y = +m[3];
    if (y < 100) y += 2000;
    return dateToExcelSerial(y, +m[2], +m[1]);
  }
  return null;
}

/* ───────────────────────────── приведение типов ───────────────────────────── */

const TRUE_WORDS = new Set(['true', 'истина', 'да', 'д', 'yes', 'y']);
const FALSE_WORDS = new Set(['false', 'ложь', 'нет', 'н', 'no', 'n']);

/** Число из текста: «1 234,5», «10%», даты. null — не число. */
export function parseNumberText(text) {
  const s = String(text ?? '').trim().replace(/[\s ]/g, '');
  if (!s) return null;
  if (/^[-+]?(\d+([.,]\d*)?|[.,]\d+)([eE][-+]?\d+)?%$/.test(s)) {
    return Number(s.slice(0, -1).replace(',', '.')) / 100;
  }
  if (/^[-+]?(\d+([.,]\d*)?|[.,]\d+)([eE][-+]?\d+)?$/.test(s)) {
    return Number(s.replace(',', '.'));
  }
  return parseDateTextToSerial(text);
}

/** Скаляр из значения: диапазон → неявное пересечение со строкой/столбцом формулы. */
export function toScalar(v, ctx) {
  if (!isRange(v)) return v;
  if (v.rows === 1 && v.cols === 1) return v.get(0, 0);
  if (ctx && v.cols === 1 && ctx.row >= v.r0 && ctx.row <= v.r1 && v.model === ctx.model) {
    return v.get(ctx.row - v.r0, 0);
  }
  if (ctx && v.rows === 1 && ctx.col >= v.c0 && ctx.col <= v.c1 && v.model === ctx.model) {
    return v.get(0, ctx.col - v.c0);
  }
  return err('#VALUE!', 'Диапазон там, где ожидается одно значение');
}

export function toNumber(v, ctx) {
  const s = toScalar(v, ctx);
  if (isError(s)) return s;
  if (typeof s === 'number') return Number.isFinite(s) ? s : err('#NUM!');
  if (typeof s === 'boolean') return s ? 1 : 0;
  if (isEmpty(s) || s == null) return 0;
  const n = parseNumberText(s);
  if (n == null) return err('#VALUE!', `«${s}» — не число`);
  return n;
}

export function formatGeneralNumber(n) {
  if (!Number.isFinite(n)) return '';
  if (Number.isInteger(n)) return String(n);
  return String(parseFloat(n.toPrecision(12)));
}

export function toText(v, ctx) {
  const s = toScalar(v, ctx);
  if (isError(s)) return s;
  if (typeof s === 'string') return s;
  if (typeof s === 'number') return formatGeneralNumber(s);
  if (typeof s === 'boolean') return s ? 'ИСТИНА' : 'ЛОЖЬ';
  return '';
}

export function toBool(v, ctx) {
  const s = toScalar(v, ctx);
  if (isError(s)) return s;
  if (typeof s === 'boolean') return s;
  if (typeof s === 'number') return s !== 0;
  if (isEmpty(s) || s == null) return false;
  const t = String(s).trim().toLowerCase();
  if (!t) return false;
  if (TRUE_WORDS.has(t)) return true;
  if (FALSE_WORDS.has(t)) return false;
  const n = parseNumberText(t);
  if (n != null) return n !== 0;
  return true;
}

/**
 * Сравнение как в Excel (строки без учёта регистра), с поблажками старых формул:
 * «да»/«нет» сравниваются с логическими значениями, числовой текст — с числами.
 * @returns {number|FormulaError} -1, 0, 1
 */
export function compareValues(a, b) {
  if (isError(a)) return a;
  if (isError(b)) return b;
  let x = a;
  let y = b;
  if (isEmpty(x)) x = typeof y === 'string' ? '' : typeof y === 'boolean' ? false : 0;
  if (isEmpty(y)) y = typeof x === 'string' ? '' : typeof x === 'boolean' ? false : 0;
  if (typeof x === 'boolean' && typeof y === 'string') {
    const t = y.trim().toLowerCase();
    if (TRUE_WORDS.has(t) || FALSE_WORDS.has(t)) y = TRUE_WORDS.has(t);
  }
  if (typeof y === 'boolean' && typeof x === 'string') {
    const t = x.trim().toLowerCase();
    if (TRUE_WORDS.has(t) || FALSE_WORDS.has(t)) x = TRUE_WORDS.has(t);
  }
  if (typeof x === 'number' && typeof y === 'string') {
    const n = parseNumberText(y);
    if (n != null) y = n;
  }
  if (typeof y === 'number' && typeof x === 'string') {
    const n = parseNumberText(x);
    if (n != null) x = n;
  }
  const rank = (v) => (typeof v === 'number' ? 0 : typeof v === 'string' ? 1 : 2);
  if (rank(x) !== rank(y)) return rank(x) < rank(y) ? -1 : 1;
  if (typeof x === 'string') {
    const xs = x.toLowerCase();
    const ys = y.toLowerCase();
    if (xs === ys) return 0;
    return xs.localeCompare(ys, 'ru') < 0 ? -1 : 1;
  }
  const xn = Number(x);
  const yn = Number(y);
  if (xn === yn) return 0;
  return xn < yn ? -1 : 1;
}

/* ───────────────────────────── ячейки ───────────────────────────── */

function columnsOf(model) {
  return Array.isArray(model?.tableColumns) && model.tableColumns.length > 0
    ? model.tableColumns
    : gridModelToTableColumns(model || {});
}

export function modelColCount(model) {
  return Math.max(model?.colCount || 0, columnsOf(model).length);
}

export function modelRowCount(model) {
  return model?.rowCount || 0;
}

function isFilled(raw) {
  return raw != null && String(raw).trim() !== '';
}

/** Исходный текст ячейки с учётом значения столбца по умолчанию и названия в заголовке. */
export function cellRawValue(model, r, c) {
  const cols = columnsOf(model);
  const raw = getEffectiveCellValue(model.cells || {}, r, c, cols, !!model.hasHeaderRow);
  if (isFilled(raw)) return raw;
  if (model.hasHeaderRow && r === 0) {
    const label = cols[c]?.label;
    if (isFilled(label)) return String(label);
  }
  return raw;
}

/** Константа ячейки → число / логическое / текст с учётом типа столбца. */
export function literalCellValue(raw, dataType) {
  const s = String(raw ?? '');
  if (!s.trim()) return EMPTY;
  const dt = normalizeColumnDataType(dataType);
  if (dt === 'boolean') {
    const t = s.trim().toLowerCase();
    if (TRUE_WORDS.has(t) || t === '1') return true;
    if (FALSE_WORDS.has(t) || t === '0') return false;
    return s;
  }
  if (dt === 'date') {
    const serial = parseDateTextToSerial(s);
    if (serial != null) return serial;
  }
  if (/%\s*$/.test(s)) {
    const pct = parseNumberText(s);
    if (pct != null) return pct;
  }
  const n = parseNumericCellValue(s, dt === 'date' ? 'number' : dt);
  if (n != null) return n;
  return s;
}

let anonymousModelIds = new WeakMap();
let anonymousModelSeq = 0;

function modelKey(model) {
  if (model?.id != null) return String(model.id);
  if (!anonymousModelIds.has(model)) {
    anonymousModelSeq += 1;
    anonymousModelIds.set(model, `m${anonymousModelSeq}`);
  }
  return anonymousModelIds.get(model);
}

/** Значение ячейки (с вычислением формулы, кешем и защитой от циклов). */
export function getCellValue(ctx, model, r, c) {
  if (!model) return err('#REF!');
  if (r < 0 || c < 0) return err('#REF!');
  if (c >= modelColCount(model) || r >= modelRowCount(model)) return EMPTY;
  const raw = cellRawValue(model, r, c);
  if (!isFilled(raw)) return EMPTY;
  const text = String(raw).trim();
  if (text.startsWith('=') && text.length > 1) {
    const key = `${modelKey(model)}|${r}|${c}`;
    const { shared } = ctx;
    if (shared.cache.has(key)) return shared.cache.get(key);
    if (shared.visiting.has(key)) return err('#REF!', 'Циклическая ссылка');
    shared.visiting.add(key);
    const result = evaluateFormulaInContext(text, model, r, c, shared).value;
    shared.visiting.delete(key);
    shared.cache.set(key, result);
    return result;
  }
  return literalCellValue(raw, columnsOf(model)[c]?.dataType);
}

/* ───────────────────────────── листы ───────────────────────────── */

function resolveSheetModel(ctx, sheetName) {
  if (!sheetName) return ctx.model;
  const want = String(sheetName).trim().toLowerCase();
  const { shared } = ctx;
  if (String(ctx.model?.name || '').trim().toLowerCase() === want) return ctx.model;
  const sheets = shared.workbook?.sheets;
  if (!Array.isArray(sheets)) return null;
  const found = sheets.find((s) => String(s?.name || '').trim().toLowerCase() === want);
  if (!found) return null;
  // Живая модель (с несохранёнными правками) приоритетнее определения листа из шаблона.
  if (found.id != null && shared.liveModels.has(String(found.id))) {
    return shared.liveModels.get(String(found.id));
  }
  return found;
}

/* ───────────────────────────── парсер ───────────────────────────── */

class ParseError extends Error {}

const COMPARE_OPS = new Set(['=', '<>', '<', '>', '<=', '>=', '!=', '==']);

/**
 * @returns {object} AST
 */
export function parseFormulaBody(body) {
  const tokens = tokenizeFormulaBody(body);
  const bad = tokens.find((t) => t.type === 'error');
  if (bad) throw new ParseError(bad.message);
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];
  const isOp = (tok, ops) => tok?.type === 'op' && ops.includes(tok.op);

  function parseComparison() {
    let left = parseConcat();
    while (peek()?.type === 'op' && COMPARE_OPS.has(peek().op)) {
      const op = next().op;
      left = { type: 'bin', op, left, right: parseConcat() };
    }
    return left;
  }

  function parseConcat() {
    let left = parseAdditive();
    while (isOp(peek(), ['&'])) {
      next();
      left = { type: 'bin', op: '&', left, right: parseAdditive() };
    }
    return left;
  }

  function parseAdditive() {
    let left = parseMultiplicative();
    while (isOp(peek(), ['+', '-'])) {
      const op = next().op;
      left = { type: 'bin', op, left, right: parseMultiplicative() };
    }
    return left;
  }

  function parseMultiplicative() {
    let left = parsePower();
    while (isOp(peek(), ['*', '/'])) {
      const op = next().op;
      left = { type: 'bin', op, left, right: parsePower() };
    }
    return left;
  }

  function parsePower() {
    let left = parsePercent();
    while (isOp(peek(), ['^'])) {
      next();
      left = { type: 'bin', op: '^', left, right: parsePercent() };
    }
    return left;
  }

  function parsePercent() {
    let node = parseUnary();
    while (isOp(peek(), ['%'])) {
      next();
      node = { type: 'percent', arg: node };
    }
    return node;
  }

  // Как в Excel: унарный минус сильнее ^ (=-2^2 → 4).
  function parseUnary() {
    if (isOp(peek(), ['-', '+'])) {
      const op = next().op;
      const arg = parseUnary();
      return op === '-' ? { type: 'neg', arg } : arg;
    }
    return parsePrimary();
  }

  function parseArgs() {
    const args = [];
    if (peek()?.type === 'rparen') {
      next();
      return args;
    }
    for (;;) {
      const tok = peek();
      if (tok?.type === 'sep' || tok?.type === 'rparen') {
        args.push({ type: 'missing' });
      } else {
        args.push(parseComparison());
      }
      const after = next();
      if (!after) throw new ParseError('Не хватает закрывающей скобки');
      if (after.type === 'rparen') return args;
      if (after.type !== 'sep') throw new ParseError(`Ожидалась «;» или «)» вместо «${after.text}»`);
    }
  }

  function parsePrimary() {
    const tok = next();
    if (!tok) throw new ParseError('Формула не закончена');
    switch (tok.type) {
      case 'num':
        return { type: 'num', value: tok.value };
      case 'str':
        return { type: 'str', value: tok.value };
      case 'ref':
        return { type: 'ref', tok };
      case 'func': {
        const open = next();
        if (open?.type !== 'lparen') throw new ParseError('Ожидалась «(»');
        return { type: 'call', name: tok.name, args: parseArgs(), start: tok.start };
      }
      case 'ident': {
        const upper = tok.name.toUpperCase();
        if (upper === 'TRUE' || upper === 'ИСТИНА') return { type: 'bool', value: true };
        if (upper === 'FALSE' || upper === 'ЛОЖЬ') return { type: 'bool', value: false };
        if (isBareColumnIdent(tok)) return { type: 'barecol', c: columnLabelToIndex(tok.name), name: tok.name };
        return { type: 'name', name: tok.name };
      }
      case 'lparen': {
        const inner = parseComparison();
        if (next()?.type !== 'rparen') throw new ParseError('Не хватает закрывающей скобки');
        return inner;
      }
      default:
        throw new ParseError(`Неожиданный «${tok.text}»`);
    }
  }

  if (!tokens.length) throw new ParseError('Пустая формула');
  const ast = parseComparison();
  if (pos < tokens.length) throw new ParseError(`Лишнее в формуле: «${tokens[pos].text}»`);
  return ast;
}

const astCache = new Map();
const AST_CACHE_LIMIT = 2000;

function getAst(body) {
  if (astCache.has(body)) return astCache.get(body);
  let entry;
  try {
    entry = { ast: parseFormulaBody(body) };
  } catch (e) {
    entry = { error: err('#ERROR!', e instanceof ParseError ? e.message : 'Ошибка в формуле') };
  }
  if (astCache.size > AST_CACHE_LIMIT) astCache.clear();
  astCache.set(body, entry);
  return entry;
}

/* ───────────────────────────── вычисление ───────────────────────────── */

function refToRange(node, ctx) {
  const { tok } = node;
  const model = resolveSheetModel(ctx, tok.sheetName);
  if (!model) return err('#REF!', `Нет листа «${tok.sheetName}»`);
  if (tok.kind === 'cols') {
    return new RangeRef(ctx, model, 0, tok.a.c, Math.max(0, modelRowCount(model) - 1), tok.b.c);
  }
  if (tok.kind === 'rows') {
    return new RangeRef(ctx, model, tok.a.r, 0, tok.b.r, Math.max(0, modelColCount(model) - 1));
  }
  return new RangeRef(ctx, model, tok.a.r, tok.a.c, tok.b.r, tok.b.c);
}

function evalBinary(node, ctx) {
  const { op } = node;
  const l = toScalar(evalNode(node.left, ctx), ctx);
  if (isError(l)) return l;
  const r = toScalar(evalNode(node.right, ctx), ctx);
  if (isError(r)) return r;

  if (op === '&') {
    const a = toText(l, ctx);
    if (isError(a)) return a;
    const b = toText(r, ctx);
    if (isError(b)) return b;
    return a + b;
  }
  if (COMPARE_OPS.has(op)) {
    const cmp = compareValues(l, r);
    if (isError(cmp)) return cmp;
    switch (op) {
      case '=': case '==': return cmp === 0;
      case '<>': case '!=': return cmp !== 0;
      case '<': return cmp < 0;
      case '>': return cmp > 0;
      case '<=': return cmp <= 0;
      default: return cmp >= 0;
    }
  }
  const a = toNumber(l, ctx);
  if (isError(a)) return a;
  const b = toNumber(r, ctx);
  if (isError(b)) return b;
  let out;
  switch (op) {
    case '+': out = a + b; break;
    case '-': out = a - b; break;
    case '*': out = a * b; break;
    case '/':
      if (b === 0) return err('#DIV/0!');
      out = a / b;
      break;
    case '^':
      if (a === 0 && b < 0) return err('#DIV/0!');
      out = a ** b;
      break;
    default:
      return err('#ERROR!');
  }
  return Number.isFinite(out) ? out : err('#NUM!');
}

/** Вычислить аргумент функции: голая буква в агрегате = весь столбец (старый синтаксис СУММ(B)). */
export function evalArg(node, ctx, { columnAsRange = false } = {}) {
  if (node.type === 'barecol' && columnAsRange) {
    return new RangeRef(ctx, ctx.model, 0, node.c, Math.max(0, modelRowCount(ctx.model) - 1), node.c);
  }
  if (node.type === 'missing') return EMPTY;
  return evalNode(node, ctx);
}

function evalCall(node, ctx) {
  const spec = lookupFormulaFunction(node.name);
  if (!spec) return err('#NAME?', `Неизвестная функция ${node.name}`);
  const argc = node.args.length;
  if (argc < (spec.min ?? 0) || (spec.max != null && argc > spec.max)) {
    return err('#N/A', `${spec.name}: неверное число аргументов`);
  }
  if (spec.lazy) return spec.fn(node.args, ctx, node);
  const args = node.args.map((a) => evalArg(a, ctx, { columnAsRange: !!spec.ranges }));
  return spec.fn(args, ctx, node);
}

export function evalNode(node, ctx) {
  switch (node.type) {
    case 'num': return node.value;
    case 'str': return node.value;
    case 'bool': return node.value;
    case 'missing': return EMPTY;
    case 'ref': return refToRange(node, ctx);
    case 'barecol': {
      if (node.c >= modelColCount(ctx.model)) return err('#NAME?', `Неизвестное имя ${node.name}`);
      return getCellValue(ctx, ctx.model, ctx.row, node.c);
    }
    case 'name': return err('#NAME?', `Неизвестное имя ${node.name}`);
    case 'neg': {
      const v = toNumber(evalNode(node.arg, ctx), ctx);
      return isError(v) ? v : -v;
    }
    case 'percent': {
      const v = toNumber(evalNode(node.arg, ctx), ctx);
      return isError(v) ? v : v / 100;
    }
    case 'bin': return evalBinary(node, ctx);
    case 'call': return evalCall(node, ctx);
    default: return err('#ERROR!');
  }
}

/* ─────────── даты в результате (для отображения без столбца «Дата») ─────────── */

const DATE_RESULT_FUNCTIONS = new Set(['DATE', 'TODAY', 'EDATE', 'EOMONTH', 'DATEVALUE', 'WORKDAY']);

function isDateResultNode(node) {
  if (!node) return false;
  if (node.type === 'call') {
    const spec = lookupFormulaFunction(node.name);
    return !!spec && DATE_RESULT_FUNCTIONS.has(spec.name);
  }
  if (node.type === 'bin' && (node.op === '+' || node.op === '-')) {
    const l = isDateResultNode(node.left);
    const r = isDateResultNode(node.right);
    if (node.op === '-' && l && r) return false;
    return l || r;
  }
  return false;
}

/* ───────────────────────────── вход ───────────────────────────── */

function createShared(workbook, rootModel) {
  const liveModels = new Map();
  if (rootModel?.id != null) liveModels.set(String(rootModel.id), rootModel);
  (workbook?.liveModels || []).forEach((m) => {
    if (m?.id != null) liveModels.set(String(m.id), m);
  });
  return { workbook, cache: new Map(), visiting: new Set(), liveModels };
}

function evaluateFormulaInContext(formula, model, row, col, shared) {
  const body = String(formula).trim().replace(/^=/, '');
  const { ast, error } = getAst(body);
  if (error) return { value: error, isDate: false };
  const ctx = { model, row, col, shared, self: { model, r: row, c: col } };
  let value = evalNode(ast, ctx);
  if (isRange(value)) value = toScalar(value, ctx);
  return { value, isDate: isDateResultNode(ast) };
}

/**
 * Вычислить формулу ячейки.
 * @param {object} [options] — { shared } для общего кеша при расчёте всего листа
 * @returns {{ value: number|string|boolean|FormulaError|typeof EMPTY, isDate: boolean }}
 */
export function evaluateFormula(formula, model, row, col, workbook = null, options = {}) {
  const shared = options.shared || createShared(workbook, model);
  const key = `${modelKey(model)}|${row}|${col}`;
  shared.visiting.add(key);
  try {
    return evaluateFormulaInContext(formula, model, row, col, shared);
  } catch (e) {
    return { value: err('#ERROR!', e?.message || 'Ошибка в формуле'), isDate: false };
  } finally {
    shared.visiting.delete(key);
  }
}

export function createFormulaSession(workbook, rootModel) {
  return createShared(workbook, rootModel);
}

/** Проверка синтаксиса: null или сообщение об ошибке. */
export function getFormulaSyntaxError(formula) {
  const body = String(formula ?? '').trim().replace(/^=/, '');
  const { error } = getAst(body);
  return error ? error.message : null;
}

export { FORMULA_FUNCTIONS };

/** Для тестов: сбросить кеши. */
export function __resetFormulaEngineCaches() {
  astCache.clear();
  anonymousModelIds = new WeakMap();
}
