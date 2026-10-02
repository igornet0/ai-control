import { tokenize } from './tokenizer.js';
import { parseExpression } from './parser.js';
import { FormulaError } from './errors.js';
import {
  aggWhereHash,
  canonicalizeLocalFilters,
  canonicalizeWhere,
  cloneLocalFilters,
  cloneWhere,
  flattenAndLeaves,
  whereFromLocalFilters,
} from './localFilters.js';

/**
 * @typedef {{
 *   key: string,
 *   fn: string,
 *   column: string,
 *   ignoreFilters?: boolean,
 *   localFilters?: import('./localFilters.js').SqlLocalFilter[],
 *   localWhere?: import('./localFilters.js').WhereNode,
 * }} AggSpec
 */

/**
 * @param {string} fn
 * @param {string} col
 * @param {boolean} [ignoreFilters]
 * @param {import('./localFilters.js').WhereNode|import('./localFilters.js').SqlLocalFilter[]|null|undefined} [whereOrFilters]
 */
export function aggKey(fn, col, ignoreFilters = false, whereOrFilters = null) {
  const f = String(fn || '').toLowerCase();
  const c = String(col || '');
  let base = ignoreFilters ? `${f}:${c}:$` : `${f}:${c}`;
  let wh = '';
  if (whereOrFilters && typeof whereOrFilters === 'object' && !Array.isArray(whereOrFilters) && /** @type {any} */ (whereOrFilters).t) {
    wh = aggWhereHash({ localWhere: whereOrFilters });
  } else {
    wh = aggWhereHash({ localFilters: whereOrFilters, localWhere: null });
  }
  if (wh) base = `${base}:w:${wh}`;
  return base;
}

/**
 * Обходит AST и собирает agg-узлы (с полем key).
 * @param {object} node
 * @param {AggSpec[]} out
 */
function collectAggs(node, out) {
  if (!node || typeof node !== 'object') return;
  if (node.t === 'agg') {
    const fn = String(node.fn);
    const col = String(node.col || '');
    const ignoreFilters = !!node.ignoreFilters;
    let localWhere = canonicalizeWhere(node.localWhere);
    if (!localWhere && node.localFilters) {
      localWhere = whereFromLocalFilters(node.localFilters);
    }
    const key = aggKey(fn, col, ignoreFilters, localWhere);
    node.key = key;
    if (localWhere) {
      node.localWhere = localWhere;
      const flat = flattenAndLeaves(localWhere);
      if (flat?.length) node.localFilters = flat;
      else delete node.localFilters;
    } else {
      delete node.localWhere;
      delete node.localFilters;
    }
    /** @type {AggSpec} */
    const spec = { key, fn: fn.toLowerCase(), column: col, ignoreFilters };
    if (localWhere) {
      spec.localWhere = cloneWhere(localWhere) || undefined;
      const flat = flattenAndLeaves(localWhere);
      if (flat?.length) spec.localFilters = cloneLocalFilters(flat);
    }
    out.push(spec);
    return;
  }
  if (node.t === 'bin' || node.t === 'cmp' || node.t === 'logic') {
    collectAggs(node.l, out);
    collectAggs(node.r, out);
    return;
  }
  if (node.t === 'ua') {
    collectAggs(node.x, out);
    return;
  }
  if (node.t === 'rgb') {
    collectAggs(node.r, out);
    collectAggs(node.g, out);
    collectAggs(node.b, out);
    return;
  }
  if (node.t === 'if') {
    collectAggs(node.cond, out);
    collectAggs(node.then, out);
    collectAggs(node.else, out);
    return;
  }
  if (node.t === 'match') {
    collectAggs(node.subject, out);
    (node.cases || []).forEach((c) => collectAggs(c?.body, out));
    collectAggs(node.else, out);
    return;
  }
  if (node.t === 'for') {
    collectAggs(node.expr, out);
  }
}

/**
 * @param {object} node
 * @param {Map<string, string>} keyToAlias
 */
function assignAliases(node, keyToAlias) {
  if (!node || typeof node !== 'object') return;
  if (node.t === 'agg') {
    const al = keyToAlias.get(node.key);
    if (!al) {
      throw new FormulaError('INTERNAL', 'Не найден alias для агрегата');
    }
    node.alias = al;
    return;
  }
  if (node.t === 'bin' || node.t === 'cmp' || node.t === 'logic') {
    assignAliases(node.l, keyToAlias);
    assignAliases(node.r, keyToAlias);
    return;
  }
  if (node.t === 'ua') {
    assignAliases(node.x, keyToAlias);
    return;
  }
  if (node.t === 'rgb') {
    assignAliases(node.r, keyToAlias);
    assignAliases(node.g, keyToAlias);
    assignAliases(node.b, keyToAlias);
    return;
  }
  if (node.t === 'if') {
    assignAliases(node.cond, keyToAlias);
    assignAliases(node.then, keyToAlias);
    assignAliases(node.else, keyToAlias);
    return;
  }
  if (node.t === 'match') {
    assignAliases(node.subject, keyToAlias);
    (node.cases || []).forEach((c) => assignAliases(c?.body, keyToAlias));
    assignAliases(node.else, keyToAlias);
    return;
  }
  if (node.t === 'for') {
    assignAliases(node.expr, keyToAlias);
  }
}

/**
 * @param {object|null|undefined} ast
 * @returns {{ table: string, column: string }[]|null}
 */
