/**
 * Резолв полей входящего соединения для блоков обработки (фильтр, трансформация).
 */

import { findLinkedTable, normalizeLinkedTables } from './linkedModelDataCodeSync.js';
import { joinResultColumns, unionColumnLists } from './joinConfigSchema.js';
import { getAggregateOutputFields } from './aggregateConfigSchema.js';

export function normalizeFieldNames(cols) {
  return (cols || [])
    .map((c) => (typeof c === 'string' ? c : (c?.name ?? c?.id ?? String(c))))
    .filter(Boolean);
}

export function getFieldsFromLinkedModel(settings = {}, tableHint = '') {
  const match = findLinkedTable(settings, tableHint);
  if (match) return normalizeFieldNames(match.columns);
  const tables = normalizeLinkedTables(settings);
  if (tables.length === 1) return normalizeFieldNames(tables[0].columns);
  return [];
}

/**
 * Возвращает список «таблиц» источника данных — для показа selector в соединении.
 * Каждый элемент: { name: string, alias: string, columns: string[] }
 * Возвращает [] если источник имеет только одну безымянную таблицу (нет смысла выбирать).
 */
export function getSourceTables(settings = {}) {
  // data-model: selectedTables[]
  const linkedTables = normalizeLinkedTables(settings);
  if (linkedTables.length > 1) return linkedTables;
  if (linkedTables.length === 1) return linkedTables; // одна — тоже возвращаем (для единообразия)

  // folder/archive: folderConfig.groups[]
  const groups = settings.folderConfig?.groups;
  if (Array.isArray(groups) && groups.length > 0) {
    const tables = groups
      .filter((g) => g && (g.tableName || g.name))
      .map((g) => {
        const name = g.tableName || g.name || '';
        const cols = g.schema?.columns
          ? normalizeFieldNames(g.schema.columns.map((c) => c.name || c))
          : normalizeFieldNames(g.columns || []);
        return { name, alias: name, columns: cols };
      });
    if (tables.length > 1) return tables;
    if (tables.length === 1) return tables;
  }

  // file с несколькими листами (xlsx): sheetColumns
  const file = settings.selectedFile;
  if (file?.sheetColumns && typeof file.sheetColumns === 'object') {
    const sheets = Object.keys(file.sheetColumns);
    if (sheets.length > 1) {
      return sheets.map((sheet) => ({
        name: sheet,
        alias: sheet,
        columns: normalizeFieldNames(file.sheetColumns[sheet]),
      }));
    }
  }

  return [];
}

/**
 * Возвращает поля source-виджета с учётом выбранной таблицы в connection.settings.
 * Если selectedTable задана и виджет многотабличный — вернёт поля именно этой таблицы.
 */
export function getFieldsFromWidgetSettingsWithTable(widgetSettings = {}, selectedTable = '') {
  if (selectedTable) {
    // data-model
    const linkedTables = normalizeLinkedTables(widgetSettings);
    if (linkedTables.length) {
      const match = linkedTables.find((t) => t.alias === selectedTable || t.name === selectedTable);
      if (match) return normalizeFieldNames(match.columns);
    }
    // folder/archive groups
    const groups = widgetSettings.folderConfig?.groups;
    if (Array.isArray(groups)) {
      const match = groups.find((g) => (g.tableName || g.name) === selectedTable);
      if (match) {
        const cols = match.schema?.columns
          ? normalizeFieldNames(match.schema.columns.map((c) => c.name || c))
          : normalizeFieldNames(match.columns || []);
        if (cols.length) return cols;
      }
    }
    // xlsx sheets
    const file = widgetSettings.selectedFile;
    if (file?.sheetColumns?.[selectedTable]) {
      return normalizeFieldNames(file.sheetColumns[selectedTable]);
    }
  }
  return getFieldsFromWidgetSettings(widgetSettings);
}

