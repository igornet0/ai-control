/** Тип блока листа: сетка как в Google Таблицах */
export const SPREADSHEET_BLOCK_TYPE = 'spreadsheet';

export const CELL_TYPES = [
  { value: 'text', label: 'Текст' },
  { value: 'number', label: 'Число' },
  { value: 'date', label: 'Дата' },
  { value: 'currency', label: 'Валюта' },
];

/** Тип данных столбца (шаблон) — проверка при заполнении документа */
export const COLUMN_DATA_TYPES = [
  { value: 'string', label: 'Текст' },
  { value: 'number', label: 'Число' },
  { value: 'date', label: 'Дата' },
  { value: 'boolean', label: 'Да/Нет' },
];

const DEFAULT_COLUMN_DATA_TYPE = 'string';

export function normalizeColumnDataType(dt) {
  const s = String(dt || '').toLowerCase();
  if (s === 'text') return 'string';
  if (s === 'currency') return 'number';
  if (['string', 'number', 'date', 'boolean'].includes(s)) return s;
  return DEFAULT_COLUMN_DATA_TYPE;
}

/** @returns {number|null} */
export function parseNumericCellValue(raw, dataType) {
  if (raw == null || String(raw).trim() === '') return null;
  const dt = normalizeColumnDataType(dataType);
  if (dt === 'boolean' || dt === 'date') return null;
  const s = String(raw).trim().replace(/\s/g, '').replace(/%/g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {string|undefined} raw
 * @param {string|undefined} dataType
 * @returns {{ ok: boolean, message?: string }}
 */
export function validateCellValueForColumnType(raw, dataType) {
  const dt = normalizeColumnDataType(dataType);
  const s = raw == null ? '' : String(raw).trim();
  if (s === '') return { ok: true };
  if (s.startsWith('=') && s.length > 1) return { ok: true };

  if (dt === 'string') return { ok: true };

  if (dt === 'number') {
    const n = Number(String(s).replace(/\s/g, '').replace(',', '.'));
    if (Number.isFinite(n)) return { ok: true };
    return { ok: false, message: 'Ожидается число' };
  }

  if (dt === 'date') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const d = new Date(`${s}T12:00:00`);
      if (!Number.isNaN(d.getTime())) return { ok: true };
    }
    const m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/);
    if (m) {
      const d2 = parseInt(m[1], 10);
      const mo = parseInt(m[2], 10) - 1;
      let y = parseInt(m[3], 10);
      if (y < 100) y += y < 70 ? 2000 : 1900;
      const d = new Date(y, mo, d2);
      if (d.getFullYear() === y && d.getMonth() === mo && d.getDate() === d2) return { ok: true };
    }
    const t = Date.parse(s);
    if (!Number.isNaN(t)) return { ok: true };
    return { ok: false, message: 'Ожидается дата (ДД.ММ.ГГГГ или ГГГГ-ММ-ДД)' };
  }

  if (dt === 'boolean') {
    const low = s.toLowerCase();
    if (['да', 'нет', 'yes', 'no', 'true', 'false', '1', '0', 'д', 'н', 'y', 'n'].includes(low)) {
      return { ok: true };
    }
    return { ok: false, message: 'Введите: да, нет, 1 или 0' };
  }

  return { ok: true };
}

function columnDataTypesAligned(model, colCount) {
  return columnMetadataAligned(model, colCount).map((m) => m.dataType);
}

/** Метаданные столбцов (тип + значение по умолчанию для новых строк). */
function columnMetadataAligned(model, colCount) {
  const prev = Array.isArray(model.tableColumns) ? model.tableColumns : [];
  const meta = [];
  for (let c = 0; c < colCount; c += 1) {
    if (c < prev.length && prev[c]) {
      meta.push({
        dataType: normalizeColumnDataType(prev[c].dataType),
        defaultValue: prev[c].defaultValue != null ? String(prev[c].defaultValue) : '',
      });
    } else {
      meta.push({ dataType: DEFAULT_COLUMN_DATA_TYPE, defaultValue: '' });
    }
  }
  return meta;
}

function resolveTableColumns(model) {
  const colCount = model.colCount ?? SPREADSHEET_MIN_DIM;
  if (Array.isArray(model.tableColumns) && model.tableColumns.length >= colCount) {
    return model.tableColumns;
  }
  return gridModelToTableColumns(model);
}

function isApplicableColumnDefault(def) {
  const s = def == null ? '' : String(def).trim();
  return s !== '' && s !== '=';
}

/**
 * Заполнить строку r значениями по умолчанию из tableColumns (только пустые ячейки).
 */
export function applyColumnDefaultsToRow(cells, r, colCount, tableColumns, hasHeaderRow) {
  if (hasHeaderRow && r === 0) return cells;
  const cols = Array.isArray(tableColumns) ? tableColumns : [];
  let next = cells;
  for (let c = 0; c < colCount; c += 1) {
    const def = cols[c]?.defaultValue;
    if (!isApplicableColumnDefault(def)) continue;
    const prev = getCellState(cells, r, c);
    if (prev.value != null && String(prev.value).trim() !== '') continue;
    next = ensureCellPatch(next, r, c, { value: String(def) });
  }
  return next;
}

