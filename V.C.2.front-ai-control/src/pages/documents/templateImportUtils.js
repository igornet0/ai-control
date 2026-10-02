import Papa from 'papaparse';
import { FIELD_DISPLAY, DEFAULT_TABLE_COLUMNS } from './SheetEditor';
import { normalizeSheetFieldBlocks, applyImportedTableColumns, buildImportedColumnsMap } from './documentTableColumns';
import { isTableFieldBlock } from './tableFieldUtils';
import { papaResultToFieldRows } from './csvUtils';
import { normalizePageNumberStyle } from './documentPageNumber';
import { normalizePageLayout } from './documentPageLayout';
import { normalizeSummaryConfig } from './spreadsheetSummary';
import {
  SPREADSHEET_BLOCK_TYPE,
  SPREADSHEET_FIELD_FORMAT,
  buildSpreadsheetBlock,
  spreadsheetBlockToGridModel,
  mergeSpreadsheetSheetWithDataRows,
  gridWorkbookToFieldValue,
  gridModelToTableColumns,
  normalizeSpreadsheetFieldValue,
  isLegacySpreadsheetFieldValue,
} from './spreadsheetGridUtils';

function isPlainFieldMap(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  const reserved = new Set([
    'export_format',
    'export_version',
    'exported_at',
    'variant',
    'template',
    'structure',
    'structure_fields',
    'sheet_content',
    'default_values',
    'title_template',
    'title_style',
    'page_number_style',
    'page_layout_style',
  ]);
  return Object.keys(obj).some((k) => !reserved.has(k));
}

export function detectImportFormat(text, fileName, preferred = 'auto') {
  if (preferred === 'json' || preferred === 'csv') return preferred;
  const name = String(fileName || '').toLowerCase();
  if (name.endsWith('.json')) return 'json';
  if (name.endsWith('.csv')) return 'csv';
  const trimmed = String(text || '').trim();
  if (!trimmed) return 'json';
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json';
  return 'csv';
}

export function parseJsonImportText(text) {
  try {
    return { ok: true, data: JSON.parse(String(text || '').trim()) };
  } catch {
    return { ok: false, error: 'Некорректный JSON' };
  }
}

export function parseCsvImportText(text, columns) {
  const cols = Array.isArray(columns) && columns.length > 0 ? columns : DEFAULT_TABLE_COLUMNS;
  const result = Papa.parse(String(text || '').trim(), {
    header: true,
    skipEmptyLines: 'greedy',
  });
  if (result.errors?.length) {
    const msg = result.errors.map((e) => e.message).filter(Boolean).join('; ');
    return { ok: false, error: msg || 'Не удалось разобрать CSV' };
  }
  const rows = papaResultToFieldRows(result, cols);
  if (rows.length === 0) {
    return { ok: false, error: 'В CSV нет строк данных' };
  }
  return { ok: true, rows };
}

export function getTableFieldOptions({ isTableTemplate, sheetBlocks, fieldsList }) {
  if (isTableTemplate) {
    const fn = sheetBlocks[0]?.field_name
      || fieldsList.find((f) => f.type === 'table')?.name
      || 'Данные';
    return [{ key: fn, label: fn }];
  }
  const keys = new Set();
  const options = [];
  sheetBlocks.forEach((b) => {
    if (b?.type === SPREADSHEET_BLOCK_TYPE && b.field_name) {
      if (!keys.has(b.field_name)) {
        keys.add(b.field_name);
        options.push({ key: b.field_name, label: b.field_name });
      }
      return;
    }
    if (b?.type === 'field' && b.displayType === FIELD_DISPLAY.table && b.field_name) {
      if (!keys.has(b.field_name)) {
        keys.add(b.field_name);
        options.push({ key: b.field_name, label: b.field_name });
      }
    }
  });
  fieldsList.forEach((f) => {
    if (f.type === 'table' && f.name && !keys.has(f.name)) {
      keys.add(f.name);
      options.push({ key: f.name, label: f.name });
    }
  });
  return options;
}

