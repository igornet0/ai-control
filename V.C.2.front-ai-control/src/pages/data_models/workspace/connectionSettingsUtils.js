import {
  getFieldsFromWidgetSettings,
  getFieldsFromWidgetSettingsWithTable,
  resolveFieldsFromWidgetChain,
} from './interactive/incomingFieldsUtils.js';
import { getAggregateOutputFields } from './interactive/aggregateConfigSchema.js';
import { defaultLinkedModelConnectionSettings } from './interactive/linkedModelDataCodeSync.js';
import { normalizeWidgetId } from './widgetIdUtils.js';

function getFieldsForConnectionFromWidget(fromWidget, selectedTable = '', widgetManager = null) {
  if (!fromWidget) return [];
  if (fromWidget.type === 'processing-block' && fromWidget.settings?.blockType === 'aggregate') {
    const out = getAggregateOutputFields(fromWidget.settings || {});
    if (out.length) return out;
  }
  if (selectedTable) {
    const tableFields = getFieldsFromWidgetSettingsWithTable(fromWidget.settings || {}, selectedTable);
    if (tableFields.length) return tableFields;
  }
  if (widgetManager && typeof widgetManager.getWidget === 'function' && fromWidget.id != null) {
    const chain = resolveFieldsFromWidgetChain(widgetManager, fromWidget.id);
    if (chain.length) return chain;
  }
  return getFieldsFromWidgetSettings(fromWidget.settings || {});
}

export function findConnectionById(widgetManager, connectionId) {
  if (!widgetManager || !connectionId) return null;
  for (const widget of widgetManager.getAllWidgets()) {
    const match = (widget.connections || []).find((conn) => conn.id === connectionId);
    if (match) return match;
  }
  return null;
}

export function buildDefaultConnectionSettings(fromWidget, widgetManager = null) {
  const linkedDefaults = defaultLinkedModelConnectionSettings(fromWidget);
  const base = {
    ...linkedDefaults,
    filterType: 'all',
  };

  if (!fromWidget?.id) return base;

  const sourceId = normalizeWidgetId(fromWidget.id);
  const settings = fromWidget.settings || {};

  // Для data-source с несколькими таблицами (folder/archive): если одна группа — выбираем её
  if (fromWidget.type === 'data-source' && !linkedDefaults.selectedTable) {
    const groups = settings.folderConfig?.groups;
    if (Array.isArray(groups) && groups.length === 1) {
      const tableName = groups[0]?.tableName || groups[0]?.name || '';
      if (tableName) {
        base.selectedTable = tableName;
        base.inputVariable = tableName;
      }
    }
  }

  const fields = getFieldsForConnectionFromWidget(
    fromWidget,
    base.selectedTable || '',
    widgetManager,
  );

  return {
    ...base,
    selectedSource: sourceId,
    ...(fields.length ? { selectedFields: fields } : {}),
  };
}

/** Копирует колонки upstream-виджета в settings связи, если их ещё нет. */
export function syncConnectionFieldsFromUpstream(widgetManager, connectionId, fromWidget) {
  if (!widgetManager || !connectionId || !fromWidget) return false;

  const connection = findConnectionById(widgetManager, connectionId);
  if (!connection) return false;

  const selectedTable = connection.settings?.selectedTable || connection.settings?.inputVariable || '';
  const fields = getFieldsForConnectionFromWidget(fromWidget, selectedTable, widgetManager);

  if (!fields.length) return false;

  const existing = connection.settings?.selectedFields || [];
  const needsSync = !existing.length
    || fields.length !== existing.length
    || fields.some((field) => !existing.includes(field));

  if (!needsSync && connection.settings?.selectedSource) {
    return false;
  }

  widgetManager.updateConnectionSettings(connectionId, {
    ...defaultLinkedModelConnectionSettings(fromWidget),
    filterType: connection.settings?.filterType || 'all',
    selectedSource: normalizeWidgetId(fromWidget.id),
    selectedFields: fields,
  });
  return true;
}

export function syncAllConnectionFieldsFromUpstream(widgetManager) {
  if (!widgetManager) return;
  const seen = new Set();
  widgetManager.getAllWidgets().forEach((widget) => {
    (widget.connections || []).forEach((conn) => {
      if (!conn?.id || seen.has(conn.id)) return;
      seen.add(conn.id);
      const fromWidget = widgetManager.getWidget(conn.from);
      if (fromWidget) {
        syncConnectionFieldsFromUpstream(widgetManager, conn.id, fromWidget);
      }
    });
  });
}
