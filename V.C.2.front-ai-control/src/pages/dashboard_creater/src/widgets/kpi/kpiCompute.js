import { getDashboardDataModelClient } from '../../../../../services/dashboardDataModel/DashboardDataModelClient.js';
import {
  collectDashboardFilters,
  filtersForModel,
} from '../../../../../services/dashboardFilterUtils.js';
import { compileFormulaBundle } from '../../formula/cache.js';
import { toSqliteAggregations } from '../../formula/compile.js';
import { evaluateAst } from '../../formula/evaluate.js';
import { formatFormulaError } from '../../formula/errors.js';
import { makeFormulaVarContext } from '../../formula/formulaVarContext.js';
import { chooseTrend, computePercentChange, isFiniteNumber } from './kpiFormat.js';

const RANGE_OPS = new Set(['gte', 'lte', 'between', 'gt', 'lt']);

export function clearKpiComputeQueryCache() {
  // Compatibility no-op: cache lives in DashboardDataModelClient.
}

/**
 * Removes range predicates on a given table column (used before appending explicit KPI windows).
 * @param {Array<{ table: string, column: string, op: string, value?: unknown, values?: unknown[] }>} filters
 * @param {string} table
 * @param {string} dateField
 */
export function stripDateFieldRangeFilters(filters, table, dateField) {
  const col = String(dateField || '');
  const tbl = String(table || '');
  return (filters || []).filter((f) => {
    if (f.table !== tbl || f.column !== col) return true;
    const op = String(f.op || '').toLowerCase();
    return !RANGE_OPS.has(op);
  });
}

/**
 * @param {Array} baseFilters
 * @param {string} table
 * @param {string} dateField
 * @param {string} startYmd
 * @param {string} endYmd
 */
export function appendDateRangeFilters(baseFilters, table, dateField, startYmd, endYmd) {
  return [
    ...baseFilters,
    { table, column: dateField, op: 'gte', value: startYmd },
    { table, column: dateField, op: 'lte', value: endYmd },
  ];
}

/**
 * @param {object} row
 * @param {string[]} aliases
 */
function rowHasAggValues(row, aliases) {
  if (!row || typeof row !== 'object') return false;
  return aliases.some((al) => row[al] != null && row[al] !== '');
}

/**
 * @param {object} ast
 * @param {object} row
 * @returns {{ n: number|null, err: string }}
 */
function safeEvaluate(ast, row, engine) {
  try {
    const n = evaluateAst(ast, row, undefined, makeFormulaVarContext(engine));
    if (!Number.isFinite(n)) return { n: null, err: '' };
    return { n, err: '' };
  } catch (e) {
    return { n: null, err: formatFormulaError(e) };
  }
}

/**
 * @param {object} params
 * @param {{ runQuery?: Function }} [options]
 * @returns {Promise<{
 *   current: number|null,
 *   previous: number|null,
 *   delta: number|null,
 *   percent: number|null,
 *   trend: 'up'|'down'|'neutral',
 *   error: string,
 *   noData: boolean,
 *   currentEvalError: string,
 *   previousEvalError: string,
 * }>}
 */
export async function computeKpiSnapshot(params, options = {}) {
  const {
    engine,
    modelId,
    table,
    formula,
    dateField,
    currentRange,
    previousRange,
  } = params;

  const runQuery =
    options.runQuery ??
    ((eng, mid, body) => getDashboardDataModelClient(eng).fetchAggregate({ modelId: mid, ...body }));

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
  };

  const src = String(formula ?? '').trim();
  if (!src) {
    return { ...empty, error: 'Пустая формула' };
  }

  let bundle;
  try {
    bundle = compileFormulaBundle([src]);
  } catch (e) {
    return { ...empty, error: formatFormulaError(e) };
  }

  const globalScoped = Array.isArray(params.globalFilters)
    ? params.globalFilters
    : filtersForModel(collectDashboardFilters(engine), modelId);
  const dateCol = String(dateField || '').trim();
  const baseFilters = dateCol ? stripDateFieldRangeFilters(globalScoped, table, dateCol) : globalScoped;

  const aliases = [...bundle.keyToAlias.values()];
  const aggs = toSqliteAggregations(bundle.mergedAggs, bundle.keyToAlias, table);
  const ast0 = bundle.asts[0];

  const bodyBase = {
    mode: 'aggregate',
    base_table: table,
    group_by: [],
    aggregations: aggs,
    limit: 1,
  };

  const hasCurWindow =
    dateCol &&
    currentRange &&
    String(currentRange.start || '').trim() &&
    String(currentRange.end || '').trim();
  const filtersCur = hasCurWindow
    ? appendDateRangeFilters(baseFilters, table, dateCol, currentRange.start, currentRange.end)
    : [...baseFilters];

  const hasPrevWindow =
    dateCol &&
    previousRange &&
    String(previousRange.start || '').trim() &&
    String(previousRange.end || '').trim();
  const filtersPrev = hasPrevWindow
    ? appendDateRangeFilters(baseFilters, table, dateCol, previousRange.start, previousRange.end)
    : null;

  try {
    if (!filtersPrev) {
      const curRes = await runQuery(engine, modelId, { ...bodyBase, filters: filtersCur });
      const curRow = curRes?.rows?.[0] || {};
      const curHas = rowHasAggValues(curRow, aliases);
      const evC = safeEvaluate(ast0, curRow, engine);

      if (evC.err) {
        return {
          ...empty,
          error: evC.err,
          currentEvalError: evC.err,
          noData: !curHas,
        };
      }

      const current = evC.n;

      if (!isFiniteNumber(current)) {
        return {
          ...empty,
          noData: !curHas,
          error: '',
        };
      }
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

    const [curRes, prevRes] = await Promise.all([
      runQuery(engine, modelId, { ...bodyBase, filters: filtersCur }),
      runQuery(engine, modelId, { ...bodyBase, filters: filtersPrev }),
    ]);
    const curRow = curRes?.rows?.[0] || {};
    const curHas = rowHasAggValues(curRow, aliases);
    const evC = safeEvaluate(ast0, curRow, engine);

    if (evC.err) {
      return {
        ...empty,
        error: evC.err,
        currentEvalError: evC.err,
        noData: !curHas,
      };
    }

    const prevRow = prevRes?.rows?.[0] || {};
    const prevHas = rowHasAggValues(prevRow, aliases);
    const evP = safeEvaluate(ast0, prevRow, engine);

    if (evP.err) {
      return {
        ...empty,
        current: evC.n,
        previous: null,
        delta: null,
        percent: null,
        trend: 'neutral',
        previousEvalError: evP.err,
        error: evP.err,
        noData: !curHas && !prevHas,
      };
    }

    const previous = evP.n;
    const current = evC.n;

    if (!isFiniteNumber(current) && !isFiniteNumber(previous)) {
      return {
        ...empty,
        noData: !curHas && !prevHas,
        error: '',
      };
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
    };
  } catch (e) {
    return { ...empty, error: formatFormulaError(e) };
  }
}
