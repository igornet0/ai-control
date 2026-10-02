import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { DEFAULT_TABLE_COLUMNS, FIELD_DISPLAY, getTextStyleString } from './SheetEditor';
import { SPREADSHEET_BLOCK_TYPE } from './spreadsheetGridUtils';
import { getSpreadsheetAllSheetsPreviewData } from './spreadsheetPreview';
import { buildExpandedPreviewPages } from './documentPagination';
import {
  ISO_A_SIZES_MM,
  PAGE_PADDING_X_PX,
  PAGE_PADDING_Y_PX,
  TEXT_LINE_HEIGHT_RATIO,
  getJsPdfFormat,
  getPageDimensions,
  normalizePageLayout,
} from './documentPageLayout';
import {
  buildImageNumberMap,
  clampImageSize,
  formatImageCaption,
  getBlockAlignFlex,
} from './sheetImageUtils';
import { resolveBlockContent, resolveFieldValuePlaceholders } from './documentPlaceholders';

const PDF_BG = 'background:#fff!important';
const PDF_WRAP = 'overflow-wrap:break-word;word-break:break-word';
const PDF_TEXT_WRAP = 'white-space:pre-wrap;overflow-wrap:break-word;word-break:break-word';
const PDF_FIELD_LABEL_STYLE = `font-weight:600;font-size:0.875rem;line-height:${TEXT_LINE_HEIGHT_RATIO};padding-bottom:2px;color:#64748b;display:block;overflow:visible`;
const PDF_FIELD_VALUE_STYLE = `${PDF_WRAP};border-bottom:1px solid #cbd5e1;padding-bottom:8px;min-height:1.5em;line-height:${TEXT_LINE_HEIGHT_RATIO};display:block;color:#1e293b;overflow:visible`;

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatFieldValueForPdf(value, placeholderVars = null) {
  const resolved = placeholderVars ? resolveFieldValuePlaceholders(value, placeholderVars) : value;
  if (resolved === null || resolved === undefined) return '';
  if (resolved instanceof Date) return resolved.toISOString().slice(0, 10);
  if (typeof resolved === 'object') {
    if (resolved && typeof resolved.toISOString === 'function') return resolved.toISOString().slice(0, 10);
    if (resolved && (resolved.date != null || resolved.value != null)) return String(resolved.date ?? resolved.value);
    return JSON.stringify(resolved);
  }
  return String(resolved);
}

function getFieldValueForPdf(fieldData, fieldName) {
  if (!fieldName || !fieldData || typeof fieldData !== 'object') return undefined;
  if (Object.prototype.hasOwnProperty.call(fieldData, fieldName)) return fieldData[fieldName];
  const keyLower = String(fieldName).trim().toLowerCase();
  const found = Object.keys(fieldData).find((k) => String(k).trim().toLowerCase() === keyLower);
  return found !== undefined ? fieldData[found] : undefined;
}

function blockOffsetStyle(align, offsetX, offsetY) {
  const ox = Number(offsetX) || 0;
  const oy = Number(offsetY) || 0;
  const parts = [`display:flex;justify-content:${getBlockAlignFlex(align)};margin:0;padding:4px 0`];
  if (oy) parts.push(`margin-top:${oy}px`);
  if (ox) {
    if (align === 'right') parts.push(`margin-right:${ox}px`);
    else parts.push(`margin-left:${ox}px`);
  }
  return parts.join(';');
}

