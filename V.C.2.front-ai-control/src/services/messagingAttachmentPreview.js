import Papa from 'papaparse';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { getAttachmentUrl } from './messagingBaseUrl';
import { getAccessToken } from './tokenRefresh';

/** @typedef {'image'|'pdf'|'video'|'csv'|'excel'|'word'|'text'|'file'} AttachmentPreviewKind */

const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'mov', 'm4v', 'mkv', 'ogv']);
const PREVIEW_MAX_ROWS = 200;
const CSV_PARTIAL_BYTES = 1024 * 1024;
const EXCEL_MAX_FULL_BYTES = 4 * 1024 * 1024;

/**
 * @param {{ mime_type?: string, original_filename?: string, is_image?: boolean }} att
 * @returns {AttachmentPreviewKind}
 */
export function getAttachmentPreviewKind(att) {
  if (att?.is_image || att?.mime_type?.startsWith('image/')) return 'image';
  const name = String(att?.original_filename || '').toLowerCase();
  const ext = name.includes('.') ? name.split('.').pop() : '';
  const mime = String(att?.mime_type || '').toLowerCase();

  if (mime.startsWith('video/') || VIDEO_EXTENSIONS.has(ext)) return 'video';
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (mime.includes('csv') || ext === 'csv') return 'csv';
  if (
    mime.includes('spreadsheet') ||
    mime.includes('excel') ||
    ext === 'xlsx' ||
    ext === 'xls'
  ) {
    return 'excel';
  }
  if (
    mime.includes('wordprocessingml') ||
    mime === 'application/msword' ||
    ext === 'docx' ||
    ext === 'doc'
  ) {
    return 'word';
  }
  if (mime.startsWith('text/') || ['txt', 'json', 'xml', 'html', 'htm', 'md'].includes(ext)) {
    return 'text';
  }
  return 'file';
}

export function isPreviewableAttachment(att) {
  const kind = getAttachmentPreviewKind(att);
  return kind !== 'file' || att?.is_image;
}

