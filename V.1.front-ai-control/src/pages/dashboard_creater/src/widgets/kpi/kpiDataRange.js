/**
 * Авто-диапазоны KPI по данным (календарное окно вокруг последней даты + предыдущий период)
 * и проверка, что в окне сравнения есть строки.
 */

import { getDashboardDataModelClient } from '../../../../../services/dashboardDataModel/DashboardDataModelClient.js';
import { parseDateTimeLikeToEvalMs } from '../../formula/evaluate.js';
import { appendDateRangeFilters, stripDateFieldRangeFilters } from './kpiCompute.js';
import {
  bucketEndInclusiveLocal,
  bucketStartLocal,
  computePreviousKpiWindowMs,
  inclusiveRangeToLocalMs,
  formatLocalSqlDateTimeEnd,
  formatLocalSqlDateTimeStart,
  normalizeKpiPeriodShift,
  shiftInclusiveRangeByGranularitySteps,
} from './kpiGranularity.js';
import {
  formatLocalYMD,
  resolveKpiDateRangeWithSource,
} from './kpiPeriods.js';

const RECENT_ROW_LIMIT = 256;

/**
 * @param {number[]} sortedAsc
 * @returns {number}
 */
export function medianPositiveStepMs(sortedAsc) {
  const deltas = [];
  for (let i = 1; i < sortedAsc.length; i += 1) {
    const d = sortedAsc[i] - sortedAsc[i - 1];
    if (d > 0) deltas.push(d);
  }
  if (!deltas.length) return 86400000;
  deltas.sort((a, b) => a - b);
  const mid = Math.floor(deltas.length / 2);
  if (deltas.length % 2) return deltas[mid];
  return (deltas[mid - 1] + deltas[mid]) / 2;
}

/**
 * @param {number} loMs
 * @param {number} hiMs
 */
export function msPairToKpiDateStrings(loMs, hiMs) {
  const a = new Date(loMs);
  const b = new Date(hiMs);
  const isMid = (d) =>
    d.getHours() === 0 &&
    d.getMinutes() === 0 &&
    d.getSeconds() === 0 &&
    d.getMilliseconds() === 0;
  if (isMid(a) && isMid(b)) {
    return { start: formatLocalYMD(a), end: formatLocalYMD(b) };
  }
  return {
    start: formatLocalSqlDateTimeStart(a),
    end: formatLocalSqlDateTimeEnd(b),
  };
}

/**
 * @param {number} loA
 * @param {number} hiA
 * @param {number} loB
 * @param {number} hiB
 * @returns {{ loMs: number, hiMs: number } | null}
 */
function intersectInclusiveMs(loA, hiA, loB, hiB) {
  const lo = Math.max(loA, loB);
  const hi = Math.min(hiA, hiB);
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi < lo) return null;
  return { loMs: lo, hiMs: hi };
}

/**
 * Бакет KPI для последней точки:
 * - default last_completed: для month берём месяц последней точки (частичный месяц допустим),
 *   для остальных гранулярностей — последний завершённый бакет;
 * - last_inclusive: всегда бакет, содержащий последнюю точку.
 * @param {number} tMs
 * @param {'minute'|'hour'|'day'|'week'|'month'} granularity
 * @param {'last_completed'|'last_inclusive'} mode
 * @returns {{ loMs: number, hiMs: number } | null}
 */
function resolveLatestBucketWindowMs(tMs, granularity, mode) {
  if (!Number.isFinite(tMs)) return null;
  const ts = new Date(tMs);
  const curStart = bucketStartLocal(ts, granularity);
  const curEnd = bucketEndInclusiveLocal(ts, granularity);
  const curStartMs = curStart.getTime();
  const curEndMs = curEnd.getTime();
  if (granularity === 'month' && mode === 'last_completed') {
    return { loMs: curStartMs, hiMs: curEndMs };
  }
  if (mode === 'last_inclusive' || tMs >= curEndMs) {
    return { loMs: curStartMs, hiMs: curEndMs };
  }
  const prevRefMs = curStartMs - 1;
  if (!Number.isFinite(prevRefMs)) return null;
  const prevRef = new Date(prevRefMs);
  const prevStart = bucketStartLocal(prevRef, granularity).getTime();
  const prevEnd = bucketEndInclusiveLocal(prevRef, granularity).getTime();
  return { loMs: prevStart, hiMs: prevEnd };
}