export function applyColumnDefaultToColumn(cells, c, rowCount, tableColumns, hasHeaderRow) {
  const def = tableColumns[c]?.defaultValue;
  if (!isApplicableColumnDefault(def)) return cells;
  const dataStart = hasHeaderRow ? 1 : 0;
  let next = cells;
  for (let r = dataStart; r < rowCount; r += 1) {
    const prev = getCellState(cells, r, c);
    if (prev.value != null && String(prev.value).trim() !== '') continue;
    next = ensureCellPatch(next, r, c, { value: String(def) });
  }
  return next;
}

/**
 * Изменить размер сетки: новые строки/столбцы получают значения по умолчанию.
 */
export function resizeSheetGrid(model, nextRowCount, nextColCount) {
  const nr = Math.max(SPREADSHEET_MIN_DIM, Math.min(SPREADSHEET_MAX_DIM, nextRowCount));
  const nc = Math.max(SPREADSHEET_MIN_DIM, Math.min(SPREADSHEET_MAX_DIM, nextColCount));
  const { rowCount, colCount, cells = {}, hasHeaderRow, columnNames } = model;
  const meta = columnMetadataAligned(model, Math.max(colCount, nc));
  let nextCells = { ...cells };
  const cols = tableColumnsFromMetadata(model, nc, meta);

  if (nr > rowCount) {
    for (let r = rowCount; r < nr; r += 1) {
      nextCells = applyColumnDefaultsToRow(nextCells, r, nc, cols, hasHeaderRow);
      nextCells = applyRowStyleFromAbove(nextCells, r, nc);
    }
  }

  if (nc > colCount) {
    for (let c = colCount; c < nc; c += 1) {
      nextCells = applyColumnDefaultToColumn(nextCells, c, Math.max(nr, rowCount), cols, hasHeaderRow);
    }
  }

  const nextModel = {
    ...model,
    rowCount: nr,
    colCount: nc,
    cells: nextCells,
    columnNames: padColumnNames(columnNames, nc),
    tableColumns: cols,
  };
  return {
    ...nextModel,
    summary: model.summary,
  };
}

function tableColumnsFromMetadata(model, colCount, metadata) {
  const { cells = {}, hasHeaderRow, columnNames = [] } = model;
  const names = padColumnNames(columnNames, colCount);
  const cols = [];
  for (let c = 0; c < colCount; c += 1) {
    const key = `col_${c}`;
    let label;
    if (hasHeaderRow) {
      const v = getCellState(cells, 0, c).value?.trim();
      label = v || `Столбец ${excelColumnLabel(c)}`;
    } else {
      const cn = (names[c] && String(names[c]).trim()) || '';
      label = cn || `Столбец ${excelColumnLabel(c)}`;
    }
    const m = metadata[c] || { dataType: DEFAULT_COLUMN_DATA_TYPE, defaultValue: '' };
    cols.push({
      key,
      label,
      dataType: m.dataType,
      defaultValue: m.defaultValue ?? '',
    });
  }
  return cols;
}

/**
 * Дата ячейки → YYYY-MM-DD для нативного поля type=date, или null при невозможности разбора.
 * @param {unknown} raw
 * @returns {string|null}
 */
export function toHtmlDateValue(raw) {
  const t = String(raw ?? '').trim();
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/);
  if (m) {
    const d0 = parseInt(m[1], 10);
    const m0 = parseInt(m[2], 10) - 1;
    let y0 = parseInt(m[3], 10);
    if (y0 < 100) y0 += y0 < 70 ? 2000 : 1900;
    const dt = new Date(y0, m0, d0);
    if (dt.getFullYear() === y0 && dt.getMonth() === m0 && dt.getDate() === d0) {
      const p = (n) => String(n).padStart(2, '0');
      return `${y0}-${p(m0 + 1)}-${p(d0)}`;
    }
  }
  const p2 = Date.parse(t);
  if (!Number.isNaN(p2)) {
    const d2 = new Date(p2);
    if (!Number.isNaN(d2.getTime())) {
      const p = (n) => String(n).padStart(2, '0');
      return `${d2.getFullYear()}-${p(d2.getMonth() + 1)}-${p(d2.getDate())}`;
    }
  }
  return null;
}

/**
 * Нативный date-контрол или свободный текст (неразборчивая дата).
 * @returns {{ useNative: boolean, value: string }}
 */
export function prepareDateInputForControl(raw) {
  const t = String(raw ?? '').trim();
  if (t === '') return { useNative: true, value: '' };
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return { useNative: true, value: t };
  const iso = toHtmlDateValue(t);
  if (iso) return { useNative: true, value: iso };
  return { useNative: false, value: t };
}

const BOOL_YES = 'да';
const BOOL_NO = 'нет';

/**
 * @param {unknown} raw
 * @returns {string} — '', 'да' или 'нет' для &lt;select&gt;
 */
export function booleanToSelectValue(raw) {
  const t = String(raw ?? '').trim().toLowerCase();
  if (!t) return '';
  if (['да', 'д', 'yes', 'y', 'true', '1'].includes(t)) return BOOL_YES;
  if (['нет', 'н', 'no', 'n', 'false', '0'].includes(t)) return BOOL_NO;
  return '';
}

/**
 * @param {string} sel
 * @returns {string}
 */
export function valueFromBooleanSelect(sel) {
  if (sel === BOOL_YES) return BOOL_YES;
  if (sel === BOOL_NO) return BOOL_NO;
  if (sel === '1') return '1';
  if (sel === '0') return '0';
  return '';
}

