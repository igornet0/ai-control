import { getDashboardDataModelClient } from '../../../../services/dashboardDataModel/DashboardDataModelClient.js';
import {
  collectDashboardFilters,
  filtersForModel,
} from '../../../../services/dashboardFilterUtils.js';
import { canonicalizeFilters } from '../../../../services/dashboardDataModel/intentTypes.js';
import { getDashboardQueryBumpGeneration } from '../../../../services/dashboardQueryBump.js';
import { compileFormulaBundle, getCompiledFormula } from './cache.js';
import { formulaGroupBy } from './compile.js';
import { fetchMergedAggregateRow } from './formulaAggregateFetch.js';
import { evaluateAst, formatEvalResultForDisplay } from './evaluate.js';
import { formatFormulaError, GROUPED_FORMULA_SCALAR_HINT } from './errors.js';
import { appendDateRangeFilters, stripDateFieldRangeFilters } from '../widgets/kpi/kpiCompute.js';
import { sha256Hex } from './formulaHasher.js';
import {
  trimWidgetFormulaResultCache,
  widgetFormulaInflight,
  widgetFormulaResultCache,
} from './widgetFormulaBundleCache.js';

export { clearWidgetFormulaResultCache } from './widgetFormulaBundleCache.js';

import { isFormulaCacheV3, isFormulaDagRecompute } from './formulaFeatures.js';
import { buildFormulaComputeContextV3, composeSubtreeContextKey } from './formulaComputeContext.js';
import {
  registerAggRowScalars,
  tryReuseFullAggregateRow,
  subtreeEvalMemoKey,
  getSubtreeMemo,
  setSubtreeMemo,
} from './formulaCacheManager.js';
import { getFormulaSheetGraph, collectSubtreeHashes } from './formulaGraph.js';
import { hashCanonicalAst } from './formulaCanonical.js';
import { ensureFormulaInvalidationHooks } from './formulaInvalidation.js';
import { makeFormulaVarContext, snapshotEngineModelVariables } from './formulaVarContext.js';

const RESULT_TTL_MS = 60000;

/**
 * @typedef {{ byId: Record<string, { numeric: number|null, value: string, error: string }>, errors: Record<string, string> }} NamedFormulaBundleResult
 */

function stableNamedFormulas(named) {
  const o = {};
  Object.keys(named || {})
    .sort()
    .forEach((k) => {
      const t = String(named[k] ?? '').trim();
      if (t) o[k] = t;
    });
  return o;
}

function effectiveFiltersForNamedBundle(engine, modelId, base_table, kpiWindow) {
  let filters = engine ? filtersForModel(collectDashboardFilters(engine), modelId) : [];
  const df = String(kpiWindow?.dateField || '').trim();
  const wr = kpiWindow?.range;
  if (df && wr && String(wr.start || '').trim() && String(wr.end || '').trim()) {
    filters = appendDateRangeFilters(
      stripDateFieldRangeFilters(filters, base_table, df),
      base_table,
      df,
      wr.start,
      wr.end,
    );
  }
  return filters;
}

function computeFormulaFingerprintsForKey(roots) {
  /** @type {Record<string,string>} */
  const rootHashes = {};
  /** @type {Record<string,string>} */
  const formulaVersions = {};
  Object.keys(roots)
    .sort()
    .forEach((id) => {
      const src = roots[id];
      formulaVersions[id] = sha256Hex(src);
      try {
        const { canonicalHash } = getCompiledFormula(src);
        rootHashes[id] = canonicalHash || sha256Hex(`raw:${src}`);
      } catch {
        rootHashes[id] = sha256Hex(`err:${src}`);
      }
    });
  return { rootHashes, formulaVersions };
}

/**
 * @param {object|null} engine
 * @param {number|string} modelId
 * @param {string} base_table
 * @param {Record<string, string>} named — непустые формулы
 * @param {{ dateField?: string, range?: { start: string, end: string } }|null} [kpiWindow]
 * @param {{
 *   sourceVersion?: string,
 *   schemaVersion?: string,
 *   rootHashes?: Record<string,string>,
 *   formulaVersions?: Record<string,string>,
 * } | null} [extra]
 */
