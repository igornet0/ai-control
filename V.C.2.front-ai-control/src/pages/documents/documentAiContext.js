/**
 * Compact document / template snapshots for AI system context.
 */

import { formatCellAddress } from './documentFieldDiff';
import {
  SPREADSHEET_BLOCK_TYPE,
  SPREADSHEET_FIELD_FORMAT,
  normalizeSpreadsheetBlock,
  gridModelToTableColumns,
  normalizeSpreadsheetFieldValue,
  blockFragmentForSheet,
  mergeSpreadsheetSheetWithDataRows,
  getEffectiveCellValue,
  cellKey,
  SPREADSHEET_MAX_DIM,
  serializeSpreadsheetFieldValue,
  gridModelToDataRows,
} from './spreadsheetGridUtils';
import { isCellFormula, computeFormulaDisplayMap } from './spreadsheetCellFormula';
import { isSpreadsheetTemplate } from './templateTypeUtils';

export const MAX_CONTEXT_CELLS = 400;
export const MAX_INCOMPLETE_CELLS = 48;
export const MAX_TABLE_ROWS_IN_CONTEXT = 64;
export const MAX_JSON_CHARS = 1800;

export function getFieldsListFromStructure(structure) {
  if (!structure || !structure.fields) return [];
  const raw = structure.fields;
  const list = Array.isArray(raw) ? raw : (raw.fields || []);
  const arr = Array.isArray(list) ? list : [];
  return arr.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function safeJson(value, maxLen = MAX_JSON_CHARS) {
  try {
    const s = JSON.stringify(value);
    if (s.length <= maxLen) return s;
    return `${s.slice(0, maxLen)}…`;
  } catch {
    return String(value);
  }
}

export function isSpreadsheetFieldValue(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  if (value.__format === SPREADSHEET_FIELD_FORMAT) return true;
  return Object.keys(value).some((k) => /^sheet_\d+$/.test(k) && Array.isArray(value[k]));
}

export function isEmptyScalar(value) {
  if (value == null) return true;
  if (typeof value === 'boolean') return false;
  if (typeof value === 'number') return false;
  return String(value).trim() === '';
}

function isEmptyRow(row) {
  if (!row || typeof row !== 'object') return true;
  return Object.values(row).every((v) => isEmptyScalar(v));
}

export function resolveFieldType(fieldName, fieldsList = [], sheetBlocks = null) {
  const block = Array.isArray(sheetBlocks)
    ? sheetBlocks.find((b) => b?.field_name === fieldName)
    : null;
  if (block?.type === SPREADSHEET_BLOCK_TYPE) return 'spreadsheet';
  if (block?.type === 'field' && (block.displayType === 'table')) return 'table';
  const meta = (fieldsList || []).find((f) => f?.name === fieldName);
  if (meta?.type) return meta.type;
  return 'string';
}

export function collectFieldNames(fieldsList = [], sheetBlocks = null, fieldData = {}) {
  const names = [];
  const seen = new Set();
  const add = (name) => {
    const n = String(name || '').trim();
    if (!n || seen.has(n)) return;
    seen.add(n);
    names.push(n);
  };
  (fieldsList || []).forEach((f) => add(f?.name));
  (Array.isArray(sheetBlocks) ? sheetBlocks : []).forEach((b) => {
    if (b?.field_name) add(b.field_name);
  });
  Object.keys(fieldData || {}).forEach((k) => {
    if (k !== '__format') add(k);
  });
  return names;
}

function formulaMapKey(sheetKey, rowIndex, colKey) {
  return `${sheetKey}|${rowIndex}|${colKey}`;
}

/** Вычисленные формулы и карта display_value для spreadsheet-поля. */
export function buildSpreadsheetFormulaContext(fieldName, fieldValue, sheetBlocks) {
  const block = getSpreadsheetBlock(fieldName, sheetBlocks);
  if (!block) {
    return { displayByKey: new Map(), formulaByKey: new Map(), formulaCells: [] };
  }

  const sheets = block.sheets || [];
  const sheetDataMap = normalizeSpreadsheetFieldValue(fieldValue, sheets);
  const workbook = { sheets, activeSheetId: sheets[0]?.id };
  const displayByKey = new Map();
  const formulaByKey = new Map();
  const formulaCells = [];

  sheets.forEach((sh) => {
    const frag = blockFragmentForSheet(block, sh);
    const rows = sheetDataMap[sh.id] || [];
    const model = mergeSpreadsheetSheetWithDataRows(frag, rows);
    const cols = Array.isArray(model.tableColumns) && model.tableColumns.length
      ? model.tableColumns
      : gridModelToTableColumns(model);
    const displayMap = computeFormulaDisplayMap(model, cols, workbook);
    const dataStart = model.hasHeaderRow ? 1 : 0;

    for (let r = dataStart; r < model.rowCount; r += 1) {
      const rowIndex = r - dataStart;
      cols.forEach((col, c) => {
        const colKey = col?.key;
        if (!colKey) return;
        const raw = getEffectiveCellValue(model.cells, r, c, cols, !!model.hasHeaderRow);
        if (!isCellFormula(raw)) return;
        const mapKey = formulaMapKey(sh.id, rowIndex, colKey);
        const display = displayMap[cellKey(r, c)] ?? '';
        const formula = String(raw);
        displayByKey.set(mapKey, display);
        const entry = {
          sheet_key: sh.id,
          sheet_name: sh.name,
          row_index: rowIndex,
          col_key: colKey,
          col_label: col.label || colKey,
          formula,
          display_value: display,
        };
        formulaByKey.set(mapKey, entry);
        formulaCells.push(entry);
      });
    }
  });

  return { displayByKey, formulaByKey, formulaCells };
}

function mapSpreadsheetColumn(col) {
  const entry = {
    key: col.key,
    label: col.label || col.key,
    dataType: col.dataType || null,
  };
  if (col.defaultValue != null && String(col.defaultValue).trim() !== '') {
    entry.default_value = col.defaultValue;
    if (isCellFormula(col.defaultValue)) entry.default_is_formula = true;
  }
  return entry;
}

function getSpreadsheetBlock(fieldName, sheetBlocks) {
  const block = Array.isArray(sheetBlocks)
    ? sheetBlocks.find((b) => b?.field_name === fieldName)
    : null;
  if (!block || block.type !== SPREADSHEET_BLOCK_TYPE) return null;
  return normalizeSpreadsheetBlock(block);
}

function resolveTableColumns(fieldName, fieldsList = [], sheetBlocks = null) {
  const fromList = (fieldsList || []).find((f) => f?.name === fieldName) || {};
  if (Array.isArray(fromList.columns) && fromList.columns.length) {
    return fromList.columns;
  }
  const block = Array.isArray(sheetBlocks)
    ? sheetBlocks.find((b) => b?.field_name === fieldName)
    : null;
  if (Array.isArray(block?.tableColumns) && block.tableColumns.length) {
    return block.tableColumns;
  }
  return null;
}

function resolveSpreadsheetSheets(fieldName, sheetBlocks) {
  const block = getSpreadsheetBlock(fieldName, sheetBlocks);
  if (!block) return null;
  return (block.sheets || []).map((sh) => ({
    sheet_id: sh.id,
    sheet_name: sh.name,
    rowCount: sh.rowCount,
    colCount: sh.colCount,
    hasHeaderRow: sh.hasHeaderRow !== false,
    columns: Array.isArray(sh.tableColumns) && sh.tableColumns.length
      ? sh.tableColumns
      : gridModelToTableColumns(sh),
  }));
}

function getFieldMeta(fieldName, fieldsList = [], sheetBlocks = null) {
  const fromList = (fieldsList || []).find((f) => f?.name === fieldName) || {};
  const block = Array.isArray(sheetBlocks)
    ? sheetBlocks.find((b) => b?.field_name === fieldName)
    : null;
  const type = resolveFieldType(fieldName, fieldsList, sheetBlocks);
  const sheets = type === 'spreadsheet' ? resolveSpreadsheetSheets(fieldName, sheetBlocks) : null;
  const columns = type === 'spreadsheet'
    ? (sheets?.[0]?.columns || null)
    : resolveTableColumns(fieldName, fieldsList, sheetBlocks);
  return {
    name: fieldName,
    type,
    required: Boolean(fromList.required),
    columns,
    sheets,
    blockType: block?.type || null,
    displayType: block?.displayType || null,
    hasHeaderRow: sheets?.[0]?.hasHeaderRow ?? (block?.hasHeaderRow !== false),
  };
}

function compactTable(rows, limit = MAX_TABLE_ROWS_IN_CONTEXT) {
  const list = Array.isArray(rows) ? rows : [];
  let preview = list;
  let previewNote = null;
  if (list.length > limit) {
    const head = Math.max(1, Math.floor(limit * 0.75));
    const tail = Math.max(1, limit - head);
    preview = [...list.slice(0, head), ...list.slice(-tail)];
    previewNote = `В контексте показаны первые ${head} и последние ${tail} из ${list.length} строк. Можно добавлять строки при заполнении.`;
  }
  return {
    rowCount: list.length,
    emptyRowCount: list.filter(isEmptyRow).length,
    preview,
    truncated: list.length > limit,
    previewNote,
    canAddRows: true,
    maxRows: MAX_TABLE_ROWS_IN_CONTEXT,
  };
}

function spreadsheetRowStats(value, sheets = []) {
  const data = isSpreadsheetFieldValue(value) ? value : {};
  return sheets.map((s) => {
    const rows = Array.isArray(data[s.sheet_id]) ? data[s.sheet_id] : [];
    const templateBodyRows = Math.max(
      0,
      Number(s.rowCount || 0) - (s.hasHeaderRow ? 1 : 0),
    );
    const maxBodyRows = SPREADSHEET_MAX_DIM - (s.hasHeaderRow ? 1 : 0);
    return {
      sheet_key: s.sheet_id,
      sheet_name: s.sheet_name,
      saved_rows: rows.length,
      template_body_rows: templateBodyRows,
      max_body_rows: maxBodyRows,
      can_add_rows: true,
    };
  });
}

function iterSpreadsheetCells(value, meta = {}, formulaContext = null) {
  const formulaByKey = formulaContext?.formulaByKey || null;

  if (Array.isArray(meta.sheets) && meta.sheets.length) {
    const cells = [];
    const data = isSpreadsheetFieldValue(value) ? value : {};
    meta.sheets.forEach((sheet) => {
      const sheetKey = sheet.sheet_id;
      const cols = Array.isArray(sheet.columns) ? sheet.columns : [];
      const rows = Array.isArray(data[sheetKey]) ? data[sheetKey] : [];
      const templateBodyRows = Math.max(
        0,
        Number(sheet.rowCount || 0) - (sheet.hasHeaderRow ? 1 : 0),
      );
      const rowCount = Math.max(rows.length, templateBodyRows, 1);
      for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
        const row = rows[rowIndex] || {};
        cols.forEach((col) => {
          const colKey = col?.key || col?.name;
          if (!colKey) return;
          const mapKey = formulaMapKey(sheetKey, rowIndex, colKey);
          const formulaMeta = formulaByKey?.get(mapKey);
          if (formulaMeta) {
            cells.push({
              sheetKey,
              rowIndex,
              colKey,
              colLabel: col.label || colKey,
              value: formulaMeta.formula,
              formula: formulaMeta.formula,
              display_value: formulaMeta.display_value,
              is_formula: true,
              address: formatCellAddress(rowIndex, colKey, sheetKey, { hasHeaderRow: sheet.hasHeaderRow }),
              empty: false,
            });
            return;
          }
          const cellValue = row[colKey];
          cells.push({
            sheetKey,
            rowIndex,
            colKey,
            colLabel: col.label || colKey,
            value: cellValue,
            address: formatCellAddress(rowIndex, colKey, sheetKey, { hasHeaderRow: sheet.hasHeaderRow }),
            empty: isEmptyScalar(cellValue),
            is_formula: isCellFormula(cellValue),
          });
        });
      }
    });
    return cells;
  }

  if (!isSpreadsheetFieldValue(value)) return [];
  const cells = [];
  Object.keys(value).forEach((sheetKey) => {
    if (sheetKey === '__format') return;
    const rows = Array.isArray(value[sheetKey]) ? value[sheetKey] : [];
    rows.forEach((row, rowIndex) => {
      if (!row || typeof row !== 'object') return;
      Object.keys(row).forEach((colKey) => {
        cells.push({
          sheetKey,
          rowIndex,
          colKey,
          value: row[colKey],
          address: formatCellAddress(rowIndex, colKey, sheetKey, { hasHeaderRow: meta.hasHeaderRow !== false }),
          empty: isEmptyScalar(row[colKey]),
        });
      });
    });
  });
  return cells;
}

