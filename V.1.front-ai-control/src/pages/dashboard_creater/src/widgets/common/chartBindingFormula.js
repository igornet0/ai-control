/**
 * Формулы измерения/меры для pie / bar / line (как formula у колонок таблицы).
 * SQL-путь: ссылка на поле `[table.field]` или одиночный агрегат `SUM([table.field])`.
 */

import { compileFormula, formulaGroupBy, unwrapGroupedAst } from '../../formula/compile.js';
import { formulaHasQualifiedTableRefs } from '../../formula/formulaInference.js';
import {
  defaultTableColumnFormula,
  parseSimpleTableFieldRef,
} from './tableColumnFormula.js';
import { resolvePieSliceSqlAggregation } from '../pie-chart/pieSliceAggregation.js';
import { whereNodeToApiFilters, whereFromLocalFilters, flattenAndLeaves } from '../../formula/localFilters.js';

export function defaultChartBindingFormula(binding) {
  return defaultTableColumnFormula(binding);
}

/**
 * @param {Record<string, unknown>|null|undefined} binding
 */
export function normalizeChartDimMeasBinding(binding) {
  if (!binding || typeof binding !== 'object') return binding;
  const formulaRaw = typeof binding.formula === 'string' ? binding.formula.trim() : '';
  const formula = formulaRaw || defaultChartBindingFormula(binding);
  return { ...binding, formula };
}

/**
 * @param {Record<string, unknown>} settings
 */
export function normalizeChartBindingFormulas(settings) {
  if (!settings || typeof settings !== 'object') return settings;
  if (settings.bindingDimension) {
    settings.bindingDimension = normalizeChartDimMeasBinding(settings.bindingDimension);
  }
  if (settings.bindingMeasure) {
    settings.bindingMeasure = normalizeChartDimMeasBinding(settings.bindingMeasure);
  }
  if (Array.isArray(settings.bindingMeasures)) {
    settings.bindingMeasures = settings.bindingMeasures.map((b) =>
      b && typeof b === 'object' ? normalizeChartDimMeasBinding(b) : b,
    );
    if (settings.bindingMeasures.length && !settings.bindingMeasure) {
      settings.bindingMeasure = { ...settings.bindingMeasures[0] };
    }
  } else if (settings.bindingMeasure) {
    settings.bindingMeasures = [{ ...settings.bindingMeasure }];
  }
  return settings;
}

/**
 * @param {Record<string, unknown>|null|undefined} b
 */
export function chartBindingHasFieldOrFormula(b) {
  if (!b || b.modelId == null || !String(b.table || '').trim()) return false;
  if (String(b.field || '').trim()) return true;
  const f = String(b.formula || '').trim();
  if (!f) return false;
  if (parseSimpleTableFieldRef(f)) return true;
  if (parseFieldRefWithWhere(f)) return true;
  try {
    return formulaHasQualifiedTableRefs(f);
  } catch {
    return false;
  }
}

/**
 * `[table.field] WHERE …` — поле + фильтр (точки ряда на линейном графике).
 * @param {string} formula
 * @returns {{ table: string, field: string, aggFn: null, ignoreFilters: boolean, localWhere?: object, localFilters?: object[] } | null}
 */
export function parseFieldRefWithWhere(formula) {
  const src = String(formula ?? '').trim();
  const m = src.match(/^\s*(\$)?\[([^\].]+)\.([^\].]+)\]\s+(WHERE\b[\s\S]+)$/i);
  if (!m) return null;
  const ignoreFilters = !!m[1];
  const table = m[2].trim();
  const field = m[3].trim();
  const wherePart = m[4].trim();
  if (!table || !field || !wherePart) return null;
  const wrapped = ignoreFilters
    ? `SUM($[${table}.${field}] ${wherePart})`
    : `SUM([${table}.${field}] ${wherePart})`;
  try {
    const { aggs } = compileFormula(wrapped);
    if (!aggs?.length || !aggs[0].localWhere) return null;
    const a = aggs[0];
    /** @type {{ table: string, field: string, aggFn: null, ignoreFilters: boolean, localWhere?: object, localFilters?: object[] }} */
    const out = {
      table,
      field,
      aggFn: null,
      ignoreFilters,
      localWhere: a.localWhere,
    };
    const flat = flattenAndLeaves(a.localWhere) || a.localFilters;
    if (flat?.length) out.localFilters = flat;
    return out;
  } catch {
    return null;
  }
}

