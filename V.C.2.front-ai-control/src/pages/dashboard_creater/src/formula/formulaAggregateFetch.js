import { toSqliteAggregations, normalizeGroupByColumns } from './compile.js';
import {
  aggWhereHash,
  whereNodeToApiFilters,
  whereFromLocalFilters,
  canonicalizeWhere,
} from './localFilters.js';

const NO_FILTER_HASH = '__none__';

/**
 * @param {{ ignoreFilters?: boolean, localFilters?: object[], localWhere?: object }[]} mergedAggs
 * @returns {Map<string, typeof mergedAggs>}
 */
export function groupAggsByFilterSignature(mergedAggs) {
  /** @type {Map<string, typeof mergedAggs>} */
  const groups = new Map();
  for (const a of mergedAggs || []) {
    const ignore = !!a.ignoreFilters;
    const lfHash = aggWhereHash(a);
    const sig = `${ignore ? '1' : '0'}|${lfHash}`;
    let bucket = groups.get(sig);
    if (!bucket) {
      bucket = [];
      groups.set(sig, bucket);
    }
    bucket.push(a);
  }
  return groups;
}

/**
 * @deprecated use groupAggsByFilterSignature — kept for tests / callers
 * @param {{ ignoreFilters?: boolean }[]} mergedAggs
 */
export function splitAggsByFilterMode(mergedAggs) {
  /** @type {typeof mergedAggs} */
  const filtered = [];
  /** @type {typeof mergedAggs} */
  const unfiltered = [];
  for (const a of mergedAggs) {
    if (a.ignoreFilters) unfiltered.push(a);
    else filtered.push(a);
  }
  return { filtered, unfiltered };
}

/**
 * @param {object} keyCtx
 * @param {boolean} ignoreFilters
 * @param {object|object[]|null|undefined} [localWhereOrFilters]
 */
export function filterHashForAggContext(keyCtx, ignoreFilters, localWhereOrFilters = null) {
  const base = ignoreFilters ? NO_FILTER_HASH : keyCtx.filterHash;
  const lf = Array.isArray(localWhereOrFilters)
    ? aggWhereHash({ localFilters: localWhereOrFilters })
    : aggWhereHash({
        localWhere: localWhereOrFilters,
        localFilters: null,
      });
  return lf ? `${base}|lf:${lf}` : base;
}

/**
 * @param {{ localWhere?: unknown, localFilters?: unknown }} sampleAgg
 */
function resolveAggWhere(sampleAgg) {
  let w = canonicalizeWhere(sampleAgg?.localWhere);
  if (!w && sampleAgg?.localFilters) {
    w = whereFromLocalFilters(sampleAgg.localFilters);
  }
  return w;
}

/**
 * Собирает filters для группы агрегатов: dashboard AND local (или только local при ignoreFilters).
 * @param {object[]} dashboardFilters
 * @param {{ ignoreFilters?: boolean, localFilters?: object[], localWhere?: object }} sampleAgg
 */
export function buildFiltersForAggGroup(dashboardFilters, sampleAgg) {
  const localApi = whereNodeToApiFilters(resolveAggWhere(sampleAgg));
  if (sampleAgg?.ignoreFilters) {
    return localApi;
  }
  const base = Array.isArray(dashboardFilters) ? dashboardFilters : [];
  if (!localApi.length) return base;
  return [...base, ...localApi];
}

/**
 * Выполняет один или несколько aggregate-запросов (по сигнатуре фильтров) и смерживает row для evaluateAst.
 * @param {object} client — DashboardDataModelClient
 * @param {{
 *   modelId: number|string,
 *   base_table: string,
 *   mergedAggs: object[],
 *   keyToAlias: Map<string, string>,
 *   filters: object[],
 * }} opts
 * @returns {Promise<Record<string, unknown>>}
 */
export async function fetchMergedAggregateRow(client, opts) {
  const { modelId, base_table, mergedAggs, keyToAlias, filters } = opts;
  const groups = groupAggsByFilterSignature(mergedAggs);

  const buckets = [...groups.values()].filter((b) => b.length);
  // Bucket'ы независимы — запускаем параллельно (батчер склеит их в один query-batch),
  // мержим в исходном порядке для детерминизма.
  const results = await Promise.all(
    buckets.map((bucket) =>
      client.fetchAggregate({
        modelId,
        base_table,
        group_by: [],
        aggregations: toSqliteAggregations(bucket, keyToAlias, base_table),
        filters: buildFiltersForAggGroup(filters, bucket[0]),
        limit: 1,
      }),
    ),
  );

  /** @type {Record<string, unknown>} */
  const row = {};
  for (const { rows } of results) {
    Object.assign(row, rows?.[0] || {});
  }
  return row;
}

/**
 * Ключ строки GROUP BY для слияния нескольких aggregate-запросов (разный WHERE).
 * @param {Record<string, unknown>} row
 * @param {string[]} groupByColumns
 */
export function groupedRowKey(row, groupByColumns) {
  return (groupByColumns || []).map((c) => JSON.stringify(row?.[c] ?? null)).join('\0');
}

/**
 * Aggregate + GROUP BY. Несколько bucket'ов (разный WHERE) мержатся по ключу группы.
 * @param {object} client
 * @param {{
 *   modelId: number|string,
 *   base_table: string,
 *   mergedAggs: object[],
 *   keyToAlias: Map<string, string>,
 *   filters: object[],
 *   groupBy: { table?: string, column?: string }[],
 *   limit?: number,
 * }} opts
 * @returns {Promise<{ rows: Record<string, unknown>[], groupByColumns: string[] }>}
 */
export async function fetchMergedAggregateRows(client, opts) {
  const { modelId, base_table, mergedAggs, keyToAlias, filters, groupBy } = opts;
  const groupByColumns = normalizeGroupByColumns(groupBy, base_table);
  if (!groupByColumns.length) {
    const row = await fetchMergedAggregateRow(client, opts);
    return { rows: [row], groupByColumns: [] };
  }

  const limit = Math.max(1, Number(opts.limit) || 500);
  const groups = groupAggsByFilterSignature(mergedAggs);
  /** @type {Map<string, Record<string, unknown>>} */
  const byKey = new Map();
  /** @type {string[]} */
  const keyOrder = [];

  const buckets = [...groups.values()].filter((b) => b.length);
  const results = await Promise.all(
    buckets.map((bucket) =>
      client.fetchAggregate({
        modelId,
        base_table,
        group_by: groupByColumns,
        aggregations: toSqliteAggregations(bucket, keyToAlias, base_table),
        filters: buildFiltersForAggGroup(filters, bucket[0]),
        limit,
      }),
    ),
  );

  buckets.forEach((bucket, ix) => {
    const { rows } = results[ix];
    for (const r of rows || []) {
      const k = groupedRowKey(r, groupByColumns);
      let acc = byKey.get(k);
      if (!acc) {
        acc = {};
        for (const c of groupByColumns) {
          acc[c] = r[c];
        }
        byKey.set(k, acc);
        keyOrder.push(k);
      }
      for (const a of bucket) {
        const al = keyToAlias.get(a.key);
        if (al) acc[al] = r[al];
      }
    }
  });

  return { rows: keyOrder.map((k) => byKey.get(k)), groupByColumns };
}

export { NO_FILTER_HASH };