export function getImportColumns({
  isTableTemplate,
  sheetBlocks,
  tableGridModel,
  fieldsList,
  targetFieldName,
}) {
  if (isTableTemplate) {
    const b = sheetBlocks[0];
    if (tableGridModel?.sheets?.[0]) {
      return gridModelToTableColumns(tableGridModel.sheets[0]);
    }
    if (b) {
      const wb = spreadsheetBlockToGridModel(b);
      if (wb?.sheets?.[0]) return gridModelToTableColumns(wb.sheets[0]);
    }
    return DEFAULT_TABLE_COLUMNS;
  }
  const name = targetFieldName;
  const spreadBlock = sheetBlocks.find((b) => b.type === SPREADSHEET_BLOCK_TYPE && b.field_name === name);
  if (spreadBlock) {
    const wb = spreadsheetBlockToGridModel(spreadBlock);
    if (wb?.sheets?.[0]) return gridModelToTableColumns(wb.sheets[0]);
  }
  const legacyBlock = sheetBlocks.find(
    (b) => b.type === 'field' && b.field_name === name && b.displayType === FIELD_DISPLAY.table,
  );
  if (legacyBlock?.tableColumns?.length) return legacyBlock.tableColumns;
  const field = fieldsList.find((f) => f.name === name && f.type === 'table');
  if (field?.columns?.length) return field.columns;
  return DEFAULT_TABLE_COLUMNS;
}

function mergeDefaultValues(current, imported, mode) {
  const cur = current && typeof current === 'object' && !Array.isArray(current) ? current : {};
  const imp = imported && typeof imported === 'object' && !Array.isArray(imported) ? imported : {};
  if (mode === 'replace') return { ...imp };
  return { ...cur, ...imp };
}

function isSpreadsheetFieldBlock(sheetBlocks, fieldName) {
  return sheetBlocks.some((b) => b.type === SPREADSHEET_BLOCK_TYPE && b.field_name === fieldName);
}

function isLegacyTableFieldBlock(sheetBlocks, fieldsList, fieldName) {
  return sheetBlocks.some(
    (b) => b.type === 'field' && b.field_name === fieldName && isTableFieldBlock(b, fieldsList),
  ) || fieldsList.some((f) => f.name === fieldName && f.type === 'table');
}

export function isSpreadsheetFieldValue(value) {
  if (isLegacySpreadsheetFieldValue(value)) return true;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  if (value.__format === SPREADSHEET_FIELD_FORMAT) return true;
  return Object.keys(value).some((k) => k !== '__format' && Array.isArray(value[k]));
}

function applySpreadsheetFieldValueToTemplate({
  sheetBlocks,
  tableGridModel,
  defaultValues,
  fieldName,
  fieldValue,
}) {
  const b0 = sheetBlocks.find((b) => b.type === SPREADSHEET_BLOCK_TYPE && (!fieldName || b.field_name === fieldName))
    || sheetBlocks[0];
  if (!b0 || b0.type !== SPREADSHEET_BLOCK_TYPE) {
    return { ok: false, error: 'Табличный блок шаблона не найден' };
  }
  const fn = fieldName || b0.field_name;
  const wb = (tableGridModel && b0 === sheetBlocks[0]) ? tableGridModel : spreadsheetBlockToGridModel(b0);
  if (!wb) return { ok: false, error: 'Не удалось загрузить сетку таблицы' };

  const dataMap = normalizeSpreadsheetFieldValue(fieldValue, wb.sheets);
  const mergedSheets = wb.sheets.map((sh) => {
    const merged = mergeSpreadsheetSheetWithDataRows(sh, dataMap[sh.id] || []);
    return {
      ...sh,
      rowCount: merged.rowCount,
      colCount: merged.colCount,
      hasHeaderRow: merged.hasHeaderRow,
      cells: merged.cells,
      tableColumns: merged.tableColumns,
      summary: normalizeSummaryConfig(sh.summary, merged.tableColumns),
    };
  });
  const nextGrid = { sheets: mergedSheets, activeSheetId: wb.activeSheetId };
  const nextBlock = buildSpreadsheetBlock(fn, nextGrid);
  const nextDefaults = {
    ...(defaultValues && typeof defaultValues === 'object' ? defaultValues : {}),
    [fn]: gridWorkbookToFieldValue(nextGrid, nextBlock),
  };
  const nextBlocks = sheetBlocks.map((b) => (
    b.type === SPREADSHEET_BLOCK_TYPE && b.field_name === fn ? nextBlock : b
  ));
  const rowCount = Object.values(dataMap).reduce((sum, rows) => sum + (Array.isArray(rows) ? rows.length : 0), 0);
  return {
    ok: true,
    patch: {
      defaultValues: nextDefaults,
      tableGridModel: b0 === sheetBlocks[0] ? nextGrid : tableGridModel,
      sheetBlocks: nextBlocks.length ? nextBlocks : [nextBlock],
    },
    message: `Импортировано строк: ${rowCount}`,
  };
}

