/**
 * LRU-style memo for scalar aggregation results keyed by deterministic context + agg spec.
 * Enables skipping identical aggregate SQL across widgets sharing model/filters/context.
 */

import { sha256Hex } from './formulaHasher.js';
import { normalizeAggColumnForBaseTable } from './compile.js';
import { filterHashForAggContext } from './formulaAggregateFetch.js';

const MAX_ENTRIES = 512;
/** @type {Map<string, { at: number, value: unknown }>} */
const aggregateScalarCache = new Map();

/** @typedef {{ fn: string, column: string, ignoreFilters?: boolean, localFilters?: object[] }} AggSpecLite */

export function clearFormulaAggregateReuseCache() {
  aggregateScalarCache.clear();
}

function trimAggCache() {
  while (aggregateScalarCache.size > MAX_ENTRIES) {
    const k = aggregateScalarCache.keys().next();
    if (k.done) break;
    aggregateScalarCache.delete(k.value);
  }
}

/**
 * @param {{
 *   modelId: string|number,
 *   base_table: string,
 *   filterHash: string,
 *   bumpGen: number,
 *   window: object|null,
 *   agg: AggSpecLite,
 * }} ctx
 */
export function makeAggregateScalarKey(ctx) {
  const fn = String(ctx.agg?.fn ?? '').toLowerCase();
  // Keep qualified column (employees.id vs documents.id) so reuse cache cannot
  // mix COUNT across tables after normalizeAggColumnForBaseTable strips prefixes.
  const colRaw = String(ctx.agg?.column ?? '');
  const colNorm = normalizeAggColumnForBaseTable(colRaw, String(ctx.base_table ?? ''));
  const ignoreFilters = !!ctx.agg?.ignoreFilters;
  const payload = {
    ver: 'v3e',
    m: String(ctx.modelId),
    t: String(ctx.base_table),
    fh: String(ctx.filterHash ?? ''),
    bg: Number(ctx.bumpGen) || 0,
    w: ctx.window,
    fn,
    column: colRaw || colNorm,
    colNorm,
    ...(ignoreFilters ? { noFilter: true } : {}),
    ...(ctx.agg?.localWhere ? { lw: ctx.agg.localWhere } : {}),
    ...(Array.isArray(ctx.agg?.localFilters) && ctx.agg.localFilters.length
      ? { lf: ctx.agg.localFilters }
      : {}),
  };
  return sha256Hex(JSON.stringify(payload));
}

/**
 * @param {string} key
 */
export function getCachedAggregateScalar(key) {
  const h = aggregateScalarCache.get(key);
  return h ? h.value : undefined;
}

/**
 * @param {string} key
 * @param {unknown} value
 */
export function setCachedAggregateScalar(key, value) {
  aggregateScalarCache.set(key, { at: Date.now(), value });
  trimAggCache();
}

/**
 * After SQL row, register each alias cell for aggregate keys.
 * @param {object} row
 * @param {{ key: string, fn: string, column: string, ignoreFilters?: boolean }[]} mergedAggs
 * @param {Map<string, string>} keyToAlias
 * @param {object} keyCtx merged context for keys
 */
export function registerAggRowScalars(row, mergedAggs, keyToAlias, keyCtx) {
  if (!row || typeof row !== 'object') return;
  for (const a of mergedAggs) {
    const alias = keyToAlias.get(a.key);
    if (!alias) continue;
    if (!Object.prototype.hasOwnProperty.call(row, alias)) continue;
    const ignoreFilters = !!a.ignoreFilters;
    const k = makeAggregateScalarKey({
      modelId: keyCtx.modelId,
      base_table: keyCtx.base_table,
      filterHash: filterHashForAggContext(keyCtx, ignoreFilters, a.localWhere || a.localFilters),
      bumpGen: keyCtx.bumpGen,
      window: ignoreFilters ? null : keyCtx.window,
      agg: {
        fn: a.fn,
        column: a.column,
        ignoreFilters,
        ...(a.localWhere ? { localWhere: a.localWhere } : {}),
        ...(a.localFilters?.length ? { localFilters: a.localFilters } : {}),
      },
    });
    setCachedAggregateScalar(k, row[alias]);
  }
}

