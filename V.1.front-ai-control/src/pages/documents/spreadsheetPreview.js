import {
  SPREADSHEET_BLOCK_TYPE,
  cellKey,
  gridModelToDataRows,
  gridModelToTableColumns,
  getEffectiveCellValue,
  mergeSpreadsheetSheetWithDataRows,
  normalizeSpreadsheetSheets,
  normalizeSpreadsheetFieldValue,
  blockFragmentForSheet,
} from './spreadsheetGridUtils';
import { isCellFormula, resolveCellDisplayValue } from './spreadsheetCellFormula';

function resolveRowsFormulas(model, rows, columns, workbook = null) {
  const dataStart = model.hasHeaderRow ? 1 : 0;
  return rows.map((row, rowIdx) => {
    const r = dataStart + rowIdx;
    const out = {};
    columns.forEach((col, c) => {
      const v = row[col.key];
      out[col.key] = isCellFormula(v)
        ? resolveCellDisplayValue(v, model, r, c, columns, workbook)
        : (v != null ? String(v) : '');
    });
    return out;
  });
}

function previewForSheet(block, fieldData, sheet) {
  const sheetBlock = blockFragmentForSheet(block, sheet);
  const columns = Array.isArray(sheet.tableColumns) && sheet.tableColumns.length > 0
    ? sheet.tableColumns
    : gridModelToTableColumns(sheetBlock);
  const sheets = normalizeSpreadsheetSheets(block);
  const workbook = { sheets, activeSheetId: sheet.id };
  const map = normalizeSpreadsheetFieldValue(fieldData, sheets);
  const sheetRows = map[sheet.id] || [];
  if (Array.isArray(sheetRows) && sheetRows.length > 0) {
    const merged = mergeSpreadsheetSheetWithDataRows(sheetBlock, sheetRows);
    const rawRows = gridModelToDataRows({ ...merged, tableColumns: columns });
    return {
      fieldName: block.field_name || '',
      sheetName: sheet.name,
      sheetId: sheet.id,
      columns,
      rows: resolveRowsFormulas(merged, rawRows, columns, workbook),
    };
  }
  const model = { ...sheetBlock, tableColumns: columns, cells: sheetBlock.cells || {} };
  const rawRows = gridModelToDataRows(model);
  return {
    fieldName: block.field_name || '',
    sheetName: sheet.name,
    sheetId: sheet.id,
    columns,
    rows: resolveRowsFormulas(model, rawRows, columns, workbook),
  };
}

/**
 * Данные для HTML-предпросмотра/печати/CSV: формулы вычисляются в отображаемые значения.
 * @param {string} [sheetId] — если не задан, используется первый лист
 */
export function getSpreadsheetPreviewData(block, fieldData, sheetId) {
  if (!block || block.type !== SPREADSHEET_BLOCK_TYPE) {
    return { fieldName: '', columns: [], rows: [] };
  }
  const sheets = normalizeSpreadsheetSheets(block);
  const sheet = sheetId
    ? sheets.find((s) => s.id === sheetId) || sheets[0]
    : sheets[0];
  if (!sheet) {
    return { fieldName: block.field_name || '', columns: [], rows: [] };
  }
  const data = previewForSheet(block, fieldData, sheet);
  return {
    fieldName: data.fieldName,
    columns: data.columns,
    rows: data.rows,
    sheetName: data.sheetName,
    sheetId: data.sheetId,
  };
}

/** Все листы блока для экспорта / PDF */
export function getSpreadsheetAllSheetsPreviewData(block, fieldData) {
  if (!block || block.type !== SPREADSHEET_BLOCK_TYPE) return [];
  const sheets = normalizeSpreadsheetSheets(block);
  return sheets.map((sheet) => previewForSheet(block, fieldData, sheet));
}

/**
 * Значение ячейки для предпросмотра: шаблон из cells + строки fieldValues, с вычислением формул.
 */
export function getSpreadsheetCellDisplayValue(block, fieldValues, r, c, sheetId) {
  const sheets = normalizeSpreadsheetSheets(block);
  const sheet = sheetId
    ? sheets.find((s) => s.id === sheetId) || sheets[0]
    : sheets[0];
  const sheetBlock = blockFragmentForSheet(block, sheet);
  const cols = sheetBlock.tableColumns || [];
  const col = cols[c];
  if (!col) return '';
  const cells = sheetBlock.cells || {};
  const meta = cells[cellKey(r, c)] || {};
  const dataStart = sheetBlock.hasHeaderRow ? 1 : 0;
  let raw = meta.value;
  if (raw == null || String(raw).trim() === '') {
    if (r >= dataStart) {
      const rowIdx = r - dataStart;
      const map = normalizeSpreadsheetFieldValue(fieldValues?.[block.field_name], sheets);
      const rows = Array.isArray(map[sheet.id]) ? map[sheet.id] : [];
      const row = rows[rowIdx];
      if (row && row[col.key] != null && String(row[col.key]).trim() !== '') {
        raw = row[col.key];
      }
    }
  }
  if (raw == null || String(raw).trim() === '') {
    raw = getEffectiveCellValue(cells, r, c, cols, !!sheetBlock.hasHeaderRow);
  }
  if (raw == null || String(raw).trim() === '') return '';
  const map = normalizeSpreadsheetFieldValue(fieldValues?.[block.field_name], sheets);
  const rowData = Array.isArray(map[sheet.id]) ? map[sheet.id] : [];
  const merged = mergeSpreadsheetSheetWithDataRows(sheetBlock, rowData);
  if (isCellFormula(raw)) {
    return resolveCellDisplayValue(raw, merged, r, c, cols, { sheets, activeSheetId: sheet.id });
  }
  return String(raw);
}
