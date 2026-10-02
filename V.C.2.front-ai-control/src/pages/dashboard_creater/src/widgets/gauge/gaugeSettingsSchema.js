/**
 * Схема настроек датчика: дефолты, нормализация, обратная совместимость с дашбордами без новых полей.
 */

/** @typedef {'static_value'|'field_value'|'aggregated_value'|'formula_value'} GaugeValueSource */

/** @typedef {'arc'|'full_circle'|'donut'|'thin_line'|'segmented'|'progress_bar'} GaugeStyleType */

/** @typedef {'dot'|'needle'|'line'} GaugeIndicatorType */

/** @typedef {'static'|'range'|'gradient'} GaugeFillColorMode */

/** @typedef {'number'|'percent'|'custom'} GaugeValueFormat */

/** @typedef {'of_range'|'literal'} GaugePercentMode — of_range: % заполнения шкалы; literal: value уже 0–100 */

/** @typedef {{ id: string, label: string, value: number|null, formula: string, color: string }} GaugeTarget */

export const GAUGE_TARGETS_MAX = 8;
export const GAUGE_DEFAULT_TARGET_COLOR = '#f59e0b';

/**
 * @returns {Record<string, unknown>}
 */
export function createDefaultGaugeSettings() {
  return {
    showTitle: false,
    title: 'Датчик',
    titleSize: 14,
    titleColor: '#8B5CF6',
    value: null,
    min: 0,
    max: 100,
    /** @deprecated migrated → targets */
    targetValue: null,
    theme: 'neon',
    backgroundColor: 'rgba(20,20,30,0.8)',
    gaugeColor: '#00f0ff',
    fillColor: '#00ff80',
    textColor: '#ffffff',
    borderRadius: '16px',
    shadow: true,
    animationSpeed: 500,
    animationEnabled: true,
    animationEasing: 'cubic-bezier(0.16, 1, 0.3, 1)',
    showValue: true,
    valueSuffix: '%',
    /** По умолчанию как старый датчик: процент заполнения шкалы. */
    valueFormat: 'percent',
    valuePrecision: 0,
    valueCustomPattern: '{value}',
    valuePercentMode: 'of_range',
    /** @type {'standard'|'compact'} — только для valueFormat === 'number' */
    valueNumberNotation: 'standard',
    thickness: 16,
    startAngle: -130,
    endAngle: 130,
    dialRotation: 0,
    glowIntensity: 10,
    neonEnabled: true,
    neonColor: '#78ff82',
    /** @type {GaugeValueSource|''} */
    valueSource: '',
    staticValue: null,
    aggregation: 'sum',
    countMode: 'rows',
    valueFormula: '',
    /** Опциональные формулы шкалы (агрегаты); если пусто — min/max из чисел. */
    minFormula: '',
    maxFormula: '',
    /** @deprecated migrated → targets[].formula */
    targetFormula: '',
    /** @type {GaugeTarget[]} */
    targets: [],
    /** Красить дорожку шкалы цветными зонами по целям */
    targetsPaintTrack: true,
    gaugeStyleType: 'arc',
    donutInnerRatio: 0.62,
    thinLineSweepDeg: 300,
    segmentedCount: 12,
    segmentedGapDeg: 3,
    indicatorType: 'dot',
    indicatorSize: null,
    indicatorColor: '',
    fillColorMode: 'static',
    rangeColorRules: [],
    gradientColorA: '#00ff80',
    gradientColorB: '#00f0ff',
    /** Скругление углов полосы (px), только тип progress_bar */
    progressBarCornerRadius: 10,
    gaugePaddingRatio: 0.12,
    trackOpacity: 0.07,
    roundCaps: true,
    interactionEnabled: false,
    tooltipShowFormula: true,
  };
}

/**
 * @param {Partial<GaugeTarget>} [partial]
 * @returns {GaugeTarget}
 */
