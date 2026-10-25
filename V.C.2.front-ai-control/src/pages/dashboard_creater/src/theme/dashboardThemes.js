/**
 * Глобальный стиль дашборда: готовые пресеты, пользовательские переопределения,
 * перевод токенов в CSS-переменные --dash-* на #viewport.
 *
 * Хранится в layout_config.theme = { preset, overrides }, история сохранений —
 * в layout_config.theme_history (для отката).
 */

import { colorToRgba, parseColorRgb } from '../widgets/common/colorToRgba.js';
import { setThemeRuntime } from './themeRuntime.js';

export const DEFAULT_THEME_ID = 'dark';
export const THEME_HISTORY_LIMIT = 10;

/** Шрифты с кириллицей (Google Fonts). mono — моноширинные. */
export const DASHBOARD_FONTS = [
  { id: 'Inter', label: 'Inter' },
  { id: 'Roboto', label: 'Roboto' },
  { id: 'Manrope', label: 'Manrope' },
  { id: 'Montserrat', label: 'Montserrat' },
  { id: 'IBM Plex Sans', label: 'IBM Plex Sans' },
  { id: 'Nunito', label: 'Nunito' },
  { id: 'Rubik', label: 'Rubik' },
  { id: 'PT Sans', label: 'PT Sans' },
  { id: 'Fira Sans', label: 'Fira Sans' },
  { id: 'Exo 2', label: 'Exo 2' },
  { id: 'Comfortaa', label: 'Comfortaa' },
  { id: 'Unbounded', label: 'Unbounded' },
  { id: 'Playfair Display', label: 'Playfair Display', serif: true },
  { id: 'Merriweather', label: 'Merriweather', serif: true },
  { id: 'JetBrains Mono', label: 'JetBrains Mono', mono: true },
  { id: 'Fira Code', label: 'Fira Code', mono: true },
  { id: 'Oswald', label: 'Oswald' },
  { id: 'Russo One', label: 'Russo One', weights: [400] },
  { id: 'Caveat', label: 'Caveat (рукописный)' },
  { id: 'Old Standard TT', label: 'Old Standard TT', serif: true, weights: [400, 700] },
  { id: 'Pixelify Sans', label: 'Pixelify Sans (пиксельный)', mono: true },
  { id: 'Press Start 2P', label: 'Press Start 2P (8-бит)', mono: true, weights: [400] },
];

export const SHADOW_OPTIONS = [
  { id: 'none', label: 'Без тени' },
  { id: 'soft', label: 'Мягкая' },
  { id: 'strong', label: 'Глубокая' },
  { id: 'glow', label: 'Свечение' },
  { id: 'hard', label: 'Жёсткая (смещённая)' },
  { id: 'neu', label: 'Неоморфизм' },
];

export const BG_STYLE_OPTIONS = [
  { id: 'solid', label: 'Однотонный' },
  { id: 'linear', label: 'Градиент' },
  { id: 'radial', label: 'Сияние' },
];

const BASE_DARK = {
  mode: 'dark',
  bg: '#0F1014',
  bg2: '#0F1014',
  bgStyle: 'solid',
  grid: 'rgba(0, 224, 255, 0.05)',
  surface: '#262834',
  surfaceOpacity: 0.62,
  border: '#FFFFFF',
  borderOpacity: 0.08,
  text: '#FFFFFF',
  text2: '#B0B3B8',
  text3: '#6B7280',
  accent: '#6366F1',
  accent2: '#8B5CF6',
  font: 'Inter',
  radius: 16,
  blur: 14,
  shadow: 'soft',
  borderWidth: 1,
};

const BASE_LIGHT = {
  ...BASE_DARK,
  mode: 'light',
  bg: '#F4F6FA',
  bg2: '#F4F6FA',
  grid: 'rgba(15, 23, 42, 0.06)',
  surface: '#FFFFFF',
  surfaceOpacity: 1,
  border: '#0F172A',
  borderOpacity: 0.08,
  text: '#0F172A',
  text2: '#475569',
  text3: '#94A3B8',
  accent: '#4F46E5',
  accent2: '#7C3AED',
  radius: 14,
  blur: 0,
};