export function applyRowsToTableTemplate({
  sheetBlocks,
  tableGridModel,
  defaultValues,
  fieldName,
  rows,
}) {
  return applySpreadsheetFieldValueToTemplate({
    sheetBlocks,
    tableGridModel,
    defaultValues,
    fieldName,
    fieldValue: rows,
  });
}

function applyRowsToDocumentField({ defaultValues, fieldName, rows, mode }) {
  if (!fieldName) {
    return { ok: false, error: 'Выберите поле таблицы для импорта CSV' };
  }
  const cur = defaultValues && typeof defaultValues === 'object' ? defaultValues : {};
  const next = mode === 'replace'
    ? { [fieldName]: rows }
    : { ...cur, [fieldName]: rows };
  return {
    ok: true,
    patch: { defaultValues: next },
    message: `Импортировано строк в «${fieldName}»: ${rows.length}`,
  };
}

function extractTemplatePayload(data) {
  if (!data || typeof data !== 'object') return null;
  if (data.export_format === 'aicontrol.template' || data.sheet_content != null) {
    return {
      kind: 'template',
      defaultValues: data.default_values,
      sheetContent: data.sheet_content,
      structureFields: data.structure_fields,
      titleTemplate: data.title_template,
      titleStyle: data.title_style,
      pageNumberStyle: data.page_number_style,
      pageLayoutStyle: data.page_layout_style,
    };
  }
  if (data.default_values && typeof data.default_values === 'object' && !Array.isArray(data.default_values)) {
    return { kind: 'fields', defaultValues: data.default_values };
  }
  if (Array.isArray(data)) {
    return { kind: 'rows', rows: data };
  }
  if (isPlainFieldMap(data)) {
    return { kind: 'fields', defaultValues: data };
  }
  return null;
}