/** Значение по умолчанию столбца для select (да/нет/1/0). */
export function columnDefaultBooleanSelectValue(raw) {
  const t = String(raw ?? '').trim();
  if (!t) return '';
  if (t === '1' || t === '0') return t;
  return booleanToSelectValue(raw);
}

/**
 * Как рисовать ввод: тип столбца (шаблон) + displayType ячейки для столбца «текст».
 * @param {string|undefined} colDataType
 * @param {string|undefined} displayType — из ячейки (text, number, date, currency)
 * @param {boolean} inHeader — шапка таблицы: всегда текст
 * @returns {{ variant: 'text'|'number'|'date'|'boolean', inputType: string, inputMode?: string }}
 */
export function resolveSpreadsheetCellInputDescriptor(colDataType, displayType, inHeader) {
  if (inHeader) {
    return { variant: 'text', inputType: 'text' };
  }
  const d = normalizeColumnDataType(colDataType);
  if (d === 'number') {
    return { variant: 'number', inputType: 'text', inputMode: 'decimal' };
  }
  if (d === 'date') {
    return { variant: 'date', inputType: 'date' };
  }
  if (d === 'boolean') {
    return { variant: 'boolean' };
  }
  const st = displayType || 'text';
  if (st === 'date') {
    return { variant: 'date', inputType: 'date' };
  }
  if (st === 'number' || st === 'currency') {
    return { variant: 'number', inputType: 'text', inputMode: 'decimal' };
  }
  return { variant: 'text', inputType: 'text' };
}

/**
 * @param {string|undefined} align
 * @param {string|undefined} variant
 */
export function effectiveCellTextAlign(align, variant) {
  if (align === 'center' || align === 'right' || align === 'left') return align;
  if (variant === 'number') return 'right';
  if (variant === 'boolean') return 'center';
  return 'left';
}

/** Подпись столбца как в Excel: A, B, …, Z, AA, … */
export function excelColumnLabel(indexZeroBased) {
  let label = '';
  let n = indexZeroBased + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    label = String.fromCharCode(65 + rem) + label;
    n = Math.floor((n - 1) / 26);
  }
  return label;
}

export function cellKey(r, c) {
  return `${r}-${c}`;
}

/** Прямоугольник выделения по двум угловым ячейкам (r, c). */
export function selectionBounds(anchor, focus) {
  return {
    r0: Math.min(anchor.r, focus.r),
    r1: Math.max(anchor.r, focus.r),
    c0: Math.min(anchor.c, focus.c),
    c1: Math.max(anchor.c, focus.c),
  };
}

/** Выделение столбца целиком. */
export function spreadsheetColumnSelection(c, { rowCount, dataStart = 0 }) {
  const col = Math.max(0, c);
  return {
    a: { r: Math.max(0, dataStart), c: col },
    f: { r: Math.max(0, rowCount - 1), c: col },
  };
}

/** Выделение строки целиком. */
export function spreadsheetRowSelection(r, { colCount }) {
  const row = Math.max(0, r);
  return {
    a: { r: row, c: 0 },
    f: { r: row, c: Math.max(0, colCount - 1) },
  };
}

/** Выделение всей таблицы (область данных). */
export function spreadsheetAllSelection({ rowCount, colCount, dataStart = 0 }) {
  return {
    a: { r: Math.max(0, dataStart), c: 0 },
    f: { r: Math.max(0, rowCount - 1), c: Math.max(0, colCount - 1) },
  };
}