const dark = (name, tokens) => ({ name, ...BASE_DARK, ...tokens });
const light = (name, tokens) => ({ name, ...BASE_LIGHT, ...tokens });

/** Готовые стили. Первый — текущий вид по умолчанию. */
export const DASHBOARD_THEME_PRESETS = [
  { id: 'dark', ...dark('Тёмный', {}) },
  { id: 'light', ...light('Светлый', {}) },
  { id: 'midnight-neon', ...dark('Полночный неон', {
    bg: '#05060F', bg2: '#1A0B3D', bgStyle: 'radial', grid: 'rgba(34, 211, 238, 0.07)',
    surface: '#0E1024', surfaceOpacity: 0.7, border: '#22D3EE', borderOpacity: 0.25,
    text: '#E0F7FF', text2: '#8FB8D8', text3: '#5B6B8C',
    accent: '#22D3EE', accent2: '#E879F9', font: 'Exo 2', shadow: 'glow',
  }) },
  { id: 'aurora', ...dark('Северное сияние', {
    bg: '#0B1020', bg2: '#0F3B3A', bgStyle: 'radial', grid: 'none',
    surface: '#FFFFFF', surfaceOpacity: 0.06, border: '#FFFFFF', borderOpacity: 0.12,
    text: '#F1F5F9', text2: '#A7B4C8', text3: '#64748B',
    accent: '#34D399', accent2: '#A78BFA', font: 'Manrope', radius: 20, blur: 20,
  }) },
  { id: 'ocean', ...dark('Океан', {
    bg: '#0B1E33', bg2: '#0E3A5B', bgStyle: 'linear', grid: 'rgba(56, 189, 248, 0.06)',
    surface: '#0F2A44', surfaceOpacity: 0.7, border: '#38BDF8', borderOpacity: 0.14,
    text: '#E6F4FF', text2: '#93B8D6', text3: '#5E7F9C',
    accent: '#38BDF8', accent2: '#2DD4BF', font: 'Manrope', radius: 14,
  }) },
  { id: 'forest', ...dark('Лес', {
    bg: '#0F1A14', bg2: '#13261C', bgStyle: 'linear', grid: 'rgba(34, 197, 94, 0.05)',
    surface: '#18291F', surfaceOpacity: 0.75, border: '#86EFAC', borderOpacity: 0.1,
    text: '#ECFDF3', text2: '#A3C4B0', text3: '#62806E',
    accent: '#22C55E', accent2: '#A3E635', font: 'Nunito', radius: 18,
  }) },
  { id: 'sunset', ...dark('Закат', {
    bg: '#1F0F1A', bg2: '#3B1424', bgStyle: 'linear', grid: 'rgba(249, 115, 22, 0.05)',
    surface: '#2E1424', surfaceOpacity: 0.7, border: '#FDBA74', borderOpacity: 0.14,
    text: '#FFF1EB', text2: '#D9A9A0', text3: '#946A6A',
    accent: '#F97316', accent2: '#EC4899', font: 'Montserrat', radius: 16,
  }) },
  { id: 'cyberpunk', ...dark('Киберпанк', {
    bg: '#0D0221', bg2: '#26014A', bgStyle: 'linear', grid: 'rgba(255, 42, 109, 0.09)',
    surface: '#1A0636', surfaceOpacity: 0.8, border: '#F5D300', borderOpacity: 0.35,
    text: '#FDF6FF', text2: '#C9A6E8', text3: '#7E5FA3',
    accent: '#F5D300', accent2: '#FF2A6D', font: 'JetBrains Mono', radius: 2, blur: 0, shadow: 'glow',
  }) },
  { id: 'dracula', ...dark('Дракула', {
    bg: '#282A36', bg2: '#282A36', grid: 'rgba(189, 147, 249, 0.05)',
    surface: '#343746', surfaceOpacity: 1, border: '#6272A4', borderOpacity: 0.35,
    text: '#F8F8F2', text2: '#C5C8DE', text3: '#6272A4',
    accent: '#BD93F9', accent2: '#FF79C6', radius: 12, blur: 0,
  }) },
  { id: 'nord', ...dark('Nord', {
    bg: '#2E3440', bg2: '#2E3440', grid: 'rgba(136, 192, 208, 0.05)',
    surface: '#3B4252', surfaceOpacity: 1, border: '#D8DEE9', borderOpacity: 0.1,
    text: '#ECEFF4', text2: '#D8DEE9', text3: '#7B88A1',
    accent: '#88C0D0', accent2: '#B48EAD', font: 'IBM Plex Sans', radius: 10, blur: 0,
  }) },
  { id: 'solarized-dark', ...dark('Solarized тёмный', {
    bg: '#002B36', bg2: '#002B36', grid: 'rgba(147, 161, 161, 0.06)',
    surface: '#073642', surfaceOpacity: 1, border: '#93A1A1', borderOpacity: 0.15,
    text: '#EEE8D5', text2: '#93A1A1', text3: '#657B83',
    accent: '#268BD2', accent2: '#2AA198', font: 'Fira Sans', radius: 10, blur: 0,
  }) },
  { id: 'graphite', ...dark('Графит', {
    bg: '#18181B', bg2: '#18181B', grid: 'rgba(255, 255, 255, 0.03)',
    surface: '#27272A', surfaceOpacity: 1, border: '#FFFFFF', borderOpacity: 0.08,
    text: '#FAFAFA', text2: '#A1A1AA', text3: '#71717A',
    accent: '#F59E0B', accent2: '#EF4444', radius: 12, blur: 0, shadow: 'strong',
  }) },
  { id: 'mono', ...dark('Монохром', {
    bg: '#111111', bg2: '#111111', grid: 'rgba(255, 255, 255, 0.04)',
    surface: '#1C1C1C', surfaceOpacity: 1, border: '#FFFFFF', borderOpacity: 0.14,
    text: '#F5F5F5', text2: '#A3A3A3', text3: '#6B6B6B',
    accent: '#FFFFFF', accent2: '#9CA3AF', font: 'JetBrains Mono', radius: 0, blur: 0, shadow: 'none',
  }) },
  { id: 'coffee', ...dark('Кофе', {
    bg: '#1C1410', bg2: '#2A1C14', bgStyle: 'linear', grid: 'rgba(214, 167, 122, 0.05)',
    surface: '#2B1F18', surfaceOpacity: 0.9, border: '#D6A77A', borderOpacity: 0.14,
    text: '#F6EBDD', text2: '#C2A88E', text3: '#87705C',
    accent: '#D6A77A', accent2: '#E07A5F', font: 'Rubik', radius: 14, blur: 0,
  }) },
  { id: 'royal', ...dark('Королевский', {
    bg: '#0F0A1F', bg2: '#1E1240', bgStyle: 'linear', grid: 'rgba(212, 175, 55, 0.05)',
    surface: '#1C1336', surfaceOpacity: 0.8, border: '#D4AF37', borderOpacity: 0.25,
    text: '#F8F1DE', text2: '#C9B98F', text3: '#857A5C',
    accent: '#D4AF37', accent2: '#A78BFA', font: 'Playfair Display', radius: 12, shadow: 'strong',
  }) },
  { id: 'contrast', ...dark('Высокий контраст', {
    bg: '#000000', bg2: '#000000', grid: 'none',
    surface: '#000000', surfaceOpacity: 1, border: '#FFFFFF', borderOpacity: 0.9,
    text: '#FFFFFF', text2: '#FFFFFF', text3: '#D4D4D4',
    accent: '#FFD600', accent2: '#00E5FF', radius: 4, blur: 0, shadow: 'none',
  }) },
  { id: 'corporate', ...light('Корпоративный', {
    bg: '#EEF1F5', bg2: '#EEF1F5', grid: 'none',
    border: '#0F172A', borderOpacity: 0.1,
    accent: '#1D4ED8', accent2: '#0EA5E9', font: 'Roboto', radius: 6,
  }) },
  { id: 'mint', ...light('Мята', {
    bg: '#F0FDF9', bg2: '#E6FBF4', bgStyle: 'linear', grid: 'rgba(20, 184, 166, 0.07)',
    border: '#0F766E', borderOpacity: 0.12,
    text: '#0B3B36', text2: '#3F6F69', text3: '#86A9A4',
    accent: '#14B8A6', accent2: '#0EA5E9', font: 'Rubik', radius: 16,
  }) },
  { id: 'sky', ...light('Небо', {
    bg: '#E0F2FE', bg2: '#F0F9FF', bgStyle: 'linear', grid: 'rgba(2, 132, 199, 0.07)',
    surface: '#FFFFFF', surfaceOpacity: 0.85, border: '#0369A1', borderOpacity: 0.12,
    text: '#0C2A43', text2: '#3B5B78', text3: '#8AA5BD',
    accent: '#0284C7', accent2: '#6366F1', font: 'Nunito', radius: 18, blur: 12,
  }) },
  { id: 'pastel', ...light('Пастель', {
    bg: '#FDF2F8', bg2: '#EEF2FF', bgStyle: 'linear', grid: 'none',
    surface: '#FFFFFF', surfaceOpacity: 0.8, border: '#A78BFA', borderOpacity: 0.2,
    text: '#3B2A4D', text2: '#6E5C84', text3: '#A99BBB',
    accent: '#A78BFA', accent2: '#F472B6', font: 'Comfortaa', radius: 22, blur: 10,
  }) },
  { id: 'paper', ...light('Бумага', {
    bg: '#F3EDE2', bg2: '#F3EDE2', grid: 'rgba(120, 90, 50, 0.06)',
    surface: '#FBF8F1', surfaceOpacity: 1, border: '#5C4A32', borderOpacity: 0.16,
    text: '#2F2619', text2: '#6B5B45', text3: '#A39478',
    accent: '#B5651D', accent2: '#7A8B3A', font: 'Merriweather', radius: 8,
  }) },
  { id: 'solarized-light', ...light('Solarized светлый', {
    bg: '#FDF6E3', bg2: '#FDF6E3', grid: 'rgba(101, 123, 131, 0.07)',
    surface: '#EEE8D5', surfaceOpacity: 1, border: '#657B83', borderOpacity: 0.18,
    text: '#073642', text2: '#586E75', text3: '#93A1A1',
    accent: '#268BD2', accent2: '#D33682', font: 'Fira Sans', radius: 10,
  }) },
  { id: 'nordic-light', ...light('Скандинавский', {
    bg: '#ECEFF4', bg2: '#E5E9F0', bgStyle: 'linear', grid: 'none',
    surface: '#FFFFFF', surfaceOpacity: 1, border: '#4C566A', borderOpacity: 0.12,
    text: '#2E3440', text2: '#4C566A', text3: '#9AA3B5',
    accent: '#5E81AC', accent2: '#BF616A', font: 'IBM Plex Sans', radius: 10,
  }) },
  { id: 'lavender', ...light('Лаванда', {
    bg: '#F5F3FF', bg2: '#FAF5FF', bgStyle: 'radial', grid: 'rgba(124, 58, 237, 0.05)',
    surface: '#FFFFFF', surfaceOpacity: 0.9, border: '#7C3AED', borderOpacity: 0.12,
    text: '#2E1065', text2: '#5B4A8A', text3: '#A39BC4',
    accent: '#7C3AED', accent2: '#DB2777', font: 'Unbounded', radius: 18, blur: 8,
  }) },
  // ── Необычные ──
  { id: 'pixel', ...dark('Пиксель', {
    bg: '#1D2B53', bg2: '#1D2B53', grid: 'rgba(255, 241, 232, 0.07)',
    surface: '#000000', surfaceOpacity: 0.85, border: '#FFF1E8', borderOpacity: 0.9,
    text: '#FFF1E8', text2: '#C2C3C7', text3: '#83769C',
    accent: '#FF004D', accent2: '#FFEC27', font: 'Pixelify Sans', radius: 0, blur: 0,
    shadow: 'hard', borderWidth: 3,
  }) },
  { id: 'gameboy', ...light('Game Boy', {
    bg: '#9BBC0F', bg2: '#9BBC0F', grid: 'rgba(15, 56, 15, 0.08)',
    surface: '#8BAC0F', surfaceOpacity: 1, border: '#0F380F', borderOpacity: 1,
    text: '#0F380F', text2: '#306230', text3: '#306230',
    accent: '#0F380F', accent2: '#306230', font: 'Press Start 2P', radius: 0,
    shadow: 'hard', borderWidth: 3,
  }) },
  { id: 'terminal', ...dark('Терминал', {
    bg: '#000000', bg2: '#001A00', bgStyle: 'radial', grid: 'rgba(51, 255, 102, 0.06)',
    surface: '#020A04', surfaceOpacity: 0.9, border: '#33FF66', borderOpacity: 0.45,
    text: '#33FF66', text2: '#22C55E', text3: '#15803D',
    accent: '#33FF66', accent2: '#A3FF12', font: 'Fira Code', radius: 0, blur: 0, shadow: 'glow',
  }) },
  { id: 'synthwave', ...dark('Синтвейв', {
    bg: '#120024', bg2: '#5B0E5E', bgStyle: 'radial', grid: 'rgba(255, 56, 196, 0.12)',
    surface: '#1B0638', surfaceOpacity: 0.72, border: '#FF38C4', borderOpacity: 0.4,
    text: '#FFE9FF', text2: '#E3A8FF', text3: '#9A6AC2',
    accent: '#FF38C4', accent2: '#00F0FF', font: 'Russo One', radius: 6, blur: 10, shadow: 'glow',
  }) },
  { id: 'brutalism', ...light('Брутализм', {
    bg: '#FFFDF5', bg2: '#FFFDF5', grid: 'rgba(0, 0, 0, 0.07)',
    surface: '#FFFFFF', surfaceOpacity: 1, border: '#000000', borderOpacity: 1,
    text: '#000000', text2: '#222222', text3: '#555555',
    accent: '#FF5C00', accent2: '#2B59FF', font: 'Unbounded', radius: 0,
    shadow: 'hard', borderWidth: 3,
  }) },
  { id: 'newspaper', ...light('Газета', {
    bg: '#F2EFE6', bg2: '#F2EFE6', grid: 'none',
    surface: '#FAF8F2', surfaceOpacity: 1, border: '#1A1A1A', borderOpacity: 0.85,
    text: '#111111', text2: '#3A3A3A', text3: '#7A7A7A',
    accent: '#B91C1C', accent2: '#1A1A1A', font: 'Old Standard TT', radius: 0, shadow: 'none',
  }) },
  { id: 'blueprint', ...dark('Чертёж', {
    bg: '#0B3D91', bg2: '#0A2F6E', bgStyle: 'linear', grid: 'rgba(255, 255, 255, 0.14)',
    surface: '#0B3D91', surfaceOpacity: 0.55, border: '#FFFFFF', borderOpacity: 0.6,
    text: '#FFFFFF', text2: '#C7D8F5', text3: '#8FAAD9',
    accent: '#FFFFFF', accent2: '#FFD166', font: 'JetBrains Mono', radius: 0, blur: 0, shadow: 'none',
  }) },
  { id: 'neumorphism', ...light('Неоморфизм', {
    bg: '#E6E9EF', bg2: '#E6E9EF', grid: 'none',
    surface: '#E6E9EF', surfaceOpacity: 1, border: '#FFFFFF', borderOpacity: 0.5,
    text: '#2D3748', text2: '#5A6478', text3: '#9AA3B2',
    accent: '#6C63FF', accent2: '#00B8A9', font: 'Nunito', radius: 20, shadow: 'neu',
  }) },
  { id: 'glass', ...dark('Стекло', {
    bg: '#0F172A', bg2: '#4C1D95', bgStyle: 'radial', grid: 'none',
    surface: '#FFFFFF', surfaceOpacity: 0.08, border: '#FFFFFF', borderOpacity: 0.22,
    text: '#F8FAFC', text2: '#CBD5E1', text3: '#94A3B8',
    accent: '#60A5FA', accent2: '#F472B6', font: 'Manrope', radius: 24, blur: 24,
  }) },
  { id: 'notebook', ...light('Тетрадь', {
    bg: '#FDFCF7', bg2: '#FDFCF7', grid: 'rgba(59, 130, 246, 0.16)',
    surface: '#FFFFFF', surfaceOpacity: 0.7, border: '#1E3A8A', borderOpacity: 0.25,
    text: '#1E293B', text2: '#334155', text3: '#94A3B8',
    accent: '#E11D48', accent2: '#2563EB', font: 'Caveat', radius: 4, shadow: 'none',
  }) },
];

