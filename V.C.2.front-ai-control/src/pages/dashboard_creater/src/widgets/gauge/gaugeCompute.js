import { getDashboardDataModelClient } from '../../../../../services/dashboardDataModel/DashboardDataModelClient.js';
import { collectDashboardFilters, filtersForModel } from '../../../../../services/dashboardFilterUtils.js';
import { runNamedFormulaBundle } from '../../formula/widgetFormulaRuntime.js';
import { resolveKpiDataSourceFromFormula } from '../../formula/formulaInference.js';
import { buildSimpleFormula } from '../kpi/kpiBuildFormula.js';
import { GAUGE_DEFAULT_TARGET_COLOR, normalizeGaugeSettings } from './gaugeSettingsSchema.js';

/**
 * @typedef {{ id: string, label: string, value: number|null, color: string, error?: string }} ResolvedGaugeTarget
 */

/**
 * @param {object|null} engine
 * @param {{ settings?: object, dataSource?: object|null }} widget
 * @returns {Promise<{
 *   value: { numeric: number|null, error: string },
 *   min: number,
 *   max: number,
 *   target: number|null,
 *   targets: ResolvedGaugeTarget[],
 *   scaleErrors: Record<string, string>,
 * }>}
 */
export async function computeGaugeState(engine, widget) {
  const ds = widget.dataSource;
  const s = normalizeGaugeSettings(widget.settings || {}, { dataSource: ds });
  const source = String(s.valueSource || 'static_value');

  let min = Number(s.min);
  let max = Number(s.max);
  if (!Number.isFinite(min)) min = 0;
  if (!Number.isFinite(max)) max = 100;
  if (max <= min) max = min + 1;

  /** @type {Record<string, string>} */
  const scaleErrors = {};

  const mf = String(s.minFormula || '').trim();
  const xf = String(s.maxFormula || '').trim();
  /** @type {Array<{ id: string, label: string, value: number|null, formula: string, color: string }>} */
  const targetDefs = Array.isArray(s.targets) ? s.targets : [];

  /** Seed targets from static values; formulas filled after bundle. */
  /** @type {ResolvedGaugeTarget[]} */
  let targets = targetDefs.map((t) => ({
    id: String(t.id),
    label: String(t.label || ''),
    value: t.value != null && Number.isFinite(Number(t.value)) ? Number(t.value) : null,
    color: String(t.color || GAUGE_DEFAULT_TARGET_COLOR),
    error: '',
  }));

  const formulaTargets = targetDefs.filter((t) => String(t.formula || '').trim());

  /**
   * @param {Record<string, { numeric?: number|null, error?: string }>} byId
   */
  const applyScaleFromBundle = (byId) => {
    if (mf && byId.min?.numeric != null && Number.isFinite(byId.min.numeric)) {
      min = byId.min.numeric;
    }
    if (mf && byId.min?.error) scaleErrors.min = byId.min.error;
    if (xf && byId.max?.numeric != null && Number.isFinite(byId.max.numeric)) {
      max = byId.max.numeric;
    }
    if (xf && byId.max?.error) scaleErrors.max = byId.max.error;
    for (const t of formulaTargets) {
      const key = `tgt_${t.id}`;
      const hit = byId[key];
      const idx = targets.findIndex((x) => x.id === t.id);
      if (idx < 0) continue;
      if (hit?.numeric != null && Number.isFinite(hit.numeric)) {
        targets[idx] = { ...targets[idx], value: hit.numeric, error: '' };
      }
      if (hit?.error) {
        targets[idx] = { ...targets[idx], error: hit.error };
        scaleErrors[`target:${t.id}`] = hit.error;
      }
    }
    if (max <= min) max = min + 1;
  };

  const buildScaleNamed = () => {
    /** @type {Record<string, string>} */
    const named = {};
    if (mf) named.min = mf;
    if (xf) named.max = xf;
    for (const t of formulaTargets) {
      named[`tgt_${t.id}`] = String(t.formula).trim();
    }
    return named;
  };

  const firstScaleProbe = () => {
    if (mf) return mf;
    if (xf) return xf;
    if (formulaTargets[0]) return String(formulaTargets[0].formula).trim();
    return '';
  };

  const sortTargets = () => {
    targets = targets
      .filter((t) => t.value != null && Number.isFinite(t.value))
      .sort((a, b) => Number(a.value) - Number(b.value));
  };

  const primaryTarget = () =>
    targets.length ? targets[Math.min(targets.length - 1, Math.floor(targets.length / 2))].value : null;

  if (source === 'static_value') {
    const v =
      s.staticValue != null && s.staticValue !== ''
        ? Number(s.staticValue)
        : Number(s.value);
    const val = { numeric: Number.isFinite(v) ? v : 0, error: '' };

    const scaleNamed = buildScaleNamed();
    if (!engine || !Object.keys(scaleNamed).length) {
      sortTargets();
      return {
        value: val,
        min,
        max,
        target: primaryTarget(),
        targets,
        scaleErrors,
      };
    }

    const probe = firstScaleProbe();
    let modelId = ds?.modelId;
    let table = ds?.table;
    try {
      const resolved = await resolveKpiDataSourceFromFormula(engine, ds || {}, probe);
      modelId = resolved?.modelId ?? modelId;
      table = resolved?.table ?? table;
    } catch {
      /* ignore */
    }
    if (modelId == null || !table) {
      scaleErrors._ = 'Укажите поле данных для формул шкалы';
      sortTargets();
      return {
        value: val,
        min,
        max,
        target: primaryTarget(),
        targets,
        scaleErrors,
      };
    }

    const client = getDashboardDataModelClient(engine);
    if (client?.invalidate) client.invalidate([String(modelId)]);

    const bundle = await runNamedFormulaBundle(engine, modelId, String(table), scaleNamed, null);
    applyScaleFromBundle(bundle.byId || {});
    sortTargets();
    return {
      value: val,
      min,
      max,
      target: primaryTarget(),
      targets,
      scaleErrors,
    };
  }

  if (!engine) {
    sortTargets();
    return {
      value: { numeric: null, error: 'Нет движка' },
      min,
      max,
      target: primaryTarget(),
      targets,
      scaleErrors,
    };
  }

  const named = {};
  /** @type {string} */
  let resolveProbe = '';

  if (source === 'formula_value') {
    const formula = String(s.valueFormula || '').trim();
    if (!formula) {
      sortTargets();
      return {
        value: { numeric: null, error: 'Пустая формула' },
        min,
        max,
        target: primaryTarget(),
        targets,
        scaleErrors,
      };
    }
    named.value = formula;
    resolveProbe = formula;
  } else if (source === 'field_value' || source === 'aggregated_value') {
    const modelId = ds?.modelId;
    const table = ds?.table;
    const field = ds?.field;
    if (modelId == null || !table || !field) {
      sortTargets();
      return {
        value: { numeric: null, error: 'Перетащите поле на виджет' },
        min,
        max,
        target: primaryTarget(),
        targets,
        scaleErrors,
      };
    }
    const agg =
      source === 'field_value' ? 'sum' : String(s.aggregation || 'sum').toLowerCase();
    const formula = buildSimpleFormula(agg, String(field), {
      countMode: s.countMode || 'rows',
    }).trim();
    if (!formula) {
      sortTargets();
      return {
        value: { numeric: null, error: 'Не задано поле' },
        min,
        max,
        target: primaryTarget(),
        targets,
        scaleErrors,
      };
    }
    named.value = formula;
    resolveProbe = formula;
  } else {
    sortTargets();
    return {
      value: { numeric: null, error: 'Неизвестный источник' },
      min,
      max,
      target: primaryTarget(),
      targets,
      scaleErrors,
    };
  }

  Object.assign(named, buildScaleNamed());
  if (!resolveProbe) resolveProbe = firstScaleProbe();

  try {
    const resolved = await resolveKpiDataSourceFromFormula(engine, ds || {}, resolveProbe);
    const modelId = resolved?.modelId ?? ds?.modelId;
    const table = resolved?.table ?? ds?.table;
    if (modelId == null || !table) {
      sortTargets();
      return {
        value: { numeric: null, error: 'Укажите модель или поле с вкладки «Данные»' },
        min,
        max,
        target: primaryTarget(),
        targets,
        scaleErrors,
      };
    }
    const client = getDashboardDataModelClient(engine);
    if (client?.invalidate && modelId != null) client.invalidate([String(modelId)]);
    const bundle = await runNamedFormulaBundle(engine, modelId, String(table), named, null);

    /** @type {{ numeric: number|null, error: string }} */
    let value = { numeric: null, error: '' };
    if (bundle.byId.value) {
      value = {
        numeric: bundle.byId.value.numeric,
        error: bundle.byId.value.error || bundle.errors.value || '',
      };
    }

    applyScaleFromBundle(bundle.byId || {});
    sortTargets();
    return { value, min, max, target: primaryTarget(), targets, scaleErrors };
  } catch (e) {
    sortTargets();
    return {
      value: { numeric: null, error: String(e?.message || e) },
      min,
      max,
      target: primaryTarget(),
      targets,
      scaleErrors,
    };
  }
}