export function applyTemplateImport({
  text,
  format,
  mode,
  targetFieldName,
  importSheetContent,
  isTableTemplate,
  fieldsList,
  sheetBlocks,
  defaultValues,
  tableGridModel,
}) {
  const detected = detectImportFormat(text, '', format);
  const columns = getImportColumns({
    isTableTemplate,
    sheetBlocks,
    tableGridModel,
    fieldsList,
    targetFieldName,
  });

  if (detected === 'csv') {
    const parsed = parseCsvImportText(text, columns);
    if (!parsed.ok) return parsed;
    if (isTableTemplate || isSpreadsheetFieldBlock(sheetBlocks, targetFieldName)) {
      return applyRowsToTableTemplate({
        sheetBlocks,
        tableGridModel,
        defaultValues,
        fieldName: targetFieldName,
        rows: parsed.rows,
      });
    }
    return applyRowsToDocumentField({
      defaultValues,
      fieldName: targetFieldName,
      rows: parsed.rows,
      mode,
    });
  }

  const parsedJson = parseJsonImportText(text);
  if (!parsedJson.ok) return parsedJson;
  const payload = extractTemplatePayload(parsedJson.data);
  if (!payload) {
    return { ok: false, error: 'JSON не содержит полей шаблона или строк таблицы' };
  }

  if (payload.kind === 'rows') {
    if (isTableTemplate || isSpreadsheetFieldBlock(sheetBlocks, targetFieldName)) {
      return applyRowsToTableTemplate({
        sheetBlocks,
        tableGridModel,
        defaultValues,
        fieldName: targetFieldName,
        rows: payload.rows,
      });
    }
    return applyRowsToDocumentField({
      defaultValues,
      fieldName: targetFieldName,
      rows: payload.rows,
      mode,
    });
  }

  const patch = {};
  const messages = [];

  if (payload.defaultValues && typeof payload.defaultValues === 'object') {
    const imported = { ...payload.defaultValues };
    let nextDefaults = mode === 'replace' ? {} : (patch.defaultValues ?? defaultValues);
    let nextGrid = patch.tableGridModel ?? tableGridModel;
    let nextBlocks = patch.sheetBlocks ?? sheetBlocks;

    Object.keys(imported).forEach((fieldName) => {
      const val = imported[fieldName];
      const useSpreadsheet = isTableTemplate
        || isSpreadsheetFieldBlock(nextBlocks, fieldName);
      if (useSpreadsheet && isSpreadsheetFieldValue(val)) {
        const tableResult = applySpreadsheetFieldValueToTemplate({
          sheetBlocks: nextBlocks,
          tableGridModel: nextGrid,
          defaultValues: nextDefaults,
          fieldName,
          fieldValue: val,
        });
        if (!tableResult.ok) return;
        nextDefaults = tableResult.patch.defaultValues;
        nextGrid = tableResult.patch.tableGridModel ?? nextGrid;
        nextBlocks = tableResult.patch.sheetBlocks ?? nextBlocks;
        messages.push(tableResult.message);
        delete imported[fieldName];
        return;
      }
      if (!Array.isArray(val)) return;
      if (isLegacyTableFieldBlock(nextBlocks, fieldsList, fieldName)) {
        const docResult = applyRowsToDocumentField({
          defaultValues: nextDefaults,
          fieldName,
          rows: val,
          mode,
        });
        if (!docResult.ok) return;
        nextDefaults = docResult.patch.defaultValues;
        messages.push(docResult.message);
        delete imported[fieldName];
        return;
      }
      if (!useSpreadsheet) return;
      const tableResult = applyRowsToTableTemplate({
        sheetBlocks: nextBlocks,
        tableGridModel: nextGrid,
        defaultValues: nextDefaults,
        fieldName,
        rows: val,
      });
      if (!tableResult.ok) return;
      nextDefaults = tableResult.patch.defaultValues;
      nextGrid = tableResult.patch.tableGridModel ?? nextGrid;
      nextBlocks = tableResult.patch.sheetBlocks ?? nextBlocks;
      messages.push(tableResult.message);
      delete imported[fieldName];
    });

    patch.defaultValues = { ...nextDefaults, ...imported };
    if (nextGrid !== tableGridModel) patch.tableGridModel = nextGrid;
    if (nextBlocks !== sheetBlocks) patch.sheetBlocks = nextBlocks;
    const scalarCount = Object.keys(imported).length;
    if (scalarCount > 0) {
      messages.push(`Импортировано полей: ${scalarCount}`);
    }
  }

  const isFullTemplateExport = parsedJson.data?.export_format === 'aicontrol.template';
  const shouldImportSheetContent = importSheetContent || isFullTemplateExport;

  if (shouldImportSheetContent && Array.isArray(payload.sheetContent) && payload.sheetContent.length > 0) {
    patch.sheetBlocks = normalizeSheetFieldBlocks(payload.sheetContent, fieldsList);
    messages.push('Разметка листа импортирована');
  }

  if (payload.titleTemplate != null) {
    patch.titleTemplate = payload.titleTemplate;
    messages.push('Заголовок импортирован');
  }
  if (payload.titleStyle != null && typeof payload.titleStyle === 'object') {
    patch.titleStyle = payload.titleStyle;
  }
  if (payload.pageNumberStyle != null) {
    patch.pageNumberStyle = normalizePageNumberStyle(payload.pageNumberStyle);
  }
  if (payload.pageLayoutStyle != null) {
    patch.pageLayoutStyle = normalizePageLayout(payload.pageLayoutStyle);
  }

  const importedColumnsMap = buildImportedColumnsMap({
    sheetContent: payload.sheetContent,
    structureFields: payload.structureFields,
    defaultValues: payload.defaultValues,
  });
  if (Object.keys(importedColumnsMap).length > 0) {
    const baseBlocks = Array.isArray(patch.sheetBlocks) ? patch.sheetBlocks : sheetBlocks;
    const withColumns = applyImportedTableColumns(baseBlocks, fieldsList, importedColumnsMap);
    if (JSON.stringify(withColumns) !== JSON.stringify(baseBlocks)) {
      patch.sheetBlocks = withColumns;
      messages.push('Колонки таблиц обновлены');
    }
  }

  if (Object.keys(patch).length === 0) {
    return { ok: false, error: 'В JSON нет данных для импорта' };
  }

  return {
    ok: true,
    patch,
    message: messages.length ? messages.join('. ') : 'Данные импортированы',
  };
}
