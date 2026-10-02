import { DEFAULT_TABLE_COLUMNS, FIELD_DISPLAY } from './SheetEditor';
import { isTableFieldBlock, isTableFieldValue } from './tableFieldUtils';

/** Колонки таблицы для блока листа и мета поля структуры */
export function resolveTableColumns(block, fieldMeta) {
  if (Array.isArray(block?.tableColumns) && block.tableColumns.length > 0) {
    return block.tableColumns;
  }
  if (Array.isArray(fieldMeta?.columns) && fieldMeta.columns.length > 0) {
    return fieldMeta.columns;
  }
  return DEFAULT_TABLE_COLUMNS;
}

export function copyDefaultTableColumns() {
  return DEFAULT_TABLE_COLUMNS.map((c) => ({ ...c, dataType: c.dataType != null ? String(c.dataType) : 'string' }));
}

function cloneTableColumns(columns) {
  return columns.map((c) => ({
    key: String(c.key ?? c.label ?? ''),
    label: String(c.label ?? c.key ?? ''),
    ...(c.dataType != null ? { dataType: c.dataType } : {}),
  }));
}

/** Колонки из первой строки табличных данных (ключи → key и label). */
export function inferTableColumnsFromRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const first = rows.find((row) => row && typeof row === 'object' && !Array.isArray(row));
  if (!first) return null;
  return Object.keys(first).map((key) => ({ key, label: key }));
}

/**
 * Собирает колонки таблиц из импорта: sheet_content > structure_fields > строки default_values.
 */
export function buildImportedColumnsMap({ sheetContent, structureFields, defaultValues } = {}) {
  const map = {};

  if (defaultValues && typeof defaultValues === 'object') {
    Object.entries(defaultValues).forEach(([fieldName, val]) => {
      if (!isTableFieldValue(val)) return;
      const cols = inferTableColumnsFromRows(val);
      if (cols) map[fieldName] = cols;
    });
  }

  (structureFields || []).forEach((field) => {
    if (field?.type === 'table' && Array.isArray(field.columns) && field.columns.length > 0) {
      map[field.name] = cloneTableColumns(field.columns);
    }
  });

  (sheetContent || []).forEach((block) => {
    if (block?.type === 'field' && block.field_name && Array.isArray(block.tableColumns) && block.tableColumns.length > 0) {
      map[block.field_name] = cloneTableColumns(block.tableColumns);
    }
  });

  return map;
}

/** Подставляет импортированные колонки в блоки листа (заголовки таблицы на превью). */
export function applyImportedTableColumns(blocks, fieldsList, importedByField) {
  if (!Array.isArray(blocks) || !importedByField || typeof importedByField !== 'object') {
    return blocks;
  }
  const names = Object.keys(importedByField);
  if (names.length === 0) return blocks;

  return blocks.map((block) => {
    if (block?.type !== 'field' || !block.field_name) return block;
    const imported = importedByField[block.field_name];
    if (!Array.isArray(imported) || imported.length === 0) return block;
    const isTable = isTableFieldBlock(block, fieldsList)
      || isTableFieldValue(imported)
      || block.displayType === FIELD_DISPLAY.table;
    if (!isTable) return block;
    return {
      ...block,
      displayType: FIELD_DISPLAY.table,
      tableColumns: cloneTableColumns(imported),
    };
  });
}

/** Дополняет блоки листа displayType/tableColumns по структуре документа. */
export function normalizeSheetFieldBlocks(blocks, fieldsList) {
  if (!Array.isArray(blocks)) return [];
  return blocks.map((block) => {
    if (!isTableFieldBlock(block, fieldsList)) return block;
    const meta = Array.isArray(fieldsList)
      ? fieldsList.find((f) => f.name === block.field_name)
      : undefined;
    const patch = {};
    if (block.displayType !== FIELD_DISPLAY.table) {
      patch.displayType = FIELD_DISPLAY.table;
    }
    if (!Array.isArray(block.tableColumns) || block.tableColumns.length === 0) {
      patch.tableColumns = resolveTableColumns(block, meta).map((c) => ({ ...c }));
    }
    return Object.keys(patch).length > 0 ? { ...block, ...patch } : block;
  });
}