/**
 * @param {string} formula
 * @returns {{ table: string|null, field: string, aggFn: string|null, ignoreFilters?: boolean, localFilters?: import('../../formula/localFilters.js').SqlLocalFilter[], localWhere?: import('../../formula/localFilters.js').WhereNode } | null}
 */
export function resolveFieldFromChartFormula(formula) {
  const src = String(formula ?? '').trim();
  if (!src) return null;

  const withWhere = parseFieldRefWithWhere(src);
  if (withWhere) return withWhere;

  const simple = parseSimpleTableFieldRef(src);
  if (simple) {
    return {
      table: simple.table,
      field: simple.field,
      aggFn: null,
      ignoreFilters: !!simple.ignoreFilters,
    };
  }

  try {
    const { ast, aggs } = compileFormula(src);
    const groupBy = formulaGroupBy(ast);
    const inner = unwrapGroupedAst(ast);
    if (aggs.length !== 1 || !inner || inner.t !== 'agg') return null;
    const a = aggs[0];
    const fn = String(a.fn || '').toLowerCase();
    const col = String(a.column || '').trim();
    const localFilters = Array.isArray(a.localFilters) ? a.localFilters : [];
    const localWhere = a.localWhere || null;
    /** @type {{ table: string|null, field: string, aggFn: string|null, ignoreFilters?: boolean, localFilters?: import('../../formula/localFilters.js').SqlLocalFilter[], localWhere?: import('../../formula/localFilters.js').WhereNode }} */
    let resolved;
    if (col === '*' || col === '1' || col === '__rows__' || col === '') {
      if (fn !== 'count') return null;
      resolved = {
        table: null,
        field: '*',
        aggFn: 'count',
        ignoreFilters: !!a.ignoreFilters,
      };
    } else {
      const dot = col.indexOf('.');
      if (dot > 0) {
        resolved = {
          table: col.slice(0, dot).trim(),
          field: col.slice(dot + 1).trim(),
          aggFn: fn,
          ignoreFilters: !!a.ignoreFilters,
        };
      } else {
        resolved = {
          table: null,
          field: col,
          aggFn: fn,
          ignoreFilters: !!a.ignoreFilters,
        };
      }
    }
    if (localWhere) resolved.localWhere = localWhere;
    if (localFilters.length) resolved.localFilters = localFilters;
    if (groupBy?.length) resolved.groupBy = groupBy;
    return resolved;
  } catch {
    return null;
  }
}

/**
 * После сохранения формулы — синхронизировать field/table, если формула однозначна.
 * @param {Record<string, unknown>} binding
 * @param {string} formula
 */
export function applyChartBindingFormula(binding, formula) {
  if (!binding || typeof binding !== 'object') return binding;
  const next = String(formula ?? '').trim() || defaultChartBindingFormula(binding);
  binding.formula = next;
  const resolved = resolveFieldFromChartFormula(next);
  if (resolved?.field && resolved.field !== '*') {
    binding.field = resolved.field;
    if (resolved.table) binding.table = resolved.table;
  }
  return binding;
}

/**
 * @typedef {{
 *   modelId: number|string,
 *   table: string,
 *   field: string,
 *   type?: string,
 *   formula: string,
 *   aggFn: string|null,
 *   sqlOk: boolean,
 *   error?: string,
 *   localFilters?: import('../../formula/localFilters.js').SqlLocalFilter[],
 *   groupBy?: { table: string, column: string }[],
 * }} ChartResolvedBinding
 */

/**
 * @param {Record<string, unknown>|null|undefined} binding
 * @returns {ChartResolvedBinding | null}
 */
