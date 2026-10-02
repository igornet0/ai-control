/** Размеры листа (ISO A) и ориентация для шаблонов документов. DPI 72 — как в PDF/печати. */

import { FIELD_DISPLAY } from './SheetEditor';
import { SPREADSHEET_BLOCK_TYPE } from './spreadsheetGridUtils';

export const PAGE_DPI = 72;
const MM_PER_INCH = 25.4;

/** ISO A: ширина × высота в мм (портрет). */
export const ISO_A_SIZES_MM = {
  A1: { width: 594, height: 841 },
  A2: { width: 420, height: 594 },
  A3: { width: 297, height: 420 },
  A4: { width: 210, height: 297 },
  A5: { width: 148, height: 210 },
};

export const PAGE_FORMAT_OPTIONS = [
  { value: 'A4', label: 'A4 (210 × 297 мм)' },
  { value: 'A3', label: 'A3 (297 × 420 мм)' },
  { value: 'A2', label: 'A2 (420 × 594 мм)' },
  { value: 'A1', label: 'A1 (594 × 841 мм)' },
  { value: 'A5', label: 'A5 (148 × 210 мм)' },
  { value: 'custom', label: 'Произвольный размер' },
];

export const DEFAULT_PAGE_LAYOUT = {
  format: 'A4',
  orientation: 'portrait',
  /** portrait | landscape | auto — для страниц с таблицами */
  tablePagesOrientation: 'auto',
  customWidthMm: 210,
  customHeightMm: 297,
};

export const PAGE_PADDING_X_PX = 40;
export const PAGE_PADDING_Y_PX = 32;
export const PAGE_TITLE_RESERVE_PX = 48;
/** Доп. поля контента сверху/снизу (5–10% высоты листа) */
export const PAGE_CONTENT_MARGIN_RATIO = 0.075;
export const BLOCK_GAP_LINES = 1;
/** Зазор между блоками в sheetPageInner (0.75rem) */
export const BLOCK_GAP_PX = 12;
/** Запас снизу страницы, чтобы текст не обрезался на границе */
export const PAGINATION_SAFETY_PX = 12;
export const TABLE_HEADER_RESERVE_PX = 36;
export const TABLE_ROW_HEIGHT_PX = 30;
export const TEXT_LINE_HEIGHT_RATIO = 1.5;
export const TEXT_CHARS_PER_MM = 0.42;

export function mmToPx(mm, dpi = PAGE_DPI) {
  return Math.round((Number(mm) / MM_PER_INCH) * dpi);
}

export function pxToMm(px, dpi = PAGE_DPI) {
  return (Number(px) / dpi) * MM_PER_INCH;
}

export function normalizePageLayout(raw) {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_PAGE_LAYOUT };
  }
  const format = ISO_A_SIZES_MM[raw.format] ? raw.format : (raw.format === 'custom' ? 'custom' : 'A4');
  return {
    ...DEFAULT_PAGE_LAYOUT,
    ...raw,
    format,
    orientation: raw.orientation === 'landscape' ? 'landscape' : 'portrait',
    tablePagesOrientation: ['portrait', 'landscape', 'auto'].includes(raw.tablePagesOrientation)
      ? raw.tablePagesOrientation
      : 'auto',
    customWidthMm: Math.min(2000, Math.max(50, Number(raw.customWidthMm) || 210)),
    customHeightMm: Math.min(2000, Math.max(50, Number(raw.customHeightMm) || 297)),
  };
}

export function getPageSizeMm(layout, orientation = 'portrait') {
  const cfg = normalizePageLayout(layout);
  let widthMm;
  let heightMm;
  if (cfg.format === 'custom') {
    widthMm = cfg.customWidthMm;
    heightMm = cfg.customHeightMm;
  } else {
    const iso = ISO_A_SIZES_MM[cfg.format] || ISO_A_SIZES_MM.A4;
    widthMm = iso.width;
    heightMm = iso.height;
  }
  if (orientation === 'landscape') {
    return { widthMm: heightMm, heightMm: widthMm };
  }
  return { widthMm, heightMm };
}

export function getPageDimensions(layout, orientation = 'portrait') {
  const { widthMm, heightMm } = getPageSizeMm(layout, orientation);
  const widthPx = mmToPx(widthMm);
  const heightPx = mmToPx(heightMm);
  return { widthMm, heightMm, widthPx, heightPx, orientation };
}