function compactSpreadsheetPreviewCell(c) {
  const base = {
    address: c.address,
    sheet_key: c.sheetKey,
    row_index: c.rowIndex,
    col_key: c.colKey,
    col_label: c.colLabel || c.colKey,
  };
  if (c.is_formula || isCellFormula(c.value)) {
    return {
      ...base,
      is_formula: true,
      formula: c.formula || String(c.value ?? ''),
      display_value: c.display_value ?? '',
    };
  }
  return { ...base, value: c.value };
}

function compactSpreadsheet(value, meta, formulaContext = null) {
  const cells = iterSpreadsheetCells(value, meta, formulaContext);
  const filled = cells.filter((c) => !c.empty);
  const empty = cells.filter((c) => c.empty);
  return {
    sheets: Array.isArray(meta.sheets) && meta.sheets.length
      ? meta.sheets.map((s) => ({
        sheet_id: s.sheet_id,
        sheet_name: s.sheet_name,
        columns: (s.columns || []).map((c) => mapSpreadsheetColumn(c)),
      }))
      : Object.keys(value || {}).filter((k) => k !== '__format' && Array.isArray(value[k])),
    rowStats: spreadsheetRowStats(value, meta.sheets),
    filledCount: filled.length,
    emptyCount: empty.length,
    filledPreview: filled.slice(0, MAX_CONTEXT_CELLS).map(compactSpreadsheetPreviewCell),
    emptyPreview: empty.slice(0, MAX_INCOMPLETE_CELLS).map(compactSpreadsheetPreviewCell),
    truncated: filled.length > MAX_CONTEXT_CELLS,
    previewNote: filled.length > MAX_CONTEXT_CELLS
      ? `В контексте показана часть ячеек (${MAX_CONTEXT_CELLS} из ${filled.length} заполненных). Можно добавлять строки через row_index.`
      : null,
    canAddRows: true,
  };
}

