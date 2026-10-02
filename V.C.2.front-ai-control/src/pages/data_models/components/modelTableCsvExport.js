import { dataModelService } from '../../../services/dataModelService';
import { rowsToCsv, downloadCsvFile, sanitizeFilename } from '../../documents/csvUtils';

const FETCH_CHUNK = 500;

function formatCell(value) {
  if (value == null) return '';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

/**
 * Fetch all rows of a model table (paginated API, max 500 per request).
 * @returns {Promise<{ columns: string[], rows: Record<string, unknown>[] }>}
 */
export async function fetchAllModelTableRows(modelId, tableName) {
  const allRows = [];
  let columns = [];
  let offset = 0;
  let total = Infinity;

  while (offset < total) {
    const res = await dataModelService.getModelTableRows(modelId, tableName, {
      limit: FETCH_CHUNK,
      offset,
      includeSource: false,
    });
    columns = res.columns?.length ? res.columns : columns;
    const rows = Array.isArray(res.rows) ? res.rows : [];
    total = Number(res.total) || 0;
    allRows.push(...rows);
    if (rows.length === 0) break;
    offset += rows.length;
  }

  const displayColumns = (columns || []).filter((c) => !String(c).startsWith('_'));
  return { columns: displayColumns, rows: allRows };
}

/**
 * Download selected model table as CSV (all rows, user-visible columns only).
 */
export async function downloadModelTableCsv(modelId, tableName) {
  const { columns, rows } = await fetchAllModelTableRows(modelId, tableName);
  const colDefs = columns.map((c) => ({ key: c, label: c }));
  const formattedRows = rows.map((row) => {
    const out = {};
    for (const col of columns) {
      out[col] = formatCell(row[col]);
    }
    return out;
  });
  const csv = rowsToCsv(formattedRows, colDefs);
  downloadCsvFile(`${sanitizeFilename(tableName)}.csv`, csv);
}