export function getFieldsFromWidgetSettings(settings = {}) {
  const linkedTables = normalizeLinkedTables(settings);
  if (linkedTables.length) {
    const hint = settings.primaryTable || settings.dataCodeVariableName;
    const fields = getFieldsFromLinkedModel(settings, hint);
    if (fields.length) return fields;
  }

  const direct = settings.selectedColumns
    || settings.fileColumns
    || settings.originalFileColumns
    || settings.availableFields
    || settings.columns
    || settings.dbColumns   // database source: колонки сохранённые из preview
    || [];
  let fields = normalizeFieldNames(direct);
  if (fields.length) return fields;

  const file = settings.selectedFile;
  if (file) {
    if (file.columns?.length) {
      return normalizeFieldNames(file.columns);
    }
    const sheet = settings.excelSheet || settings.selectedSheet;
    if (sheet && file.sheetColumns?.[sheet]) {
      return normalizeFieldNames(file.sheetColumns[sheet]);
    }
  }

  // interactive source: columns live in table.fields[].name, not table.columns
  const interactiveFields = settings.interactiveConfig?.table?.fields;
  const interactiveCols = Array.isArray(interactiveFields) && interactiveFields.length
    ? interactiveFields.map((f) => f?.name).filter(Boolean)
    : settings.interactiveConfig?.table?.columns
      || settings.interactiveConfig?.columns;
  if (interactiveCols?.length) {
    return normalizeFieldNames(interactiveCols);
  }

  if (Array.isArray(settings.previewRows) && settings.previewRows.length > 0) {
    const previewCols = Object.keys(settings.previewRows[0] || {});
    if (previewCols.length) return normalizeFieldNames(previewCols);
  }

  const groups = settings.folderConfig?.groups;
  if (groups?.length) {
    const schemaCols = groups[0]?.schema?.columns;
    if (schemaCols?.length) {
      return normalizeFieldNames(schemaCols.map((c) => c.name || c));
    }
    if (groups[0]?.columns?.length) {
      return normalizeFieldNames(groups[0].columns);
    }
  }

  return [];
}

function getFieldsFromConnectionSettings(connSettings = {}) {
  let fields = normalizeFieldNames(connSettings.selectedFields);
  if (fields.length) return fields;

  const selectedFiles = connSettings.selectedFiles || [];
  if (!selectedFiles.length) return [];

  const first = selectedFiles[0];
  const sheet = connSettings.selectedSheet || first?.sheet;
  const cols = first?.columns
    || (sheet && first?.sheetColumns?.[sheet])
    || [];
  return normalizeFieldNames(cols);
}

/**
 * Apply transform operations to a column list (rename / drop / add / select).
 * Order matches transformDataCodeSync execution order.
 */
export function applyTransformOpsToFields(fields = [], transformSettings = {}) {
  let cols = normalizeFieldNames(fields);
  const ops = transformSettings?.operations || [];
  for (const op of ops) {
    if (!op || op.enabled === false) continue;
    const p = op.params || {};
    switch (op.type) {
      case 'renameColumn':
        if (p.column && p.newName) {
          cols = cols.map((c) => (c === p.column ? String(p.newName) : c));
        }
        break;
      case 'dropColumn':
        if (p.column) cols = cols.filter((c) => c !== p.column);
        break;
      case 'addColumn':
        if (p.name && !cols.includes(p.name)) cols = [...cols, String(p.name)];
        break;
      case 'selectColumns':
      case 'reorderColumns':
        if (p.columns?.length) {
          cols = normalizeFieldNames(p.columns);
        }
        break;
      default:
        break;
    }
  }
  return cols;
}

/**
 * Map a stored column name through transform rename chain → effective name.
 */
export function resolveEffectiveColumnName(column, transformSettings = {}) {
  if (!column) return column;
  let name = String(column);
  const ops = transformSettings?.operations || [];
  for (const op of ops) {
    if (!op || op.enabled === false) continue;
    if (op.type !== 'renameColumn') continue;
    const p = op.params || {};
    if (p.column && p.newName && p.column === name) {
      name = String(p.newName);
    }
  }
  return name;
}