export function compactFieldValue(value, meta, sheetBlocks = null) {
  if (meta.type === 'table' || Array.isArray(value)) return compactTable(value);
  if (meta.type === 'spreadsheet' || isSpreadsheetFieldValue(value)) {
    const formulaContext = sheetBlocks
      ? buildSpreadsheetFormulaContext(meta.name, value, sheetBlocks)
      : null;
    return compactSpreadsheet(value || {}, meta, formulaContext);
  }
  if (value != null && typeof value === 'object') return safeJson(value, 800);
  return value ?? '';
}

export function findIncompleteFields({
  fieldsList = [],
  fieldData = {},
  sheetBlocks = null,
} = {}) {
  const names = collectFieldNames(fieldsList, sheetBlocks, fieldData);
  const incomplete = [];

  names.forEach((name) => {
    const meta = getFieldMeta(name, fieldsList, sheetBlocks);
    const value = fieldData?.[name];

    if (meta.type === 'table' || Array.isArray(value)) {
      const rows = Array.isArray(value) ? value : [];
      const cols = Array.isArray(meta.columns) ? meta.columns : [];
      const emptyRows = rows.filter(isEmptyRow).length;
      if (!rows.length || emptyRows === rows.length) {
        incomplete.push({
          field: name,
          type: 'table',
          required: meta.required,
          reason: rows.length ? 'Все строки пустые' : 'Таблица не заполнена',
        });
        return;
      }
      if (cols.length) {
        const emptyCells = [];
        rows.forEach((row, rowIndex) => {
          cols.forEach((col) => {
            const colKey = col?.key || col?.name;
            if (!colKey) return;
            if (isEmptyScalar(row?.[colKey])) {
              emptyCells.push({
                row_index: rowIndex,
                col_key: colKey,
                col_label: col.label || colKey,
              });
            }
          });
        });
        if (emptyCells.length) {
          incomplete.push({
            field: name,
            type: 'table',
            required: meta.required,
            reason: `${emptyCells.length} пустых ячеек`,
            emptyCells: emptyCells.slice(0, MAX_INCOMPLETE_CELLS),
          });
        }
      }
      return;
    }

    if (meta.type === 'spreadsheet' || isSpreadsheetFieldValue(value)) {
      const formulaContext = sheetBlocks
        ? buildSpreadsheetFormulaContext(name, value, sheetBlocks)
        : null;
      const cells = iterSpreadsheetCells(value || {}, meta, formulaContext);
      const filled = cells.filter((c) => !c.empty);
      const empty = cells.filter((c) => c.empty);
      if (!filled.length) {
        incomplete.push({
          field: name,
          type: 'spreadsheet',
          required: meta.required,
          reason: 'Таблица не заполнена',
          emptyCells: empty.slice(0, MAX_INCOMPLETE_CELLS).map((c) => ({
            address: c.address,
            sheet_key: c.sheetKey,
            row_index: c.rowIndex,
            col_key: c.colKey,
            col_label: c.colLabel || c.colKey,
          })),
        });
        return;
      }
      if (empty.length) {
        incomplete.push({
          field: name,
          type: 'spreadsheet',
          required: meta.required,
          reason: `${empty.length} пустых ячеек`,
          emptyCells: empty.slice(0, MAX_INCOMPLETE_CELLS).map((c) => ({
            address: c.address,
            sheet_key: c.sheetKey,
            row_index: c.rowIndex,
            col_key: c.colKey,
            col_label: c.colLabel || c.colKey,
          })),
        });
      }
      return;
    }

    if (isEmptyScalar(value)) {
      incomplete.push({
        field: name,
        type: meta.type,
        required: meta.required,
        reason: 'Пустое поле',
      });
    }
  });

  return incomplete;
}

