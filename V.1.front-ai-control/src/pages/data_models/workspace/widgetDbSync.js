import { dataModelService } from '../../../services/dataModelService';
import { normalizeConnection } from './widgetIdUtils.js';

export function parseDbWidgetId(widget) {
  if (widget?.id == null) return null;
  if (typeof widget.id === 'number') return widget.id;
  if (typeof widget.id === 'string' && /^\d+$/.test(widget.id)) {
    return parseInt(widget.id, 10);
  }
  return null;
}

export function buildWidgetApiPayload(widget, index = 0) {
  return {
    widget_type: widget.type || 'data-source',
    widget_config: {
      ...(widget.config || {}),
      settings: widget.settings || {},
      styles: widget.styles || {},
    },
    data_source: widget.dataSource || null,
    data_config: widget.dataConfig || {},
    position_x: typeof widget.x === 'number' ? widget.x : 0,
    position_y: typeof widget.y === 'number' ? widget.y : 0,
    width: typeof widget.width === 'number' ? widget.width : 250,
    order_index: typeof widget.orderIndex === 'number' ? widget.orderIndex : index,
    is_visible: widget.isVisible !== false,
    refresh_interval: typeof widget.refreshInterval === 'number' ? widget.refreshInterval : 60,
  };
}

export function remapWidgetId(engineRef, widget, oldId, newId) {
  const oldIdStr = String(oldId);
  const newIdStr = String(newId);
  widget.id = newIdStr;
  if (widget.element) {
    widget.element.dataset.widgetId = newIdStr;
  }

  const widgetManager = engineRef?.current?.widgetManager;
  if (!widgetManager) return;

  widgetManager.widgets.delete(oldIdStr);
  widgetManager.widgets.set(newIdStr, widget);
  if (widgetManager.selectedWidgets?.has(oldIdStr)) {
    widgetManager.selectedWidgets.delete(oldIdStr);
    widgetManager.selectedWidgets.add(newIdStr);
  }

  widgetManager.getAllWidgets().forEach((w) => {
    if (!Array.isArray(w.connections)) return;
    w.connections = w.connections.map((conn) => {
      const next = { ...conn };
      if (String(conn.from) === oldIdStr) next.from = newIdStr;
      if (String(conn.to) === oldIdStr) next.to = newIdStr;
      return next;
    });
  });
}

/**
 * Гарантирует, что виджет существует в data_model_widgets.
 * Если локальный числовой id отсутствует в БД — создаёт запись и обновляет id на канвасе.
 */
export async function ensureWidgetInDatabase(modelId, widget, engineRef) {
  if (!modelId || !widget) return null;

  const existingId = parseDbWidgetId(widget);
  if (existingId) {
    try {
      await dataModelService.getDataModelWidget(modelId, existingId);
      return existingId;
    } catch (error) {
      if (error.response?.status !== 404) throw error;
    }
  }

  const createdWidget = await dataModelService.createDataModelWidget(
    modelId,
    buildWidgetApiPayload(widget),
  );
  remapWidgetId(engineRef, widget, widget.id, createdWidget.id);
  return createdWidget.id;
}

export async function saveWidgetToDatabase(modelId, widget, engineRef) {
  const widgetId = await ensureWidgetInDatabase(modelId, widget, engineRef);
  if (!widgetId) return null;

  const payload = buildWidgetApiPayload(widget);
  try {
    await dataModelService.updateDataModelWidget(modelId, widgetId, payload);
    return widgetId;
  } catch (error) {
    if (error.response?.status !== 404) throw error;
    const recreatedId = await ensureWidgetInDatabase(modelId, widget, engineRef);
    await dataModelService.updateDataModelWidget(modelId, recreatedId, payload);
    return recreatedId;
  }
}

export function mapWorkspaceWidgetToApi(widget, index = 0) {
  const widgetId = parseDbWidgetId(widget) ?? undefined;
  const rawSettings = widget.settings || {};
  const settings = { ...rawSettings };
  if (settings.selectedFile && typeof settings.selectedFile === 'object') {
    const { file, ...selectedFileMeta } = settings.selectedFile;
    settings.selectedFile = selectedFileMeta;
  }

  const widgetConfig = {
    ...(widget.config || {}),
    ...(Object.keys(settings).length > 0 && { settings }),
    ...(widget.styles && { styles: widget.styles }),
  };

  return {
    ...(widgetId !== undefined ? { id: widgetId } : {}),
    widget_type: widget.type || 'data-source',
    widget_config: Object.keys(widgetConfig).length > 0 ? widgetConfig : {},
    data_source: widget.dataSource || null,
    data_config: widget.dataConfig && Object.keys(widget.dataConfig).length > 0 ? widget.dataConfig : {},
    position_x: typeof widget.x === 'number' ? widget.x : 0,
    position_y: typeof widget.y === 'number' ? widget.y : 0,
    width: typeof widget.width === 'number' ? widget.width : 250,
    order_index: typeof widget.orderIndex === 'number' ? widget.orderIndex : index,
    is_visible: widget.isVisible !== false,
    refresh_interval: typeof widget.refreshInterval === 'number' ? widget.refreshInterval : 60,
  };
}

export function mapConnectionsToRelationships(connections = []) {
  const relationships = {};
  connections.forEach((conn, index) => {
    const normalized = normalizeConnection(conn);
    const relId = `connection_${normalized.id || index}`;
    relationships[relId] = {
      id: normalized.id,
      from: normalized.from,
      to: normalized.to,
      fromType: normalized.fromType || 'output',
      toType: normalized.toType || 'input',
      settings: normalized.settings || {},
    };
  });
  return relationships;
}

/** Сохранить все виджеты и связи workspace в БД одним пакетом. */
export async function persistWorkspaceState(modelId, workspaceState) {
  if (!modelId || !workspaceState) return;

  const widgets = (workspaceState.widgets || [])
    .filter(Boolean)
    .map((widget, index) => mapWorkspaceWidgetToApi(widget, index));

  if (widgets.length > 0) {
    await dataModelService.bulkUpdateDataModelWidgets(modelId, widgets);
  }

  await dataModelService.updateModelRelationships(
    modelId,
    mapConnectionsToRelationships(workspaceState.connections || []),
  );
}
