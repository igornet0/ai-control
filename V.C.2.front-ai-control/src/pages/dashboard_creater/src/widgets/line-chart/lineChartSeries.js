/**
 * Multi-series: palette, bindingMeasures migrate, build series from rows.
 */

import { normalizeChartDimMeasBinding, resolveChartMeasure } from '../common/chartBindingFormula.js';
import { parseXToNumber } from './lineChartScales.js';

export const LINE_SERIES_PALETTE = [
  '#4DA3FF',
  '#34d399',
  '#f59e0b',
  '#f87171',
  '#a78bfa',
  '#22d3ee',
  '#fb7185',
  '#84cc16',
  '#e879f9',
  '#38bdf8',
];

export const LINE_CHART_MAX_VISIBLE_SERIES = 8;

/**
 * @param {unknown} raw
 * @returns {string}
 */
function normalizeHexColor(raw, fallback = '#4DA3FF') {
  const s = String(raw || '').trim();
  return /^#[0-9a-fA-F]{6}$/i.test(s) ? s : fallback;
}

/**
 * Paint for a Y-series: solid color or gradient.
 * @param {Record<string, unknown>|null|undefined} binding
 * @param {number} index
 */
export function normalizeSeriesPaint(binding, index = 0) {
  const fallback = LINE_SERIES_PALETTE[index % LINE_SERIES_PALETTE.length];
  const color = normalizeHexColor(binding?.color, fallback);
  const gIn = binding?.gradient && typeof binding.gradient === 'object' ? binding.gradient : {};
  const modeRaw = String(binding?.colorMode || '').toLowerCase();
  const gradEnabled =
    modeRaw === 'gradient' ||
    (!!gIn.enabled && modeRaw !== 'solid');
  return {
    colorMode: gradEnabled ? 'gradient' : 'solid',
    color,
    gradient: {
      enabled: gradEnabled,
      mode: String(gIn.mode || 'x').toLowerCase() === 'y' ? 'y' : 'x',
      from: normalizeHexColor(gIn.from, '#005DFF'),
      to: normalizeHexColor(gIn.to, '#00E0FF'),
    },
  };
}

