/**
 * Schema detection from folder data files (CSV/XLSX).
 */

import * as XLSX from 'xlsx';

export async function readExcelFirstRows(file, maxRows = 25, sheetName = null) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
  const sheetNames = workbook.SheetNames || [];
  if (!sheetNames.length) return [];
  const target = sheetName || sheetNames[0];
  const worksheet = workbook.Sheets[target];
  if (!worksheet) return [];
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  return jsonData.slice(0, maxRows);
}

export async function readCsvFirstRows(file, maxRows = 5) {
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, maxRows);
  return lines.map((line) => line.split(/[,;\t]/).map((c) => c.trim()));
}

export function headersFromRows(rows, headerRow = 1) {
  const idx = Math.max(0, (headerRow || 1) - 1);
  const row = rows[idx];
  if (!row) return [];
  return row
    .map((cell) => (cell == null ? '' : String(cell).trim()))
    .filter(Boolean);
}

export function inferFieldType(name) {
  const n = String(name).toLowerCase();
  if (n.includes('date') || n.includes('time')) return 'date';
  if (n.endsWith('_id') || n === 'id') return 'int';
  if (n.includes('amount') || n.includes('price') || n.includes('sum')) return 'number';
  return 'string';
}

export function fieldsFromHeaders(headers) {
  return headers.map((name, i) => ({
    name,
    type: inferFieldType(name),
    source: 'file',
    required: false,
    originalIndex: i,
  }));
}

export async function detectFileHeaders(fileInfo, resolveFileFn, options = {}) {
  const headerRow = options.headerRow ?? 1;
  const sheet = options.sheet ?? null;
  try {
    const file = await resolveFileFn(fileInfo);
    if (!file) return { headers: [], fields: [], error: 'Файл недоступен' };

    const name = fileInfo.name || file.name || '';
    const ext = name.split('.').pop()?.toLowerCase() || '';

    let rows = [];
    if (ext === 'xlsx' || ext === 'xls') {
      rows = await readExcelFirstRows(file, 25, sheet);
    } else if (ext === 'csv') {
      rows = await readCsvFirstRows(file, 10);
    } else {
      return { headers: [], fields: [], error: 'Неподдерживаемый формат' };
    }

    const headers = headersFromRows(rows, headerRow);
    return {
      headers,
      fields: fieldsFromHeaders(headers),
      headerRow,
      error: headers.length ? null : 'Заголовки не найдены',
    };
  } catch (err) {
    return { headers: [], fields: [], error: err.message };
  }
}

export async function detectGroupSchema(groupFiles, resolveFileFn, existingSchema = {}, options = {}) {
  const headerRow = existingSchema.excelHeaderRow ?? 1;
  const sampleSize = options.sampleSize ?? 3;
  const allFiles = groupFiles || [];
  const filesToScan = allFiles.slice(0, Math.max(1, sampleSize));
  const fileResults = [];

  for (const file of filesToScan) {
    const perFile = existingSchema.perFile || {};
    const key = file.path || file.relativePath || file.smbPath || file.name;
    const cfg = perFile[key] || {};
    const result = await detectFileHeaders(file, resolveFileFn, {
      headerRow: cfg.headerRow ?? headerRow,
      sheet: cfg.sheet,
    });
    fileResults.push({
      ...file,
      ...result,
      path: key,
    });
  }

  const headerSets = fileResults.map((f) =>
    new Set((f.headers || []).map((h) => h.toLowerCase().trim()).filter(Boolean)),
  );

  const unionFields = new Map();
  for (const fr of fileResults) {
    for (const field of fr.fields || []) {
      if (!unionFields.has(field.name.toLowerCase())) {
        unionFields.set(field.name.toLowerCase(), field);
      }
    }
  }

  const uniqueSets = new Set(headerSets.map((s) => [...s].sort().join('\0')));
  const headerWarnings = [];
  if (uniqueSets.size > 1) {
    headerWarnings.push('Файлы в группе имеют разные наборы заголовков');
  }
  if (allFiles.length > filesToScan.length) {
    headerWarnings.push(
      `Схема определена по ${filesToScan.length} из ${allFiles.length} файлов`,
    );
  }

  return {
    excelHeaderRow: headerRow,
    fields: Array.from(unionFields.values()),
    perFile: existingSchema.perFile || {},
    groupSync: existingSchema.groupSync !== false,
    headerWarnings,
    fileResults,
  };
}