export function getPageCssVars(layout, orientation = 'portrait') {
  const dims = getPageDimensions(layout, orientation);
  return {
    '--sheet-page-width': `${dims.widthPx}px`,
    '--sheet-page-height': `${dims.heightPx}px`,
    '--sheet-page-padding-x': `${PAGE_PADDING_X_PX}px`,
    '--sheet-page-padding-y': `${PAGE_PADDING_Y_PX}px`,
  };
}

export function getSheetPageInlineStyle(layout, orientation = 'portrait') {
  const dims = getPageDimensions(layout, orientation);
  return {
    ...getPageCssVars(layout, orientation),
    width: `${dims.widthPx}px`,
    minWidth: `${dims.widthPx}px`,
    maxWidth: `${dims.widthPx}px`,
    minHeight: `${dims.heightPx}px`,
  };
}

export function pageHasTableContent(page) {
  if (!page?.blocks?.length) return false;
  return page.blocks.some((entry) => {
    const b = entry?.block;
    if (!b) return false;
    if (b.type === SPREADSHEET_BLOCK_TYPE) return true;
    if (b.type === 'field' && (b.displayType === FIELD_DISPLAY.table || b.displayType === 'table')) {
      return true;
    }
    return false;
  });
}

export function estimateTableBlockHeightPx(rowCount, { withLabel = true, isContinuation = false } = {}) {
  const rows = Math.max(1, Number(rowCount) || 1);
  let h = TABLE_HEADER_RESERVE_PX + rows * TABLE_ROW_HEIGHT_PX;
  if (withLabel && !isContinuation) h += 28;
  return h;
}

export function resolveTableOrientationForBlock(pageLayout, rowCount, remainingPx, pageOrientation = 'portrait') {
  const cfg = normalizePageLayout(pageLayout);
  if (cfg.tablePagesOrientation === 'portrait') return 'portrait';
  if (cfg.tablePagesOrientation === 'landscape') return 'landscape';

  const tableH = estimateTableBlockHeightPx(rowCount);
  const portraitBudget = getPageContentBudgetPx(cfg, 'portrait');
  if (tableH <= remainingPx || tableH <= portraitBudget) return 'portrait';
  return 'landscape';
}

export function resolvePageOrientation(pageLayout, page) {
  const cfg = normalizePageLayout(pageLayout);
  if (page?.orientation) return page.orientation;
  const hasTable = pageHasTableContent(page);
  if (!hasTable) return cfg.orientation;

  if (cfg.tablePagesOrientation === 'landscape') return 'landscape';
  if (cfg.tablePagesOrientation === 'portrait') return 'portrait';
  return cfg.orientation;
}

export function getLineHeightPx(fontSize = 16) {
  return Math.max(14, fontSize * TEXT_LINE_HEIGHT_RATIO);
}

export function getBlockGapPx() {
  return BLOCK_GAP_PX;
}

export function getPageContentBudgetPx(layout, orientation, { withTitle = false } = {}) {
  return Math.max(120, getContentAreaHeight(layout, orientation, { withTitle }) - PAGINATION_SAFETY_PX);
}

export function getContentAreaHeight(layout, orientation, { withTitle = false } = {}) {
  const { heightPx } = getPageDimensions(layout, orientation);
  const edgeMargin = Math.round(heightPx * PAGE_CONTENT_MARGIN_RATIO);
  let h = heightPx - PAGE_PADDING_Y_PX * 2 - edgeMargin * 2;
  if (withTitle) h -= PAGE_TITLE_RESERVE_PX;
  return Math.max(120, h);
}

export function getTableRowsPerPage(layout, orientation, { withTitle = false } = {}) {
  const contentH = getContentAreaHeight(layout, orientation, { withTitle });
  const rows = Math.floor((contentH - TABLE_HEADER_RESERVE_PX) / TABLE_ROW_HEIGHT_PX);
  return Math.max(4, rows);
}

export function estimateCharsPerLine(layout, orientation, fontSize = 16) {
  const { widthPx } = getPageDimensions(layout, orientation);
  const inner = widthPx - PAGE_PADDING_X_PX * 2;
  const charW = Math.max(6, fontSize * 0.52);
  return Math.max(20, Math.floor(inner / charW));
}

export function estimateTextLinesPerPage(layout, orientation, fontSize = 16, withTitle = false) {
  const contentH = getContentAreaHeight(layout, orientation, { withTitle });
  const lineH = Math.max(14, fontSize * TEXT_LINE_HEIGHT_RATIO);
  return Math.max(4, Math.floor(contentH / lineH));
}

