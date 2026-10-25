import {
  compileFormula,
  mergeAggSpecsInOrder,
  buildKeyToAliasMap,
  applyAliasesToAsts,
} from './compile.js';
import { FormulaError } from './errors.js';
import { isFormulaCacheV3 } from './formulaFeatures.js';
import { hashCanonicalAst } from './formulaCanonical.js';

/** @typedef {{ ast: object, aggs: import('./compile.js').AggSpec[], canonicalHash: string }} CompiledFormula */

const astCache = new Map();
/** @type {Map<string, string>} trimmed source -> canonical hash (v3 fast path) */
const sourceToCanonical = new Map();
const MAX_SOURCE_TO_CANON = 384;
const MAX_AST_CACHE = 512;

function trimAstCache() {
  while (astCache.size > MAX_AST_CACHE) {
    const k = astCache.keys().next();
    if (k.done) break;
    astCache.delete(k.value);
  }
}

function trimSourceToCanon() {
  while (sourceToCanonical.size > MAX_SOURCE_TO_CANON) {
    const k = sourceToCanonical.keys().next();
    if (k.done) break;
    sourceToCanonical.delete(k.value);
  }
}

/**
 * @param {string} formula
 * @returns {CompiledFormula}
 */
export function getCompiledFormula(formula) {
  const trimmed = String(formula ?? '').trim();
  if (!trimmed) {
    throw new FormulaError('EMPTY', 'Пустая формула');
  }

  if (!isFormulaCacheV3()) {
    const rawKey = `raw:${trimmed}`;
    let hit = astCache.get(rawKey);
    if (!hit) {
      hit = compileFormula(trimmed);
      astCache.set(rawKey, hit);
      trimAstCache();
    }
    return {
      ast: cloneAst(hit.ast),
      aggs: hit.aggs.map((a) => cloneAggSpec(a)),
      canonicalHash: '',
    };
  }

  const knownCh = sourceToCanonical.get(trimmed);
  if (knownCh) {
    const cached = astCache.get(`can:${knownCh}`);
    if (cached) {
      return {
        ast: cloneAst(cached.ast),
        aggs: cached.aggs.map((a) => cloneAggSpec(a)),
        canonicalHash: knownCh,
      };
    }
  }

  const probe = compileFormula(trimmed);
  const ch = hashCanonicalAst(probe.ast);
  sourceToCanonical.set(trimmed, ch);
  trimSourceToCanon();

  const canKey = `can:${ch}`;
  let hit = astCache.get(canKey);
  if (!hit) {
    hit = {
      ast: cloneAst(probe.ast),
      aggs: probe.aggs.map((a) => cloneAggSpec(a)),
    };
    astCache.set(canKey, hit);
    trimAstCache();
  }
  return {
    ast: cloneAst(hit.ast),
    aggs: hit.aggs.map((a) => cloneAggSpec(a)),
    canonicalHash: ch,
  };
}

/** Размер кэша AST (для тестов). */
export function formulaAstCacheSize() {
  return astCache.size;
}

/** Сброс кэша AST (например, в тестах). */
export function clearFormulaAstCache() {
  astCache.clear();
  sourceToCanonical.clear();
}

/**
 * Глубокое клонирование AST (agg / bin / ua / num).
 * @param {object} node
 */
function cloneAst(node) {
  if (!node || typeof node !== 'object') return node;
  if (node.t === 'num') return { t: 'num', v: node.v };
  if (node.t === 'agg') {
    return {
      t: 'agg',
      fn: node.fn,
      col: node.col,
      key: node.key,
      alias: node.alias,
      ...(node.ignoreFilters ? { ignoreFilters: true } : {}),
      ...(node.localWhere ? { localWhere: structuredCloneWhere(node.localWhere) } : {}),
      ...(Array.isArray(node.localFilters) && node.localFilters.length
        ? {
            localFilters: node.localFilters.map((f) => ({
              table: f.table,
              column: f.column,
              op: f.op,
              ...(f.values ? { values: [...f.values] } : { value: f.value }),
            })),
          }
        : {}),
    };
  }
  if (node.t === 'ua') return { t: 'ua', x: cloneAst(node.x) };
  if (node.t === 'bin') {
    return { t: 'bin', op: node.op, l: cloneAst(node.l), r: cloneAst(node.r) };
  }
  if (node.t === 'for') {
    return {
      t: 'for',
      expr: cloneAst(node.expr),
      by: (node.by || []).map((f) => ({
        table: String(f.table || ''),
        column: String(f.column || ''),
      })),
      ...(node.pos != null ? { pos: node.pos } : {}),
    };
  }
  return node;
}

function cloneAggSpec(a) {
  return {
    ...a,
    ...(a.localWhere ? { localWhere: structuredCloneWhere(a.localWhere) } : {}),
    ...(a.localFilters?.length
      ? {
          localFilters: a.localFilters.map((f) => ({
            ...f,
            ...(f.values ? { values: [...f.values] } : {}),
          })),
        }
      : {}),
  };
}

function structuredCloneWhere(w) {
  if (!w || typeof w !== 'object') return w;
  if (w.t === 'pred') {
    return {
      t: 'pred',
      table: w.table,
      column: w.column,
      op: w.op,
      ...(w.values ? { values: [...w.values] } : { value: w.value }),
    };
  }
  if (w.t === 'and' || w.t === 'or') {
    return { t: w.t, items: (w.items || []).map(structuredCloneWhere) };
  }
  return w;
}

/**
 * Компиляция набора формул: общий список агрегатов + AST с alias.
 * @param {string[]} formulas
 */
export function compileFormulaBundle(formulas) {
  const compiled = formulas.map((f) => getCompiledFormula(f));
  const merged = mergeAggSpecsInOrder(compiled.map((c) => c.aggs));
  const keyToAlias = buildKeyToAliasMap(merged);
  const asts = compiled.map((c) => c.ast);
  applyAliasesToAsts(asts, keyToAlias);
  return {
    asts,
    mergedAggs: merged,
    keyToAlias,
    canonicalHashes: compiled.map((c) => c.canonicalHash || ''),
  };
}