export function resolveFieldsFromWidgetChain(widgetManager, widgetId, depth = 0) {
  if (!widgetManager || widgetId == null || depth > 12) return [];

  const widget = widgetManager.getWidget(widgetId);
  if (!widget?.settings) return [];

  // Aggregate produces a new schema (groupBy + metric aliases).
  // Ignore cached availableFields — those are input columns.
  if (widget.type === 'processing-block' && widget.settings.blockType === 'aggregate') {
    const aggregateOut = getAggregateOutputFields(widget.settings);
    if (aggregateOut.length) return aggregateOut;
  }

  const fields = getFieldsFromWidgetSettings(widget.settings);
  if (fields.length) {
    if (widget.type === 'processing-block' && widget.settings.blockType === 'transform') {
      return applyTransformOpsToFields(fields, widget.settings);
    }
    // Aggregate must not treat input availableFields as its output schema.
    if (!(widget.type === 'processing-block' && widget.settings.blockType === 'aggregate')) {
      return fields;
    }
  }

  if (widget.type === 'processing-block' || widget.type === 'formula') {
    const incoming = (widget.connections || []).filter((c) => String(c.to) === String(widget.id));
    if (widget.settings.blockType === 'join') {
      const colSets = incoming.map((conn) => {
        const up = widgetManager.getWidget(conn.from);
        if (up?.type === 'data-model') {
          return getFieldsFromLinkedModel(
            up.settings,
            conn.settings?.selectedTable || conn.settings?.inputVariable,
          );
        }
        return resolveFieldsFromWidgetChain(widgetManager, conn.from, depth + 1);
      });
      if ((widget.settings.joinMode || 'join') === 'merge') {
        return unionColumnLists(...colSets);
      }
      return colSets.slice(1).reduce(
        (left, right) => joinResultColumns(left, right, widget.settings.joinType || 'left'),
        colSets[0] || [],
      );
    }
    const first = incoming[0];
    if (first?.from) {
      const upstream = widgetManager.getWidget(first.from);
      if (upstream?.type === 'data-model') {
        const linkedFields = getFieldsFromLinkedModel(
          upstream.settings,
          first.settings?.selectedTable || first.settings?.inputVariable,
        );
        if (widget.settings.blockType === 'transform') {
          return applyTransformOpsToFields(linkedFields, widget.settings);
        }
        if (widget.settings.blockType === 'aggregate') {
          // Still unconfigured — no output schema yet
          return [];
        }
        if (widget.type === 'formula') {
          const exprs = widget.settings.expressions || [];
          const added = exprs
            .map((e) => e?.name)
            .filter((n) => n && !linkedFields.includes(n));
          return [...linkedFields, ...added];
        }
        return linkedFields;
      }
      const upstreamConnFields = getFieldsFromConnectionSettings(first.settings);
      const base = upstreamConnFields.length
        ? upstreamConnFields
        : resolveFieldsFromWidgetChain(widgetManager, first.from, depth + 1);
      if (widget.settings.blockType === 'transform') {
        return applyTransformOpsToFields(base, widget.settings);
      }
      if (widget.settings.blockType === 'aggregate') {
        return [];
      }
      if (widget.type === 'formula') {
        const exprs = widget.settings.expressions || [];
        const added = exprs
          .map((e) => e?.name)
          .filter((n) => n && !base.includes(n));
        return [...base, ...added];
      }
      return base;
    }
  }

  return [];
}

/**
 * @param {object|null} incomingConnection — входящее соединение (с isIncoming, from, settings)
 * @param {object|null} widgetManager
 */
export function resolveIncomingAvailableFields(incomingConnection, widgetManager) {
  if (!incomingConnection || !widgetManager) return [];

  const connSettings = incomingConnection.settings || {};
  const connFields = getFieldsFromConnectionSettings(connSettings);

  const sourceId = connSettings.selectedSource || incomingConnection.from;
  const sourceWidget = widgetManager.getWidget(sourceId)
    || incomingConnection.fromWidget
    || null;

  // Prefer aggregate output schema over stale connection.selectedFields / availableFields.
  if (sourceWidget?.type === 'processing-block' && sourceWidget.settings?.blockType === 'aggregate') {
    const aggregateOut = getAggregateOutputFields(sourceWidget.settings);
    if (aggregateOut.length) return aggregateOut;
  }

  if (sourceWidget?.type === 'data-model') {
    return getFieldsFromLinkedModel(
      sourceWidget.settings,
      connSettings.selectedTable || connSettings.inputVariable,
    );
  }
  // Для data-source с многотабличным источником (folder/xlsx) учитываем selectedTable
  if (sourceWidget?.type === 'data-source' && (connSettings.selectedTable || connSettings.inputVariable)) {
    const tableHint = connSettings.selectedTable || connSettings.inputVariable;
    const tableFields = getFieldsFromWidgetSettingsWithTable(sourceWidget.settings || {}, tableHint);
    if (tableFields.length) return tableFields;
  }
  const sourceFields = resolveFieldsFromWidgetChain(widgetManager, sourceId);

  if (connFields.length) {
    const src = widgetManager.getWidget(sourceId);
    if (src?.settings?.blockType === 'transform') {
      return applyTransformOpsToFields(connFields, src.settings);
    }
    // Ignore connection selectedFields when they look like pre-aggregate input columns
    // and the source is a processing block whose chain already resolved a schema.
    if (src?.type === 'processing-block' && sourceFields.length) {
      return sourceFields;
    }
    return connFields;
  }
  if (sourceFields.length) return sourceFields;

  if (connSettings.filterType === 'all' || !connSettings.filterType) {
    const fromFields = resolveFieldsFromWidgetChain(widgetManager, incomingConnection.from);
    if (fromFields.length) return fromFields;
  }

  return [];
}