export function renderSheetBlockPdfHtml(block, fieldData, {
  rowSlice = null,
  isTableContinuation = false,
  sheetId = null,
  imageNumber = 0,
  placeholderVars = {},
} = {}) {
  const esc = escHtml;

  if (block.type === SPREADSHEET_BLOCK_TYPE) {
    const rowArr = getFieldValueForPdf(fieldData, block.field_name);
    let allSheets = getSpreadsheetAllSheetsPreviewData(block, rowArr);
    if (sheetId) {
      allSheets = allSheets.filter((s) => s.sheetId === sheetId);
    }
    const blockStyle = getTextStyleString(block);
    const fs = blockStyle ? `${PDF_BG};${blockStyle}` : `${PDF_BG};color:#000;font-size:0.875rem`;
    const cellStyle = `${fs};${PDF_WRAP};border:1px solid #ccc;padding:6px 10px`;
    return allSheets.map((sheetData) => {
      const { columns, rows, fieldName, sheetName } = sheetData;
      const slicedRows = rowSlice ? rows.slice(rowSlice.start, rowSlice.end) : rows;
      const thRow = columns.map((c) => `<th style="${cellStyle};font-weight:600">${esc(c.label)}</th>`).join('');
      const trRows = slicedRows.length > 0
        ? slicedRows.map((row) => `<tr style="${fs}">${columns.map((col) => `<td style="${cellStyle}">${esc(String(row[col.key] ?? '—'))}</td>`).join('')}</tr>`).join('')
        : `<tr style="${fs}">${columns.map(() => `<td style="${cellStyle}">—</td>`).join('')}</tr>`;
      const cap = (sheetName && String(sheetName).trim()) || fieldName || 'Таблица';
      const continuation = isTableContinuation ? ' (продолжение)' : '';
      return `<div class="pdf-block pdf-table-block pdf-no-break" style="${fs};${PDF_WRAP};margin:0"><div style="${fs};font-weight:600;font-size:0.875rem;margin-bottom:8px">${esc(cap)}${continuation}</div><table style="width:100%;border-collapse:collapse;table-layout:fixed;font-size:0.875rem"><thead><tr>${thRow}</tr></thead><tbody>${trRows}</tbody></table></div>`;
    }).join('');
  }

  if (block.type === 'field') {
    const displayType = block.displayType || FIELD_DISPLAY.form;
    const isTable = displayType === FIELD_DISPLAY.table;
    const rawValue = getFieldValueForPdf(fieldData, block.field_name);
    let value = rawValue !== undefined && rawValue !== null ? rawValue : (isTable ? [] : '_______________');
    value = resolveFieldValuePlaceholders(value, placeholderVars);
    const blockStyle = getTextStyleString(block);
    const fs = blockStyle ? `${PDF_BG};${blockStyle}` : `${PDF_BG};color:#000;font-size:1rem`;

    if (isTable) {
      const allRows = Array.isArray(value) ? value : [];
      const rows = rowSlice ? allRows.slice(rowSlice.start, rowSlice.end) : allRows;
      const columns = Array.isArray(block.tableColumns) && block.tableColumns.length > 0
        ? block.tableColumns
        : DEFAULT_TABLE_COLUMNS;
      const cellStyle = `${fs};${PDF_WRAP};border:1px solid #ccc;padding:6px 10px`;
      const thRow = columns.map((c) => `<th style="${cellStyle};font-weight:600">${esc(c.label)}</th>`).join('');
      const trRows = rows.length > 0
        ? rows.map((row) => `<tr style="${fs}">${columns.map((col) => `<td style="${cellStyle}">${esc(String(row[col.key] ?? '—'))}</td>`).join('')}</tr>`).join('')
        : `<tr style="${fs}">${columns.map(() => `<td style="${cellStyle}">—</td>`).join('')}</tr>`;
      const continuation = isTableContinuation ? ' (продолжение)' : '';
      return `<div class="pdf-block pdf-table-block pdf-no-break" style="${fs};${PDF_WRAP};margin:0"><div class="pdf-field-label" style="${PDF_BG};${PDF_FIELD_LABEL_STYLE};margin-bottom:6px">${esc(block.field_name || '(поле)')}${continuation}</div><table style="width:100%;border-collapse:collapse;table-layout:fixed;font-size:0.875rem"><thead><tr>${thRow}</tr></thead><tbody>${trRows}</tbody></table></div>`;
    }

    const displayValue = formatFieldValueForPdf(value, placeholderVars);
    const valueHtml = displayValue ? esc(displayValue) : '&nbsp;';
    const labelStyle = `${PDF_BG};${PDF_FIELD_LABEL_STYLE};margin-bottom:4px`;
    const valueStyle = `${PDF_BG};${PDF_FIELD_VALUE_STYLE}`;
    return `<div class="pdf-block pdf-field-block pdf-no-break" style="${fs};${PDF_WRAP};margin:0"><div class="pdf-field-label" style="${labelStyle}">${esc(block.field_name || '(поле)')}</div><div class="pdf-field-value" style="${valueStyle}">${valueHtml}</div></div>`;
  }

  if (block.type === 'stamp') {
    const showCircle = block.showCircle !== false;
    const w = clampImageSize(block.stampWidth, 120, 300);
    const h = clampImageSize(block.stampHeight, 120, 300);
    const border = showCircle ? '2px solid #333' : 'none';
    const radius = showCircle ? '50%' : '0';
    const wrapStyle = `${PDF_BG};${blockOffsetStyle(block.stampAlign, block.stampOffsetX, block.stampOffsetY)}`;
    const inner = block.image
      ? `<img src="${String(block.image).replace(/"/g, '&quot;')}" alt="" style="width:100%;height:100%;object-fit:contain;display:block" />`
      : `<span style="font-weight:600;font-size:0.875rem">${esc(resolveBlockContent(block.content || 'М.П.', placeholderVars))}</span>`;
    return `<div class="pdf-block pdf-stamp pdf-no-break" style="${wrapStyle}"><div style="${PDF_BG};display:inline-flex;align-items:center;justify-content:center;width:${w}px;height:${h}px;border:${border};border-radius:${radius};overflow:visible;flex-shrink:0">${inner}</div></div>`;
  }

  if (block.type === 'image') {
    const w = clampImageSize(block.imageWidth, 240);
    const h = clampImageSize(block.imageHeight, 180);
    const wrapStyle = `${PDF_BG};${blockOffsetStyle(block.imageAlign, block.imageOffsetX, block.imageOffsetY)}`;
    const caption = formatImageCaption(block, imageNumber, placeholderVars);
    const imgHtml = block.image
      ? `<img src="${String(block.image).replace(/"/g, '&quot;')}" alt="" style="width:100%;height:100%;object-fit:contain;display:block" />`
      : `<span style="color:#94a3b8;font-size:0.875rem">Изображение не загружено</span>`;
    const captionHtml = caption
      ? `<div style="${PDF_BG};text-align:center;font-size:0.875rem;color:#475569;margin-top:6px;line-height:${TEXT_LINE_HEIGHT_RATIO}">${esc(caption)}</div>`
      : '';
    return `<div class="pdf-block pdf-image pdf-no-break" style="${wrapStyle}"><div style="${PDF_BG};display:inline-flex;flex-direction:column;align-items:center;max-width:100%"><div style="${PDF_BG};display:inline-flex;align-items:center;justify-content:center;width:${w}px;height:${h}px;overflow:hidden;flex-shrink:0">${imgHtml}</div>${captionHtml}</div></div>`;
  }

  const text = esc(resolveBlockContent(block.content || '', placeholderVars));
  const textBlockStyle = getTextStyleString(block);
  const textStyle = textBlockStyle
    ? `${PDF_BG};${PDF_TEXT_WRAP};${textBlockStyle};line-height:${TEXT_LINE_HEIGHT_RATIO};margin:0`
    : `${PDF_BG};${PDF_TEXT_WRAP};color:#000;font-size:1rem;line-height:${TEXT_LINE_HEIGHT_RATIO};margin:0`;
  return `<div class="pdf-block pdf-text-block" style="${textStyle}">${text || '&nbsp;'}</div>`;
}

