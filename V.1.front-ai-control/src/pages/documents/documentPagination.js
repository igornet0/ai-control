import { FIELD_DISPLAY } from './SheetEditor';
import { SPREADSHEET_BLOCK_TYPE } from './spreadsheetGridUtils';
import { getSpreadsheetPreviewData, getSpreadsheetAllSheetsPreviewData } from './spreadsheetPreview';
import { splitSheetIntoPages } from './documentsPageUtils';
import { resolveBlockContent } from './documentPlaceholders';
import {
  estimateBlockLineCount,
  estimateTableBlockHeightPx,
  getBlockGapPx,
  getLineHeightPx,
  getPageContentBudgetPx,
  getTableRowsPerPage,
  getWrappedTextLines,
  normalizePageLayout,
  resolvePageOrientation,
  resolveTableOrientationForBlock,
  TABLE_ROW_HEIGHT_PX,
} from './documentPageLayout';

export const TABLE_ROWS_PER_PAGE = 12;

function getFieldValue(fieldData, fieldName) {
  if (!fieldName || !fieldData || typeof fieldData !== 'object') return undefined;
  if (Object.prototype.hasOwnProperty.call(fieldData, fieldName)) return fieldData[fieldName];
  const keyLower = String(fieldName).trim().toLowerCase();
  const found = Object.keys(fieldData).find((k) => String(k).trim().toLowerCase() === keyLower);
  return found !== undefined ? fieldData[found] : undefined;
}

/** @param {object} block */
export function isTableBlock(block) {
  if (!block) return false;
  if (block.type === SPREADSHEET_BLOCK_TYPE) return true;
  if (block.type === 'field') {
    return (block.displayType || FIELD_DISPLAY.form) === FIELD_DISPLAY.table;
  }
  return false;
}

/** @returns {Array<Record<string, string>>} */
export function getTableRows(block, fieldData, sheetId) {
  if (!block) return [];
  if (block.type === SPREADSHEET_BLOCK_TYPE) {
    const rowArr = getFieldValue(fieldData, block.field_name);
    const { rows } = getSpreadsheetPreviewData(block, rowArr, sheetId);
    return rows;
  }
  if (block.type === 'field') {
    const raw = getFieldValue(fieldData, block.field_name);
    return Array.isArray(raw) ? raw : [];
  }
  return [];
}

function wrapBlock(block, extra = {}) {
  return { block, rowSlice: null, isTableContinuation: false, ...extra };
}

function createPaginator(layout, baseOrientation, { reserveTitle = false, placeholderVars = {} } = {}) {
  const pages = [];
  let blocks = [];
  let usedPx = 0;
  let orientation = baseOrientation;

  const isFirstPage = () => pages.length === 0 && blocks.length === 0;
  const hasTitleReserve = () => reserveTitle && isFirstPage();

  const budgetPx = () => getPageContentBudgetPx(layout, orientation, {
    withTitle: hasTitleReserve(),
  });

  const remainingPx = () => Math.max(0, budgetPx() - usedPx);

  const flush = () => {
    if (!blocks.length) return;
    pages.push({
      blocks: [...blocks],
      showTitle: false,
      pageBreakBefore: pages.length > 0,
      orientation,
    });
    blocks = [];
    usedPx = 0;
  };

  const addGap = () => {
    if (blocks.length > 0) usedPx += getBlockGapPx();
  };

  const ensureFits = (heightPx, nextOrientation = orientation) => {
    if (heightPx <= remainingPx()) return;
    if (blocks.length > 0) {
      flush();
      orientation = nextOrientation;
      return;
    }
    orientation = nextOrientation;
  };

  const pushEntry = (entry, heightPx) => {
    addGap();
    if (heightPx > remainingPx() && blocks.length > 0) flush();
    blocks.push(entry);
    usedPx += heightPx;
  };

  const appendTextBlock = (block) => {
    const fontSize = Number(block.textStyle?.fontSize) || 16;
    const lineH = getLineHeightPx(fontSize);
    const resolvedContent = resolveBlockContent(block.content, placeholderVars);
    const lines = getWrappedTextLines(resolvedContent, layout, orientation, fontSize);
    if (!lines.length) return;

    let lineIndex = 0;
    while (lineIndex < lines.length) {
      if (blocks.length > 0 && lineIndex === 0) usedPx += getBlockGapPx();

      let budget = remainingPx();
      if (budget < lineH && blocks.length > 0) {
        flush();
        budget = remainingPx();
      }

      const maxLines = Math.max(1, Math.floor(budget / lineH));
      const take = Math.min(maxLines, lines.length - lineIndex);
      const chunkContent = lines.slice(lineIndex, lineIndex + take).join('\n');
      blocks.push(wrapBlock({ ...block, content: chunkContent }));
      usedPx += take * lineH;
      lineIndex += take;

      if (lineIndex < lines.length) flush();
    }
  };

  const appendFlowBlock = (block) => {
    const heightPx = estimateBlockHeightPx(block, layout, orientation, placeholderVars);
    pushEntry(wrapBlock(block), heightPx);
    if (usedPx >= budgetPx()) flush();
  };

  const maxRowsForRemaining = (withLabel, isContinuation) => {
    const header = estimateTableBlockHeightPx(0, { withLabel, isContinuation });
    const rowArea = Math.max(0, remainingPx() - header - (blocks.length > 0 ? getBlockGapPx() : 0));
    return Math.max(0, Math.floor(rowArea / TABLE_ROW_HEIGHT_PX));
  };

  const appendTableRows = (block, allRows, fieldData, sheetId = null) => {
    let rowStart = 0;
    const totalRows = Math.max(allRows.length, 1);
    let isFirstChunk = true;

    while (rowStart < totalRows) {
      const rowsLeft = totalRows - rowStart;
      const orient = resolveTableOrientationForBlock(
        layout,
        rowsLeft,
        remainingPx() - (blocks.length > 0 ? getBlockGapPx() : 0),
        orientation,
      );

      if (blocks.length === 0) orientation = orient;
      else if (orient !== orientation && blocks.length > 0) flush();

      orientation = orient;

      const rowsPerPage = getTableRowsPerPage(layout, orientation, { withTitle: hasTitleReserve() });
      const maxHere = maxRowsForRemaining(isFirstChunk, !isFirstChunk);
      const take = Math.min(
        rowsLeft,
        rowsPerPage,
        maxHere > 0 ? maxHere : rowsPerPage,
      );
      const chunkRows = Math.max(1, take);

      addGap();
      if (estimateTableBlockHeightPx(chunkRows, { withLabel: isFirstChunk, isContinuation: !isFirstChunk })
        > remainingPx() && blocks.length > 0) {
        flush();
        orientation = orient;
        continue;
      }

      const entry = wrapBlock(block, {
        rowSlice: { start: rowStart, end: rowStart + chunkRows },
        isTableContinuation: !isFirstChunk,
        ...(sheetId ? { sheetId } : {}),
      });
      const h = estimateTableBlockHeightPx(chunkRows, {
        withLabel: isFirstChunk,
        isContinuation: !isFirstChunk,
      });
      blocks.push(entry);
      usedPx += h;
      rowStart += chunkRows;
      isFirstChunk = false;

      if (rowStart < totalRows) flush();
    }
  };

  const appendSpreadsheetBlock = (block, fieldData) => {
    const rowArr = getFieldValue(fieldData, block.field_name);
    const allSheets = getSpreadsheetAllSheetsPreviewData(block, rowArr);
    allSheets.forEach((sheetData) => {
      appendTableRows(block, sheetData.rows, fieldData, sheetData.sheetId);
    });
  };

  const appendFieldTableBlock = (block, fieldData) => {
    const rows = getTableRows(block, fieldData);
    appendTableRows(block, rows, fieldData);
  };

  const appendBlock = (block, fieldData) => {
    if (block?.type === 'page_break') {
      flush();
      return;
    }
    if (block.type === 'text') {
      appendTextBlock(block);
      return;
    }
    if (block.type === SPREADSHEET_BLOCK_TYPE) {
      appendSpreadsheetBlock(block, fieldData);
      return;
    }
    if (isTableBlock(block)) {
      appendFieldTableBlock(block, fieldData);
      return;
    }
    appendFlowBlock(block);
  };

  return {
    appendBlock,
    flush,
    getPages: () => {
      flush();
      return pages;
    },
  };
}