function getAuthHeaders(extra = {}) {
  const token = getAccessToken() || '';
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

/**
 * @param {number} attachmentId
 * @returns {Promise<Blob>}
 */
export async function fetchAttachmentBlob(attachmentId) {
  const url = getAttachmentUrl(attachmentId);
  const response = await fetch(url, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Не удалось загрузить файл (${response.status})`);
  }
  return response.blob();
}

/**
 * @param {number} attachmentId
 * @param {number} start
 * @param {number} end
 * @param {AbortSignal} [signal]
 * @returns {Promise<ArrayBuffer>}
 */
async function fetchAttachmentRange(attachmentId, start, end, signal) {
  const url = getAttachmentUrl(attachmentId);
  const response = await fetch(url, {
    headers: getAuthHeaders({ Range: `bytes=${start}-${end}` }),
    signal,
  });
  if (response.status !== 206 && response.status !== 200) {
    throw new Error(`Не удалось загрузить файл (${response.status})`);
  }
  return response.arrayBuffer();
}

function parseCsvText(text, { partial = false, maxRows = PREVIEW_MAX_ROWS } = {}) {
  let trimmed = text;
  let incompleteLastLine = false;
  if (partial && trimmed.length > 0 && !trimmed.endsWith('\n')) {
    const lastNl = Math.max(trimmed.lastIndexOf('\n'), trimmed.lastIndexOf('\r'));
    if (lastNl >= 0) {
      trimmed = trimmed.slice(0, lastNl + 1);
      incompleteLastLine = true;
    }
  }
  const parsed = Papa.parse(trimmed, { skipEmptyLines: true });
  if (parsed.errors?.length) {
    throw new Error(parsed.errors[0]?.message || 'Ошибка разбора CSV');
  }
  const rows = parsed.data || [];
  if (!rows.length) {
    return { headers: [], rows: [], truncated: partial || incompleteLastLine };
  }
  const headers = rows[0].map((cell, idx) => String(cell ?? `Колонка ${idx + 1}`));
  const body = rows.slice(1, maxRows + 1).map((row) =>
    headers.map((_, idx) => String(row?.[idx] ?? ''))
  );
  const truncated = partial || incompleteLastLine || rows.length - 1 > maxRows;
  return { headers, rows: body, truncated };
}

function parseExcelBuffer(arrayBuffer, maxRows = PREVIEW_MAX_ROWS) {
  const workbook = XLSX.read(arrayBuffer, { type: 'array', sheetRows: maxRows + 1 });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { headers: [], rows: [], sheetName: '', truncated: false };
  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (!matrix.length) return { headers: [], rows: [], sheetName, truncated: false };
  const headers = matrix[0].map((cell, idx) => String(cell ?? `Колонка ${idx + 1}`));
  const rows = matrix.slice(1, maxRows + 1).map((row) =>
    headers.map((_, idx) => String(row?.[idx] ?? ''))
  );
  const truncated = matrix.length > maxRows + 1;
  return { headers, rows, sheetName, truncated };
}

async function loadCsvPreview(att) {
  const filename = att.original_filename || 'file.csv';
  const size = Number(att.size_bytes) || 0;

  if (size > 0 && size <= CSV_PARTIAL_BYTES) {
    const blob = await fetchAttachmentBlob(att.id);
    const text = await blob.text();
    const table = parseCsvText(text, { maxRows: PREVIEW_MAX_ROWS });
    if (size > 0) table.totalSizeBytes = size;
    return { kind: 'csv', filename, table };
  }

  const end = size > 0 ? Math.min(size - 1, CSV_PARTIAL_BYTES - 1) : CSV_PARTIAL_BYTES - 1;
  const buffer = await fetchAttachmentRange(att.id, 0, end);
  const text = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
  const table = parseCsvText(text, { partial: true, maxRows: PREVIEW_MAX_ROWS });
  table.truncated = true;
  if (size > 0) table.totalSizeBytes = size;
  return { kind: 'csv', filename, table };
}

async function streamExcelPreview(att, maxRows = PREVIEW_MAX_ROWS) {
  const ExcelJS = (await import('exceljs')).default;
  const url = getAttachmentUrl(att.id);
  const controller = new AbortController();
  const size = Number(att.size_bytes) || 0;

  const response = await fetch(url, {
    headers: getAuthHeaders(),
    signal: controller.signal,
  });
  if (!response.ok) {
    throw new Error(`Не удалось загрузить файл (${response.status})`);
  }

  const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(response.body, {
    worksheets: 'emit',
    sharedStrings: 'cache',
    hyperlinks: 'ignore',
    styles: 'ignore',
  });

  let sheetName = '';
  let headers = [];
  const rows = [];
  let truncated = false;

  try {
    outer: for await (const worksheetReader of workbookReader) {
      sheetName = worksheetReader.name;
      for await (const row of worksheetReader) {
        const values = [];
        let maxCol = 0;
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          maxCol = Math.max(maxCol, colNumber);
          values[colNumber - 1] = cell.text ?? '';
        });
        for (let i = 0; i < maxCol; i += 1) {
          if (values[i] === undefined) values[i] = '';
        }

        if (row.number === 1) {
          headers = values.map((cell, idx) => String(cell || `Колонка ${idx + 1}`));
          continue;
        }

        rows.push(headers.map((_, idx) => String(values[idx] ?? '')));

        if (rows.length >= maxRows) {
          truncated = true;
          controller.abort();
          break outer;
        }
      }
      break;
    }
  } catch (err) {
    if (err?.name !== 'AbortError' && !truncated) {
      throw err;
    }
  }

  return {
    headers,
    rows,
    sheetName,
    truncated: truncated || size > EXCEL_MAX_FULL_BYTES,
    totalSizeBytes: size > 0 ? size : undefined,
  };
}

async function loadExcelPreview(att) {
  const filename = att.original_filename || 'file.xlsx';
  const ext = filename.toLowerCase().split('.').pop() || '';
  const size = Number(att.size_bytes) || 0;

  if (ext === 'xls') {
    if (size > EXCEL_MAX_FULL_BYTES) {
      return {
        kind: 'excel',
        filename,
        table: {
          headers: [],
          rows: [],
          truncated: true,
          totalSizeBytes: size,
          message:
            'Файл .xls слишком большой для предпросмотра. Скачайте файл для полного просмотра.',
        },
      };
    }
    const buffer = await fetchAttachmentBlob(att.id).then((b) => b.arrayBuffer());
    const table = parseExcelBuffer(buffer);
    if (size > 0) table.totalSizeBytes = size;
    return { kind: 'excel', filename, table };
  }

  if (size > 0 && size <= EXCEL_MAX_FULL_BYTES) {
    const buffer = await fetchAttachmentBlob(att.id).then((b) => b.arrayBuffer());
    const table = parseExcelBuffer(buffer);
    if (size > 0) table.totalSizeBytes = size;
    return { kind: 'excel', filename, table };
  }

  try {
    const table = await streamExcelPreview(att);
    return { kind: 'excel', filename, table };
  } catch (err) {
    console.warn('Excel streaming preview failed:', err);
    if (size > 0 && size <= EXCEL_MAX_FULL_BYTES * 2) {
      const buffer = await fetchAttachmentBlob(att.id).then((b) => b.arrayBuffer());
      const table = parseExcelBuffer(buffer);
      table.truncated = true;
      table.totalSizeBytes = size;
      return { kind: 'excel', filename, table };
    }
    throw err;
  }
}

/**
 * @param {{ id: number, mime_type?: string, original_filename?: string, is_image?: boolean, size_bytes?: number }} att
 */
export async function loadAttachmentPreview(att) {
  const kind = getAttachmentPreviewKind(att);
  const filename = att.original_filename || 'file';

  if (kind === 'video') {
    return {
      kind,
      filename,
      src: getAttachmentUrl(att.id),
      mimeType: att.mime_type || 'video/mp4',
    };
  }

  if (kind === 'csv') {
    return loadCsvPreview(att);
  }

  if (kind === 'excel') {
    return loadExcelPreview(att);
  }

  const blob = await fetchAttachmentBlob(att.id);

  if (kind === 'pdf') {
    const pdfBlob =
      blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' });
    return {
      kind,
      filename,
      blobUrl: URL.createObjectURL(pdfBlob),
    };
  }

  if (kind === 'word') {
    if (filename.toLowerCase().endsWith('.doc')) {
      return {
        kind: 'file',
        filename,
        message: 'Формат .doc не поддерживает предпросмотр. Скачайте файл.',
      };
    }
    const result = await mammoth.convertToHtml({ arrayBuffer: await blob.arrayBuffer() });
    return { kind, filename, html: result.value || '<p>Пустой документ</p>' };
  }

  if (kind === 'text') {
    const text = await blob.text();
    return { kind, filename, text };
  }

  return { kind: 'file', filename, message: 'Предпросмотр недоступен' };
}

export function revokePreviewState(preview) {
  if (preview?.blobUrl) URL.revokeObjectURL(preview.blobUrl);
}

export function formatPreviewBytes(bytes) {
  if (!bytes || bytes <= 0) return '';
  const units = ['Б', 'КБ', 'МБ', 'ГБ'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}