export function resolveChartDimension(binding) {
  if (!binding || binding.modelId == null || !String(binding.table || '').trim()) return null;
  const b = normalizeChartDimMeasBinding(binding);
  const formula = String(b.formula || '').trim() || defaultChartBindingFormula(b);
  const fromF = resolveFieldFromChartFormula(formula);

  if (fromF?.localWhere || fromF?.localFilters?.length) {
    return {
      modelId: b.modelId,
      table: String(b.table),
      field: String(b.field || ''),
      type: b.type != null ? String(b.type) : undefined,
      formula,
      aggFn: null,
      sqlOk: false,
      error: 'WHERE в формуле измерения не поддерживается — используйте WHERE в мере',
    };
  }

  if (fromF?.aggFn) {
    return {
      modelId: b.modelId,
      table: String(b.table),
      field: String(b.field || ''),
      type: b.type != null ? String(b.type) : undefined,
      formula,
      aggFn: null,
      sqlOk: false,
      error: 'Формула измерения должна ссылаться на поле без агрегата, например [таблица.поле]',
    };
  }

  if (fromF?.field && fromF.field !== '*') {
    return {
      modelId: b.modelId,
      table: String(fromF.table || b.table),
      field: fromF.field,
      type: b.type != null ? String(b.type) : undefined,
      formula,
      aggFn: null,
      sqlOk: true,
    };
  }

  const field = String(b.field || '').trim();
  if (!field) {
    return {
      modelId: b.modelId,
      table: String(b.table),
      field: '',
      type: b.type != null ? String(b.type) : undefined,
      formula,
      aggFn: null,
      sqlOk: false,
      error: 'Укажите поле измерения или формулу вида [таблица.поле]',
    };
  }

  return {
    modelId: b.modelId,
    table: String(b.table),
    field,
    type: b.type != null ? String(b.type) : undefined,
    formula,
    aggFn: null,
    sqlOk: true,
  };
}

/**
 * @param {Record<string, unknown>|null|undefined} binding
 * @param {{ weightMode?: string, forLine?: boolean }} [opts]
 * @returns {(ChartResolvedBinding & { parse?: (raw: unknown) => number }) | null}
 */