export function buildNamedFormulaCacheKey(engine, modelId, base_table, named, kpiWindow, extra = null) {
  const filters = effectiveFiltersForNamedBundle(engine, modelId, base_table, kpiWindow);
  const win =
    kpiWindow?.dateField && kpiWindow?.range?.start && kpiWindow?.range?.end
      ? { d: String(kpiWindow.dateField), r: { ...kpiWindow.range } }
      : null;
  const stable = stableNamedFormulas(named);
  const varsSnap = snapshotEngineModelVariables(engine);
  const base = {
    g: getDashboardQueryBumpGeneration(),
    m: String(modelId),
    t: String(base_table),
    fl: canonicalizeFilters(filters),
    w: win,
    n: stable,
    vars: varsSnap,
  };

  if (!isFormulaCacheV3()) {
    return JSON.stringify({ v: 2, ...base });
  }

  const fp = extra?.rootHashes
    ? { rootHashes: extra.rootHashes, formulaVersions: extra.formulaVersions || {} }
    : computeFormulaFingerprintsForKey(stable);

  const ctx = buildFormulaComputeContextV3({
    modelId,
    base_table,
    filtersSnapshot: filters,
    bumpGen: base.g,
    window: win,
    formulaRootHashes: fp.rootHashes,
    formulaVersions: fp.formulaVersions,
    varsSnapshot: varsSnap,
  });

  return JSON.stringify({
    v: 3,
    ...base,
    c3: {
      bundle: ctx.formulaBundleHash,
      filterH: ctx.filterHash,
      scopeH: ctx.scopeHash,
      varsH: ctx.varsHash,
      src: String(extra?.sourceVersion ?? ''),
      sch: String(extra?.schemaVersion ?? ''),
    },
  });
}

/**
 * Один aggregate-запрос на набор формул; дедуп по канону; кэш + inflight по ключу контекста v3.
 *
 * @param {object} engine
 * @param {number|string} modelId
 * @param {string} base_table
 * @param {Record<string, string>} namedFormulas — id → текст формулы (пустые пропускаются)
 * @param {{ dateField?: string, range?: { start: string, end: string } }|null} [kpiWindow]
 * @param {{ sourceVersion?: string, schemaVersion?: string, widgetId?: string|number } | null} [options]
 * @returns {Promise<NamedFormulaBundleResult>}
 */