export function buildFieldSchema(fieldsList = [], sheetBlocks = null, fieldData = {}) {
  return collectFieldNames(fieldsList, sheetBlocks, fieldData).map((name) => {
    const meta = getFieldMeta(name, fieldsList, sheetBlocks);
    const entry = {
      name: meta.name,
      type: meta.type,
      required: meta.required,
    };
    if (meta.type === 'spreadsheet' && Array.isArray(meta.sheets) && meta.sheets.length) {
      const { formulaCells } = buildSpreadsheetFormulaContext(name, fieldData?.[name], sheetBlocks);
      const fieldValue = fieldData?.[name];
      entry.sheets = meta.sheets.map((s) => ({
        sheet_id: s.sheet_id,
        sheet_name: s.sheet_name,
        columns: (s.columns || []).map((c) => mapSpreadsheetColumn(c)),
      }));
      entry.row_stats = spreadsheetRowStats(fieldValue, meta.sheets);
      entry.can_add_rows = true;
      if (formulaCells.length) {
        entry.formula_cells = formulaCells.slice(0, MAX_CONTEXT_CELLS);
      }
    } else if (meta.columns) {
      entry.columns = (meta.columns || []).map((c) => (
        c?.key || c?.name
          ? {
            key: c.key || c.name,
            label: c.label || c.key || c.name,
            dataType: c.dataType || null,
            ...(c.defaultValue != null && String(c.defaultValue).trim() !== ''
              ? { default_value: c.defaultValue }
              : {}),
          }
          : c
      ));
      if (meta.type === 'table') {
        entry.can_add_rows = true;
        entry.max_rows = MAX_TABLE_ROWS_IN_CONTEXT;
      }
    }
    return entry;
  });
}