function getPageSizeCss(layout, orientation) {
  const cfg = normalizePageLayout(layout);
  if (cfg.format !== 'custom' && ISO_A_SIZES_MM[cfg.format]) {
    return `${cfg.format} ${orientation}`;
  }
  const dims = getPageDimensions(cfg, orientation);
  return `${dims.widthMm}mm ${dims.heightMm}mm`;
}

function buildPdfStyles(pageLayout = null) {
  const layout = normalizePageLayout(pageLayout);
  const portraitSize = getPageSizeCss(layout, 'portrait');
  const landscapeSize = getPageSizeCss(layout, 'landscape');

  return `
    @page pdf-portrait { margin: 0; size: ${portraitSize}; }
    @page pdf-landscape { margin: 0; size: ${landscapeSize}; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff !important;
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    #pdf-root { background: #fff !important; }
    .pdf-sheet {
      display: block;
      background: #fff !important;
      color: #1e293b;
      overflow: visible;
      page-break-after: always;
      break-after: page;
      box-sizing: border-box;
    }
    .pdf-sheet[data-orientation="portrait"] { page: pdf-portrait; }
    .pdf-sheet[data-orientation="landscape"] { page: pdf-landscape; }
    .pdf-sheet:last-child {
      page-break-after: auto;
      break-after: auto;
    }
    .pdf-sheet-body {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      overflow: visible;
    }
    .pdf-field-label {
      font-weight: 600;
      font-size: 0.875rem;
      line-height: ${TEXT_LINE_HEIGHT_RATIO};
      padding-bottom: 2px;
      color: #64748b;
      display: block;
      overflow: visible;
    }
    .pdf-field-value {
      line-height: ${TEXT_LINE_HEIGHT_RATIO};
      overflow: visible;
    }
    .pdf-title {
      margin: 0 0 1rem;
      flex-shrink: 0;
    }
    .pdf-no-break {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .pdf-stamp, .pdf-image, .pdf-field-block {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .pdf-text-block {
      page-break-inside: auto;
      break-inside: auto;
    }
    table { page-break-inside: auto; font-size: 0.875rem; }
    tr { page-break-inside: avoid; break-inside: avoid; }
    @media print {
      html, body { width: auto; height: auto; }
      #pdf-root { margin: 0; padding: 0; }
      .pdf-sheet {
        margin: 0;
        box-shadow: none !important;
      }
    }
  `;
}

