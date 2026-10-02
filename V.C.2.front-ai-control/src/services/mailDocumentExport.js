import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { documentService } from './documentService';
import { rowsToCsv, sanitizeFilename } from '../pages/documents/csvUtils';
import { SPREADSHEET_BLOCK_TYPE } from '../pages/documents/spreadsheetGridUtils';
import { getSpreadsheetAllSheetsPreviewData } from '../pages/documents/spreadsheetPreview';
import {
  buildPdfHtmlFromBlocks,
  buildPdfHtmlFromFields,
} from '../pages/documents/documentPdfExport';
import { FIELD_DISPLAY } from '../pages/documents/SheetEditor';
import { normalizePageLayout, getPageDimensions, getJsPdfFormat } from '../pages/documents/documentPageLayout';
import { isSpreadsheetTemplate } from '../pages/documents/templateTypeUtils';

function isTableFieldBlock(block) {
  if (!block || block.type !== 'field') return false;
  const displayType = block.displayType || FIELD_DISPLAY.form;
  return displayType === FIELD_DISPLAY.table || displayType === 'table';
}

function isSpreadsheetBlock(block) {
  return Boolean(block && block.type === SPREADSHEET_BLOCK_TYPE);
}

function getFieldValue(fieldData, fieldName) {
  if (!fieldName || !fieldData || typeof fieldData !== 'object') return undefined;
  if (Object.prototype.hasOwnProperty.call(fieldData, fieldName)) return fieldData[fieldName];
  const keyLower = String(fieldName).trim().toLowerCase();
  const found = Object.keys(fieldData).find((k) => String(k).trim().toLowerCase() === keyLower);
  return found !== undefined ? fieldData[found] : undefined;
}

function uniqueCsvFilename(baseName, used) {
  let name = sanitizeFilename(baseName) || 'sheet.csv';
  if (!name.toLowerCase().endsWith('.csv')) name = `${name}.csv`;
  let unique = name;
  let n = 2;
  while (used.has(unique.toLowerCase())) {
    unique = name.replace(/\.csv$/i, `_${n}.csv`);
    n += 1;
  }
  used.add(unique.toLowerCase());
  return unique;
}

/**
 * Build one CSV File per spreadsheet sheet (and per legacy table field).
 * @returns {File[]}
 */
function buildCsvFilesForMail(blocks, fieldData, titleBase) {
  const files = [];
  const used = new Set();
  const base = sanitizeFilename(titleBase) || 'table';

  (blocks || []).forEach((block) => {
    if (isSpreadsheetBlock(block)) {
      const rowArr = getFieldValue(fieldData, block.field_name);
      const sheets = getSpreadsheetAllSheetsPreviewData(block, rowArr);
      if (sheets.length === 0) return;

      if (sheets.length === 1) {
        const sheet = sheets[0];
        const csv = rowsToCsv(sheet.rows, sheet.columns);
        const filename = uniqueCsvFilename(base, used);
        files.push(new File([csv], filename, { type: 'text/csv;charset=utf-8' }));
        return;
      }

      sheets.forEach((sheet, i) => {
        const sheetLabel = sheet.sheetName || `sheet-${i + 1}`;
        const csv = rowsToCsv(sheet.rows, sheet.columns);
        const filename = uniqueCsvFilename(`${base}_${sheetLabel}`, used);
        files.push(new File([csv], filename, { type: 'text/csv;charset=utf-8' }));
      });
      return;
    }

    if (isTableFieldBlock(block)) {
      const value = getFieldValue(fieldData, block.field_name);
      const rows = Array.isArray(value) ? value : [];
      const columns = Array.isArray(block.tableColumns) && block.tableColumns.length > 0
        ? block.tableColumns
        : [];
      const csv = rowsToCsv(rows, columns);
      const label = block.field_name || 'table';
      const filename = uniqueCsvFilename(`${base}_${label}`, used);
      files.push(new File([csv], filename, { type: 'text/csv;charset=utf-8' }));
    }
  });

  return files;
}

async function waitForImages(root) {
  const images = Array.from(root.querySelectorAll('img'));
  if (images.length === 0) return;
  await Promise.all(images.map((img) => {
    if (img.complete) return Promise.resolve();
    return new Promise((resolve) => {
      img.onload = resolve;
      img.onerror = resolve;
    });
  }));
}

