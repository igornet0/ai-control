import { parseDbWidgetId } from './widgetDbSync.js';

const TABLE_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]{0,127}$/;

/** @typedef {'pending'|'stored'|'deployed'|'failed'} DeployStatus */
/** @typedef {'snapshot'|'stream'|'append'} IngestMode */

/** Surrogate PK column created by append ingest (must stay in schema / source_table). */
export const APPEND_ROW_ID_COLUMN = 'row_id';

/**
 * Ensure append `row_id` stays selected and listed for DataCode / UI.
 * @param {string[]} columns
 * @param {'snapshot'|'stream'|'append'|string|null|undefined} mode
 * @returns {string[]}
 */
export function ensureAppendRowIdColumn(columns, mode) {
  const list = Array.isArray(columns) ? columns.filter(Boolean) : [];
  if (mode !== 'append') return list;
  if (list.includes(APPEND_ROW_ID_COLUMN)) {
    return [APPEND_ROW_ID_COLUMN, ...list.filter((c) => c !== APPEND_ROW_ID_COLUMN)];
  }
  return [APPEND_ROW_ID_COLUMN, ...list];
}

/**
 * @param {string} name
 * @returns {string}
 */
export function sanitizeTableName(name) {
  const raw = String(name || '').trim();
  if (!raw) return 'source_data';
  let out = raw
    .replace(/[^\w]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_{2,}/g, '_');
  if (!out) return 'source_data';
  if (/^[0-9]/.test(out)) out = `t_${out}`;
  if (!TABLE_NAME_RE.test(out)) {
    out = out.replace(/[^A-Za-z0-9_]/g, '').slice(0, 128);
    if (!out || !TABLE_NAME_RE.test(out)) return 'source_data';
  }
  return out;
}

/**
 * @param {{ id?: string|number, settings?: { name?: string } }} widget
 * @returns {string}
 */
export function defaultTableName(widget) {
  const widgetId = parseDbWidgetId(widget);
  if (widgetId) return `source_${widgetId}`;
  const fromName = sanitizeTableName(widget?.settings?.name || '');
  return fromName === 'source_data' ? 'source_data' : fromName;
}

/**
 * Build the Developer API documentation URL with apiBase query param.
 * @param {{ docs_url?: string, base_url?: string }|null|undefined} devInfo
 * @returns {string}
 */
export function buildDeveloperDocsUrl(devInfo) {
  if (!devInfo?.docs_url) return '/developer-api-docs';
  const base = devInfo.base_url ? `?apiBase=${encodeURIComponent(devInfo.base_url)}` : '';
  return `${devInfo.docs_url}${base}`;
}

/**
 * @param {string} devBase
 * @param {string} tableName
 * @returns {string}
 */
export function buildIngestUrl(devBase, tableName) {
  const base = String(devBase || 'http://127.0.0.1:8002').replace(/\/$/, '');
  const table = sanitizeTableName(tableName);
  return `${base}/api/v1/ingest/tables/${encodeURIComponent(table)}`;
}

/**
 * @param {string} url
 * @param {'snapshot'|'stream'|'append'} mode
 * @returns {{ csv: string, json: string, columnar: string }}
 */
export function buildCurlExamples(url, mode = 'snapshot') {
  const sep = url.includes('?') ? '&' : '?';
  const withMode = `${url}${sep}mode=${mode}`;
  const csv = `curl -X POST "${withMode}" \\
  -H "X-API-Key: aic_YOUR_KEY" \\
  -H "Content-Type: text/csv" \\
  --data-binary @data.csv`;

  const json = `curl -X POST "${withMode}" \\
  -H "X-API-Key: aic_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '[{"id": 1, "name": "example"}]'`;

  const columnar = `curl -X POST "${withMode}" \\
  -H "X-API-Key: aic_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"id": [1, 2], "name": ["alpha", "beta"]}'`;

  return { csv, json, columnar };
}

/**
 * @param {DeployStatus|string|null|undefined} status
 * @returns {string}
 */
export function deployStatusLabel(status) {
  switch (status) {
    case 'pending':
      return 'В очереди деплоя';
    case 'stored':
      return 'Данные сохранены (ожидает сборку модели)';
    case 'deployed':
      return 'Деплой выполнен';
    case 'failed':
      return 'Ошибка деплоя';
    default:
      return 'Ожидание данных';
  }
}

/**
 * @param {DeployStatus|string|null|undefined} status
 * @returns {'waiting'|'pending'|'ok'|'error'}
 */
export function deployStatusTone(status) {
  switch (status) {
    case 'pending':
      return 'pending';
    case 'stored':
    case 'deployed':
      return 'ok';
    case 'failed':
      return 'error';
    default:
      return 'waiting';
  }
}

/**
 * @param {object} processingConfig
 * @param {string} tableName
 * @returns {{
 *   lastIngestAt?: string,
 *   lastRowCount?: number,
 *   mode?: string,
 *   deploy_status?: DeployStatus,
 *   deploy_error?: string,
 *   last_request_id?: number,
 *   schema_hash?: string,
 *   columns?: string[],
 * }|null}
 */
export function getTableIngestStatus(processingConfig, tableName) {
  const table = sanitizeTableName(tableName);
  const ingest = processingConfig?.ingest;
  const tables = ingest?.tables;
  if (!tables || typeof tables !== 'object') return null;
  const cfg = tables[table];
  if (!cfg || typeof cfg !== 'object') return null;
  return cfg;
}

/**
 * @param {Array<Record<string, unknown>>} rows
 * @returns {string[]}
 */
export function columnsFromPreviewRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const seen = new Set();
  const columns = [];
  rows.forEach((row) => {
    if (!row || typeof row !== 'object') return;
    Object.keys(row).forEach((key) => {
      if (!seen.has(key)) {
        seen.add(key);
        columns.push(key);
      }
    });
  });
  return columns;
}