/**
 * Try build full row `{ t_i: value }` for merged aggs entirely from reuse cache.
 * @returns {{ row: Record<string, unknown>|null }}
 */
export function tryReuseFullAggregateRow(mergedAggs, keyToAlias, keyCtx) {
  /** @type {Record<string, unknown>} */
  const row = {};
  for (let i = 0; i < mergedAggs.length; i++) {
    const a = mergedAggs[i];
    const alias = keyToAlias.get(a.key) || `t_${i}`;
    const ignoreFilters = !!a.ignoreFilters;
    const k = makeAggregateScalarKey({
      modelId: keyCtx.modelId,
      base_table: keyCtx.base_table,
      filterHash: filterHashForAggContext(keyCtx, ignoreFilters, a.localWhere || a.localFilters),
      bumpGen: keyCtx.bumpGen,
      window: ignoreFilters ? null : keyCtx.window,
      agg: {
        fn: a.fn,
        column: a.column,
        ignoreFilters,
        ...(a.localWhere ? { localWhere: a.localWhere } : {}),
        ...(a.localFilters?.length ? { localFilters: a.localFilters } : {}),
      },
    });
    const hit = getCachedAggregateScalar(k);
    if (hit === undefined) return { row: null };
    row[alias] = hit;
  }
  return { row };
}

/* ---- Subtree memo (post-SQL, per row signature) ---------------------------------- */

const MAX_SUBTREE_EVAL = 384;
/** @type {Map<string, number>} */
const subtreeEvalCache = new Map();

export function clearSubtreeEvalCache() {
  subtreeEvalCache.clear();
}

function trimSubtreeCache() {
  while (subtreeEvalCache.size > MAX_SUBTREE_EVAL) {
    const k = subtreeEvalCache.keys().next();
    if (k.done) break;
    subtreeEvalCache.delete(k.value);
  }
}

/**
 * @param {object} ast
 * @param {Record<string, unknown>} row
 */
export function aliasesSignatureForSubtree(ast, row) {
  const aliases = [];
  function walk(n) {
    if (!n || typeof n !== 'object') return;
    if (n.t === 'agg' && n.alias) aliases.push(String(n.alias));
    if (n.t === 'bin') {
      walk(n.l);
      walk(n.r);
    } else if (n.t === 'ua') walk(n.x);
  }
  walk(ast);
  aliases.sort();
  /** @type {Record<string, unknown>} */
  const slice = {};
  for (const a of aliases) {
    slice[a] = Object.prototype.hasOwnProperty.call(row, a) ? row[a] : null;
  }
  return sha256Hex(JSON.stringify(slice));
}

export function subtreeEvalMemoKey(bundleCtxKey, astFragment, row) {
  const rowSig = aliasesSignatureForSubtree(astFragment, row);
  const sh = sha256Hex(stableSubtreeJson(astFragment));
  return sha256Hex(JSON.stringify({ bundleCtxKey, sh, rowSig }));
}

function stableSubtreeJson(node) {
  if (!node || typeof node !== 'object') return node;
  if (node.t === 'num') return { t: 'num', v: node.v };
  if (node.t === 'agg')
    return {
      t: 'agg',
      fn: String(node.fn || '').toUpperCase(),
      col: String(node.col || ''),
      alias: node.alias,
      ...(node.ignoreFilters ? { ignoreFilters: true } : {}),
      ...(Array.isArray(node.localFilters) && node.localFilters.length
        ? { localFilters: node.localFilters }
        : {}),
    };
  if (node.t === 'ua') return { t: 'ua', x: stableSubtreeJson(node.x) };
  if (node.t === 'bin') return { t: 'bin', op: node.op, l: stableSubtreeJson(node.l), r: stableSubtreeJson(node.r) };
  return node;
}

/**
 * Fast path: reuse numeric evaluation for identical subtree + agg row fingerprint.
 */
export function getSubtreeMemo(key) {
  return subtreeEvalCache.get(key);
}

export function setSubtreeMemo(key, value) {
  subtreeEvalCache.set(key, value);
  trimSubtreeCache();
}

