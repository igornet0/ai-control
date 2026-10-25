/**
 * Перевод произвольного CSS-цвета в rgba с заданной прозрачностью.
 * Поддерживает #rgb, #rgba, #rrggbb, #rrggbbaa, rgb()/rgba() (через запятую или пробел).
 * Прочие значения (имена цветов, hsl(), var(--x)) — через color-mix, который понимают
 * современные браузеры; без цвета — fallback.
 */

function clampAlpha(alpha) {
  const a = Number(alpha);
  if (!Number.isFinite(a)) return 1;
  return Math.min(1, Math.max(0, a));
}

/**
 * @param {string} color
 * @returns {{ r: number, g: number, b: number } | null}
 */
export function parseColorRgb(color) {
  if (typeof color !== 'string') return null;
  const s = color.trim();
  const hex = s.match(/^#([0-9a-f]{3,8})$/i);
  if (hex) {
    let h = hex[1];
    if (h.length === 3 || h.length === 4) h = h.slice(0, 3).split('').map((c) => c + c).join('');
    else if (h.length === 8) h = h.slice(0, 6);
    if (h.length !== 6) return null;
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }
  const fn = s.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
  if (fn) {
    const [r, g, b] = fn.slice(1, 4).map((v) => Math.min(255, Math.round(Number(v))));
    if ([r, g, b].some((v) => !Number.isFinite(v))) return null;
    return { r, g, b };
  }
  return null;
}

/**
 * @param {string} color
 * @param {number} alpha 0..1
 * @param {string} [fallback]
 * @returns {string}
 */
export function colorToRgba(color, alpha, fallback = 'rgba(255, 255, 255, 0.1)') {
  const a = clampAlpha(alpha);
  const rgb = parseColorRgb(color);
  if (rgb) return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
  if (typeof color === 'string' && color.trim() && color.trim() !== 'transparent') {
    return `color-mix(in srgb, ${color.trim()} ${Math.round(a * 100)}%, transparent)`;
  }
  return fallback;
}