/**
 * Делит длинный текстовый блок на части для переноса на следующие страницы.
 * @returns {Array<object>}
 */
export function splitTextBlockForPagination(block, layout, orientation, withTitle = false, maxLinesOverride = null) {
  if (block?.type !== 'text') return [block];
  const content = String(block.content || '');
  if (!content.trim()) return [block];

  const fontSize = Number(block.textStyle?.fontSize) || 16;
  const maxLines = maxLinesOverride ?? getMaxLinesForPage(layout, orientation, fontSize, withTitle);
  const wrappedLines = getWrappedTextLines(content, layout, orientation, fontSize);

  if (wrappedLines.length <= maxLines) return [block];

  const chunks = [];
  for (let i = 0; i < wrappedLines.length; i += maxLines) {
    chunks.push({
      ...block,
      content: wrappedLines.slice(i, i + maxLines).join('\n'),
    });
  }
  return chunks;
}

export function preprocessBlocksForPagination(blocks, layout, orientation, withTitle = false) {
  if (!Array.isArray(blocks)) return [];
  const out = [];
  blocks.forEach((block) => {
    if (block?.type === 'text') {
      out.push(...splitTextBlockForPagination(block, layout, orientation, withTitle));
    } else {
      out.push(block);
    }
  });
  return out;
}

export function getJsPdfFormat(layout, orientation = 'portrait') {
  const cfg = normalizePageLayout(layout);
  if (cfg.format !== 'custom' && ISO_A_SIZES_MM[cfg.format]) {
    return { format: cfg.format.toLowerCase(), orientation };
  }
  const { widthMm, heightMm } = getPageSizeMm(cfg, orientation);
  return {
    format: [widthMm, heightMm],
    orientation,
  };
}

export function getMaxPreviewWidthPx(layout) {
  const cfg = normalizePageLayout(layout);
  const portrait = getPageDimensions(cfg, 'portrait').widthPx;
  const landscape = getPageDimensions(cfg, 'landscape').widthPx;
  return Math.max(portrait, landscape);
}

export function estimateBlockLineCount(block, layout, orientation = 'portrait') {
  if (!block) return 0;
  if (block.type === 'page_break') return 0;
  if (block.type === 'text') {
    const fontSize = Number(block.textStyle?.fontSize) || 16;
    const content = String(block.content || '');
    if (!content.trim()) return 1;
    return getWrappedTextLines(content, layout, orientation, fontSize).length;
  }
  if (block.type === 'field') {
    const isTable = (block.displayType || FIELD_DISPLAY.form) === FIELD_DISPLAY.table;
    return isTable ? 8 : 3;
  }
  if (block.type === 'stamp') {
    const fontSize = 16;
    const lineHeight = Math.max(14, fontSize * TEXT_LINE_HEIGHT_RATIO);
    const h = Math.min(300, Math.max(40, Number(block.stampHeight) || 120));
    return Math.max(2, Math.ceil((h + 16) / lineHeight));
  }
  if (block.type === 'image') {
    const lineHeight = getLineHeightPx(14);
    const h = Math.min(600, Math.max(40, Number(block.imageHeight) || 180));
    const captionLines = block.showCaption !== false ? 2 : 0;
    return Math.max(2, Math.ceil((h + 12 + captionLines * lineHeight) / lineHeight));
  }
  if (block.type === SPREADSHEET_BLOCK_TYPE) return 8;
  return 2;
}

export function getMaxLinesForPage(layout, orientation, fontSize = 16, withTitle = false) {
  return estimateTextLinesPerPage(layout, orientation, fontSize, withTitle);
}

/** Разбивает текст блока на визуальные строки с учётом переноса по ширине листа. */
export function getWrappedTextLines(content, layout, orientation, fontSize = 16) {
  const charsPerLine = estimateCharsPerLine(layout, orientation, fontSize);
  const rawLines = String(content || '').split('\n');
  const wrappedLines = [];
  rawLines.forEach((line) => {
    if (line.length <= charsPerLine) {
      wrappedLines.push(line);
      return;
    }
    let rest = line;
    while (rest.length > charsPerLine) {
      let breakAt = rest.lastIndexOf(' ', charsPerLine);
      if (breakAt < charsPerLine * 0.4) breakAt = charsPerLine;
      wrappedLines.push(rest.slice(0, breakAt).trimEnd());
      rest = rest.slice(breakAt).trimStart();
    }
    if (rest) wrappedLines.push(rest);
  });
  return wrappedLines.length > 0 ? wrappedLines : [''];
}
