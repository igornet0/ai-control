/**
 * Оформление виджета «Фильтр»: вариант полей, размер, скругление, акцент, отступы, раскладка.
 * Пустой акцент и radius = -1 означают «как в теме дашборда» (--dash-accent / --dash-widget-radius).
 */

export const FILTER_STYLE_VARIANTS = Object.freeze(['soft', 'outline', 'filled', 'underline', 'pill', 'glass']);
export const FILTER_STYLE_SIZES = Object.freeze(['sm', 'md', 'lg']);
export const FILTER_STYLE_LAYOUTS = Object.freeze(['auto', 'row', 'column']);

export const DEFAULT_FILTER_STYLE = Object.freeze({
  variant: 'soft',
  size: 'md',
  radius: -1,
  accent: '',
  gap: 8,
  layout: 'auto',
});

function asHexOrEmpty(raw) {
  const s = String(raw ?? '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(s) ? s.toUpperCase() : '';
}

function asInt(raw, fallback, min, max) {
  const n = parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function oneOf(raw, list, fallback) {
  return list.includes(raw) ? raw : fallback;
}

/**
 * @param {unknown} raw
 * @returns {{ variant: string, size: string, radius: number, accent: string, gap: number, layout: string }}
 */
export function normalizeFilterStyle(raw) {
  const d = DEFAULT_FILTER_STYLE;
  const r = raw && typeof raw === 'object' ? raw : {};
  return {
    variant: oneOf(r.variant, FILTER_STYLE_VARIANTS, d.variant),
    size: oneOf(r.size, FILTER_STYLE_SIZES, d.size),
    radius: asInt(r.radius, d.radius, -1, 24),
    accent: asHexOrEmpty(r.accent),
    gap: asInt(r.gap, d.gap, 0, 24),
    layout: oneOf(r.layout, FILTER_STYLE_LAYOUTS, d.layout),
  };
}

/** @param {unknown} style */
export function filterStyleClasses(style) {
  const s = normalizeFilterStyle(style);
  return `filter-widget--v-${s.variant} filter-widget--size-${s.size}`;
}

/**
 * Inline CSS variables для `.filter-widget`.
 * @param {unknown} style
 * @returns {string}
 */
export function filterStyleCssVars(style) {
  const s = normalizeFilterStyle(style);
  return [
    s.accent ? `--filter-accent:${s.accent}` : '',
    s.radius >= 0 ? `--filter-radius:${s.radius}px` : '',
    `--filter-gap:${s.gap}px`,
  ]
    .filter(Boolean)
    .join(';');
}