function newSeriesId() {
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * @param {Record<string, unknown>|null|undefined} binding
 * @param {number} index
 */
export function measureBindingToSeriesMeta(binding, index = 0) {
  if (!binding || typeof binding !== 'object') return null;
  const b = normalizeChartDimMeasBinding(binding);
  const field = String(b.field || '').trim();
  const label =
    (b.label != null && String(b.label).trim()) ||
    field ||
    `Серия ${index + 1}`;
  const paint = normalizeSeriesPaint(
    {
      color: b.color != null ? b.color : binding.color,
      colorMode: binding.colorMode,
      gradient: binding.gradient,
    },
    index,
  );
  return {
    id: b.id != null ? String(b.id) : binding.id != null ? String(binding.id) : newSeriesId(),
    modelId: b.modelId,
    table: b.table,
    field: b.field,
    formula: b.formula,
    type: b.type,
    label,
    color: paint.color,
    colorMode: paint.colorMode,
    gradient: paint.gradient,
    visible: b.visible !== false && binding.visible !== false,
    yAxis: b.yAxis === 'right' || binding.yAxis === 'right' ? 'right' : 'left',
  };
}

/**
 * Migrate bindingMeasure → bindingMeasures[]; sync bindingMeasure = [0].
 * Legacy: line.gradient.enabled → paint первой серии.
 * @param {Record<string, unknown>} settings
 */
export function ensureBindingMeasures(settings) {
  if (!settings || typeof settings !== 'object') return settings;
  let list = Array.isArray(settings.bindingMeasures) ? settings.bindingMeasures.slice() : null;
  if ((!list || !list.length) && settings.bindingMeasure && typeof settings.bindingMeasure === 'object') {
    list = [settings.bindingMeasure];
  }
  if (!list) list = [];

  const legacyGrad =
    settings.line?.gradient &&
    typeof settings.line.gradient === 'object' &&
    !!settings.line.gradient.enabled
      ? settings.line.gradient
      : null;

  settings.bindingMeasures = list.map((b, i) => {
    let row = { ...(b && typeof b === 'object' ? b : {}) };
    if (
      i === 0 &&
      legacyGrad &&
      row.colorMode == null &&
      !(row.gradient && typeof row.gradient === 'object' && row.gradient.enabled)
    ) {
      row = {
        ...row,
        colorMode: 'gradient',
        gradient: {
          enabled: true,
          mode: legacyGrad.mode === 'y' ? 'y' : 'x',
          from: legacyGrad.from || '#005DFF',
          to: legacyGrad.to || '#00E0FF',
        },
      };
    }
    const meta = measureBindingToSeriesMeta(row, i);
    return meta || row;
  });

  // Глобальный градиент Display больше не UI-источник — гасим после миграции.
  if (legacyGrad && settings.line?.gradient) {
    settings.line = {
      ...settings.line,
      gradient: { ...settings.line.gradient, enabled: false },
    };
  }

  if (settings.bindingMeasures.length) {
    settings.bindingMeasure = { ...settings.bindingMeasures[0] };
    if (!settings.line || typeof settings.line !== 'object') settings.line = {};
    settings.line.color = settings.bindingMeasures[0].color || settings.line.color || LINE_SERIES_PALETTE[0];
  }
  return settings;
}

/**
 * @param {Record<string, unknown>} settings
 * @returns {object[]}
 */
export function listBindingMeasures(settings) {
  ensureBindingMeasures(settings);
  return Array.isArray(settings.bindingMeasures) ? settings.bindingMeasures : [];
}

/**
 * @param {Record<string, unknown>} settings
 * @param {Record<string, unknown>} measureBinding
 */
export function appendBindingMeasure(settings, measureBinding) {
  ensureBindingMeasures(settings);
  const idx = settings.bindingMeasures.length;
  const meta = measureBindingToSeriesMeta(measureBinding, idx);
  if (!meta) return false;
  const key = `${meta.modelId}::${meta.table}::${meta.field}`;
  const dup = settings.bindingMeasures.some(
    (m) => `${m.modelId}::${m.table}::${m.field}` === key,
  );
  if (dup) return false;
  settings.bindingMeasures.push(meta);
  settings.bindingMeasure = { ...settings.bindingMeasures[0] };
  return true;
}

/**
 * @param {object[]} measures meta from bindingMeasures
 */
export function resolveLineMeasures(measures) {
  const out = [];
  for (const m of measures || []) {
    const resolved = resolveChartMeasure(m, { forLine: true });
    if (resolved?.groupBy?.length && !resolved.sqlOk) {
      out.push({
        meta: m,
        resolved,
        id: String(m.id || resolved.field || 'measure'),
        label: String(m.label || resolved.field || 'measure'),
        color: '#4DA3FF',
        colorMode: 'solid',
        gradient: null,
        visible: m.visible !== false,
        yAxis: m.yAxis === 'right' ? 'right' : 'left',
        yField: String(resolved.field || ''),
      });
      continue;
    }
    if (!resolved?.sqlOk || !resolved.field || resolved.field === '*') continue;
    const paint = normalizeSeriesPaint(m, out.length);
    out.push({
      meta: m,
      resolved,
      id: String(m.id || resolved.field),
      label: String(m.label || resolved.field),
      color: paint.color,
      colorMode: paint.colorMode,
      gradient: paint.gradient,
      visible: m.visible !== false,
      yAxis: m.yAxis === 'right' ? 'right' : 'left',
      yField: String(resolved.field),
    });
  }
  return out;
}

/**
 * @param {Record<string, unknown>[]} data
 * @param {string} xField
 * @param {string} yField
 * @param {'time'|'linear'|'category'} xType
 */
export function buildSortedSeries(data, xField, yField, xType) {
  /** @type {{ x: number; y: number; idx: number; rawX?: unknown; row?: Record<string, unknown> }[]} */
  const out = [];
  const rows = Array.isArray(data) ? data : [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rawX = row[xField];
    const y = parseFloat(/** @type {any} */ (row[yField]));
    if (!Number.isFinite(y)) continue;
    let xNum = parseXToNumber(rawX);
    if (xNum == null || !Number.isFinite(xNum)) {
      xNum = out.length;
    }
    out.push({ x: xNum, y, idx: i, rawX, row });
  }
  out.sort((a, b) => (a.x !== b.x ? a.x - b.x : a.idx - b.idx));
  if (xType === 'category') {
    out.forEach((p, j) => {
      p.x = j;
    });
  }
  return out;
}

/**
 * @param {object[]} seriesList
 */
export function fullBoundsFromMultiSeries(seriesList) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let any = false;
  for (const s of seriesList || []) {
    if (s.visible === false || s.kind === 'band') continue;
    const pts = s.points || [];
    for (const p of pts) {
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
      any = true;
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
  }
  if (!any) return { minX: 0, maxX: 1, minY: 0, maxY: 1 };
  if (minX === maxX) maxX = minX + 1;
  if (minY === maxY) maxY = minY + 1e-6;
  return { minX, maxX, minY, maxY };
}

/**
 * Merge rows by X key from parallel series fetches.
 * @param {string} xField
 * @param {Array<{ yField: string, rows: Record<string, unknown>[] }>} parts
 */
export function mergeSeriesRowsByX(xField, parts) {
  /** @type {Map<string, Record<string, unknown>>} */
  const map = new Map();
  for (const part of parts) {
    for (const row of part.rows || []) {
      const rawX = row[xField];
      const key = rawX == null ? '' : String(rawX);
      let dest = map.get(key);
      if (!dest) {
        dest = { [xField]: rawX };
        map.set(key, dest);
      }
      if (row[part.yField] !== undefined) dest[part.yField] = row[part.yField];
      for (const [k, v] of Object.entries(row)) {
        if (k !== xField && k !== part.yField && dest[k] === undefined) dest[k] = v;
      }
    }
  }
  const out = [...map.values()];
  out.sort((a, b) => {
    const ax = parseXToNumber(a[xField]);
    const bx = parseXToNumber(b[xField]);
    if (ax != null && bx != null && Number.isFinite(ax) && Number.isFinite(bx)) return ax - bx;
    return String(a[xField] ?? '').localeCompare(String(b[xField] ?? ''));
  });
  return out;
}

/**
 * Count how many series are visible (raw only for draw limit).
 * @param {object[]} seriesList
 */
export function countVisibleRawSeries(seriesList) {
  return (seriesList || []).filter((s) => s.kind === 'raw' && s.visible !== false).length;
}