export function resolveChartMeasure(binding, opts = {}) {
  if (!binding || binding.modelId == null || !String(binding.table || '').trim()) return null;
  const b = normalizeChartDimMeasBinding(binding);
  const formula = String(b.formula || '').trim() || defaultChartBindingFormula(b);
  const fromF = resolveFieldFromChartFormula(formula);
  const weightMode = opts.weightMode;
  const forLine = !!opts.forLine;

  const parseNum = (raw) => {
    const n = parseFloat(/** @type {any} */ (raw));
    return Number.isFinite(n) ? n : 0;
  };

  if (fromF?.groupBy?.length && forLine) {
    return {
      modelId: b.modelId,
      table: String(b.table),
      field: String(b.field || ''),
      type: b.type != null ? String(b.type) : undefined,
      formula,
      aggFn: fromF.aggFn,
      sqlOk: false,
      groupBy: fromF.groupBy,
      error: 'FOR группирует категории — для линейного графика укажите поле оси X и меру без FOR',
      parse: parseNum,
    };
  }

  if (fromF?.aggFn) {
    let fn = fromF.aggFn;
    if (fn === 'count_distinct') fn = 'count_distinct';
    if (!['sum', 'avg', 'min', 'max', 'count', 'count_distinct'].includes(fn)) {
      return {
        modelId: b.modelId,
        table: String(b.table),
        field: String(b.field || ''),
        type: b.type != null ? String(b.type) : undefined,
        formula,
        aggFn: null,
        sqlOk: false,
        error: `Агрегат «${fromF.aggFn}» не поддерживается для меры графика`,
        parse: parseNum,
      };
    }
    const field =
      fromF.field === '*'
        ? '*'
        : fromF.field || String(b.field || '').trim();
    if (!field) {
      return {
        modelId: b.modelId,
        table: String(b.table),
        field: '',
        type: b.type != null ? String(b.type) : undefined,
        formula,
        aggFn: null,
        sqlOk: false,
        error: 'Формула меры должна ссылаться на поле',
        parse: parseNum,
      };
    }
    // Линия без таймбакета — сырые точки: агрегат в формуле задаёт поле и предпочтительную агрегацию TF.
    if (forLine && fromF.field === '*') {
      return {
        modelId: b.modelId,
        table: String(b.table),
        field: String(b.field || '').trim() || '*',
        type: b.type != null ? String(b.type) : undefined,
        formula,
        aggFn: fn,
        sqlOk: !!String(b.field || '').trim(),
        error: String(b.field || '').trim()
          ? undefined
          : 'COUNT(*) для линейного графика: укажите поле меры в привязке',
        parse: parseNum,
        ...(fromF.localWhere ? { localWhere: fromF.localWhere } : {}),
        ...(fromF.localFilters?.length ? { localFilters: fromF.localFilters } : {}),
      };
    }
    return {
      modelId: b.modelId,
      table: String(fromF.table || b.table),
      field: fromF.field === '*' ? '*' : field,
      type: b.type != null ? String(b.type) : undefined,
      formula,
      aggFn: fn,
      sqlOk: true,
      parse: parseNum,
      ...(fromF.localWhere ? { localWhere: fromF.localWhere } : {}),
      ...(fromF.localFilters?.length ? { localFilters: fromF.localFilters } : {}),
      ...(fromF.groupBy?.length ? { groupBy: fromF.groupBy } : {}),
    };
  }

  if (fromF?.field && fromF.field !== '*') {
    const sliceAgg = resolvePieSliceSqlAggregation(
      b.type != null ? String(b.type) : undefined,
      weightMode,
    );
    return {
      modelId: b.modelId,
      table: String(fromF.table || b.table),
      field: fromF.field,
      type: b.type != null ? String(b.type) : undefined,
      formula,
      aggFn: forLine ? null : sliceAgg.fn,
      sqlOk: true,
      parse: sliceAgg.parse,
      ...(fromF.localWhere ? { localWhere: fromF.localWhere } : {}),
      ...(fromF.localFilters?.length ? { localFilters: fromF.localFilters } : {}),
    };
  }

  // Неоднозначная / составная формула (например SUM(a)/SUM(b))
  // Scalar Formula API это поддерживает (KPI / Reference / Gauge), но мера линии —
  // это колонка SELECT по оси X, не одно скалярное число на весь датасет.
  if (formula && !isDefaultChartBindingFormula(formula, b)) {
    try {
      const { aggs, ast } = compileFormula(formula);
      if (ast && aggs?.length >= 1 && (ast.t === 'bin' || aggs.length > 1)) {
        return {
          modelId: b.modelId,
          table: String(b.table),
          field: String(b.field || ''),
          type: b.type != null ? String(b.type) : undefined,
          formula,
          aggFn: null,
          sqlOk: false,
          scalarFormulaOk: true,
          error:
            'Составная формула (SUM(a)−SUM(b) и т.п.) — для Reference / KPI / Gauge. ' +
            'Для серии линии укажите поле [таблица.колонка] или один агрегат SUM([таблица.колонка]).',
          parse: parseNum,
        };
      }
      return {
        modelId: b.modelId,
        table: String(b.table),
        field: String(b.field || ''),
        type: b.type != null ? String(b.type) : undefined,
        formula,
        aggFn: null,
        sqlOk: false,
        error:
          'Формула меры: [таблица.поле], [таблица.поле] WHERE …, или SUM([таблица.поле] WHERE …)',
        parse: parseNum,
      };
    } catch {
      /* fall through to field */
    }
  }

  const field = String(b.field || '').trim();
  if (!field) {
    return {
      modelId: b.modelId,
      table: String(b.table),
      field: '',
      type: b.type != null ? String(b.type) : undefined,
      formula,
      aggFn: null,
      sqlOk: false,
      error: 'Укажите поле меры или формулу',
      parse: parseNum,
    };
  }

  const sliceAgg = resolvePieSliceSqlAggregation(
    b.type != null ? String(b.type) : undefined,
    weightMode,
  );
  return {
    modelId: b.modelId,
    table: String(b.table),
    field,
    type: b.type != null ? String(b.type) : undefined,
    formula,
    aggFn: forLine ? null : sliceAgg.fn,
    sqlOk: true,
    parse: sliceAgg.parse,
  };
}

