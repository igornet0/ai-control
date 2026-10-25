/**
 * Текущие значения темы дашборда, нужные виджетам при рендере
 * (canvas и SVG-атрибуты не понимают CSS-переменные, поэтому значения берутся отсюда).
 * Обновляется в applyDashboardTheme.
 */

import { parseColorRgb } from '../widgets/common/colorToRgba.js';

const DEFAULT_TEXT_COLOR = '#E4E6EB';
const DEFAULT_FONT_FAMILY = 'Inter';

let textColor = DEFAULT_TEXT_COLOR;
let fontFamily = DEFAULT_FONT_FAMILY;
/** @type {'light' | 'dark' | null} null — стандартный стиль, цвета не адаптируются */
let mode = null;

/** Цвет текста виджетов по умолчанию (если в виджете не задан свой). */
export function defaultTextColor() {
  return textColor;
}

/** Шрифт виджетов по умолчанию (если в виджете не задан свой). */
export function defaultFontFamily() {
  return fontFamily;
}

/** Относительная яркость цвета 0..1 (null — не удалось разобрать). */
function luminance(color) {
  const rgb = parseColorRgb(color);
  if (!rgb) return null;
  const lin = (c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(rgb.r) + 0.7152 * lin(rgb.g) + 0.0722 * lin(rgb.b);
}

/**
 * Явно заданный цвет текста, который сольётся с фоном темы
 * (почти белый на светлой теме, почти чёрный на тёмной), заменяется цветом текста темы.
 * Остальные цвета и пустое значение возвращаются как есть.
 * @param {string | null | undefined} color
 */
export function adaptTextColor(color) {
  if (!color || !mode) return color;
  const l = luminance(String(color).trim());
  if (l == null) return color;
  if (mode === 'light' && l > 0.8) return textColor;
  if (mode === 'dark' && l < 0.02) return textColor;
  return color;
}

/**
 * @param {{ textColor?: string, fontFamily?: string, mode?: 'light' | 'dark' }} [values]
 */
export function setThemeRuntime(values = {}) {
  textColor = values.textColor || DEFAULT_TEXT_COLOR;
  fontFamily = values.fontFamily || DEFAULT_FONT_FAMILY;
  mode = values.mode === 'light' || values.mode === 'dark' ? values.mode : null;
}