export function formulaGroupBy(ast) {
  if (!ast || ast.t !== 'for' || !Array.isArray(ast.by) || !ast.by.length) return null;
  return ast.by.map((f) => ({
    table: String(f.table || '').trim(),
    column: String(f.column || '').trim(),
  }));
}

/**
 * @param {object|null|undefined} ast
 */
export function unwrapGroupedAst(ast) {
  return ast?.t === 'for' ? ast.expr : ast;
}

/**
 * Стабильный ключ списка группировки (порядок как в формуле).
 * @param {{ table?: string, column?: string }[]|null|undefined} groupBy
 */
export function groupBySignature(groupBy) {
  if (!Array.isArray(groupBy) || !groupBy.length) return '';
  return groupBy
    .map((f) => `${String(f.table || '').trim()}.${String(f.column || '').trim()}`.toLowerCase())
    .join('|');
}

/**
 * Короткие имена колонок group_by для sqlite/query (должны быть на base_table).
 * @param {{ table?: string, column?: string }[]|null|undefined} groupBy
 * @param {string} [baseTable]
 * @returns {string[]}
 */
export function normalizeGroupByColumns(groupBy, baseTable) {
  if (!Array.isArray(groupBy) || !groupBy.length) return [];
  return groupBy.map((g) => {
    const table = String(g.table || '').trim();
    const column = String(g.column || '').trim();
    const qualified = table && column.indexOf('.') < 0 ? `${table}.${column}` : column;
    return normalizeAggColumnForBaseTable(qualified, baseTable);
  });
}

/**
 * @param {string} formula
 * @param {{ allowFieldRef?: boolean }} [opts]
 * @returns {{ ast: object, aggs: AggSpec[], groupBy: { table: string, column: string }[]|null }}
 */
export function compileFormula(formula, opts = {}) {
  const src = String(formula ?? '').trim();
  if (!src) {
    throw new FormulaError('EMPTY', 'Пустая формула');
  }
  const tokens = tokenize(src);
  const ast = parseExpression(tokens, opts);
  const aggs = [];
  collectAggs(ast, aggs);
  const groupBy = formulaGroupBy(ast);
  if (groupBy) {
    if (!aggs.length) {
      throw new FormulaError(
        'SYNTAX',
        'FOR требует агрегат. Например: SUM([orders.qty]) FOR [orders.region_id]',
        ast.pos,
      );
    }
    for (const g of groupBy) {
      if (!g.table || !g.column) {
        throw new FormulaError('SYNTAX', 'В FOR поле должно быть квалифицировано: [таблица.колонка]', ast.pos);
      }
    }
  }
  return { ast, aggs, groupBy };
}

/**
 * Уникальные агрегаты в стабильном порядке появления.
 * @param {AggSpec[][]} lists
 * @returns {AggSpec[]}
 */
export function mergeAggSpecsInOrder(lists) {
  const seen = new Set();
  const out = [];
  for (const list of lists) {
    for (const a of list) {
      if (seen.has(a.key)) continue;
      seen.add(a.key);
      out.push(a);
    }
  }
  return out;
}

/**
 * @param {object[]} asts — AST нескольких формул
 * @param {AggSpec[]} mergedAggs
 * @returns {Map<string, string>}
 */
export function buildKeyToAliasMap(mergedAggs) {
  const m = new Map();
  mergedAggs.forEach((a, i) => {
    m.set(a.key, `t_${i}`);
  });
  return m;
}

/**
 * @param {AggSpec[]} mergedAggs
 * @param {Map<string, string>} keyToAlias
 */
export function applyAliasesToAsts(asts, keyToAlias) {
  for (const ast of asts) {
    assignAliases(ast, keyToAlias);
  }
}

/**
 * API sqlite/query знает колонки `base_table` только по короткому имени.
 * Если в формуле указано `orders.amount`, а base_table === `orders`, шлём `amount`.
 * @param {string} column
 * @param {string} [baseTable]
 */
export function normalizeAggColumnForBaseTable(column, baseTable) {
  if (column == null || column === '*' || column === '') return column;
  const c = String(column).trim();
  const bt = String(baseTable || '').trim();
  if (!bt) return c;
  const plen = bt.length + 1;
  if (c.length > plen && c.charAt(bt.length) === '.' && c.slice(0, bt.length).toLowerCase() === bt.toLowerCase()) {
    return c.slice(plen);
  }
  const dot = c.indexOf('.');
  if (dot > 0) {
    const tbl = c.slice(0, dot);
    const rest = c.slice(dot + 1);
    if (tbl.toLowerCase() === bt.toLowerCase() && rest) return rest;
  }
  return c;
}

/**
 * Список aggregations для API sqlite/query.
 * @param {AggSpec[]} mergedAggs
 * @param {Map<string, string>} keyToAlias
 * @param {string} [baseTable]
 */
export function toSqliteAggregations(mergedAggs, keyToAlias, baseTable) {
  return mergedAggs.map((a) => ({
    fn: a.fn,
    column: normalizeAggColumnForBaseTable(a.column, baseTable),
    as: keyToAlias.get(a.key),
  }));
}

export {
  canonicalizeLocalFilters,
  cloneLocalFilters,
  canonicalizeWhere,
  cloneWhere,
  whereHash,
  whereNodeToApiFilters,
  flattenAndLeaves,
  aggWhereHash,
  localFiltersHash,
} from './localFilters.js';