/** Разобрать буфер обмена (строки через \\n, ячейки через \\t). */
export function parseTsvToRows(text) {
  const normalized = String(text ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
  const lines = normalized.split('\n');
  while (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }
  if (lines.length === 0) return [];
  return lines.map((line) => line.split('\t'));
}

function columnLabelToIndex(label) {
  const letters = String(label).toUpperCase();
  if (!/^[A-Z]+$/.test(letters)) return -1;
  let col = 0;
  for (let i = 0; i < letters.length; i += 1) {
    col = col * 26 + (letters.charCodeAt(i) - 64);
  }
  return col - 1;
}

/**
 * Вставка TSV в сетку: при одной скопированной ячейке и многоклеточном выделении
 * заполняет весь прямоугольник (как в Excel), со сдвигом ссылок в формулах.
 */
export function applyParsedPasteToCells(cells, parsed, targetBounds, limits = {}) {
  const {
    rowCount = SPREADSHEET_MAX_DIM,
    colCount = SPREADSHEET_MAX_DIM,
    dataStart = 0,
  } = limits;
  const { r0, r1, c0, c1 } = targetBounds;
  const destH = r1 - r0 + 1;
  const destW = c1 - c0 + 1;
  const srcH = parsed.length;
  const srcW = srcH > 0 ? Math.max(...parsed.map((row) => row.length)) : 0;
  const isSingleSource = srcH === 1 && srcW <= 1;
  const sourceVal = parsed[0]?.[0] ?? '';
  let next = { ...cells };

  const putValue = (r, c, raw) => {
    if (r < dataStart || r >= rowCount || c < 0 || c >= colCount) return;
    let value = raw != null ? String(raw) : '';
    if (isSingleSource && destH * destW > 1 && isFormulaValue(value)) {
      value = adjustFormulaForRowOffset(value, r - r0);
      value = adjustFormulaForColOffset(value, c - c0);
    }
    const k = cellKey(r, c);
    const prev = getCellState(cells, r, c);
    next = { ...next, [k]: { ...prev, value } };
  };

  if (isSingleSource && destH * destW > 1) {
    for (let r = r0; r <= r1; r += 1) {
      for (let c = c0; c <= c1; c += 1) {
        putValue(r, c, sourceVal);
      }
    }
    return next;
  }

  parsed.forEach((row, i) => {
    row.forEach((val, j) => {
      putValue(r0 + i, c0 + j, val);
    });
  });
  return next;
}

export const SPREADSHEET_MIN_DIM = 2;
export const SPREADSHEET_MAX_DIM = 64;

/** Подогнать длину массива подписей столбцов (если нет первой строки-заголовка). */
export function padColumnNames(columnNames, colCount) {
  const a = Array.isArray(columnNames) ? [...columnNames] : [];
  while (a.length < colCount) a.push('');
  if (a.length > colCount) a.length = colCount;
  return a;
}

export function createEmptySpreadsheet(colCount = 8, rowCount = 14) {
  return {
    rowCount,
    colCount,
    hasHeaderRow: true,
    cells: {},
    columnNames: Array(colCount).fill(''),
    summary: { enabled: false, columns: {} },
  };
}

export const SPREADSHEET_MAX_SHEETS = 32;
export const DEFAULT_SHEET_NAME_PREFIX = 'Лист';
export const SPREADSHEET_FIELD_FORMAT = 'sheets';

export function createSheetId(index = 0) {
  return `sheet_${index}`;
}

export function defaultSheetName(index = 0) {
  return `${DEFAULT_SHEET_NAME_PREFIX} ${index + 1}`;
}

/** @returns {import('./spreadsheetGridUtils').SpreadsheetSheetModel} */
export function createEmptySheet(name, index = 0, colCount = 8, rowCount = 14) {
  return {
    id: createSheetId(index),
    name: name || defaultSheetName(index),
    ...createEmptySpreadsheet(colCount, rowCount),
  };
}

/** Workbook: { sheets, activeSheetId } */
export function createEmptySpreadsheetWorkbook(sheetCount = 1, colCount = 8, rowCount = 14) {
  const sheets = Array.from({ length: sheetCount }, (_, i) => createEmptySheet(undefined, i, colCount, rowCount));
  return {
    sheets,
    activeSheetId: sheets[0].id,
  };
}

function pickSheetBlockFields(sheet) {
  if (!sheet) return {};
  return {
    rowCount: sheet.rowCount,
    colCount: sheet.colCount,
    hasHeaderRow: sheet.hasHeaderRow,
    cells: sheet.cells,
    columnNames: sheet.columnNames,
    tableColumns: sheet.tableColumns,
    summary: sheet.summary,
  };
}

export function normalizeSheetModel(sh, index = 0) {
  const rowCount = sh.rowCount ?? SPREADSHEET_MIN_DIM;
  const colCount = sh.colCount ?? SPREADSHEET_MIN_DIM;
  return {
    id: sh.id || createSheetId(index),
    name: (sh.name && String(sh.name).trim()) || defaultSheetName(index),
    rowCount,
    colCount,
    hasHeaderRow: !!sh.hasHeaderRow,
    cells: { ...(sh.cells || {}) },
    columnNames: padColumnNames(sh.columnNames, colCount),
    tableColumns: Array.isArray(sh.tableColumns) ? sh.tableColumns : undefined,
    summary: sh.summary && typeof sh.summary === 'object'
      ? sh.summary
      : { enabled: false, columns: {} },
  };
}

export function sheetModelFromLegacyBlock(block) {
  return normalizeSheetModel({
    id: createSheetId(0),
    name: defaultSheetName(0),
    rowCount: block.rowCount,
    colCount: block.colCount,
    hasHeaderRow: block.hasHeaderRow,
    cells: block.cells,
    columnNames: block.columnNames,
    tableColumns: block.tableColumns,
    summary: block.summary,
  }, 0);
}

/** @returns {SpreadsheetSheetModel[]} */
export function normalizeSpreadsheetSheets(block) {
  if (!block || block.type !== SPREADSHEET_BLOCK_TYPE) return [];
  if (Array.isArray(block.sheets) && block.sheets.length > 0) {
    return block.sheets.map((sh, i) => normalizeSheetModel(sh, i));
  }
  if (block.rowCount != null || block.colCount != null || block.cells) {
    return [sheetModelFromLegacyBlock(block)];
  }
  return [createEmptySheet()];
}

export function normalizeSpreadsheetBlock(block) {
  if (!block || block.type !== SPREADSHEET_BLOCK_TYPE) return block;
  const sheets = normalizeSpreadsheetSheets(block);
  const first = sheets[0];
  return {
    ...block,
    type: SPREADSHEET_BLOCK_TYPE,
    sheets,
    ...pickSheetBlockFields(first),
  };
}

export function blockFragmentForSheet(block, sheet) {
  if (!sheet) return block;
  return {
    ...block,
    ...pickSheetBlockFields(sheet),
  };
}

export function isLegacySpreadsheetFieldValue(value) {
  return Array.isArray(value);
}

/**
 * @param {unknown} value — rows[] (legacy) или { sheetId: rows[] }
 * @param {SpreadsheetSheetModel[]} sheets
 */
export function normalizeSpreadsheetFieldValue(value, sheets) {
  const list = Array.isArray(sheets) ? sheets : [];
  const firstId = list[0]?.id || createSheetId(0);

  if (value == null) {
    const out = {};
    list.forEach((sh) => { out[sh.id] = []; });
    if (list.length === 0) out[firstId] = [];
    return out;
  }

  if (isLegacySpreadsheetFieldValue(value)) {
    const out = {};
    list.forEach((sh, i) => {
      out[sh.id] = i === 0 ? [...value] : [];
    });
    if (list.length === 0) return { [firstId]: [...value] };
    return out;
  }

  if (typeof value === 'object') {
    const out = {};
    list.forEach((sh) => {
      out[sh.id] = Array.isArray(value[sh.id]) ? [...value[sh.id]] : [];
    });
    Object.keys(value).forEach((k) => {
      if (k === '__format') return;
      if (!Object.prototype.hasOwnProperty.call(out, k) && Array.isArray(value[k])) {
        out[k] = [...value[k]];
      }
    });
    return out;
  }

  return { [firstId]: [] };
}

export function serializeSpreadsheetFieldValue(sheetDataMap, sheets) {
  const normalized = normalizeSpreadsheetFieldValue(sheetDataMap, sheets);
  return { ...normalized, __format: SPREADSHEET_FIELD_FORMAT };
}

export function getSheetDataRows(fieldValue, sheetId, sheets) {
  const map = normalizeSpreadsheetFieldValue(fieldValue, sheets);
  return map[sheetId] || [];
}

export function isSpreadsheetWorkbookModel(model) {
  return !!model && Array.isArray(model.sheets) && model.sheets.length > 0;
}

export function getWorkbookActiveSheet(workbook) {
  const sheets = workbook?.sheets || [];
  const id = workbook?.activeSheetId || sheets[0]?.id;
  return sheets.find((s) => s.id === id) || sheets[0] || null;
}

export function patchWorkbookActiveSheet(workbook, patchSheet) {
  const sheets = [...(workbook.sheets || [])];
  const id = workbook.activeSheetId || sheets[0]?.id;
  const idx = sheets.findIndex((s) => s.id === id);
  if (idx < 0) return workbook;
  sheets[idx] = { ...sheets[idx], ...patchSheet };
  return { ...workbook, sheets };
}

export function setWorkbookActiveSheet(workbook, sheetId) {
  if (!workbook?.sheets?.some((s) => s.id === sheetId)) return workbook;
  return { ...workbook, activeSheetId: sheetId };
}

/** Данные workbook для fingerprint автосохранения (без activeSheetId). */
export function workbookSaveFingerprint(workbook) {
  if (!workbook) return null;
  if (isSpreadsheetWorkbookModel(workbook)) {
    return { sheets: workbook.sheets };
  }
  return workbook;
}

export function addSheetToWorkbook(workbook, colCount = 8, rowCount = 14) {
  const sheets = [...(workbook.sheets || [])];
  if (sheets.length >= SPREADSHEET_MAX_SHEETS) return workbook;
  const next = createEmptySheet(defaultSheetName(sheets.length), sheets.length, colCount, rowCount);
  return {
    sheets: [...sheets, next],
    activeSheetId: next.id,
  };
}

export function deleteSheetFromWorkbook(workbook, sheetId) {
  const sheets = [...(workbook.sheets || [])];
  if (sheets.length <= 1) return workbook;
  const idx = sheets.findIndex((s) => s.id === sheetId);
  if (idx < 0) return workbook;
  const nextSheets = sheets.filter((s) => s.id !== sheetId);
  const wasActive = workbook.activeSheetId === sheetId;
  const nextActive = wasActive
    ? nextSheets[Math.min(idx, nextSheets.length - 1)]?.id
    : workbook.activeSheetId;
  return {
    sheets: nextSheets,
    activeSheetId: nextActive || nextSheets[0]?.id,
  };
}

export function renameSheetInWorkbook(workbook, sheetId, name) {
  const trimmed = String(name ?? '').trim();
  if (!trimmed) return workbook;
  const sheets = (workbook.sheets || []).map((s) => (
    s.id === sheetId ? { ...s, name: trimmed } : s
  ));
  return { ...workbook, sheets };
}

export function reorderSheetsInWorkbook(workbook, fromIndex, toIndex) {
  const sheets = [...(workbook.sheets || [])];
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= sheets.length || toIndex >= sheets.length) {
    return workbook;
  }
  const [removed] = sheets.splice(fromIndex, 1);
  sheets.splice(toIndex, 0, removed);
  return { ...workbook, sheets };
}