export function createGaugeTarget(partial = {}) {
  const id =
    String(partial.id || '').trim() ||
    `tgt_${Math.random().toString(36).slice(2, 9)}`;
  let value = null;
  if (partial.value != null && partial.value !== '') {
    const n = Number(partial.value);
    value = Number.isFinite(n) ? n : null;
  }
  let color = String(partial.color || GAUGE_DEFAULT_TARGET_COLOR).trim();
  if (!/^#[0-9a-fA-F]{6}$/i.test(color)) color = GAUGE_DEFAULT_TARGET_COLOR;
  return {
    id,
    label: String(partial.label ?? '').trim(),
    value,
    formula: String(partial.formula ?? '').trim(),
    color,
  };
}

/**
 * Пресеты целей для разных типов данных.
 * @returns {Record<string, { label: string, hint: string, apply: (min: number, max: number) => GaugeTarget[] }>}
 */
export function getGaugeTargetPresets() {
  return {
    traffic: {
      label: 'Светофор',
      hint: 'Низкий / норма / высокий — 3 зоны',
      apply: (min, max) => {
        const span = max - min || 100;
        return [
          createGaugeTarget({
            id: 'preset_low',
            label: 'Низкий',
            value: min + span * 0.33,
            color: '#ef4444',
          }),
          createGaugeTarget({
            id: 'preset_mid',
            label: 'Норма',
            value: min + span * 0.66,
            color: '#eab308',
          }),
          createGaugeTarget({
            id: 'preset_high',
            label: 'Высокий',
            value: max,
            color: '#22c55e',
          }),
        ];
      },
    },
    margin: {
      label: 'Margin %',
      hint: 'Зоны 20 / 40 / 60 (маржа)',
      apply: () => [
        createGaugeTarget({ id: 'm20', label: '20%', value: 20, color: '#ef4444' }),
        createGaugeTarget({ id: 'm40', label: '40%', value: 40, color: '#f59e0b' }),
        createGaugeTarget({ id: 'm60', label: '60%', value: 60, color: '#22c55e' }),
      ],
    },
    loaders: {
      label: 'Нагрузка / KPI',
      hint: 'Зоны + целевой порог (как LOADERS)',
      apply: (min, max) => {
        const hi = Number.isFinite(max) ? max : 131;
        const lo = Number.isFinite(min) ? min : 0;
        const span = hi - lo || 131;
        return [
          createGaugeTarget({
            id: 'load_warn',
            label: 'Внимание',
            value: lo + span * 0.45,
            color: '#ef4444',
          }),
          createGaugeTarget({
            id: 'load_ok',
            label: 'Цель',
            value: lo + span * 0.76,
            color: '#eab308',
          }),
          createGaugeTarget({
            id: 'load_max',
            label: 'Пик',
            value: hi,
            color: '#22c55e',
          }),
        ];
      },
    },
  };
}

/**
 * Зоны шкалы из resolved-целей: [min,t1], [t1,t2], …, [tn,max].
 * @param {number} min
 * @param {number} max
 * @param {Array<{ value: number, color: string, id?: string, label?: string }>} targets
 * @returns {Array<{ from: number, to: number, color: string, targetId?: string, label?: string }>}
 */
export function buildGaugeTargetZones(min, max, targets) {
  const lo = Number(min);
  const hi = Number(max);
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo) return [];
  const sorted = (Array.isArray(targets) ? targets : [])
    .map((t) => ({
      value: Number(t.value),
      color: String(t.color || GAUGE_DEFAULT_TARGET_COLOR),
      id: t.id,
      label: t.label,
    }))
    .filter((t) => Number.isFinite(t.value))
    .sort((a, b) => a.value - b.value);
  if (!sorted.length) return [];

  /** @type {Array<{ from: number, to: number, color: string, targetId?: string, label?: string }>} */
  const zones = [];
  let cursor = lo;
  for (const t of sorted) {
    const edge = Math.max(lo, Math.min(hi, t.value));
    if (edge <= cursor + 1e-9) {
      cursor = Math.max(cursor, edge);
      continue;
    }
    zones.push({
      from: cursor,
      to: edge,
      color: t.color,
      targetId: t.id,
      label: t.label,
    });
    cursor = edge;
  }
  if (cursor < hi - 1e-9) {
    const last = sorted[sorted.length - 1];
    zones.push({
      from: cursor,
      to: hi,
      color: last.color,
      targetId: last.id,
      label: last.label,
    });
  }
  return zones;
}