/**
 * Последние уникальные метки времени по полю (ORDER BY date DESC, дедуп по порядку обхода).
 * @param {object} engine
 * @param {number|string} modelId
 * @param {string} table
 * @param {string} dateField
 * @param {Array} baseFilters — без предикатов по dateField
 * @param {{ runDashboardModelQuery?: Function }} [deps]
 */
export async function fetchRecentDistinctDateMsAscending(
  engine,
  modelId,
  table,
  dateField,
  baseFilters,
  deps = {},
) {
  const col = String(dateField || '').trim();
  const client = getDashboardDataModelClient(engine);
  const run =
    deps.runDashboardModelQuery ??
    ((eng, mid, body) => client.fetchSelect({ modelId: mid, ...body }));
  const { rows } = await run(engine, modelId, {
    mode: 'select',
    base_table: table,
    columns: [col],
    filters: baseFilters || [],
    order_by: [{ column: col, dir: 'desc' }],
    limit: RECENT_ROW_LIMIT,
  });
  /** @type {number[]} */
  const descUnique = [];
  const seen = new Set();
  for (const row of rows || []) {
    const m = parseDateTimeLikeToEvalMs(row[col]);
    if (!Number.isFinite(m) || seen.has(m)) continue;
    seen.add(m);
    descUnique.push(m);
  }
  // SQL ORDER BY по текстовой дате не всегда гарантирует истинный хронологический порядок
  // (например, при смешанных форматах). Нормализуем к строгому числовому порядку.
  return descUnique.slice().sort((a, b) => a - b);
}

/**
 * Скользящие два последних интервала по уникальным точкам: current = [U[n-2], U[n-1]], previous = [U[n-3], U[n-2]].
 * @param {number[]} ascUniqueMs
 * @returns {{ currentRange: { start: string, end: string } | null, previousRange: { start: string, end: string } | null }}
 */
export function buildSlidingPairWindowsFromAscUnique(ascUniqueMs) {
  const U = ascUniqueMs.filter(Number.isFinite).sort((x, y) => x - y);
  const n = U.length;
  if (n === 0) return { currentRange: null, previousRange: null };
  if (n === 1) {
    const r = msPairToKpiDateStrings(U[0], U[0]);
    return { currentRange: r, previousRange: null };
  }
  const cur = msPairToKpiDateStrings(U[n - 2], U[n - 1]);
  if (n < 3) {
    return { currentRange: cur, previousRange: null };
  }
  const prev = msPairToKpiDateStrings(U[n - 3], U[n - 2]);
  return { currentRange: cur, previousRange: prev };
}

/**
 * @param {object} engine
 * @param {number|string} modelId
 * @param {string} table
 * @param {string} dateField
 * @param {Array} baseFilters
 * @param {{ start: string, end: string }} range
 * @param {{ runDashboardModelQuery?: Function }} [deps]
 */
export async function kpiDateWindowHasRows(engine, modelId, table, dateField, baseFilters, range, deps = {}) {
  if (!range?.start || !range?.end) return false;
  const client = getDashboardDataModelClient(engine);
  const run =
    deps.runDashboardModelQuery ??
    ((eng, mid, body) => client.fetchAggregate({ modelId: mid, ...body }));
  const f = appendDateRangeFilters(baseFilters || [], table, dateField, range.start, range.end);
  const { rows } = await run(engine, modelId, {
    mode: 'aggregate',
    base_table: table,
    group_by: [],
    aggregations: [{ fn: 'count', column: '*', as: 'c' }],
    filters: f,
    limit: 1,
  });
  const c = Number(rows?.[0]?.c);
  return Number.isFinite(c) && c > 0;
}

/**
 * @param {object} p
 * @param {object} p.engine
 * @param {number|string} p.modelId
 * @param {string} p.table
 * @param {string} p.dateField
 * @param {Array} p.globalFilters
 * @param {{ start?: string, end?: string }} p.customRange
 * @param {'auto'|'fallback'} p.periodMode
 * @param {'previous_period'|'previous_year'|'custom'} p.deltaMode
 * @param {{ start?: string, end?: string }} p.deltaCustomRange
 * @param {'auto'|'minute'|'hour'|'day'|'week'|'month'} [p.granularitySetting]
 * @param {number} [p.periodShift] — сдвиг текущего окна назад на N шагов гранулярности
 * @param {{ runDashboardModelQuery?: typeof runDashboardModelQuery }} [deps] — для тестов / подмены запросов
 * @returns {Promise<{
 *   currentRange: { start: string, end: string } | null,
 *   previousRange: { start: string, end: string } | null,
 *   rangeSource: 'dashboard'|'widget'|'data_auto'|'none',
 * }>}
 */
