/** Настройки нумерации страниц на итоговом листе документа. */

export const DEFAULT_PAGE_NUMBER_STYLE = {
  enabled: false,
  format: '{page} / {total}',
  vertical: 'bottom',
  horizontal: 'center',
  offsetX: 40,
  offsetY: 24,
  fontFamily: '',
  fontSize: 10,
  color: '#64748b',
  bold: false,
  italic: false,
};

export const PAGE_NUMBER_FORMAT_PRESETS = [
  { value: '{page} / {total}', label: '1 / 3' },
  { value: '{page}', label: '1' },
  { value: 'Стр. {page}', label: 'Стр. 1' },
  { value: 'Стр. {page} из {total}', label: 'Стр. 1 из 3' },
  { value: '– {page} –', label: '– 1 –' },
];

export function normalizePageNumberStyle(raw) {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_PAGE_NUMBER_STYLE };
  }
  return {
    ...DEFAULT_PAGE_NUMBER_STYLE,
    ...raw,
    enabled: !!raw.enabled,
    fontSize: Number(raw.fontSize) || DEFAULT_PAGE_NUMBER_STYLE.fontSize,
    offsetX: Number.isFinite(Number(raw.offsetX)) ? Number(raw.offsetX) : DEFAULT_PAGE_NUMBER_STYLE.offsetX,
    offsetY: Number.isFinite(Number(raw.offsetY)) ? Number(raw.offsetY) : DEFAULT_PAGE_NUMBER_STYLE.offsetY,
  };
}

export function formatPageNumber(format, page, total) {
  const tpl = format || DEFAULT_PAGE_NUMBER_STYLE.format;
  return String(tpl)
    .replace(/\{page\}/g, String(page))
    .replace(/\{total\}/g, String(total));
}

export function pageNumberPositionStyle(cfg) {
  const style = {};
  if (cfg.vertical === 'top') style.top = `${cfg.offsetY}px`;
  else style.bottom = `${cfg.offsetY}px`;

  if (cfg.horizontal === 'left') {
    style.left = `${cfg.offsetX}px`;
    style.right = 'auto';
    style.transform = 'none';
  } else if (cfg.horizontal === 'right') {
    style.right = `${cfg.offsetX}px`;
    style.left = 'auto';
    style.transform = 'none';
  } else {
    style.left = '50%';
    style.right = 'auto';
    style.transform = 'translateX(-50%)';
  }
  return style;
}

export function pageNumberTextStyle(cfg) {
  const style = {};
  if (cfg.fontFamily) style.fontFamily = cfg.fontFamily;
  if (cfg.fontSize) style.fontSize = `${Number(cfg.fontSize) || 10}px`;
  if (cfg.color) style.color = cfg.color;
  if (cfg.bold) style.fontWeight = 'bold';
  if (cfg.italic) style.fontStyle = 'italic';
  return style;
}

export function pageNumberInlineStyleForPdf(cfg, page, total) {
  const normalized = normalizePageNumberStyle(cfg);
  if (!normalized.enabled) return null;
  const pos = pageNumberPositionStyle(normalized);
  const text = pageNumberTextStyle(normalized);
  const parts = [
    'position:absolute',
    'pointer-events:none',
    `top:${pos.top ?? 'auto'}`,
    `bottom:${pos.bottom ?? 'auto'}`,
    `left:${pos.left ?? 'auto'}`,
    `right:${pos.right ?? 'auto'}`,
  ];
  if (pos.transform && pos.transform !== 'none') parts.push(`transform:${pos.transform}`);
  if (text.fontFamily) parts.push(`font-family:${text.fontFamily}`);
  if (text.fontSize) parts.push(`font-size:${text.fontSize}`);
  if (text.color) parts.push(`color:${text.color}`);
  if (text.fontWeight) parts.push(`font-weight:${text.fontWeight}`);
  if (text.fontStyle) parts.push(`font-style:${text.fontStyle}`);
  return {
    css: parts.join(';'),
    text: formatPageNumber(normalized.format, page, total),
  };
}