const PRESET_BY_ID = new Map(DASHBOARD_THEME_PRESETS.map((p) => [p.id, p]));

export function getThemePreset(id) {
  return PRESET_BY_ID.get(id) || PRESET_BY_ID.get(DEFAULT_THEME_ID);
}

const COLOR_KEYS = ['bg', 'bg2', 'surface', 'border', 'text', 'text2', 'text3', 'accent', 'accent2'];
const NUMBER_RANGES = {
  surfaceOpacity: [0, 1],
  borderOpacity: [0, 1],
  radius: [0, 40],
  blur: [0, 40],
  borderWidth: [0, 4],
};

function isColor(v) {
  return typeof v === 'string' && parseColorRgb(v) != null;
}

/** Только известные ключи с корректными значениями. */
function sanitizeOverrides(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const key of COLOR_KEYS) {
    if (isColor(raw[key])) out[key] = raw[key].trim();
  }
  for (const [key, [min, max]] of Object.entries(NUMBER_RANGES)) {
    const n = Number(raw[key]);
    if (raw[key] !== '' && raw[key] != null && Number.isFinite(n)) out[key] = Math.min(max, Math.max(min, n));
  }
  if (raw.grid === 'none' || isColor(raw.grid)) out.grid = raw.grid;
  if (raw.mode === 'dark' || raw.mode === 'light') out.mode = raw.mode;
  if (BG_STYLE_OPTIONS.some((o) => o.id === raw.bgStyle)) out.bgStyle = raw.bgStyle;
  if (SHADOW_OPTIONS.some((o) => o.id === raw.shadow)) out.shadow = raw.shadow;
  if (DASHBOARD_FONTS.some((f) => f.id === raw.font)) out.font = raw.font;
  return out;
}

