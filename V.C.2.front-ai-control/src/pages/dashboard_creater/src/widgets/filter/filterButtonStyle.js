/**
 * Общий стиль кнопок полей в виджете «Фильтр».
 */

export const DEFAULT_FILTER_BUTTON_STYLE = Object.freeze({
  background: '#163A42',
  color: '#E8FBFF',
  hoverBackground: '#1C4F5A',
  openBackground: '#226672',
  borderColor: '#2A7A88',
  borderRadius: 999,
  fontSize: 14,
  fontWeight: 600,
});

/**
 * @param {unknown} raw
 * @returns {string}
 */
function asHex(raw, fallback) {
  const s = String(raw ?? '').trim();
  if (/^#[0-9a-fA-F]{6}$/i.test(s)) return s.toUpperCase();
  return fallback;
}

/**
 * @param {unknown} raw
 * @param {number} fallback
 * @param {number} min
 * @param {number} max
 */
function asInt(raw, fallback, min, max) {
  const n = parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/**
 * @param {unknown} raw
 * @returns {typeof DEFAULT_FILTER_BUTTON_STYLE | null}
 */
export function normalizeFilterButtonStyle(raw) {
  if (raw == null || typeof raw !== 'object') return null;
  const d = DEFAULT_FILTER_BUTTON_STYLE;
  return {
    background: asHex(raw.background, d.background),
    color: asHex(raw.color, d.color),
    hoverBackground: asHex(raw.hoverBackground, d.hoverBackground),
    openBackground: asHex(raw.openBackground, d.openBackground),
    borderColor: asHex(raw.borderColor, d.borderColor),
    borderRadius: asInt(raw.borderRadius, d.borderRadius, 0, 999),
    fontSize: asInt(raw.fontSize, d.fontSize, 8, 72),
    fontWeight: asInt(raw.fontWeight, d.fontWeight, 400, 700),
    backgroundFormula: String(raw.backgroundFormula ?? '').trim(),
    colorFormula: String(raw.colorFormula ?? '').trim(),
    hoverBackgroundFormula: String(raw.hoverBackgroundFormula ?? '').trim(),
    openBackgroundFormula: String(raw.openBackgroundFormula ?? '').trim(),
    borderColorFormula: String(raw.borderColorFormula ?? '').trim(),
  };
}

/**
 * Inline CSS variables for `.filter-widget` (all `.filter-field-btn` inside).
 * @param {ReturnType<typeof normalizeFilterButtonStyle>} style
 * @param {Record<string, string>|null|undefined} resolved — resolved hex overrides
 * @returns {string}
 */
export function filterButtonStyleCssVars(style, resolved = null) {
  const s = normalizeFilterButtonStyle(style);
  if (!s) return '';
  const r = resolved && typeof resolved === 'object' ? resolved : {};
  const pick = (key, fallback) => {
    const v = r[key];
    return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/i.test(v) ? v : fallback;
  };
  return [
    `--filter-btn-bg:${pick('background', s.background)}`,
    `--filter-btn-hover-bg:${pick('hoverBackground', s.hoverBackground)}`,
    `--filter-btn-open-bg:${pick('openBackground', s.openBackground)}`,
    `--filter-btn-border:${pick('borderColor', s.borderColor)}`,
    `--filter-btn-radius:${s.borderRadius}px`,
    `--filter-btn-font-weight:${s.fontWeight}`,
  ].join(';');
}