export function summarizeDocumentContext({
  documentId = null,
  documentTitle = '',
  kindName = '',
  number = '',
  templateId = null,
  templateVersion = null,
  fieldsList = [],
  fieldData = {},
  sheetBlocks = null,
  isTableDocument = null,
  placeholderVars = null,
} = {}) {
  const tableDoc = isTableDocument != null
    ? Boolean(isTableDocument)
    : isSpreadsheetTemplate({ sheet_content: Array.isArray(sheetBlocks) ? sheetBlocks : [] });
  const schema = buildFieldSchema(fieldsList, sheetBlocks, fieldData);
  const incomplete = findIncompleteFields({ fieldsList, fieldData, sheetBlocks });
  const values = {};
  schema.forEach((f) => {
    const meta = getFieldMeta(f.name, fieldsList, sheetBlocks);
    values[f.name] = compactFieldValue(fieldData?.[f.name], meta, sheetBlocks);
  });

  const lines = [
    `Документ id=${documentId ?? '—'}`,
    `Заголовок: ${documentTitle || '—'}`,
    kindName ? `Вид: ${kindName}` : null,
    number ? `Номер: ${number}` : null,
    templateId != null ? `Шаблон id=${templateId}${templateVersion ? `, версия ${templateVersion}` : ''}` : null,
    `Режим: ${tableDoc ? 'таблица (spreadsheet)' : 'текстовый документ'}`,
    placeholderVars ? `Плейсхолдеры: ${safeJson(placeholderVars, 400)}` : null,
    '## Схема полей',
    safeJson(schema, 4000),
    '## Текущие значения',
    safeJson(values, 8000),
    '## Незаполненные поля',
    incomplete.length ? safeJson(incomplete, 3000) : 'Все поля имеют значения (проверьте смысл и полноту).',
  ].filter((line) => line != null);

  return lines.join('\n');
}

