/**
 * DataCode sync for JSON sources — same source_table(...) pattern as API ingest.
 *
 *   global source_112 = source_table("source_112", ["id", "name"])
 *   print(table_info(source_112))
 */

export {
  buildApiSourceAssignmentLine as buildJsonSourceAssignmentLine,
  buildSourceTableColumnsArg as buildJsonSourceColumnsArg,
  findSourceTableAssignment,
  generateDefaultApiSourceCode as generateDefaultJsonSourceCode,
  patchApiSourceInCode as patchJsonSourceInCode,
  resolveApiDataCodeVariableName as resolveJsonDataCodeVariableName,
  resolveApiTableName as resolveJsonTableName,
  stripHiddenWsImport,
} from './apiSourceDataCodeSync.js';

import { sanitizeTableName, defaultTableName } from '../apiIngestSourceUtils.js';

/**
 * Ensure tableName is set for a JSON widget (source_<id>).
 */
export function ensureJsonTableName(settings, widget) {
  const existing = sanitizeTableName(settings?.tableName || '');
  if (settings?.tableName && existing !== 'source_data') {
    return existing;
  }
  return defaultTableName(widget || { settings });
}

/**
 * Parse JSON text into column names + preview row objects.
 * Accepts: array of objects, { rows: [...] }, or columnar { col: [...] }.
 */
export function parseJsonTextToTable(text) {
  const raw = String(text || '').trim();
  if (!raw) {
    return { columns: [], rows: [], error: 'Пустой JSON' };
  }
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (err) {
    return { columns: [], rows: [], error: `Некорректный JSON: ${err.message}` };
  }

  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const values = Object.values(payload);
    const isColumnar = values.length > 0 && values.every((v) => Array.isArray(v));
    if (isColumnar) {
      const columns = Object.keys(payload).map((k) => String(k));
      const rowCount = Math.max(0, ...columns.map((c) => (payload[c] || []).length));
      const rows = [];
      for (let i = 0; i < Math.min(rowCount, 50); i += 1) {
        const row = {};
        columns.forEach((c) => {
          row[c] = payload[c]?.[i] != null ? payload[c][i] : '';
        });
        rows.push(row);
      }
      return { columns, rows, error: null };
    }
    if (Array.isArray(payload.rows)) {
      payload = payload.rows;
    } else {
      return {
        columns: [],
        rows: [],
        error: 'JSON должен быть массивом объектов, { rows: [...] } или columnar { col: [...] }',
      };
    }
  }

  if (!Array.isArray(payload)) {
    return { columns: [], rows: [], error: 'JSON должен быть массивом объектов' };
  }
  if (!payload.length) {
    return { columns: [], rows: [], error: 'JSON не содержит строк' };
  }

  const columns = [];
  const seen = new Set();
  payload.forEach((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return;
    Object.keys(item).forEach((key) => {
      if (!seen.has(key)) {
        seen.add(key);
        columns.push(key);
      }
    });
  });

  const rows = payload.slice(0, 50).map((item) => {
    const row = {};
    columns.forEach((c) => {
      const v = item?.[c];
      row[c] = v != null && typeof v === 'object' ? JSON.stringify(v) : (v ?? '');
    });
    return row;
  });

  return { columns, rows, error: columns.length ? null : 'В JSON нет колонок' };
}