/**
 * @param {any} raw
 * @returns {{ preset: string, overrides: Record<string, any> }}
 */
export function normalizeTheme(raw) {
  const preset = raw && PRESET_BY_ID.has(raw.preset) ? raw.preset : DEFAULT_THEME_ID;
  return { preset, overrides: sanitizeOverrides(raw?.overrides) };
}

export function isDefaultTheme(theme) {
  const t = normalizeTheme(theme);
  return t.preset === DEFAULT_THEME_ID && Object.keys(t.overrides).length === 0;
}

export function themesEqual(a, b) {
  const x = normalizeTheme(a);
  const y = normalizeTheme(b);
  if (x.preset !== y.preset) return false;
  const kx = Object.keys(x.overrides);
  if (kx.length !== Object.keys(y.overrides).length) return false;
  return kx.every((k) => x.overrides[k] === y.overrides[k]);
}

export function resolveThemeTokens(theme) {
  const t = normalizeTheme(theme);
  const { id, name, ...base } = getThemePreset(t.preset);
  return { ...base, ...t.overrides };
}

export function fontStack(font) {
  const meta = DASHBOARD_FONTS.find((f) => f.id === font);
  const generic = meta?.mono ? 'monospace' : meta?.serif ? 'Georgia, serif' : 'system-ui, sans-serif';
  return `'${font || 'Inter'}', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', ${generic}`;
}