export function buildPdfHtmlFromExpandedPages(expandedPages, fieldData, title, titleStyle, pageLayout = null, sheetBlocks = null, placeholderVars = {}) {
  const layout = normalizePageLayout(pageLayout);
  const imageNumberMap = buildImageNumberMap(sheetBlocks || []);
  const titleStyleStr = titleStyle && Object.keys(titleStyle).length > 0
    ? getTextStyleString({ textStyle: titleStyle })
    : '';
  const titleDivStyle = titleStyleStr
    ? `${PDF_BG};${PDF_WRAP};${titleStyleStr};margin-bottom:1rem`
    : `${PDF_BG};${PDF_WRAP};color:#000;font-size:1.25rem;font-weight:700;margin-bottom:1rem`;

  const sheets = expandedPages.map((page) => {
    const orientation = page.orientation || layout.orientation;
    const dims = getPageDimensions(layout, orientation);
    const blocksHtml = page.blocks.map((entry) => renderSheetBlockPdfHtml(entry.block, fieldData, {
      rowSlice: entry.rowSlice,
      isTableContinuation: entry.isTableContinuation,
      sheetId: entry.sheetId,
      imageNumber: imageNumberMap.get(entry.block) || 0,
      placeholderVars,
    })).join('');

    const titleHtml = page.showTitle
      ? `<div class="pdf-title pdf-no-break" style="${titleDivStyle}">${escHtml(title)}</div>`
      : '';

    return `
      <div
        class="pdf-sheet"
        data-orientation="${orientation}"
        style="width:${dims.widthPx}px;height:${dims.heightPx}px;min-height:${dims.heightPx}px;max-height:${dims.heightPx}px;padding:${PAGE_PADDING_Y_PX}px ${PAGE_PADDING_X_PX}px;"
      >
        ${titleHtml}
        <div class="pdf-sheet-body">${blocksHtml}</div>
      </div>
    `;
  }).join('');

  const safeTitle = escHtml(title);
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>${safeTitle}</title>
    <style>${buildPdfStyles(layout)}</style>
  </head>
  <body>
    <div id="pdf-root">${sheets}</div>
  </body>
</html>`;
}

export function buildPdfHtmlFromFields(fieldsList, fieldData, title, pageLayout = null) {
  const layout = normalizePageLayout(pageLayout);
  const dims = getPageDimensions(layout, layout.orientation);
  const base = `${PDF_BG};color:#000`;
  const parts = [`<div class="pdf-title" style="${base};font-size:1.25rem;font-weight:700;margin-bottom:1rem">${escHtml(title)}</div>`];
  if (fieldsList.length > 0) {
    fieldsList.forEach((f) => {
      const val = formatFieldValueForPdf(fieldData[f.name]);
      parts.push(`<div class="pdf-field-block pdf-no-break" style="${base};margin-bottom:1.25rem"><div class="pdf-field-label" style="${base};${PDF_FIELD_LABEL_STYLE};margin-bottom:4px">${escHtml(f.name)}</div><div class="pdf-field-value" style="${base};font-size:1rem;line-height:${TEXT_LINE_HEIGHT_RATIO}">${escHtml(val) || '&nbsp;'}</div></div>`);
    });
  } else {
    Object.entries(fieldData).forEach(([key, value]) => {
      parts.push(`<div class="pdf-field-block pdf-no-break" style="${base};margin-bottom:1.25rem"><div class="pdf-field-label" style="${base};${PDF_FIELD_LABEL_STYLE};margin-bottom:4px">${escHtml(key)}</div><div class="pdf-field-value" style="${base};font-size:1rem;line-height:${TEXT_LINE_HEIGHT_RATIO}">${escHtml(formatFieldValueForPdf(value)) || '&nbsp;'}</div></div>`);
    });
  }
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${escHtml(title)}</title><style>${buildPdfStyles(layout)}</style></head>
<body><div id="pdf-root"><div class="pdf-sheet" data-orientation="${layout.orientation}" style="width:${dims.widthPx}px;height:${dims.heightPx}px;padding:${PAGE_PADDING_Y_PX}px ${PAGE_PADDING_X_PX}px">${parts.join('')}</div></div></body></html>`;
}

export function buildPdfHtmlFromBlocks(sheetBlocks, fieldData, title, titleStyle, pageLayout = null, placeholderVars = {}) {
  if (!sheetBlocks?.length) {
    const layout = normalizePageLayout(pageLayout);
    const dims = getPageDimensions(layout, layout.orientation);
    const titleStyleStr = titleStyle && Object.keys(titleStyle).length > 0
      ? getTextStyleString({ textStyle: titleStyle })
      : '';
    const titleDivStyle = titleStyleStr
      ? `${PDF_BG};${PDF_WRAP};${titleStyleStr}`
      : `${PDF_BG};${PDF_WRAP};color:#000;font-size:1.25rem;font-weight:700`;
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${buildPdfStyles(layout)}</style></head><body><div id="pdf-root"><div class="pdf-sheet" data-orientation="${layout.orientation}" style="width:${dims.widthPx}px;height:${dims.heightPx}px;padding:${PAGE_PADDING_Y_PX}px ${PAGE_PADDING_X_PX}px"><div style="${titleDivStyle}">${escHtml(title)}</div></div></div></body></html>`;
  }
  const layout = normalizePageLayout(pageLayout);
  const expandedPages = buildExpandedPreviewPages(sheetBlocks, fieldData, { pageLayout: layout, placeholderVars });
  return buildPdfHtmlFromExpandedPages(expandedPages, fieldData, title, titleStyle, layout, sheetBlocks, placeholderVars);
}

function waitForImages(root) {
  const images = Array.from(root.querySelectorAll('img'));
  if (images.length === 0) return Promise.resolve();
  return Promise.all(images.map((img) => {
    if (img.complete) return Promise.resolve();
    return new Promise((resolve) => {
      img.onload = resolve;
      img.onerror = resolve;
    });
  }));
}

export function openHtmlPrintWindow(fullHtml) {
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(fullHtml);
  win.document.close();
  win.focus();
  const runPrint = () => {
    win.print();
    win.onafterprint = () => win.close();
  };
  if (win.document.readyState === 'complete') {
    waitForImages(win.document.body).then(() => setTimeout(runPrint, 150));
  } else {
    win.onload = () => {
      waitForImages(win.document.body).then(() => setTimeout(runPrint, 150));
    };
  }
}

export async function exportHtmlDocumentToPdf(fullHtml, { filename, pageLayout = null }) {
  const layout = normalizePageLayout(pageLayout);
  const iframe = document.createElement('iframe');
  iframe.setAttribute('style', 'position:fixed;left:-9999px;top:0;border:none;visibility:hidden');
  document.body.appendChild(iframe);

  const cleanup = () => {
    if (document.body.contains(iframe)) document.body.removeChild(iframe);
  };

  const fallbackPrint = () => {
    openHtmlPrintWindow(fullHtml);
  };

  try {
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
      cleanup();
      fallbackPrint();
      return;
    }

    await new Promise((resolve) => {
      iframe.contentWindow.onload = resolve;
      iframeDoc.open();
      iframeDoc.write(fullHtml);
      iframeDoc.close();
      setTimeout(resolve, 400);
    });

    const root = iframe.contentDocument?.getElementById('pdf-root') || iframe.contentDocument?.body;
    if (!root) {
      cleanup();
      fallbackPrint();
      return;
    }

    await waitForImages(root);

    const sheets = Array.from(root.querySelectorAll('.pdf-sheet'));
    if (sheets.length === 0) {
      cleanup();
      fallbackPrint();
      return;
    }

    let pdfDoc = null;

    for (let i = 0; i < sheets.length; i += 1) {
      const sheet = sheets[i];
      const orientation = sheet.dataset.orientation === 'landscape' ? 'landscape' : 'portrait';
      const { widthMm, heightMm, widthPx, heightPx } = getPageDimensions(layout, orientation);
      const jsPdfFmt = getJsPdfFormat(layout, orientation);

      const canvas = await html2canvas(sheet, {
        scale: 2,
        width: widthPx,
        height: heightPx,
        windowWidth: widthPx,
        windowHeight: heightPx,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        scrollX: 0,
        scrollY: 0,
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.98);

      if (!pdfDoc) {
        pdfDoc = new jsPDF({ unit: 'mm', ...jsPdfFmt, compress: true });
      } else {
        pdfDoc.addPage(jsPdfFmt.format, jsPdfFmt.orientation);
      }
      pdfDoc.addImage(imgData, 'JPEG', 0, 0, widthMm, heightMm, undefined, 'FAST');
    }

    pdfDoc.save(filename);
    cleanup();
  } catch {
    cleanup();
    fallbackPrint();
  }
}
