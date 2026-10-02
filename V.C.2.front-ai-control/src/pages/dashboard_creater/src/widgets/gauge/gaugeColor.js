/**
 * Цвет заливки дуги по режиму: static / range / gradient.
 * @param {number} normalized01 — доля 0..1 по заполнению (после clamp значения к min..max)
 * @param {string} fallbackFill — fillColor по умолчанию
 * @param {Record<string, unknown>} settings
 * @returns {{ strokeCss: string, useGradient: boolean, gradientId?: string, gradientStops?: { offset: string, color: string }[] }}
 */
export function resolveGaugeFillStyle(normalized01, fallbackFill, settings) {
  const t = Math.max(0, Math.min(1, normalized01));
  const mode = String(settings.fillColorMode || 'static').toLowerCase();

  if (mode === 'gradient') {
    const a = String(settings.gradientColorA || fallbackFill);
    const b = String(settings.gradientColorB || '#00f0ff');
    return {
      strokeCss: '',
      useGradient: true,
      gradientStops: [
        { offset: '0%', color: a },
        { offset: '100%', color: b },
      ],
    };
  }

  if (mode === 'range' && Array.isArray(settings.rangeColorRules) && settings.rangeColorRules.length > 0) {
    const rules = [...settings.rangeColorRules].sort((x, y) => x.from - y.from);
    for (const r of rules) {
      const from = Number(r.from);
      const to = Number(r.to);
      if (!Number.isFinite(from) || !Number.isFinite(to)) continue;
      if (t >= from && t <= to) {
        return { strokeCss: r.color, useGradient: false };
      }
    }
    if (rules.length) {
      return { strokeCss: rules[rules.length - 1].color, useGradient: false };
    }
  }

  return { strokeCss: fallbackFill, useGradient: false };
}

/**
 * Интерполяция между двумя hex для mid-point в шейдере не нужна — SVG linearGradient по длине дуги реализуется отдельно в рендере.
 * Линейный цвет вдоль дуги: вернуть цвет в точке u in 0..1 между A и B.
 * @param {string} hexA
 * @param {string} hexB
 * @param {number} u
 */
export function lerpHexColor(hexA, hexB, u) {
  const a = parseHex(hexA);
  const b = parseHex(hexB);
  if (!a || !b) return hexA || hexB || '#00ff80';
  const t = Math.max(0, Math.min(1, u));
  const r = Math.round(a.r + (b.r - a.r) * t);
  const g = Math.round(a.g + (b.g - a.g) * t);
  const bl = Math.round(a.b + (b.b - a.b) * t);
  return `#${[r, g, bl].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}

function parseHex(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex || ''));
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : null;
}

export function hexToRgb(hex) {
  return parseHex(hex);
}

export function lightenColor(hex, percent) {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  const r = Math.min(255, Math.round(rgb.r + (255 - rgb.r) * percent / 100));
  const g = Math.min(255, Math.round(rgb.g + (255 - rgb.g) * percent / 100));
  const b = Math.min(255, Math.round(rgb.b + (255 - rgb.b) * percent / 100));
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}

export function darkenColor(hex, percent) {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  const r = Math.max(0, Math.round(rgb.r * (1 - percent / 100)));
  const g = Math.max(0, Math.round(rgb.g * (1 - percent / 100)));
  const b = Math.max(0, Math.round(rgb.b * (1 - percent / 100)));
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}