function buildBackground(tk) {
  if (tk.bgStyle === 'linear') return `linear-gradient(160deg, ${tk.bg} 0%, ${tk.bg2} 100%)`;
  if (tk.bgStyle === 'radial') {
    return [
      `radial-gradient(ellipse 70% 55% at 15% 0%, ${colorToRgba(tk.bg2, 0.9)} 0%, transparent 70%)`,
      `radial-gradient(ellipse 60% 50% at 90% 100%, ${colorToRgba(tk.accent2, 0.16)} 0%, transparent 70%)`,
      tk.bg,
    ].join(', ');
  }
  return tk.bg;
}

function buildShadows(tk) {
  const isLight = tk.mode === 'light';
  const shade = isLight ? '15, 23, 42' : '0, 0, 0';
  const a = isLight ? 0.08 : 0.45;
  const inset = isLight ? '' : `, inset 0 1px 0 ${colorToRgba('#FFFFFF', 0.05)}`;
  const soft = `0 1px 2px rgba(${shade}, ${a / 1.8}), 0 8px 24px -8px rgba(${shade}, ${a})${inset}`;
  const strong = `0 2px 4px rgba(${shade}, ${a / 1.4}), 0 18px 40px -12px rgba(${shade}, ${Math.min(1, a * 1.45)})${inset}`;
  switch (tk.shadow) {
    case 'none':
      return { shadow: 'none', strong: soft };
    case 'strong':
      return { shadow: strong, strong };
    case 'glow': {
      const glow = `0 0 0 1px ${colorToRgba(tk.accent, 0.12)}, 0 0 22px -4px ${colorToRgba(tk.accent, 0.35)}, 0 10px 30px -12px rgba(${shade}, ${a})`;
      return { shadow: glow, strong: `${glow}, 0 0 36px -6px ${colorToRgba(tk.accent2, 0.3)}` };
    }
    case 'hard': {
      const c = colorToRgba(tk.border, Math.max(0.6, tk.borderOpacity));
      return { shadow: `4px 4px 0 ${c}`, strong: `6px 6px 0 ${c}` };
    }
    case 'neu': {
      const darkSide = `color-mix(in srgb, ${tk.bg} 82%, #000000)`;
      const lightSide = isLight ? '#FFFFFF' : `color-mix(in srgb, ${tk.bg} 88%, #FFFFFF)`;
      const neu = `8px 8px 16px ${darkSide}, -8px -8px 16px ${lightSide}`;
      return { shadow: neu, strong: `12px 12px 24px ${darkSide}, -12px -12px 24px ${lightSide}` };
    }
    default:
      return { shadow: soft, strong };
  }
}