export function buildTemplateBlock(template, {
  fieldsList = [],
  kindName = '',
} = {}) {
  if (!template) return '';
  const sheetBlocks = Array.isArray(template.sheet_content) ? template.sheet_content : [];
  const schema = fieldsList.length
    ? buildFieldSchema(fieldsList, sheetBlocks, template.default_values || {})
    : buildFieldSchema([], sheetBlocks, template.default_values || {});
  const tableDoc = isSpreadsheetTemplate({ sheet_content: sheetBlocks });
  return [
    `## Целевой шаблон id=${template.id}`,
    `Название: ${template.name || '—'}`,
    kindName ? `Вид: ${kindName}` : null,
    `Тип: ${tableDoc ? 'таблица' : 'текстовый'}`,
    template.version ? `Версия: ${template.version}` : null,
    'Схема полей:',
    safeJson(schema, 4000),
    template.default_values ? `Значения по умолчанию: ${safeJson(template.default_values, 1500)}` : null,
  ].filter(Boolean).join('\n');
}

export function buildSourceDocumentsBlock(sources = []) {
  if (!sources.length) return '';
  const parts = sources.map((src, i) => {
    const header = `### Источник ${i + 1}: документ id=${src.documentId ?? src.id ?? '—'} «${src.documentTitle || src.title || ''}»`;
    const body = src.summary
      || summarizeDocumentContext(src);
    return `${header}\n${body}`;
  });
  return ['## Документы-источники (уже заполнены)', ...parts].join('\n\n');
}

export function editableFieldNames(fieldsList = [], sheetBlocks = null, fieldData = {}) {
  const names = collectFieldNames(fieldsList, sheetBlocks, fieldData);
  return ['title', ...names.map((n) => `field.${n}`)];
}