export async function resolveKpiWindowsForWidget(p, deps = {}) {
  const {
    engine,
    modelId,
    table,
    dateField,
    globalFilters,
    customRange,
    periodMode,
    deltaMode,
    deltaCustomRange,
    granularitySetting = 'auto',
    kpiBucketMode = 'last_completed',
    periodShift = 0,
  } = p;

  const col = String(dateField || '').trim();
  const tbl = String(table || '').trim();
  if (!col || !tbl) {
    return { currentRange: null, previousRange: null, rangeSource: 'none' };
  }
  void periodMode;

  const { source, range } = resolveKpiDateRangeWithSource(
    globalFilters,
    tbl,
    col,
    customRange || {},
  );
  const baseNoDate = stripDateFieldRangeFilters(globalFilters || [], tbl, col);

  try {
    const asc = await fetchRecentDistinctDateMsAscending(engine, modelId, tbl, col, baseNoDate, deps);
    if (!asc.length) {
      return { currentRange: null, previousRange: null, rangeSource: 'none' };
    }
    const tMax = asc[asc.length - 1];
    const step = asc.length >= 2 ? medianPositiveStepMs(asc) : 86400000;
    const granStr = String(granularitySetting || 'auto').toLowerCase();
    /** @type {'minute'|'hour'|'day'|'week'|'month'} */
    let gEff;
    if (granStr !== 'auto') {
      gEff = /** @type {'minute'|'hour'|'day'|'week'|'month'} */ (
        ['minute', 'hour', 'day', 'week', 'month'].includes(granStr) ? granStr : 'day'
      );
    } else if (step >= 86400000 * 25) {
      gEff = 'month';
    } else if (step >= 86400000 * 4) {
      gEff = 'week';
    } else if (step >= 86400000) {
      gEff = 'day';
    } else if (step >= 3600000) {
      gEff = 'hour';
    } else {
      gEff = 'minute';
    }

    if (granStr === 'auto' && step < 86400000 && (gEff === 'minute' || gEff === 'hour')) {
      gEff = 'day';
    }

    const bucketMode =
      String(kpiBucketMode || '').toLowerCase() === 'last_inclusive'
        ? 'last_inclusive'
        : 'last_completed';
    let currentWin = resolveLatestBucketWindowMs(tMax, gEff, bucketMode);
    if (!currentWin) {
      return { currentRange: null, previousRange: null, rangeSource: 'none' };
    }

    if (source === 'dashboard' && range?.start && range?.end) {
      const dashboardMs = inclusiveRangeToLocalMs(String(range.start), String(range.end));
      if (dashboardMs) {
        const clipped = intersectInclusiveMs(
          currentWin.loMs,
          currentWin.hiMs,
          dashboardMs.loMs,
          dashboardMs.hiMs,
        );
        if (!clipped) {
          return { currentRange: null, previousRange: null, rangeSource: 'dashboard' };
        }
        currentWin = clipped;
      }
    }

    const shiftN = normalizeKpiPeriodShift(periodShift);
    if (shiftN > 0) {
      currentWin = shiftInclusiveRangeByGranularitySteps(
        currentWin.loMs,
        currentWin.hiMs,
        gEff,
        shiftN,
      );
    }

    const currentRange = msPairToKpiDateStrings(currentWin.loMs, currentWin.hiMs);
    const prevWin = computePreviousKpiWindowMs(
      currentWin.loMs,
      currentWin.hiMs,
      gEff,
      deltaMode || 'previous_period',
      deltaCustomRange || {},
      { mode: 'calendar' },
    );
    let previousRange = null;
    if (prevWin && Number.isFinite(prevWin.loMs) && Number.isFinite(prevWin.hiMs)) {
      previousRange = msPairToKpiDateStrings(prevWin.loMs, prevWin.hiMs);
    }
    if (previousRange) {
      const ok = await kpiDateWindowHasRows(engine, modelId, tbl, col, baseNoDate, previousRange, deps);
      if (!ok) previousRange = null;
    }
    return {
      currentRange,
      previousRange,
      rangeSource: source === 'dashboard' ? 'dashboard' : 'data_auto',
    };
  } catch {
    return { currentRange: null, previousRange: null, rangeSource: 'none' };
  }
}