/**
 * CSS-переменные для #viewport.
 * @returns {Record<string, string>}
 */
export function buildThemeVars(tokens) {
  const tk = { ...BASE_DARK, ...tokens };
  const isLight = tk.mode === 'light';
  const op = tk.surfaceOpacity;
  const surfaceTop = colorToRgba(tk.surface, op);
  const surfaceBottom = colorToRgba(tk.surface, Math.max(0, op * (isLight ? 0.94 : 0.84)));
  const shadows = buildShadows(tk);
  return {
    '--dash-bg': buildBackground(tk),
    '--dash-grid': tk.grid === 'none' ? 'transparent' : tk.grid,
    '--dash-font': fontStack(tk.font),
    '--dash-text': tk.text,
    '--dash-accent': tk.accent,
    '--dash-accent-2': tk.accent2,
    '--dash-widget-bg': `linear-gradient(180deg, ${surfaceTop} 0%, ${surfaceBottom} 100%)`,
    '--dash-widget-solid': tk.surface,
    '--dash-widget-elevated': isLight
      ? tk.surface
      : `linear-gradient(180deg, color-mix(in srgb, ${tk.surface} 90%, #FFFFFF) 0%, ${tk.surface} 100%)`,
    '--dash-widget-border': colorToRgba(tk.border, tk.borderOpacity),
    '--dash-widget-border-strong': colorToRgba(tk.border, Math.min(1, tk.borderOpacity * 2 + 0.02)),
    '--dash-widget-shadow': shadows.shadow,
    '--dash-widget-shadow-strong': shadows.strong,
    '--dash-widget-radius': `${tk.radius}px`,
    '--dash-widget-border-width': `${tk.borderWidth}px`,
    '--dash-widget-backdrop': tk.blur > 0 ? `blur(${tk.blur}px) saturate(150%)` : 'none',
    '--dash-widget-accent-bg': `linear-gradient(160deg, ${colorToRgba(tk.accent, isLight ? 0.1 : 0.16)} 0%, ${surfaceTop} 55%)`,
    '--dash-widget-accent-border': colorToRgba(tk.accent, 0.3),
    '--dash-ring': colorToRgba(tk.accent, 0.7),
    '--dash-selected-border': colorToRgba(tk.accent, 0.65),
    '--dash-selected-glow': colorToRgba(tk.accent, 0.22),
    // Переменные приложения, которыми пользуются стили внутри виджетов.
    '--text-primary': tk.text,
    '--text-secondary': tk.text2,
    '--text-muted': tk.text3,
    '--accent-blue': tk.accent,
    '--accent-cyan': tk.accent2,
    '--bg-panel': tk.surface,
    '--bg-workspace': tk.bg,
    '--border-color': colorToRgba(tk.border, Math.min(1, tk.borderOpacity * 1.5)),
  };
}