/** Подставить default_value колонок в пустые ячейки строк table-поля. */
export function applyTableRowsWithColumnDefaults(rows, columns = []) {
  if (!Array.isArray(rows) || !columns.length) return rows;
  return rows.map((row) => {
    const out = row && typeof row === 'object' && !Array.isArray(row) ? { ...row } : {};
    columns.forEach((col) => {
      const key = col?.key || col?.name;
      if (!key) return;
      if (isEmptyScalar(out[key]) && col.defaultValue != null && String(col.defaultValue).trim() !== '') {
        out[key] = col.defaultValue;
      }
      if (isEmptyScalar(out[key]) && col.default_value != null && String(col.default_value).trim() !== '') {
        out[key] = col.default_value;
      }
    });
    return out;
  });
}

/** Слить spreadsheet field_data с шаблоном: расширить строки, применить default_value колонок. */
export function normalizeSpreadsheetFieldData(fieldName, fieldValue, sheetBlocks) {
  const block = Array.isArray(sheetBlocks)
    ? sheetBlocks.find((b) => b?.field_name === fieldName && b?.type === SPREADSHEET_BLOCK_TYPE)
    : null;
  if (!block) return fieldValue;
  const normalized = normalizeSpreadsheetBlock(block);
  const sheets = normalized.sheets || [];
  if (!sheets.length) return fieldValue;
  const sheetDataMap = normalizeSpreadsheetFieldValue(fieldValue, sheets);
  const nextMap = {};
  sheets.forEach((sh) => {
    const frag = blockFragmentForSheet(normalized, sh);
    const rows = sheetDataMap[sh.id] || [];
    const merged = mergeSpreadsheetSheetWithDataRows(frag, rows);
    nextMap[sh.id] = gridModelToDataRows(merged);
  });
  return serializeSpreadsheetFieldValue(nextMap, sheets);
}

export function resolveFieldColumnsForApply(fieldName, fieldsList = [], sheetBlocks = null) {
  const meta = getFieldMeta(fieldName, fieldsList, sheetBlocks);
  if (meta.type === 'spreadsheet' && Array.isArray(meta.sheets)) {
    return meta.sheets.map((s) => ({ sheet_id: s.sheet_id, columns: s.columns || [] }));
  }
  return meta.columns || [];
}

export async function loadDocumentAiSnapshot(documentId) {
  const { documentService } = await import('../../services/documentService');
  const doc = await documentService.getDocument(documentId);
  let structure = null;
  if (doc.document_kind_id) {
    try {
      structure = await documentService.getStructureByKindId(doc.document_kind_id);
    } catch {
      structure = null;
    }
  }
  let sheetBlocks = null;
  if (doc.template_id) {
    try {
      const t = doc.template_version
        ? await documentService.getTemplateVersion(doc.template_id, doc.template_version)
        : await documentService.getTemplate(doc.template_id);
      if (Array.isArray(t?.sheet_content) && t.sheet_content.length) {
        sheetBlocks = t.sheet_content;
      }
    } catch {
      /* ignore */
    }
  }
  const fieldsList = getFieldsListFromStructure(structure);
  const summary = summarizeDocumentContext({
    documentId: doc.id,
    documentTitle: doc.title || '',
    number: doc.number || '',
    templateId: doc.template_id,
    templateVersion: doc.template_version,
    fieldsList,
    fieldData: doc.field_data || {},
    sheetBlocks,
  });
  return {
    doc,
    fieldsList,
    sheetBlocks,
    fieldData: doc.field_data || {},
    summary,
  };
}

export async function loadTemplateAiSnapshot(templateId) {
  const { documentService } = await import('../../services/documentService');
  const template = await documentService.getTemplate(templateId);
  let fieldsList = [];
  if (template.document_kind_id) {
    try {
      const structure = await documentService.getStructureByKindId(template.document_kind_id);
      fieldsList = getFieldsListFromStructure(structure);
    } catch {
      fieldsList = [];
    }
  }
  return {
    template,
    fieldsList,
    summary: buildTemplateBlock(template, { fieldsList }),
  };
}
