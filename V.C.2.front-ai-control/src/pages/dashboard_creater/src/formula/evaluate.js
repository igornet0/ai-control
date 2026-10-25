import { FormulaError } from './errors.js';

/**
 * Строка/число из SQLite (TEXT/REAL) → миллисекунды эпохи для дат/времени.
 * @param {unknown} raw
 * @returns {number}
 */
export function parseDateTimeLikeToEvalMs(raw) {
  if (raw === '' || raw == null) return NaN;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    if (Math.abs(raw) > 1e11) return raw;
    if (raw > 1e9 && raw < 1e11) return raw * 1000;
  }
  const s = String(raw).trim();
  if (!s) return NaN;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map((x) => parseInt(x, 10));
    const t = new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
    return Number.isNaN(t) ? NaN : t;
  }
  const isoish = s.includes('T') ? s : s.replace(/^(\d{4}-\d{2}-\d{2})[ T](.+)$/, '$1T$2');
  let t = Date.parse(isoish);
  if (!Number.isFinite(t)) {
    t = new Date(s).getTime();
  }
  return Number.isFinite(t) ? t : NaN;
}

/**
 * Значение ячейки агрегата из строки ответа → число для вычисления AST.
 * Для MIN/MAX допускаются даты/время как строки (и числовой epoch).
 * @param {unknown} raw
 * @param {string} fn — как в AST: SUM, MAX, COUNT, …
 */
export function coerceSqliteAggRawToNumber(raw, fn) {
  const f = String(fn || '').toUpperCase();
  if (raw === null || raw === undefined || raw === '') return NaN;
  if (f === 'MIN' || f === 'MAX') {
    const n0 = Number(raw);
    if (Number.isFinite(n0)) return n0;
    return parseDateTimeLikeToEvalMs(raw);
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Только одна функция MIN/MAX по одному полю — для читаемого вывода даты/времени.
 * @param {string} [formula]
 */
export function isSingleMinMaxAggFormula(formula) {
  const s = String(formula ?? '').trim();
  return /^\s*(MIN|MAX)\s*\(\s*(?:[\w.]+|\[[^\]]+\]|\$\[[^\]]+\])\s*\)\s*$/i.test(s);
}

/**
 * @param {number} ms
 * @param {{ timestampDisplay?: 'local' | 'utc' }} [opts]
 */
export function formatAggTimestampMsForDisplay(ms, opts = {}) {
  if (!Number.isFinite(ms)) return '—';
  const useUtc = opts.timestampDisplay === 'utc';
  try {
    /** @type {Intl.DateTimeFormatOptions} */
    const fmtOpts = {
      dateStyle: 'short',
      timeStyle: 'short',
    };
    if (useUtc) fmtOpts.timeZone = 'UTC';
    return new Intl.DateTimeFormat(undefined, fmtOpts).format(new Date(ms));
  } catch {
    const d = new Date(ms);
    return useUtc ? d.toISOString().slice(0, 19).replace('T', ' ') : String(d);
  }
}

/**
 * @param {number} n
 * @param {string} [formula]
 * @param {{ timestampDisplay?: 'local' | 'utc' }} [opts]
 */
export function formatEvalResultForDisplay(n, formula, opts = {}) {
  if (!Number.isFinite(n)) return '—';
  if (isSingleMinMaxAggFormula(formula)) {
    return formatAggTimestampMsForDisplay(n, opts);
  }
  return formatNumberForDisplay(n);
}

/**
 * @typedef {{ get?: (key: string) => number|undefined, set?: (key: string, value: number) => void, keyForAgg?: (node: object, row: Record<string, unknown>) => string }} AggSubtreeMemo
 * @typedef {{ getField?: (col: string) => unknown, getVar?: (name: string) => unknown, hasVar?: (name: string) => boolean }} FieldEvalContext
 */

/**
 * @param {unknown} v
 * @returns {boolean}
 */
export function isFormulaTruthy(v) {
  if (v == null) return false;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return Number.isFinite(v) && v !== 0;
  if (typeof v === 'string') return v.length > 0;
  return Boolean(v);
}

