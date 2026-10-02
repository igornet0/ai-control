import { excelColumnLabel, SPREADSHEET_BLOCK_TYPE, SPREADSHEET_FIELD_FORMAT } from './spreadsheetGridUtils';

const MAX_CELL_CHANGES = 200;
const SPREADSHEET_META_KEYS = new Set(['__format']);

function parseColIndex(colKey) {
  const match = String(colKey).match(/^col_(\d+)$/);
  return match ? parseInt(match[1], 10) : null;
}

export function formatCellAddress(rowIndex, colKey, sheetKey = null, { hasHeaderRow = false } = {}) {
  const rowLabel = rowIndex + 1 + (hasHeaderRow ? 1 : 0);
  const colIndex = parseColIndex(colKey);
  const cellRef = colIndex !== null
    ? `${excelColumnLabel(colIndex)}${rowLabel}`
    : `стр.${rowLabel} · ${colKey}`;

  if (sheetKey) {
    const sheetNum = Number(String(sheetKey).replace(/^sheet_/, ''));
    const sheetLabel = Number.isFinite(sheetNum) ? `Лист ${sheetNum + 1}` : sheetKey;
    return `${sheetLabel} · ${cellRef}`;
  }
  return cellRef;
}

export function normalizeCellValue(value) {
  if (value === null || value === undefined) return '';
  return String(value);
}

export function formatCellDiffValue(value) {
  const normalized = normalizeCellValue(value);
  return normalized === '' ? '(пусто)' : normalized;
}

function cellValuesEqual(before, after) {
  return normalizeCellValue(before) === normalizeCellValue(after);
}

function stripSpreadsheetFieldValue(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out = {};
  Object.keys(value).forEach((key) => {
    if (SPREADSHEET_META_KEYS.has(key)) return;
    if (/^sheet_\d+$/.test(key) && Array.isArray(value[key])) {
      out[key] = value[key];
    }
  });
  return out;
}

function isSpreadsheetFieldValue(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  if (value.__format === SPREADSHEET_FIELD_FORMAT) return true;
  return Object.keys(stripSpreadsheetFieldValue(value)).length > 0;
}

function isTableRowArray(value) {
  if (!Array.isArray(value)) return false;
  if (value.length === 0) return true;
  return value.every((row) => row && typeof row === 'object' && !Array.isArray(row));
}

function getFieldDiffMeta(sheetBlocks, fieldName) {
  if (!Array.isArray(sheetBlocks) || !fieldName) {
    return { hasHeaderRow: false };
  }
  const block = sheetBlocks.find(
    (item) => item?.field_name === fieldName
      && (item.type === SPREADSHEET_BLOCK_TYPE || item.type === 'field'),
  );
  if (!block) return { hasHeaderRow: false };
  if (block.type === SPREADSHEET_BLOCK_TYPE) {
    return { hasHeaderRow: block.hasHeaderRow !== false };
  }
  return { hasHeaderRow: false };
}

function diffTableRows(oldRows = [], newRows = [], { sheetKey = null, hasHeaderRow = false } = {}) {
  const cellChanges = [];
  const maxLen = Math.max(oldRows.length, newRows.length);

  for (let rowIndex = 0; rowIndex < maxLen; rowIndex += 1) {
    const oldRow = oldRows[rowIndex] || {};
    const newRow = newRows[rowIndex] || {};
    const colKeys = new Set([...Object.keys(oldRow), ...Object.keys(newRow)]);

    colKeys.forEach((colKey) => {
      const before = oldRow[colKey];
      const after = newRow[colKey];
      if (cellValuesEqual(before, after)) return;

      cellChanges.push({
        address: formatCellAddress(rowIndex, colKey, sheetKey, { hasHeaderRow }),
        rowIndex,
        colKey,
        sheetKey,
        before: normalizeCellValue(before),
        after: normalizeCellValue(after),
      });
    });
  }

  return cellChanges;
}

function diffSpreadsheetField(before = {}, after = {}, { hasHeaderRow = true } = {}) {
  const oldMap = stripSpreadsheetFieldValue(before);
  const newMap = stripSpreadsheetFieldValue(after);
  const sheetKeys = new Set([
    ...Object.keys(oldMap),
    ...Object.keys(newMap),
  ]);
  const cellChanges = [];

  sheetKeys.forEach((sheetKey) => {
    const oldRows = Array.isArray(oldMap[sheetKey]) ? oldMap[sheetKey] : [];
    const newRows = Array.isArray(newMap[sheetKey]) ? newMap[sheetKey] : [];
    cellChanges.push(...diffTableRows(oldRows, newRows, { sheetKey, hasHeaderRow }));
  });

  return cellChanges;
}

/**
 * Compare document field_data for proposal review UI.
 */
export function diffFieldData(before = {}, after = {}, options = {}) {
  const { sheetBlocks = null } = options;
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  const changes = [];

  keys.forEach((key) => {
    if (SPREADSHEET_META_KEYS.has(key)) return;

    const oldVal = before?.[key];
    const newVal = after?.[key];
    if (JSON.stringify(oldVal) === JSON.stringify(newVal)) return;

    const fieldMeta = getFieldDiffMeta(sheetBlocks, key);
    const oldIsSpreadsheet = isSpreadsheetFieldValue(oldVal);
    const newIsSpreadsheet = isSpreadsheetFieldValue(newVal);
    if (oldIsSpreadsheet || newIsSpreadsheet) {
      const cellChanges = diffSpreadsheetField(oldVal, newVal, {
        hasHeaderRow: fieldMeta.hasHeaderRow,
      });
      if (cellChanges.length > 0) {
        changes.push({
          field: key,
          type: 'spreadsheet',
          before: oldVal,
          after: newVal,
          cellChanges: cellChanges.slice(0, MAX_CELL_CHANGES),
          truncated: cellChanges.length > MAX_CELL_CHANGES,
        });
      }
      return;
    }

    if (isTableRowArray(oldVal) || isTableRowArray(newVal)) {
      const oldRows = Array.isArray(oldVal) ? oldVal : [];
      const newRows = Array.isArray(newVal) ? newVal : [];
      const cellChanges = diffTableRows(oldRows, newRows, {
        hasHeaderRow: fieldMeta.hasHeaderRow,
      });
      if (cellChanges.length > 0 || oldRows.length !== newRows.length) {
        changes.push({
          field: key,
          type: 'table',
          before: oldVal,
          after: newVal,
          cellChanges: cellChanges.slice(0, MAX_CELL_CHANGES),
          truncated: cellChanges.length > MAX_CELL_CHANGES,
        });
      }
      return;
    }

    changes.push({
      field: key,
      type: typeof newVal === 'object' || typeof oldVal === 'object' ? 'object' : 'scalar',
      before: oldVal,
      after: newVal,
    });
  });

  return changes;
}

export function formatDiffValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  return String(value);
}