export async function exportHtmlToPdfBlob(fullHtml, { pageLayout = null } = {}) {
  const layout = normalizePageLayout(pageLayout);
  const iframe = document.createElement('iframe');
  iframe.setAttribute('style', 'position:fixed;left:-9999px;top:0;border:none;visibility:hidden');
  document.body.appendChild(iframe);

  try {
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) throw new Error('iframe unavailable');

    await new Promise((resolve) => {
      iframe.contentWindow.onload = resolve;
      iframeDoc.open();
      iframeDoc.write(fullHtml);
      iframeDoc.close();
      setTimeout(resolve, 400);
    });

    const root = iframe.contentDocument?.getElementById('pdf-root') || iframe.contentDocument?.body;
    if (!root) throw new Error('pdf root missing');

    await waitForImages(root);
    const sheets = Array.from(root.querySelectorAll('.pdf-sheet'));
    if (sheets.length === 0) throw new Error('no pdf sheets');

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

    return pdfDoc.output('blob');
  } finally {
    if (document.body.contains(iframe)) document.body.removeChild(iframe);
  }
}

function resolveSheetBlocks(snap, template) {
  const fromSnap = snap?.sheet_blocks || snap?.blocks || snap?.sheet_content || [];
  if (Array.isArray(fromSnap) && fromSnap.length > 0) return fromSnap;
  const fromTemplate = template?.sheet_content || template?.sheet_blocks || template?.blocks || [];
  return Array.isArray(fromTemplate) ? fromTemplate : [];
}

async function loadDocumentContext(documentRef) {
  const doc = documentRef?.field_data
    ? documentRef
    : await documentService.getDocument(documentRef.id);

  let sheetBlocks = [];
  let pageLayout = null;
  let titleStyle = null;
  let fieldsList = [];
  let template = null;

  if (doc.template_id) {
    try {
      template = await documentService.getTemplate(doc.template_id);
      const version = doc.template_version || template.current_version;
      const snap = await documentService.getTemplateVersion(doc.template_id, version);
      sheetBlocks = resolveSheetBlocks(snap, template);
      pageLayout = snap.page_layout ?? template.page_layout;
      titleStyle = snap.title_style ?? template.title_style;
      fieldsList = snap.fields || template.fields || [];
    } catch (err) {
      console.warn('template snapshot unavailable for mail export', err);
      try {
        template = template || await documentService.getTemplate(doc.template_id);
        sheetBlocks = resolveSheetBlocks(null, template);
        fieldsList = template?.fields || [];
      } catch {
        // keep empty blocks — PDF fallback may still work from fields
      }
    }
  }

  return { doc, sheetBlocks, pageLayout, titleStyle, fieldsList, template };
}

/**
 * Export a document for mail attachment(s).
 * Spreadsheet / table docs → one CSV per sheet (single sheet → one file).
 * Other docs → one PDF.
 * @returns {Promise<File[]>}
 */
export async function exportDocumentForMail(documentRef) {
  const { doc, sheetBlocks, pageLayout, titleStyle, fieldsList, template } = await loadDocumentContext(documentRef);
  const title = doc.title || doc.number || `document-${doc.id}`;
  const safeName = sanitizeFilename(title) || `document-${doc.id}`;

  const spreadsheetBlocks = (sheetBlocks || []).filter(isSpreadsheetBlock);
  const tableFieldBlocks = (sheetBlocks || []).filter(isTableFieldBlock);
  const isSpreadsheetDoc = spreadsheetBlocks.length > 0 || isSpreadsheetTemplate(template);

  if (isSpreadsheetDoc || tableFieldBlocks.length > 0) {
    const blocksForCsv = isSpreadsheetDoc
      ? (spreadsheetBlocks.length > 0 ? spreadsheetBlocks : sheetBlocks)
      : tableFieldBlocks;
    const csvFiles = buildCsvFilesForMail(blocksForCsv, doc.field_data || {}, safeName);
    if (csvFiles.length > 0) return csvFiles;
  }

  const fullHtml = sheetBlocks?.length
    ? buildPdfHtmlFromBlocks(
      sheetBlocks,
      doc.field_data || {},
      title,
      titleStyle || undefined,
      pageLayout,
      {}
    )
    : buildPdfHtmlFromFields(fieldsList, doc.field_data || {}, title, pageLayout);

  const blob = await exportHtmlToPdfBlob(fullHtml, { pageLayout });
  return [new File([blob], `${safeName}.pdf`, { type: 'application/pdf' })];
}