/**
 * @param {unknown} a
 * @param {unknown} b
 * @param {string} op
 */
function compareValues(a, b, op) {
  if (typeof a === 'number' && typeof b === 'number' && Number.isFinite(a) && Number.isFinite(b)) {
    if (op === '=') return a === b;
    if (op === '!=') return a !== b;
    if (op === '>') return a > b;
    if (op === '<') return a < b;
    if (op === '>=') return a >= b;
    if (op === '<=') return a <= b;
  }
  // Число против числовой строки (TEXT/REAL из SQLite: 5 vs "5.0") — сравниваем как числа.
  if ((op === '=' || op === '!=') && (typeof a === 'number' || typeof b === 'number')) {
    const other = typeof a === 'number' ? b : a;
    if (typeof other === 'string' && other.trim() !== '') {
      const na0 = Number(a);
      const nb0 = Number(b);
      if (Number.isFinite(na0) && Number.isFinite(nb0)) {
        return op === '=' ? na0 === nb0 : na0 !== nb0;
      }
    }
  }
  const sa = a == null ? '' : String(a);
  const sb = b == null ? '' : String(b);
  if (op === '=') return sa === sb;
  if (op === '!=') return sa !== sb;
  const na = Number(a);
  const nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb)) {
    if (op === '>') return na > nb;
    if (op === '<') return na < nb;
    if (op === '>=') return na >= nb;
    if (op === '<=') return na <= nb;
  }
  if (op === '>') return sa > sb;
  if (op === '<') return sa < sb;
  if (op === '>=') return sa >= sb;
  if (op === '<=') return sa <= sb;
  return false;
}

/**
 * @param {number} n
 */
function clampByte(n) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(255, v));
}

/**
 * @param {number} r
 * @param {number} g
 * @param {number} b
 */