/**
 * @param {unknown} rawList
 * @returns {GaugeTarget[]}
 */
function normalizeTargetsList(rawList) {
  if (!Array.isArray(rawList)) return [];
  const seen = new Set();
  /** @type {GaugeTarget[]} */
  const out = [];
  for (const item of rawList) {
    if (!item || typeof item !== 'object') continue;
    const t = createGaugeTarget(/** @type {Partial<GaugeTarget>} */ (item));
    let id = t.id;
    while (seen.has(id)) id = `${t.id}_${out.length}`;
    t.id = id;
    seen.add(id);
    out.push(t);
    if (out.length >= GAUGE_TARGETS_MAX) break;
  }
  return out;
}

/**
 * Правила диапазона цвета в долях 0–1 по заполнению шкалы (percent 0–100 → /100).
 * @typedef {{ from: number, to: number, color: string }} GaugeRangeColorRule
 */

/**
 * @param {Record<string, unknown>} raw
 * @param {{ dataSource?: { modelId?: unknown, table?: string, field?: string } | null }} [ctx]
 * @returns {Record<string, unknown>}
 */
export function normalizeGaugeSettings(raw, ctx = {}) {
  const ds = ctx.dataSource || {};
  const defs = createDefaultGaugeSettings();
  const out = { ...defs, ...raw };

  const hasDsField =
    ds.modelId != null && !!String(ds.table || '').trim() && !!String(ds.field || '').trim();

  let valueSource = String(out.valueSource || '').trim();
  if (!valueSource) {
    if (String(out.valueFormula || '').trim()) {
      valueSource = 'formula_value';
    } else if (hasDsField) {
      valueSource = 'field_value';
    } else if (out.staticValue != null && out.staticValue !== '') {
      valueSource = 'static_value';
    } else if (
      out.value != null &&
      out.value !== '' &&
      Number.isFinite(Number(out.value))
    ) {
      valueSource = 'static_value';
    } else {
      valueSource = 'field_value';
    }
    out.valueSource = valueSource;
  }

  const allowed = ['static_value', 'field_value', 'aggregated_value', 'formula_value'];
  if (!allowed.includes(valueSource)) out.valueSource = 'field_value';

  if (out.valueSource === 'field_value' || out.valueSource === 'aggregated_value') {
    if (out.valueSource === 'field_value') {
      out.aggregation = 'sum';
    } else {
      const agg = String(out.aggregation || 'sum').toLowerCase();
      out.aggregation = ['sum', 'avg', 'min', 'max', 'count'].includes(agg) ? agg : 'sum';
    }
    const cm = String(out.countMode || 'rows').toLowerCase();
    out.countMode = ['rows', 'non_null', 'distinct'].includes(cm) ? cm : 'rows';
  }

  const mn = Number(out.min);
  const mx = Number(out.max);
  out.min = Number.isFinite(mn) ? mn : 0;
  out.max = Number.isFinite(mx) ? mx : 100;
  if (out.max <= out.min) out.max = out.min + 1;

  if (out.targetValue != null && out.targetValue !== '') {
    const tv = Number(out.targetValue);
    out.targetValue = Number.isFinite(tv) ? tv : null;
  } else {
    out.targetValue = null;
  }

  if (typeof out.targetFormula === 'string') out.targetFormula = out.targetFormula.trim();
  else out.targetFormula = '';

  let targets = normalizeTargetsList(out.targets);
  if (
    targets.length === 0 &&
    (out.targetValue != null || String(out.targetFormula || '').trim())
  ) {
    targets = [
      createGaugeTarget({
        id: 'legacy_target',
        label: 'Цель',
        value: out.targetValue,
        formula: String(out.targetFormula || ''),
        color: GAUGE_DEFAULT_TARGET_COLOR,
      }),
    ];
  }
  out.targets = targets;
  out.targetsPaintTrack = out.targetsPaintTrack !== false;

  const sv = out.staticValue;
  if (sv != null && sv !== '') {
    const sn = Number(sv);
    out.staticValue = Number.isFinite(sn) ? sn : null;
  } else {
    out.staticValue = null;
  }

  const fmt = String(out.valueFormat || 'number').toLowerCase();
  out.valueFormat = ['number', 'percent', 'custom'].includes(fmt) ? fmt : 'number';
  let prec = parseInt(String(out.valuePrecision), 10);
  if (!Number.isFinite(prec)) prec = 0;
  out.valuePrecision = Math.min(8, Math.max(0, prec));

  const pcm = String(out.valuePercentMode || 'of_range').toLowerCase();
  out.valuePercentMode = pcm === 'literal' ? 'literal' : 'of_range';

  const vn = String(out.valueNumberNotation || 'standard').toLowerCase();
  out.valueNumberNotation = vn === 'compact' ? 'compact' : 'standard';

  const st = String(out.gaugeStyleType || 'arc').toLowerCase();
  out.gaugeStyleType = ['arc', 'full_circle', 'donut', 'thin_line', 'segmented', 'progress_bar'].includes(st)
    ? st
    : 'arc';

  let pcr = Number(out.progressBarCornerRadius);
  if (!Number.isFinite(pcr)) pcr = 10;
  out.progressBarCornerRadius = Math.min(48, Math.max(0, pcr));

  const ind = String(out.indicatorType || 'dot').toLowerCase();
  out.indicatorType = ['dot', 'needle', 'line'].includes(ind) ? ind : 'dot';

  const fcm = String(out.fillColorMode || 'static').toLowerCase();
  out.fillColorMode = ['static', 'range', 'gradient'].includes(fcm) ? fcm : 'static';

  if (!Array.isArray(out.rangeColorRules)) out.rangeColorRules = [];
  out.rangeColorRules = out.rangeColorRules
    .map((r) => {
      if (!r || typeof r !== 'object') return null;
      const from = Number(r.from);
      const to = Number(r.to);
      const color = String(r.color || '').trim();
      if (!color) return null;
      return {
        from: Number.isFinite(from) ? from : 0,
        to: Number.isFinite(to) ? to : 1,
        color,
      };
    })
    .filter(Boolean);

  let ir = Number(out.donutInnerRatio);
  if (!Number.isFinite(ir)) ir = 0.62;
  out.donutInnerRatio = Math.min(0.92, Math.max(0.2, ir));

  let sweep = Number(out.thinLineSweepDeg);
  if (!Number.isFinite(sweep)) sweep = 300;
  out.thinLineSweepDeg = Math.min(359, Math.max(90, sweep));

  let segN = parseInt(String(out.segmentedCount), 10);
  if (!Number.isFinite(segN)) segN = 12;
  out.segmentedCount = Math.min(48, Math.max(3, segN));

  let segG = Number(out.segmentedGapDeg);
  if (!Number.isFinite(segG)) segG = 3;
  out.segmentedGapDeg = Math.min(20, Math.max(0, segG));

  let pad = Number(out.gaugePaddingRatio);
  if (!Number.isFinite(pad)) pad = 0.12;
  out.gaugePaddingRatio = Math.min(0.35, Math.max(0.04, pad));

  if (typeof out.roundCaps !== 'boolean') out.roundCaps = true;
  if (typeof out.neonEnabled !== 'boolean') out.neonEnabled = !!out.neonEnabled;
  if (typeof out.showValue !== 'boolean') out.showValue = out.showValue !== false;
  if (typeof out.animationEnabled !== 'boolean') out.animationEnabled = out.animationEnabled !== false;
  if (typeof out.showTitle !== 'boolean') out.showTitle = false;
  {
    const t = out.title != null ? String(out.title).trim() : '';
    out.title = t || 'Датчик';
    let ts = parseInt(out.titleSize, 10);
    if (!Number.isFinite(ts)) ts = 14;
    out.titleSize = Math.min(48, Math.max(8, ts));
    const c = String(out.titleColor || '').trim();
    out.titleColor = /^#[0-9a-fA-F]{6}$/i.test(c) ? c : '#8B5CF6';
  }

  if (typeof out.minFormula === 'string') out.minFormula = out.minFormula.trim();
  else out.minFormula = '';
  if (typeof out.maxFormula === 'string') out.maxFormula = out.maxFormula.trim();
  else out.maxFormula = '';

  return out;
}