/**
 * Удалить строку r (0-based). Минимум SPREADSHEET_MIN_DIM строк.
 * @returns {object|null} новая модель или null, если нельзя удалить
 */
export function deleteRowAt(model, r) {
  const { rowCount, colCount, cells = {} } = model;
  if (rowCount <= SPREADSHEET_MIN_DIM || r < 0 || r >= rowCount) return null;
  const newCells = {};
  for (const [k, v] of Object.entries(cells)) {
    const [rs, cs] = k.split('-').map(Number);
    if (Number.isNaN(rs) || Number.isNaN(cs)) continue;
    if (rs < r) newCells[k] = v;
    else if (rs > r) newCells[`${rs - 1}-${cs}`] = v;
  }
  return {
    ...model,
    rowCount: rowCount - 1,
    cells: newCells,
  };
}

/**
 * Удалить столбец c (0-based). Минимум SPREADSHEET_MIN_DIM столбцов.
 */
export function deleteColumnAt(model, c) {
  const { rowCount, colCount, cells = {}, columnNames } = model;
  if (colCount <= SPREADSHEET_MIN_DIM || c < 0 || c >= colCount) return null;
  const newCells = {};
  for (const [k, v] of Object.entries(cells)) {
    const [rs, cs] = k.split('-').map(Number);
    if (Number.isNaN(rs) || Number.isNaN(cs)) continue;
    if (cs < c) newCells[k] = v;
    else if (cs > c) newCells[`${rs}-${cs - 1}`] = v;
  }
  const names = padColumnNames(columnNames, colCount);
  const newNames = names.filter((_, i) => i !== c);
  const meta = columnMetadataAligned(model, colCount);
  meta.splice(c, 1);
  const out = {
    ...model,
    colCount: colCount - 1,
    cells: newCells,
    columnNames: newNames,
  };
  return { ...out, tableColumns: tableColumnsFromMetadata(out, colCount - 1, meta) };
}

