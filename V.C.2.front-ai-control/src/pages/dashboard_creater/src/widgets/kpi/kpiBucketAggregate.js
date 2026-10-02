import { getDashboardDataModelClient } from '../../../../../services/dashboardDataModel/DashboardDataModelClient.js';
import { appendDateRangeFilters } from './kpiCompute.js';
import {
  chooseTrend,
  computePercentChange,
  isFiniteNumber,
} from './kpiFormat.js';
import { formatAlignedRangeForSql, toBucketKey } from './kpiGranularity.js';

const ROW_LIMIT = 100000;

/**
 * @param {unknown} raw
 * @returns {number} epoch ms or NaN
 */
function parseRowDateTimeMs(raw) {
  if (raw === '' || raw == null) return NaN;
  const n = Number(raw);
  if (Number.isFinite(n)) {
    if (Math.abs(n) > 1e11) return n;
    if (n > 1e8 && n < 1e11) return n * 1000;
  }
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map((x) => parseInt(x, 10));
    return new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
  }
  const d = new Date(s);
  return d.getTime();
}

/**
 * @param {'sum'|'avg'|'count'|'min'|'max'} agg
 * @param {number} totalSum
 * @param {number} totalCnt
 * @param {number} gmin
 * @param {number} gmax
 */
function finalizeWindowAggregate(agg, totalSum, totalCnt, gmin, gmax) {
  const fn = String(agg || 'sum').toLowerCase();
  if (fn === 'count') return totalCnt;
  if (fn === 'sum') return totalSum;
  if (fn === 'avg') {
    if (!totalCnt) return null;
    return totalSum / totalCnt;
  }
  if (fn === 'min') return Number.isFinite(gmin) ? gmin : null;
  if (fn === 'max') return Number.isFinite(gmax) ? gmax : null;
  return totalSum;
}

/**
 * Один проход по строкам: бакеты Map + те же итоги, что у SQL-агрегата по окну.
 * @param {object} params
 */
export function aggregateSimpleWindowsSinglePass(
  rows,
  dateField,
  valueField,
  aggregation,
  curLoMs,
  curHiMs,
  prevLoMs,
  prevHiMs,
  /** @type {'minute'|'hour'|'day'|'week'|'month'} */ gran,
) {
  const curMap = new Map();
  const prevMap = new Map();
  let curSum = 0;
  let curCnt = 0;
  let curMin = Infinity;
  let curMax = -Infinity;
  let prevSum = 0;
  let prevCnt = 0;
  let prevMin = Infinity;
  let prevMax = -Infinity;

  const aggFn = String(aggregation || 'sum').toLowerCase();

  for (const row of rows || []) {
    const t = parseRowDateTimeMs(row[dateField]);
    if (!Number.isFinite(t)) continue;
    const v = Number(row[valueField]);
    if (aggFn !== 'count' && !Number.isFinite(v)) continue;

    const inCur = t >= curLoMs && t <= curHiMs;
    const inPrev = t >= prevLoMs && t <= prevHiMs;
    if (inCur) {
      if (aggFn === 'count') {
        curCnt += 1;
        const bk = toBucketKey(new Date(t), gran);
        curMap.set(bk, (curMap.get(bk) || 0) + 1);
      } else {
        curCnt += 1;
        curSum += v;
        curMin = Math.min(curMin, v);
        curMax = Math.max(curMax, v);
        const bk = toBucketKey(new Date(t), gran);
        curMap.set(bk, (curMap.get(bk) || 0) + v);
      }
    }
    if (inPrev) {
      if (aggFn === 'count') {
        prevCnt += 1;
        const bk = toBucketKey(new Date(t), gran);
        prevMap.set(bk, (prevMap.get(bk) || 0) + 1);
      } else {
        prevCnt += 1;
        prevSum += v;
        prevMin = Math.min(prevMin, v);
        prevMax = Math.max(prevMax, v);
        const bk = toBucketKey(new Date(t), gran);
        prevMap.set(bk, (prevMap.get(bk) || 0) + v);
      }
    }
  }

  const agg = String(aggregation || 'sum').toLowerCase();
  const current = finalizeWindowAggregate(agg, curSum, curCnt, curMin, curMax);
  const previous = finalizeWindowAggregate(agg, prevSum, prevCnt, prevMin, prevMax);

  return { current, previous, curMap, prevMap };
}

/**
 * @param {object} p
 */
export async function computeSimpleKpiFromRows(p) {
  const {
    engine,
    modelId,
    table,
    dateField,
    valueField,
    aggregation,
    baseFilters,
    curLoMs,
    curHiMs,
    prevLoMs,
    prevHiMs,
    granularityEffective,
  } = p;

  const empty = {
    current: null,
    previous: null,
    delta: null,
    percent: null,
    trend: /** @type {'neutral'} */ ('neutral'),
    error: '',
    noData: false,
    currentEvalError: '',
    previousEvalError: '',
    truncated: false,
  };

  const gran = String(granularityEffective || 'day').toLowerCase();
  if (!['minute', 'hour', 'day', 'week', 'month'].includes(gran)) {
    return { ...empty, error: 'Некорректная гранулярность' };
  }

  const uLo = Math.min(curLoMs, prevLoMs);
  const uHi = Math.max(curHiMs, prevHiMs);
  const uSql = formatAlignedRangeForSql(uLo, uHi);

  const filters = appendDateRangeFilters(baseFilters, table, dateField, uSql.start, uSql.end);

  const client = getDashboardDataModelClient(engine);
  const { rows } = await client.fetchSelect({
    modelId,
    base_table: table,
    columns: [dateField, valueField],
    filters,
    limit: ROW_LIMIT + 1,
  });

  const truncated = Array.isArray(rows) && rows.length > ROW_LIMIT;
  const list = truncated ? rows.slice(0, ROW_LIMIT) : rows || [];

  const { current, previous } = aggregateSimpleWindowsSinglePass(
    list,
    dateField,
    valueField,
    aggregation,
    curLoMs,
    curHiMs,
    prevLoMs,
    prevHiMs,
    /** @type {'minute'|'hour'|'day'|'week'|'month'} */ (gran),
  );

  if (truncated) {
    return {
      ...empty,
      error: `Слишком много строк (>${ROW_LIMIT}). Уменьшите период или гранулярность.`,
      truncated: true,
    };
  }

  if (!isFiniteNumber(current) && !isFiniteNumber(previous)) {
    return { ...empty, noData: true, error: '' };
  }

  if (!isFiniteNumber(current)) {
    return {
      ...empty,
      current: null,
      previous,
      noData: true,
    };
  }

  if (!isFiniteNumber(previous)) {
    return {
      current,
      previous: null,
      delta: null,
      percent: null,
      trend: 'neutral',
      error: '',
      noData: false,
      currentEvalError: '',
      previousEvalError: '',
    };
  }

  const delta = current - previous;
  const percent = computePercentChange(current, previous);
  const trend = chooseTrend(delta);

  return {
    current,
    previous,
    delta,
    percent,
    trend,
    error: '',
    noData: false,
    currentEvalError: '',
    previousEvalError: '',
    truncated: false,
  };
}
