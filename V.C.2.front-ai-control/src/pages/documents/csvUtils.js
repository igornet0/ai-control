/**
 * RFC 4180-style CSV: escape quotes, wrap fields with commas/newlines.
 * @param {string} cell
 */
export function escapeCsvCell(cell) {
  const s = cell == null ? '' : String(cell);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * @param {Array<Record<string, string>>} rows
 * @param {Array<{ key: string, label: string }>} columns
 * @param {{ bom?: boolean }} [options]
 * @returns {string}
 */
export function rowsToCsv(rows, columns, options = {}) {
  const cols = Array.isArray(columns) && columns.length > 0 ? columns : [];
  const headerLine = cols.map((c) => escapeCsvCell(c.label ?? c.key)).join(',');
  const dataLines = (Array.isArray(rows) ? rows : []).map((row) => {
    const r = row && typeof row === 'object' ? row : {};
    return cols.map((c) => escapeCsvCell(r[c.key])).join(',');
  });
  const body = [headerLine, ...dataLines].join('\r\n');
  const bom = options.bom !== false ? '\uFEFF' : '';
  return bom + body;
}

/**
 * @param {string} filename
 * @param {string} csvText
 */
export function downloadCsvFile(filename, csvText) {
  const safeName = sanitizeFilename(filename) || 'export.csv';
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safeName.endsWith('.csv') ? safeName : `${safeName}.csv`;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Скачать несколько CSV одним ZIP (по одному файлу на лист).
 * @param {string} zipFilename
 * @param {Array<{ name: string, content: string }>} files
 */
export async function downloadCsvFilesAsZip(zipFilename, files) {
  const list = (Array.isArray(files) ? files : []).filter((f) => f && f.name);
  if (list.length === 0) return;
  if (list.length === 1) {
    downloadCsvFile(list[0].name, list[0].content ?? '');
    return;
  }
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  const used = new Set();
  list.forEach((f, i) => {
    let name = sanitizeFilename(f.name) || `sheet-${i + 1}.csv`;
    if (!name.toLowerCase().endsWith('.csv')) name = `${name}.csv`;
    let unique = name;
    let n = 2;
    while (used.has(unique.toLowerCase())) {
      unique = name.replace(/\.csv$/i, `_${n}.csv`);
      n += 1;
    }
    used.add(unique.toLowerCase());
    zip.file(unique, f.content ?? '');
  });
  const blob = await zip.generateAsync({ type: 'blob' });
  let safeZip = sanitizeFilename(zipFilename) || 'export.zip';
  if (!safeZip.toLowerCase().endsWith('.zip')) safeZip = `${safeZip}.zip`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safeZip;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function sanitizeFilename(name) {
  if (!name || typeof name !== 'string') return 'document';
  return name.replace(/[/\\?%*:|"<>]/g, '_').trim() || 'document';
}

/**
 * @param {string} filename
 * @param {unknown} data
 */
export function downloadJsonFile(filename, data) {
  const safeName = sanitizeFilename(filename) || 'export.json';
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safeName.toLowerCase().endsWith('.json') ? safeName : `${safeName}.json`;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Map CSV header row to column keys using labels or keys from template columns.
 * @param {string[]} headers
 * @param {Array<{ key: string, label: string }>} columns
 * @returns {string[]} keys in same order as headers (empty string if unmapped)
 */
export function mapCsvHeadersToKeys(headers, columns) {
  const cols = Array.isArray(columns) && columns.length > 0 ? columns : [];
  const norm = (s) => String(s ?? '').trim().toLowerCase();
  return (Array.isArray(headers) ? headers : []).map((h) => {
    const hn = norm(h);
    if (!hn) return '';
    const byKey = cols.find((c) => norm(c.key) === hn);
    if (byKey) return byKey.key;
    const byLabel = cols.find((c) => norm(c.label) === hn);
    if (byLabel) return byLabel.key;
    return '';
  });
}

/**
 * Build row objects from parsed CSV rows using header->key mapping.
 * @param {string[][]} dataRows — rows after header
 * @param {string[]} headerKeys — key per column index (from mapCsvHeadersToKeys)
 */
export function csvRowsToFieldRows(dataRows, headerKeys) {
  const keys = Array.isArray(headerKeys) ? headerKeys : [];
  return (Array.isArray(dataRows) ? dataRows : []).map((cells) => {
    const row = {};
    keys.forEach((key, i) => {
      if (!key) return;
      const v = cells[i];
      row[key] = v != null ? String(v) : '';
    });
    return row;
  });
}

/**
 * Convert PapaParse result (header: true) to field_data rows using column keys/labels.
 * Falls back to column order if headers do not match.
 * @param {{ data: object[], meta: { fields?: string[] } }} parseResult
 * @param {Array<{ key: string, label: string }>} columns
 * @returns {Array<Record<string, string>>}
 */
export function papaResultToFieldRows(parseResult, columns) {
  const cols = Array.isArray(columns) && columns.length > 0 ? columns : [];
  const data = Array.isArray(parseResult?.data) ? parseResult.data : [];
  const headers = Array.isArray(parseResult?.meta?.fields) ? parseResult.meta.fields : [];
  if (cols.length === 0 || data.length === 0) return [];

  const keysByHeaderIndex = mapCsvHeadersToKeys(headers, cols);

  const byMapping = data.map((row) => {
    if (!row || typeof row !== 'object') return null;
    const obj = {};
    headers.forEach((h, i) => {
      const k = keysByHeaderIndex[i];
      if (!k) return;
      const v = row[h];
      obj[k] = v != null && v !== '' ? String(v) : '';
    });
    return obj;
  });

  if (!keysByHeaderIndex.every((k) => !k)) {
    return byMapping.filter((r) => r && Object.keys(r).length > 0);
  }

  return data.map((row) => {
    if (!row || typeof row !== 'object') return {};
    const vals = headers.map((h) => row[h]);
    const obj = {};
    cols.forEach((c, i) => {
      if (vals[i] != null && vals[i] !== '') obj[c.key] = String(vals[i]);
    });
    return obj;
  }).filter((r) => Object.keys(r).length > 0);
}
