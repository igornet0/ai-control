/**
 * Единый резолвер «hex + формула цвета».
 * Порядок: пусто → hex; color-AST; голый #hex; агрегат; иначе hex.
 */

import {
  coerceFormulaColorResult,
  evaluateSliceColorAst,
  tryCompileColorFormula,
} from '../../formula/colorExpr.js';
import { runNamedFormulaBundle } from '../../formula/widgetFormulaRuntime.js';
import { resolveKpiDataSourceFromFormula } from '../../formula/formulaInference.js';

/**
 * @param {unknown} raw
 * @returns {string}
 */
export function normalizeHexColor(raw, fallback = '') {
  const s = String(raw ?? '').trim();
  if (/^#[0-9a-fA-F]{6}$/i.test(s)) return s;
  if (/^#[0-9a-fA-F]{3}$/i.test(s)) {
    const r = s[1];
    const g = s[2];
    const b = s[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  if (/^#[0-9a-fA-F]{8}$/i.test(s)) return s.slice(0, 7);
  const fb = String(fallback ?? '').trim();
  return /^#[0-9a-fA-F]{6}$/i.test(fb) ? fb : '';
}

/**
 * @param {unknown} raw
 * @returns {string}
 */
export function normalizeColorFormula(raw) {
  return String(raw ?? '').trim();
}

/**
 * Sync-резолв (без агрегатов). Для быстрых путей и local IF/RGB.
 * @param {{
 *   hex?: string,
 *   formula?: string,
 *   fieldValues?: Record<string, unknown>,
 *   value?: number|null,
 *   label?: string,
 * }} opts
 * @returns {string} hex или ''
 */
export function resolveColorSettingSync(opts = {}) {
  const fallback = normalizeHexColor(opts.hex, '');
  const formula = normalizeColorFormula(opts.formula);
  if (!formula) return fallback;

  const bare = coerceFormulaColorResult(formula);
  if (bare) return normalizeHexColor(bare, fallback) || fallback;

  const compiled = tryCompileColorFormula(formula);
  if (compiled.ok) {
    const hex = evaluateSliceColorAst(compiled.ast, {
      value: opts.value != null ? opts.value : null,
      label: opts.label,
      fieldValues: opts.fieldValues && typeof opts.fieldValues === 'object' ? opts.fieldValues : {},
      engine: opts.engine,
    });
    if (hex) return normalizeHexColor(hex, fallback) || fallback;
  }

  return fallback;
}

/**
 * Полный async-резолв с агрегатами по модели.
 * @param {{
 *   hex?: string,
 *   formula?: string,
 *   fieldValues?: Record<string, unknown>,
 *   value?: number|null,
 *   label?: string,
 *   engine?: object|null,
 *   modelId?: string|number|null,
 *   table?: string|null,
 *   dataSource?: object|null,
 * }} opts
 * @returns {Promise<string>}
 */
export async function resolveColorSetting(opts = {}) {
  const fallback = normalizeHexColor(opts.hex, '');
  const formula = normalizeColorFormula(opts.formula);
  if (!formula) return fallback;

  const bare = coerceFormulaColorResult(formula);
  if (bare) return normalizeHexColor(bare, fallback) || fallback;

  const compiled = tryCompileColorFormula(formula);
  if (compiled.ok) {
    const hex = evaluateSliceColorAst(compiled.ast, {
      value: opts.value != null ? opts.value : null,
      label: opts.label,
      fieldValues: opts.fieldValues && typeof opts.fieldValues === 'object' ? opts.fieldValues : {},
      engine: opts.engine,
    });
    if (hex) return normalizeHexColor(hex, fallback) || fallback;
    return fallback;
  }

  const engine = opts.engine;
  if (!engine) return fallback;

  try {
    const ds = opts.dataSource || {};
    const resolved = await resolveKpiDataSourceFromFormula(engine, ds, formula);
    const modelId = opts.modelId ?? resolved?.modelId ?? ds?.modelId;
    const table = opts.table ?? resolved?.table ?? ds?.table;
    if (modelId == null || !table) return fallback;

    const bundle = await runNamedFormulaBundle(engine, modelId, table, { color: formula }, null);
    const ent = bundle?.byId?.color;
    const fromVal = coerceFormulaColorResult(ent?.value);
    if (fromVal) return normalizeHexColor(fromVal, fallback) || fallback;
    const s = String(ent?.value ?? '').trim();
    if (/^#[0-9a-fA-F]{3,8}$/i.test(s)) return normalizeHexColor(s, fallback) || fallback;
  } catch {
    /* fallback */
  }
  return fallback;
}

/**
 * Резолв нескольких именованных цветов (один проход агрегатов где нужно).
 * @param {Record<string, { hex?: string, formula?: string }>} map
 * @param {object} ctx — engine, dataSource, fieldValues, …
 * @returns {Promise<Record<string, string>>}
 */
export async function resolveColorSettingMap(map, ctx = {}) {
  /** @type {Record<string, string>} */
  const out = {};
  const entries = Object.entries(map || {});
  await Promise.all(
    entries.map(async ([key, spec]) => {
      out[key] = await resolveColorSetting({
        ...ctx,
        hex: spec?.hex,
        formula: spec?.formula,
      });
    }),
  );
  return out;
}