/**
 * Вставить пустую строку на индекс r (0-based); строки r..end сдвигаются вниз.
 */
export function insertRowAt(model, r) {
  const { rowCount, colCount, cells = {} } = model;
  if (r < 0 || r > rowCount) return null;
  if (rowCount >= SPREADSHEET_MAX_DIM) return null;
  const newCells = {};
  for (const [k, v] of Object.entries(cells)) {
    const [rs, cs] = k.split('-').map(Number);
    if (Number.isNaN(rs) || Number.isNaN(cs)) continue;
    if (rs < r) newCells[k] = v;
    else newCells[`${rs + 1}-${cs}`] = v;
  }
  const out = { ...model, rowCount: rowCount + 1, cells: newCells };
  const cols = resolveTableColumns(out);
  let filled = applyColumnDefaultsToRow(newCells, r, out.colCount, cols, !!model.hasHeaderRow);
  filled = applyRowStyleFromAbove(filled, r, out.colCount);
  return { ...out, cells: filled, tableColumns: cols };
}

/**
 * Вставить пустой столбец на индекс c; столбцы c..end сдвигаются вправо.
 */
export function insertColumnAt(model, c) {
  const { rowCount, colCount, cells = {}, columnNames } = model;
  if (c < 0 || c > colCount) return null;
  if (colCount >= SPREADSHEET_MAX_DIM) return null;
  const newCells = {};
  for (const [k, v] of Object.entries(cells)) {
    const [rs, cs] = k.split('-').map(Number);
    if (Number.isNaN(rs) || Number.isNaN(cs)) continue;
    if (cs < c) newCells[k] = v;
    else newCells[`${rs}-${cs + 1}`] = v;
  }
  const names = padColumnNames(columnNames, colCount);
  const newNames = [...names.slice(0, c), '', ...names.slice(c)];
  const meta = columnMetadataAligned(model, colCount);
  meta.splice(c, 0, { dataType: DEFAULT_COLUMN_DATA_TYPE, defaultValue: '' });
  const out = {
    ...model,
    colCount: colCount + 1,
    columnNames: padColumnNames(newNames, colCount + 1),
    cells: newCells,
  };
  const cols = tableColumnsFromMetadata(out, colCount + 1, meta);
  const filled = applyColumnDefaultToColumn(newCells, c, out.rowCount, cols, !!model.hasHeaderRow);
  return { ...out, cells: filled, tableColumns: cols };
}

/** @param {Record<string, { value?: string, displayType?: string, bold?: boolean, italic?: boolean, align?: string }>} cells */
export function getCellState(cells, r, c) {
  const k = cellKey(r, c);
  return cells[k] || { value: '', displayType: 'text', bold: false, italic: false, align: 'left' };
}

/**
 * Значение ячейки с учётом defaultValue столбца (для пустых ячеек тела таблицы).
 */
export function getEffectiveCellValue(cells, r, c, tableColumns, hasHeaderRow) {
  const stored = getCellState(cells, r, c).value;
  if (stored != null && String(stored).trim() !== '') return String(stored);
  if (hasHeaderRow && r === 0) return stored != null ? String(stored) : '';
  const cols = Array.isArray(tableColumns) ? tableColumns : [];
  const def = cols[c]?.defaultValue;
  if (!isApplicableColumnDefault(def)) return '';
  return String(def).trim();
}

export function ensureCellPatch(cells, r, c, patch) {
  const k = cellKey(r, c);
  const prev = cells[k] || {};
  return { ...cells, [k]: { ...prev, ...patch } };
}

/** Поля оформления ячейки (без value). */
export function copyCellStylePatch(source) {
  const st = source || {};
  return {
    displayType: st.displayType,
    bold: st.bold,
    italic: st.italic,
    align: st.align,
  };
}

/** Скопировать оформление ячеек из строки выше (r - 1) в строку r. */
export function applyRowStyleFromAbove(cells, r, colCount) {
  const sourceR = r - 1;
  if (sourceR < 0 || colCount <= 0) return cells;
  let next = cells;
  for (let c = 0; c < colCount; c += 1) {
    const source = getCellState(cells, sourceR, c);
    const target = getCellState(next, r, c);
    next = ensureCellPatch(next, r, c, {
      ...copyCellStylePatch(source),
      value: target.value ?? '',
    });
  }
  return next;
}

function isCellFilled(cells, r, c) {
  const v = getCellState(cells, r, c).value;
  return v != null && String(v).trim() !== '';
}