const THEME_VAR_NAMES = Object.keys(buildThemeVars(BASE_DARK));
const loadedFonts = new Set();

/** Подключает шрифт из Google Fonts (один раз). */
export function loadThemeFont(font, doc = typeof document !== 'undefined' ? document : null) {
  if (!doc || !font || loadedFonts.has(font)) return;
  if (!DASHBOARD_FONTS.some((f) => f.id === font)) return;
  loadedFonts.add(font);
  const weights = DASHBOARD_FONTS.find((f) => f.id === font).weights || [400, 500, 600, 700];
  const link = doc.createElement('link');
  link.rel = 'stylesheet';
  link.dataset.dashFont = font;
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font).replace(/%20/g, '+')}:wght@${weights.join(';')}&display=swap`;
  doc.head.appendChild(link);
}

/**
 * Применяет стиль к контейнеру дашборда.
 * Стандартный тёмный стиль снимает все переменные — работает исходный CSS.
 * @param {HTMLElement | null} el
 * @param {any} theme
 * @param {{ rerender?: () => void }} [opts]
 */
export function applyDashboardTheme(el, theme, { rerender } = {}) {
  if (!el) return;
  if (isDefaultTheme(theme)) {
    for (const name of THEME_VAR_NAMES) el.style.removeProperty(name);
    el.classList.remove('dash-themed', 'dash-theme-light');
    delete el.dataset.dashTheme;
    setThemeRuntime({});
  } else {
    const t = normalizeTheme(theme);
    const tokens = resolveThemeTokens(t);
    const vars = buildThemeVars(tokens);
    for (const [name, value] of Object.entries(vars)) el.style.setProperty(name, value);
    el.classList.add('dash-themed');
    el.classList.toggle('dash-theme-light', tokens.mode === 'light');
    el.dataset.dashTheme = t.preset;
    loadThemeFont(tokens.font, el.ownerDocument);
    setThemeRuntime({ textColor: tokens.text, fontFamily: tokens.font, mode: tokens.mode === 'light' ? 'light' : 'dark' });
  }
  rerender?.();
}

/** Новая запись истории (последние сверху, без подряд идущих дублей). */
export function pushThemeHistory(history, theme, savedAt = new Date().toISOString()) {
  const list = Array.isArray(history) ? history.filter((h) => h && h.theme) : [];
  const t = normalizeTheme(theme);
  if (list[0] && themesEqual(list[0].theme, t)) return list.slice(0, THEME_HISTORY_LIMIT);
  return [{ theme: t, savedAt }, ...list].slice(0, THEME_HISTORY_LIMIT);
}

export function themeLabel(theme) {
  const t = normalizeTheme(theme);
  const name = getThemePreset(t.preset).name;
  return Object.keys(t.overrides).length ? `${name} (изменён)` : name;
}

// ── «Мои стили» — пользовательские стили в браузере ──
const CUSTOM_KEY = 'dashboard.customThemes.v1';

export function loadCustomThemes() {
  try {
    const raw = JSON.parse(localStorage.getItem(CUSTOM_KEY) || '[]');
    return Array.isArray(raw)
      ? raw.filter((s) => s && typeof s.name === 'string' && s.theme).map((s) => ({
        id: String(s.id || s.name), name: s.name.slice(0, 60), theme: normalizeTheme(s.theme),
      }))
      : [];
  } catch {
    return [];
  }
}

export function saveCustomThemes(list) {
  try {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(list.slice(0, 50)));
  } catch {
    /* хранилище недоступно — стили останутся до перезагрузки */
  }
}