function estimateBlockHeightPx(block, layout, orientation, placeholderVars = {}) {
  if (block?.type === 'text') {
    const fontSize = Number(block.textStyle?.fontSize) || 16;
    const lineH = getLineHeightPx(fontSize);
    const content = resolveBlockContent(block.content, placeholderVars);
    const lines = getWrappedTextLines(content, layout, orientation, fontSize);
    return Math.max(lineH, lines.length * lineH);
  }
  const fontSize = Number(block?.textStyle?.fontSize) || 16;
  const lineH = getLineHeightPx(fontSize);
  return estimateBlockLineCount(block, layout, orientation) * lineH;
}

function expandTemplatePage(pageBlocks, fieldData, pageLayout, options = {}) {
  const layout = normalizePageLayout(pageLayout);
  const baseOrientation = layout.orientation;
  const paginator = createPaginator(layout, baseOrientation, options);

  pageBlocks.forEach((block) => {
    paginator.appendBlock(block, fieldData);
  });

  const pages = paginator.getPages();
  if (pages.length === 0) {
    pages.push({ blocks: [], showTitle: false, pageBreakBefore: false, orientation: baseOrientation });
  }
  return pages;
}

function attachPageLayoutMeta(pages, pageLayout) {
  const layout = normalizePageLayout(pageLayout);
  return pages.map((page) => {
    const orientation = resolvePageOrientation(layout, page);
    return {
      ...page,
      orientation,
      pageLayout: layout,
    };
  });
}

/**
 * Разбивает лист на страницы предпросмотра: явные page_break + чанки таблиц + длинный текст.
 * @returns {Array<{ blocks, showTitle, pageBreakBefore, orientation, pageLayout }>}
 */
export function buildExpandedPreviewPages(sheetBlocks, fieldData, options = {}) {
  const pageLayout = normalizePageLayout(options.pageLayout);

  const templatePages = splitSheetIntoPages(sheetBlocks);
  const expanded = [];

  templatePages.forEach((pageBlocks, templatePageIndex) => {
    const subPages = expandTemplatePage(pageBlocks, fieldData, pageLayout, {
      reserveTitle: expanded.length === 0,
    });
    subPages.forEach((sub, subIndex) => {
      expanded.push({
        ...sub,
        pageBreakBefore: expanded.length > 0 || (templatePageIndex > 0 && subIndex === 0),
      });
    });
  });

  if (expanded.length > 0) {
    expanded[0].showTitle = true;
    expanded[0].pageBreakBefore = false;
  }

  return attachPageLayoutMeta(expanded, pageLayout);
}