/**
 * @param {object|null} engine
 * @param {{ settings?: object, dataSource?: object|null }} widget
 * @returns {Promise<{ numeric: number|null, error: string }>}
 */
export async function computeGaugeValue(engine, widget) {
  const st = await computeGaugeState(engine, widget);
  return { numeric: st.value.numeric, error: st.value.error };
}

/**
 * Legacy: один агрегат sum по полю (как старый reloadFromDataModel).
 */
export async function computeGaugeLegacySumField(engine, widget) {
  const ds = widget.dataSource;
  if (!engine || !ds?.modelId || !ds?.table || !ds?.field) {
    return { numeric: null, error: '' };
  }
  try {
    const filters = filtersForModel(collectDashboardFilters(engine), ds.modelId);
    const client = getDashboardDataModelClient(engine);
    if (client?.invalidate && ds.modelId != null) client.invalidate([String(ds.modelId)]);
    const { rows } = await client.fetchAggregate({
      modelId: ds.modelId,
      base_table: ds.table,
      group_by: [],
      aggregations: [{ fn: 'sum', column: ds.field, as: 'v' }],
      filters,
      limit: 1,
    });
    const raw = rows?.[0]?.v;
    const num = raw != null && raw !== '' ? Number(raw) : NaN;
    return { numeric: !Number.isNaN(num) ? num : 0, error: '' };
  } catch (e) {
    return { numeric: null, error: String(e?.message || e) };
  }
}