export function rgbChannelsToHex(r, g, b) {
  const h = (n) => clampByte(n).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

/**
 * Универсальный вычислитель AST (число / строка / boolean / null).
 * @param {object} node
 * @param {Record<string, unknown>} row
 * @param {AggSubtreeMemo} [aggMemo]
 * @param {FieldEvalContext|null} [fieldCtx]
 * @returns {unknown}
 */
export function evaluateAstValue(node, row, aggMemo, fieldCtx = null) {
  if (!node || typeof node !== 'object') {
    throw new FormulaError('INTERNAL', 'Пустой AST');
  }
  if (node.t === 'null') return null;
  if (node.t === 'num') return Number(node.v);
  if (node.t === 'str') return String(node.v ?? '');
  if (node.t === 'var') {
    const name = String(node.name || '');
    if (fieldCtx && typeof fieldCtx.hasVar === 'function' && !fieldCtx.hasVar(name)) {
      throw new FormulaError('UNKNOWN_VAR', `Неизвестная переменная @${name}`);
    }
    if (fieldCtx && typeof fieldCtx.getVar === 'function') {
      const v = fieldCtx.getVar(name);
      if (v === undefined && !(fieldCtx.hasVar && fieldCtx.hasVar(name))) {
        throw new FormulaError('UNKNOWN_VAR', `Неизвестная переменная @${name}`);
      }
      return v;
    }
    throw new FormulaError('UNKNOWN_VAR', `Неизвестная переменная @${name}`);
  }
  if (node.t === 'field') {
    const col = String(node.col || '');
    if (fieldCtx && typeof fieldCtx.getField === 'function') {
      return fieldCtx.getField(col);
    }
    if (row && Object.prototype.hasOwnProperty.call(row, col)) return row[col];
    return null;
  }
  if (node.t === 'for') {
    return evaluateAstValue(node.expr, row, aggMemo, fieldCtx);
  }
  if (node.t === 'agg') {
    const al = node.alias;
    if (!al) throw new FormulaError('INTERNAL', 'У агрегата нет alias');
    const fn = String(node.fn || 'SUM');
    let memoKey = '';
    if (aggMemo?.keyForAgg) {
      memoKey = aggMemo.keyForAgg(node, row) || '';
      if (memoKey && typeof aggMemo.get === 'function') {
        const hit = aggMemo.get(memoKey);
        if (typeof hit === 'number' && Number.isFinite(hit)) return hit;
      }
    }
    const val = coerceSqliteAggRawToNumber(row[al], fn);
    if (memoKey && typeof aggMemo.set === 'function' && Number.isFinite(val)) {
      aggMemo.set(memoKey, val);
    }
    return val;
  }
  if (node.t === 'ua') {
    const x = evaluateAstValue(node.x, row, aggMemo, fieldCtx);
    return -Number(x);
  }
  if (node.t === 'bin') {
    const a = Number(evaluateAstValue(node.l, row, aggMemo, fieldCtx));
    const b = Number(evaluateAstValue(node.r, row, aggMemo, fieldCtx));
    if (node.op === '+') return a + b;
    if (node.op === '-') return a - b;
    if (node.op === '*') return a * b;
    if (node.op === '/') {
      if (b === 0) {
        throw new FormulaError('DIV0', 'Деление на 0');
      }
      return a / b;
    }
    throw new FormulaError('INTERNAL', `Неизвестный оператор: ${node.op}`);
  }
  if (node.t === 'cmp') {
    const a = evaluateAstValue(node.l, row, aggMemo, fieldCtx);
    const b = evaluateAstValue(node.r, row, aggMemo, fieldCtx);
    return compareValues(a, b, node.op);
  }
  if (node.t === 'logic') {
    const a = isFormulaTruthy(evaluateAstValue(node.l, row, aggMemo, fieldCtx));
    if (node.op === 'and') {
      return a && isFormulaTruthy(evaluateAstValue(node.r, row, aggMemo, fieldCtx));
    }
    if (node.op === 'or') {
      return a || isFormulaTruthy(evaluateAstValue(node.r, row, aggMemo, fieldCtx));
    }
    throw new FormulaError('INTERNAL', `Неизвестный логический оператор: ${node.op}`);
  }
  if (node.t === 'rgb') {
    const r = evaluateAstValue(node.r, row, aggMemo, fieldCtx);
    const g = evaluateAstValue(node.g, row, aggMemo, fieldCtx);
    const b = evaluateAstValue(node.b, row, aggMemo, fieldCtx);
    return rgbChannelsToHex(Number(r), Number(g), Number(b));
  }
  if (node.t === 'if') {
    const ok = isFormulaTruthy(evaluateAstValue(node.cond, row, aggMemo, fieldCtx));
    return evaluateAstValue(ok ? node.then : node.else, row, aggMemo, fieldCtx);
  }
  if (node.t === 'match') {
    const subject = evaluateAstValue(node.subject, row, aggMemo, fieldCtx);
    const cases = Array.isArray(node.cases) ? node.cases : [];
    for (let i = 0; i < cases.length; i += 1) {
      const c = cases[i];
      if (compareValues(subject, c?.value, '=')) {
        return evaluateAstValue(c.body, row, aggMemo, fieldCtx);
      }
    }
    if (node.else) return evaluateAstValue(node.else, row, aggMemo, fieldCtx);
    return null;
  }
  throw new FormulaError('INTERNAL', 'Неизвестный узел AST');
}

/**
 * @param {object} node
 * @param {Record<string, unknown>} row
 * @param {AggSubtreeMemo} [aggMemo] — memoization ключей поддерева на узлах agg (опционально)
 * @param {FieldEvalContext|null} [fieldCtx] — getVar / getField
 * @returns {number}
 */
export function evaluateAst(node, row, aggMemo, fieldCtx = null) {
  const v = evaluateAstValue(node, row, aggMemo, fieldCtx);
  if (v == null) return NaN;
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Форматирование числа для отображения в виджете.
 * @param {number} n
 */
export function formatNumberForDisplay(n) {
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 1e9 || (Math.abs(n) < 1e-6 && n !== 0)) return n.toExponential(4);
  const rounded = Math.round(n * 1e6) / 1e6;
  return String(rounded);
}