export async function runNamedFormulaBundle(engine, modelId, base_table, namedFormulas, kpiWindow, options = null) {
  await ensureFormulaInvalidationHooks();

  const named = stableNamedFormulas(namedFormulas);
  const ids = Object.keys(named);
  if (!ids.length) {
    return { byId: {}, errors: {} };
  }

  const fpEarly = computeFormulaFingerprintsForKey(named);
  const cacheKey = buildNamedFormulaCacheKey(engine, modelId, base_table, named, kpiWindow, {
    sourceVersion: options?.sourceVersion,
    schemaVersion: options?.schemaVersion,
    rootHashes: fpEarly.rootHashes,
    formulaVersions: fpEarly.formulaVersions,
  });

  const hit = widgetFormulaResultCache.get(cacheKey);
  if (hit && Date.now() - hit.at < RESULT_TTL_MS) {
    return hit.data;
  }

  if (widgetFormulaInflight.has(cacheKey)) {
    return widgetFormulaInflight.get(cacheKey);
  }

  const p = (async () => {
    /** @type {NamedFormulaBundleResult} */
    const out = { byId: {}, errors: {} };

    try {
      const formulaList = ids.map((id) => named[id]);

      const uniqueInOrder = [];
      const canonKeyToIndex = new Map();
      const formulaToAstIndex = new Map();
      /** @type {Set<string>} */
      const groupedSources = new Set();

      for (const f of formulaList) {
        const cf = getCompiledFormula(f);
        if (formulaGroupBy(cf.ast)?.length) {
          groupedSources.add(f);
          continue;
        }
        const ck = cf.canonicalHash || sha256Hex(`raw:${f}`);
        let idx = canonKeyToIndex.get(ck);
        if (idx === undefined) {
          idx = uniqueInOrder.length;
          canonKeyToIndex.set(ck, idx);
          uniqueInOrder.push(f);
        }
        formulaToAstIndex.set(f, idx);
      }

      for (const id of ids) {
        if (groupedSources.has(named[id])) {
          out.byId[id] = { numeric: null, value: '', error: GROUPED_FORMULA_SCALAR_HINT };
          out.errors[id] = GROUPED_FORMULA_SCALAR_HINT;
        }
      }

      if (!uniqueInOrder.length) {
        return out;
      }

      const bundle = compileFormulaBundle(uniqueInOrder);
      const client = getDashboardDataModelClient(engine);
      const filters = effectiveFiltersForNamedBundle(engine, modelId, base_table, kpiWindow);

      const bumpGen = getDashboardQueryBumpGeneration();
      const win =
        kpiWindow?.dateField && kpiWindow?.range?.start && kpiWindow?.range?.end
          ? { d: String(kpiWindow.dateField), r: { ...kpiWindow.range } }
          : null;

      const ctxV3 = buildFormulaComputeContextV3({
        modelId,
        base_table,
        filtersSnapshot: filters,
        bumpGen,
        window: win,
        formulaRootHashes: fpEarly.rootHashes,
        formulaVersions: fpEarly.formulaVersions,
        varsSnapshot: snapshotEngineModelVariables(engine),
      });

      const bundleCtxKey = composeSubtreeContextKey({
        filterHash: ctxV3.filterHash,
        scopeHash: ctxV3.scopeHash,
        bumpGen,
        window: win,
        sourceVersion: options?.sourceVersion ?? '',
        schemaVersion: options?.schemaVersion ?? '',
      });

      const keyCtx = {
        modelId,
        base_table,
        filterHash: ctxV3.filterHash,
        bumpGen,
        window: win,
      };

      let row = null;
      const reused = tryReuseFullAggregateRow(bundle.mergedAggs, bundle.keyToAlias, keyCtx);
      if (reused.row) {
        row = reused.row;
      } else {
        row = await fetchMergedAggregateRow(client, {
          modelId,
          base_table,
          mergedAggs: bundle.mergedAggs,
          keyToAlias: bundle.keyToAlias,
          filters,
        });
        registerAggRowScalars(row, bundle.mergedAggs, bundle.keyToAlias, keyCtx);
      }

      if (isFormulaDagRecompute() && engine && options?.widgetId != null) {
        const g = getFormulaSheetGraph(engine);
        if (g) {
          const subtrees = new Set();
          bundle.asts.forEach((ast) => {
            collectSubtreeHashes(ast, hashCanonicalAst).forEach((h) => subtrees.add(h));
          });
          const roots = bundle.canonicalHashes || [];
          g.register(String(options.widgetId), [...subtrees], roots);
        }
      }

      const aggMemo =
        isFormulaCacheV3() && bundleCtxKey
          ? {
              get: getSubtreeMemo,
              set: setSubtreeMemo,
              keyForAgg: (node, r) => subtreeEvalMemoKey(bundleCtxKey, node, r),
            }
          : undefined;

      for (const id of ids) {
        const f = named[id];
        if (groupedSources.has(f)) continue;
        const idx = formulaToAstIndex.get(f);
        const ast = bundle.asts[idx];
        try {
          const n = evaluateAst(ast, row, aggMemo, makeFormulaVarContext(engine));
          if (!Number.isFinite(n)) {
            out.byId[id] = { numeric: null, value: '—', error: '' };
          } else {
            out.byId[id] = {
              numeric: n,
              value: formatEvalResultForDisplay(n, f),
              error: '',
            };
          }
        } catch (e) {
          const msg = formatFormulaError(e);
          out.byId[id] = { numeric: null, value: '', error: msg };
          out.errors[id] = msg;
        }
      }
    } catch (e) {
      const msg = formatFormulaError(e);
      for (const id of ids) {
        out.byId[id] = { numeric: null, value: '', error: msg };
        out.errors[id] = msg;
      }
    }

    widgetFormulaResultCache.set(cacheKey, { at: Date.now(), data: out });
    trimWidgetFormulaResultCache();
    return out;
  })();

  widgetFormulaInflight.set(cacheKey, p);
  try {
    return await p;
  } finally {
    widgetFormulaInflight.delete(cacheKey);
  }
}