function isFormulaValue(raw) {
  const s = String(raw ?? '').trim();
  return s.startsWith('=') && s.length > 1;
}

/** Сдвинуть номера строк в ссылках формулы (B2 → B3 при rowOffset=1). */
export function adjustFormulaForRowOffset(formula, rowOffset) {
  if (!isFormulaValue(formula) || !rowOffset) return formula;
  return String(formula).replace(/([A-Za-z]+)(\d+)/g, (full, letters, digits) => {
    const row = parseInt(digits, 10) + rowOffset;
    if (row < 1) return full;
    return `${letters}${row}`;
  });
}

/** Сдвинуть буквы столбцов в ссылках формулы (B2 → C2 при colOffset=1; B → C). */
export function adjustFormulaForColOffset(formula, colOffset) {
  if (!isFormulaValue(formula) || !colOffset) return formula;
  const shiftLetters = (letters) => {
    const col = columnLabelToIndex(letters);
    if (col < 0) return null;
    const newCol = col + colOffset;
    if (newCol < 0) return null;
    return excelColumnLabel(newCol);
  };
  let s = String(formula).replace(
    /(?<![A-Za-z0-9_.])([A-Za-z]{1,3})(\d+)(?![A-Za-z0-9_])/g,
    (full, letters, digits) => {
      const next = shiftLetters(letters);
      return next ? `${next}${digits}` : full;
    },
  );
  s = s.replace(/(?<![A-Za-z0-9_.])([A-Za-z])(?![A-Za-z0-9_(])/g, (full, letter) => {
    const next = shiftLetters(letter);
    return next || full;
  });
  return s;
}

export function adjustFormulaForOffset(formula, rowOffset, colOffset) {
  let value = formula;
  if (rowOffset) value = adjustFormulaForRowOffset(value, rowOffset);
  if (colOffset) value = adjustFormulaForColOffset(value, colOffset);
  return value;
}

/**
 * Как в Excel: до какой строки тянуть автозаполнение по соседнему столбцу (слева, иначе справа).
 */
export function findFillDownEndRow(model, sourceR, sourceC) {
  const { rowCount, colCount, cells = {} } = model;
  if (sourceR < 0 || sourceR >= rowCount - 1) return sourceR;
  const neighborCol = sourceC > 0 ? sourceC - 1 : (sourceC + 1 < colCount ? sourceC + 1 : -1);
  if (neighborCol < 0) return rowCount - 1;

  let last = sourceR;
  for (let r = sourceR + 1; r < rowCount; r += 1) {
    if (!isCellFilled(cells, r, neighborCol)) break;
    last = r;
  }
  return last;
}

/**
 * Клонировать ячейку вниз по столбцу (двойной клик по маркеру автозаполнения).
 * @returns {object|null} новая модель или null, если заполнять некуда
 */
export function fillColumnDownFromCell(model, sourceR, sourceC) {
  const endRow = findFillDownEndRow(model, sourceR, sourceC);
  if (endRow <= sourceR) return null;

  const { cells = {} } = model;
  const source = getCellState(cells, sourceR, sourceC);
  const newCells = { ...cells };

  for (let r = sourceR + 1; r <= endRow; r += 1) {
    const rowOffset = r - sourceR;
    let value = source.value != null ? String(source.value) : '';
    if (isFormulaValue(value)) {
      value = adjustFormulaForOffset(value, rowOffset, 0);
    }
    const k = cellKey(r, sourceC);
    const prev = cells[k] || {};
    newCells[k] = {
      ...prev,
      value,
      ...copyCellStylePatch(source),
    };
  }

  return { ...model, cells: newCells };
}

/** Построить tableColumns из первой строки сетки (заголовки) или по буквам столбцов */
export function gridModelToTableColumns(model) {
  const colCount = model.colCount ?? SPREADSHEET_MIN_DIM;
  const meta = columnMetadataAligned(model, colCount);
  return tableColumnsFromMetadata(model, colCount, meta);
}

/** Строки данных для field_data: все строки тела (ниже заголовка), в т.ч. пустые — иначе «+строка» в документе не сохраняется */
export function gridModelToDataRows(model) {
  const columns = Array.isArray(model.tableColumns) && model.tableColumns.length > 0
    ? model.tableColumns
    : gridModelToTableColumns(model);
  const { rowCount, cells = {}, hasHeaderRow } = model;
  const dataStart = hasHeaderRow ? 1 : 0;
  const rows = [];
  for (let r = dataStart; r < rowCount; r++) {
    const row = {};
    columns.forEach((col, c) => {
      row[col.key] = getEffectiveCellValue(cells, r, c, columns, hasHeaderRow);
    });
    rows.push(row);
  }
  if (rows.length === 0) {
    const empty = {};
    columns.forEach((col) => { empty[col.key] = ''; });
    rows.push(empty);
  }
  return rows;
}

/** Слить лист шаблона с уже сохранёнными строками документа */
export function mergeSpreadsheetSheetWithDataRows(sheet, dataRows) {
  const cols = Array.isArray(sheet.tableColumns) ? sheet.tableColumns : gridModelToTableColumns(sheet);
  const cells = { ...(sheet.cells || {}) };
  const dataStart = sheet.hasHeaderRow ? 1 : 0;
  (Array.isArray(dataRows) ? dataRows : []).forEach((row, i) => {
    const r = dataStart + i;
    cols.forEach((col, c) => {
      const k = cellKey(r, c);
      const prev = cells[k] || {};
      const stored = row[col.key];
      const v = (stored != null && String(stored).trim() !== '')
        ? String(stored)
        : (col.defaultValue != null && String(col.defaultValue).trim() !== ''
          ? String(col.defaultValue)
          : '');
      cells[k] = { ...prev, value: v };
    });
  });
  const minRows = dataStart + Math.max(1, Array.isArray(dataRows) ? dataRows.length : 1);
  return {
    rowCount: Math.max(sheet.rowCount || minRows, minRows),
    colCount: Math.max(sheet.colCount || cols.length, cols.length),
    hasHeaderRow: !!sheet.hasHeaderRow,
    tableColumns: cols,
    cells,
  };
}

/** Слить блок шаблона с уже сохранёнными строками документа (первый лист / legacy) */
export function mergeSpreadsheetBlockWithDataRows(block, dataRows) {
  const sheets = normalizeSpreadsheetSheets(block);
  const sheet = sheets[0] || sheetModelFromLegacyBlock(block);
  const merged = mergeSpreadsheetSheetWithDataRows(sheet, dataRows);
  return merged;
}

/**
 * Сериализация в field_data: колонки берутся из фактических размеров сетки (как buildSpreadsheetBlock), чтобы
 * новые строки/столбцы в документе не терялись.
 */
export function mergedModelToDataRows(block, cells, dimensionOverride = {}) {
  const m = { ...block, ...dimensionOverride, cells };
  const tableColumns = gridModelToTableColumns(m);
  return gridModelToDataRows({ ...m, tableColumns });
}

function sheetToBlockPayload(sheet) {
  const tableColumns = gridModelToTableColumns(sheet);
  return {
    id: sheet.id,
    name: sheet.name,
    rowCount: sheet.rowCount,
    colCount: sheet.colCount,
    hasHeaderRow: !!sheet.hasHeaderRow,
    tableColumns,
    cells: { ...(sheet.cells || {}) },
    columnNames: padColumnNames(sheet.columnNames, sheet.colCount),
    ...(sheet.summary && typeof sheet.summary === 'object' ? { summary: sheet.summary } : {}),
  };
}

export function buildSpreadsheetBlock(fieldName, model) {
  if (isSpreadsheetWorkbookModel(model)) {
    const sheets = model.sheets.map((sh) => sheetToBlockPayload(sh));
    const first = sheets[0];
    return {
      type: SPREADSHEET_BLOCK_TYPE,
      field_name: fieldName,
      sheets,
      ...pickSheetBlockFields(first),
    };
  }
  const sheet = sheetToBlockPayload(normalizeSheetModel(model, 0));
  return {
    type: SPREADSHEET_BLOCK_TYPE,
    field_name: fieldName,
    sheets: [sheet],
    ...pickSheetBlockFields(sheet),
  };
}

/** Восстановить workbook-модель редактора из блока sheet_content */
export function spreadsheetBlockToGridModel(block) {
  if (!block || block.type !== SPREADSHEET_BLOCK_TYPE) return null;
  const sheets = normalizeSpreadsheetSheets(block).map((sh) => ({
    ...sh,
    tableColumns: sh.tableColumns || gridModelToTableColumns(sh),
    summary: sh.summary || { enabled: false, columns: {} },
  }));
  const activeSheetId = block.activeSheetId || sheets[0]?.id;
  return {
    sheets,
    activeSheetId: sheets.find((s) => s.id === activeSheetId)?.id || sheets[0]?.id,
  };
}

/** Legacy: однолистовая модель сетки (для обратной совместимости) */
export function spreadsheetBlockToSingleGridModel(block) {
  const wb = spreadsheetBlockToGridModel(block);
  if (!wb) return null;
  const sheet = getWorkbookActiveSheet(wb);
  if (!sheet) return null;
  return {
    rowCount: sheet.rowCount,
    colCount: sheet.colCount,
    hasHeaderRow: sheet.hasHeaderRow,
    cells: { ...sheet.cells },
    columnNames: sheet.columnNames,
    tableColumns: sheet.tableColumns,
    summary: sheet.summary,
  };
}

export function gridWorkbookToFieldValue(workbook, block) {
  const sheets = normalizeSpreadsheetSheets(block);
  const wbSheets = workbook?.sheets || [];
  const out = {};
  sheets.forEach((sh, i) => {
    const gm = wbSheets.find((w) => w.id === sh.id)
      || (!isSpreadsheetWorkbookModel(workbook) && i === 0 ? workbook : null);
    if (!gm) {
      out[sh.id] = [];
      return;
    }
    const fragment = blockFragmentForSheet(block, sh);
    out[sh.id] = gridModelToDataRows({
      ...gm,
      tableColumns: gridModelToTableColumns(gm),
      hasHeaderRow: gm.hasHeaderRow ?? sh.hasHeaderRow,
    });
  });
  return serializeSpreadsheetFieldValue(out, sheets);
}

/** Стиль ячейки для inline */
export function cellInlineStyle(meta) {
  const m = meta || {};
  const al = m.align === 'center' ? 'center' : m.align === 'right' ? 'right' : 'left';
  return {
    textAlign: al,
    fontWeight: m.bold ? 'bold' : undefined,
    fontStyle: m.italic ? 'italic' : undefined,
  };
}
