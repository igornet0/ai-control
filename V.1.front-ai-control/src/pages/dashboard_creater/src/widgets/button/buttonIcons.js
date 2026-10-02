/**
 * Minimal stroke icons for button widgets (24×24, lucide-like).
 * Used in the style-panel picker (SVG markup) and canvas draw (Path2D).
 */

const STROKE = Object.freeze({
  width: 1.75,
  linecap: 'round',
  linejoin: 'round',
});

/** @typedef {{ d: string, fill?: boolean }} IconPath */
/** @typedef {{ id: string, label: string, paths: IconPath[], circles?: Array<{ cx: number, cy: number, r: number, fill?: boolean }> }} ButtonIconDef */

/** @type {ButtonIconDef[]} */
const ICON_DEFS = [
  {
    id: 'arrow',
    label: 'Стрелка',
    paths: [
      { d: 'M5 12h14' },
      { d: 'm12 5 7 7-7 7' },
    ],
  },
  {
    id: 'arrow_left',
    label: 'Влево',
    paths: [
      { d: 'M19 12H5' },
      { d: 'm12 19-7-7 7-7' },
    ],
  },
  {
    id: 'arrow_up',
    label: 'Вверх',
    paths: [
      { d: 'M12 19V5' },
      { d: 'm5 12 7-7 7 7' },
    ],
  },
  {
    id: 'arrow_down',
    label: 'Вниз',
    paths: [
      { d: 'M12 5v14' },
      { d: 'm19 12-7 7-7-7' },
    ],
  },
  {
    id: 'chevron',
    label: 'Шеврон',
    paths: [{ d: 'm9 18 6-6-6-6' }],
  },
  {
    id: 'chevron_left',
    label: '‹ Шеврон',
    paths: [{ d: 'm15 18-6-6 6-6' }],
  },
  {
    id: 'chevron_up',
    label: 'Вверх ›',
    paths: [{ d: 'm18 15-6-6-6 6' }],
  },
  {
    id: 'chevron_down',
    label: 'Вниз ›',
    paths: [{ d: 'm6 9 6 6 6-6' }],
  },
  {
    id: 'external',
    label: 'Внешняя',
    paths: [
      { d: 'M15 3h6v6' },
      { d: 'M10 14 21 3' },
      { d: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6' },
    ],
  },
  {
    id: 'filter',
    label: 'Фильтр',
    paths: [{ d: 'M22 3H2l8 9.46V19l4 2v-8.54L22 3z' }],
  },
  {
    id: 'target',
    label: 'Цель',
    paths: [
      { d: 'M12 2v4' },
      { d: 'M12 18v4' },
      { d: 'M2 12h4' },
      { d: 'M18 12h4' },
    ],
    circles: [
      { cx: 12, cy: 12, r: 7 },
      { cx: 12, cy: 12, r: 3 },
    ],
  },
  {
    id: 'play',
    label: 'Play',
    paths: [{ d: 'M8 5v14l11-7z' }],
  },
  {
    id: 'pause',
    label: 'Pause',
    paths: [
      { d: 'M8 5h3v14H8z', fill: true },
      { d: 'M13 5h3v14h-3z', fill: true },
    ],
  },
  {
    id: 'stop',
    label: 'Stop',
    paths: [{ d: 'M6 6h12v12H6z', fill: true }],
  },
  {
    id: 'plus',
    label: 'Плюс',
    paths: [
      { d: 'M12 5v14' },
      { d: 'M5 12h14' },
    ],
  },
  {
    id: 'minus',
    label: 'Минус',
    paths: [{ d: 'M5 12h14' }],
  },
  {
    id: 'check',
    label: 'Галочка',
    paths: [{ d: 'M20 6 9 17l-5-5' }],
  },
  {
    id: 'cross',
    label: 'Закрыть',
    paths: [
      { d: 'M18 6 6 18' },
      { d: 'm6 6 12 12' },
    ],
  },
  {
    id: 'search',
    label: 'Поиск',
    paths: [{ d: 'm21 21-4.3-4.3' }],
    circles: [{ cx: 11, cy: 11, r: 7 }],
  },
  {
    id: 'refresh',
    label: 'Обновить',
    paths: [
      { d: 'M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8' },
      { d: 'M21 3v5h-5' },
      { d: 'M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16' },
      { d: 'M8 16H3v5' },
    ],
  },
  {
    id: 'download',
    label: 'Скачать',
    paths: [
      { d: 'M12 3v12' },
      { d: 'm7 10 5 5 5-5' },
      { d: 'M5 21h14' },
    ],
  },
  {
    id: 'upload',
    label: 'Загрузить',
    paths: [
      { d: 'M12 21V9' },
      { d: 'm7 14 5-5 5 5' },
      { d: 'M5 3h14' },
    ],
  },
  {
    id: 'settings',
    label: 'Настройки',
    paths: [
      {
        d: 'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z',
      },
    ],
    circles: [{ cx: 12, cy: 12, r: 3 }],
  },
  {
    id: 'home',
    label: 'Домой',
    paths: [
      { d: 'M3 10.5 12 3l9 7.5' },
      { d: 'M5 9.5V20h14V9.5' },
      { d: 'M9 20v-6h6v6' },
    ],
  },
  {
    id: 'star',
    label: 'Звезда',
    paths: [
      {
        d: 'm12 2 2.9 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l7.1-1.01L12 2z',
      },
    ],
  },
  {
    id: 'heart',
    label: 'Сердце',
    paths: [
      {
        d: 'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z',
      },
    ],
  },
  {
    id: 'info',
    label: 'Инфо',
    paths: [
      { d: 'M12 16v-4' },
      { d: 'M12 8h.01' },
    ],
    circles: [{ cx: 12, cy: 12, r: 9 }],
  },
  {
    id: 'warning',
    label: 'Внимание',
    paths: [
      { d: 'M12 9v4' },
      { d: 'M12 17h.01' },
      { d: 'm10.3 3.9-8.1 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.8-3.1l-8.1-14a2 2 0 0 0-3.4 0Z' },
    ],
  },
  {
    id: 'link',
    label: 'Ссылка',
    paths: [
      { d: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71' },
      { d: 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71' },
    ],
  },
  {
    id: 'edit',
    label: 'Редакт.',
    paths: [
      { d: 'M12 20h9' },
      { d: 'M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z' },
    ],
  },
  {
    id: 'trash',
    label: 'Удалить',
    paths: [
      { d: 'M3 6h18' },
      { d: 'M8 6V4h8v2' },
      { d: 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6' },
      { d: 'M10 11v6' },
      { d: 'M14 11v6' },
    ],
  },
  {
    id: 'save',
    label: 'Сохранить',
    paths: [
      { d: 'M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z' },
      { d: 'M17 21v-7H7v7' },
      { d: 'M7 3v5h8' },
    ],
  },
  {
    id: 'copy',
    label: 'Копия',
    paths: [
      { d: 'M8 8h11a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z' },
      { d: 'M5 16V5a1 1 0 0 1 1-1h11' },
    ],
  },
  {
    id: 'user',
    label: 'Пользов.',
    paths: [{ d: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2' }],
    circles: [{ cx: 12, cy: 7, r: 4 }],
  },
  {
    id: 'users',
    label: 'Команда',
    paths: [
      { d: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' },
      { d: 'M16 3.13a4 4 0 0 1 0 7.75' },
      { d: 'M22 21v-2a4 4 0 0 0-3-3.87' },
    ],
    circles: [{ cx: 9, cy: 7, r: 4 }],
  },
  {
    id: 'calendar',
    label: 'Календарь',
    paths: [
      { d: 'M8 2v4' },
      { d: 'M16 2v4' },
      { d: 'M3 10h18' },
      { d: 'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z' },
    ],
  },
  {
    id: 'clock',
    label: 'Часы',
    paths: [
      { d: 'M12 6v6l4 2' },
    ],
    circles: [{ cx: 12, cy: 12, r: 9 }],
  },
  {
    id: 'chart',
    label: 'График',
    paths: [
      { d: 'M3 3v18h18' },
      { d: 'm7 14 4-4 3 2 5-7' },
    ],
  },
  {
    id: 'bar_chart',
    label: 'Столбцы',
    paths: [
      { d: 'M3 20V10' },
      { d: 'M9 20V4' },
      { d: 'M15 20v-7' },
      { d: 'M21 20V7' },
      { d: 'M3 20h18' },
    ],
  },
  {
    id: 'table',
    label: 'Таблица',
    paths: [
      { d: 'M3 3h18v18H3z' },
      { d: 'M3 9h18' },
      { d: 'M3 15h18' },
      { d: 'M9 3v18' },
      { d: 'M15 3v18' },
    ],
  },
  {
    id: 'lock',
    label: 'Замок',
    paths: [
      { d: 'M7 11V8a5 5 0 0 1 10 0v3' },
      { d: 'M5 11h14v10H5z' },
    ],
  },
  {
    id: 'unlock',
    label: 'Открыто',
    paths: [
      { d: 'M7 11V8a5 5 0 0 1 9.9-1' },
      { d: 'M5 11h14v10H5z' },
    ],
  },
  {
    id: 'eye',
    label: 'Показать',
    paths: [{ d: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z' }],
    circles: [{ cx: 12, cy: 12, r: 3 }],
  },
  {
    id: 'eye_off',
    label: 'Скрыть',
    paths: [
      { d: 'M10.7 5.1A10.9 10.9 0 0 1 12 5c6.5 0 10 7 10 7a18 18 0 0 1-2.2 3.2' },
      { d: 'M6.6 6.6A18.5 18.5 0 0 0 2 12s3.5 7 10 7a10.4 10.4 0 0 0 5.4-1.5' },
      { d: 'm2 2 20 20' },
    ],
  },
  {
    id: 'zap',
    label: 'Молния',
    paths: [{ d: 'M13 2 4 14h7l-1 8 9-12h-7l1-8z' }],
  },
  {
    id: 'bell',
    label: 'Уведомл.',
    paths: [
      { d: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9' },
      { d: 'M10.3 21a1.94 1.94 0 0 0 3.4 0' },
    ],
  },
  {
    id: 'mail',
    label: 'Почта',
    paths: [
      { d: 'M4 4h16v16H4z' },
      { d: 'm4 7 8 6 8-6' },
    ],
  },
  {
    id: 'share',
    label: 'Поделиться',
    paths: [
      { d: 'M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8' },
      { d: 'M16 6l-4-4-4 4' },
      { d: 'M12 2v13' },
    ],
  },
  {
    id: 'menu',
    label: 'Меню',
    paths: [
      { d: 'M4 6h16' },
      { d: 'M4 12h16' },
      { d: 'M4 18h16' },
    ],
  },
  {
    id: 'more',
    label: 'Ещё',
    paths: [],
    circles: [
      { cx: 12, cy: 12, r: 1, fill: true },
      { cx: 19, cy: 12, r: 1, fill: true },
      { cx: 5, cy: 12, r: 1, fill: true },
    ],
  },
  {
    id: 'dashboard',
    label: 'Дашборд',
    paths: [
      { d: 'M3 3h8v8H3z' },
      { d: 'M13 3h8v5h-8z' },
      { d: 'M13 12h8v9h-8z' },
      { d: 'M3 15h8v6H3z' },
    ],
  },
  {
    id: 'database',
    label: 'База',
    paths: [
      { d: 'M12 5c4.4 0 8 1.8 8 4s-3.6 4-8 4-8-1.8-8-4 3.6-4 8-4z' },
      { d: 'M4 9v6c0 2.2 3.6 4 8 4s8-1.8 8-4V9' },
      { d: 'M4 15c0 2.2 3.6 4 8 4s8-1.8 8-4' },
    ],
  },
  {
    id: 'layers',
    label: 'Слои',
    paths: [
      { d: 'm12 2 9 5-9 5-9-5 9-5z' },
      { d: 'm3 12 9 5 9-5' },
      { d: 'm3 17 9 5 9-5' },
    ],
  },
  {
    id: 'sliders',
    label: 'Слайдеры',
    paths: [
      { d: 'M4 21v-7' },
      { d: 'M4 10V3' },
      { d: 'M12 21v-9' },
      { d: 'M12 8V3' },
      { d: 'M20 21v-5' },
      { d: 'M20 12V3' },
      { d: 'M2 14h4' },
      { d: 'M10 8h4' },
      { d: 'M18 16h4' },
    ],
  },
];

const ICON_BY_ID = new Map(ICON_DEFS.map((icon) => [icon.id, icon]));

/** Keep old free-text ids working. */
const ALIASES = Object.freeze({
  chevron_right: 'chevron',
  close: 'cross',
  x: 'cross',
  reload: 'refresh',
  sync: 'refresh',
  gear: 'settings',
  cog: 'settings',
  pencil: 'edit',
  delete: 'trash',
  bin: 'trash',
  person: 'user',
  line_chart: 'chart',
  pie: 'chart',
});

function resolveIconId(iconId) {
  if (iconId == null || iconId === '') return '';
  const key = String(iconId).trim();
  if (!key) return '';
  if (ICON_BY_ID.has(key)) return key;
  if (ALIASES[key] && ICON_BY_ID.has(ALIASES[key])) return ALIASES[key];
  return key;
}

function svgPathsMarkup(def) {
  const parts = [];
  for (const p of def.paths || []) {
    if (p.fill) {
      parts.push(`<path d="${p.d}" fill="currentColor" stroke="none"/>`);
    } else {
      parts.push(`<path d="${p.d}"/>`);
    }
  }
  for (const c of def.circles || []) {
    if (c.fill) {
      parts.push(`<circle cx="${c.cx}" cy="${c.cy}" r="${c.r}" fill="currentColor" stroke="none"/>`);
    } else {
      parts.push(`<circle cx="${c.cx}" cy="${c.cy}" r="${c.r}"/>`);
    }
  }
  return parts.join('');
}

export function getButtonIconDef(iconId) {
  const id = resolveIconId(iconId);
  if (!id) return null;
  return ICON_BY_ID.get(id) || null;
}

export function hasButtonIcon(iconId) {
  return !!getButtonIconDef(iconId);
}

export function getButtonIconLabel(iconId) {
  if (iconId == null || iconId === '') return 'Нет';
  const def = getButtonIconDef(iconId);
  return def?.label || String(iconId);
}

/** Inline SVG for picker / triggers (currentColor). */
export function getButtonIconSvg(iconId, { size = 18 } = {}) {
  const def = getButtonIconDef(iconId);
  if (!def) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${STROKE.width}" stroke-linecap="${STROKE.linecap}" stroke-linejoin="${STROKE.linejoin}" aria-hidden="true"><circle cx="12" cy="12" r="8" opacity="0.35"/><path d="M9 9h.01M15 9h.01M9.5 15c.8.8 1.7 1.2 2.5 1.2s1.7-.4 2.5-1.2" opacity="0.55"/></svg>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${STROKE.width}" stroke-linecap="${STROKE.linecap}" stroke-linejoin="${STROKE.linejoin}" aria-hidden="true">${svgPathsMarkup(def)}</svg>`;
}

/** Empty / none glyph for picker. */
export function getButtonIconNoneSvg({ size = 18 } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${STROKE.width}" stroke-linecap="${STROKE.linecap}" stroke-linejoin="${STROKE.linejoin}" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="m7 7 10 10"/></svg>`;
}

export const BUTTON_ICON_OPTIONS = Object.freeze([
  { id: '', label: 'Нет', svg: getButtonIconNoneSvg({ size: 18 }) },
  ...ICON_DEFS.map((def) => ({
    id: def.id,
    label: def.label,
    svg: getButtonIconSvg(def.id, { size: 18 }),
  })),
]);

/**
 * Draw icon into canvas at top-left (x,y) with square size.
 * @returns {boolean} true if a known SVG icon was drawn
 */
export function drawButtonIcon(ctx, iconId, x, y, size, color) {
  const def = getButtonIconDef(iconId);
  if (!ctx || !def || !(size > 0)) return false;

  const scale = size / 24;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = STROKE.width;
  ctx.lineCap = STROKE.linecap;
  ctx.lineJoin = STROKE.linejoin;

  for (const p of def.paths || []) {
    const path = typeof Path2D !== 'undefined' ? new Path2D(p.d) : null;
    if (!path) continue;
    if (p.fill) ctx.fill(path);
    else ctx.stroke(path);
  }
  for (const c of def.circles || []) {
    ctx.beginPath();
    ctx.arc(c.cx, c.cy, c.r, 0, Math.PI * 2);
    if (c.fill) ctx.fill();
    else ctx.stroke();
  }

  ctx.restore();
  return true;
}

export function getButtonIconSize(fontSize) {
  return Math.max(12, Math.round((Number(fontSize) || 14) * 1.05));
}