/**
 * @param {string} formula
 * @param {{ table?: string, field?: string }} binding
 */
export function isDefaultChartBindingFormula(formula, binding) {
  const f = String(formula ?? '').trim();
  if (!f) return true;
  const def = defaultChartBindingFormula(binding);
  if (f === def) return true;
  const fieldOnly = `[${String(binding?.field ?? '').trim()}]`;
  return f === fieldOnly;
}

/**
 * @param {Record<string, unknown>|null|undefined} dim
 * @param {Record<string, unknown>|null|undefined} meas
 */
export function chartDimMeasBindingsOk(dim, meas, measures) {
  if (!chartBindingHasFieldOrFormula(dim)) return false;
  const list = Array.isArray(measures) && measures.length ? measures : meas ? [meas] : [];
  if (!list.length) return false;
  return list.every(
    (m) => chartBindingHasFieldOrFormula(m) && String(dim.modelId) === String(m.modelId),
  );
}

/**
 * Колонка агрегата для sqlite/query: короткое имя на base_table или `other.col` для JOIN.
 * @param {{ table?: string }|null|undefined} dim
 * @param {{ table?: string, field?: string }|null|undefined} meas
 * @returns {string}
 */
export function chartMeasureAggColumn(dim, meas) {
  const field = String(meas?.field ?? '').trim();
  if (!field || field === '*' || field === '1' || field === '__rows__') return field || '*';
  const dimTable = String(dim?.table ?? '').trim();
  const measTable = String(meas?.table ?? '').trim();
  if (!measTable || !dimTable || measTable.toLowerCase() === dimTable.toLowerCase()) {
    return field;
  }
  return `${measTable}.${field}`;
}

/**
 * Фильтры дашборда + WHERE из формулы меры.
 * @param {object[]} dashboardFilters
 * @param {{ localFilters?: object[], localWhere?: object }|null|undefined} meas
 */
/**
 * FOR в мере должен совпадать с измерением графика (один ключ группировки).
 * @param {{ groupBy?: { table?: string, column?: string }[] }|null|undefined} meas
 * @param {{ table?: string, field?: string }|null|undefined} dim
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function chartMeasureForMatchesDimension(meas, dim) {
  const gb = meas?.groupBy;
  if (!gb?.length) return { ok: true };
  if (gb.length !== 1) {
    return { ok: false, error: 'График поддерживает FOR по одному полю — оно должно совпадать с измерением' };
  }
  const g = gb[0];
  const dimTable = String(dim?.table || '').trim();
  const dimField = String(dim?.field || '').trim();
  const gTable = String(g.table || '').trim();
  const gField = String(g.column || '').trim();
  if (!dimField || !gField) return { ok: true };
  if (gField.toLowerCase() !== dimField.toLowerCase()) {
    return {
      ok: false,
      error: `FOR [${gTable}.${gField}] не совпадает с измерением [${dimTable}.${dimField}]`,
    };
  }
  if (gTable && dimTable && gTable.toLowerCase() !== dimTable.toLowerCase()) {
    return {
      ok: false,
      error: `FOR [${gTable}.${gField}] не совпадает с измерением [${dimTable}.${dimField}]`,
    };
  }
  return { ok: true };
}

export function mergeChartMeasureFilters(dashboardFilters, meas) {
  const base = Array.isArray(dashboardFilters) ? dashboardFilters : [];
  const localApi = whereNodeToApiFilters(
    meas?.localWhere || whereFromLocalFilters(meas?.localFilters),
  );
  if (!localApi.length) return base;
  return [...base, ...localApi];
}
