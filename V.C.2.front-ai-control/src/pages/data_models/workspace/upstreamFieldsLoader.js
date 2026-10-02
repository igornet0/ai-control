import { dataModelService } from '../../../services/dataModelService';
import { parseFileSourceFromCode } from './interactive/fileSourceDataCodeSync.js';
import { parseDbWidgetId } from './widgetDbSync.js';
import { syncConnectionFieldsFromUpstream } from './connectionSettingsUtils.js';
import {
  getFieldsFromWidgetSettings,
  normalizeFieldNames,
  resolveIncomingAvailableFields,
} from './interactive/incomingFieldsUtils.js';

function extractFieldsFromDataCode(sourceWidget, code = '') {
  if (!code?.trim() || !sourceWidget) return [];

  const sourceType = sourceWidget.settings?.sourceType;
  if (sourceType === 'file' || sourceType === 'folder' || sourceType === 'archive' || !sourceType) {
    const parsed = parseFileSourceFromCode(
      code,
      sourceWidget.settings?.dataCodeVariableName,
    );
    if (parsed?.selectedColumns?.length) {
      return normalizeFieldNames(parsed.selectedColumns);
    }
  }

  const sourceTableMatch = code.match(/source_table\s*\(\s*"([^"]+)"\s*,\s*\[([\s\S]*?)\]/);
  if (sourceTableMatch?.[2]) {
    const cols = sourceTableMatch[2]
      .split(',')
      .map((part) => part.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean);
    if (cols.length) return cols;
  }

  return [];
}

function applyFieldsToWidgetSettings(widget, fields = []) {
  if (!widget || !fields.length) return;
  const normalized = normalizeFieldNames(fields);
  if (!normalized.length) return;

  widget.settings = {
    ...widget.settings,
    selectedColumns: normalized,
    fileColumns: normalized,
  };
}

export async function loadUpstreamFieldsAsync({
  incomingConnection,
  widgetManager,
  modelId,
  dataModelService: dataModelServiceOverride,
}) {
  const api = dataModelServiceOverride || dataModelService;
  if (!incomingConnection || !widgetManager) return [];

  const immediate = resolveIncomingAvailableFields(incomingConnection, widgetManager);
  if (immediate.length) return immediate;

  if (!modelId) return [];

  const sourceWidget = widgetManager.getWidget(incomingConnection.from)
    || incomingConnection.fromWidget
    || null;
  if (!sourceWidget) return [];

  const existing = getFieldsFromWidgetSettings(sourceWidget.settings || {});
  if (existing.length) {
    if (incomingConnection.id) {
      syncConnectionFieldsFromUpstream(widgetManager, incomingConnection.id, sourceWidget);
    }
    return existing;
  }

  const widgetDbId = parseDbWidgetId(sourceWidget);
  if (widgetDbId) {
    try {
      const codeResponse = await api.getModelCode(modelId, widgetDbId);
      const code = codeResponse?.code || codeResponse?.content || '';
      const fromCode = extractFieldsFromDataCode(sourceWidget, code);
      if (fromCode.length) {
        applyFieldsToWidgetSettings(sourceWidget, fromCode);
        if (incomingConnection.id) {
          syncConnectionFieldsFromUpstream(widgetManager, incomingConnection.id, sourceWidget);
        }
        return fromCode;
      }
    } catch {
      // ignore — fall through to files API
    }

    try {
      const filesResponse = await api.getModelFiles(modelId);
      const files = filesResponse?.files || [];
      const widgetFile = files.find((file) => Number(file.widget_id) === Number(widgetDbId));
      const schema = widgetFile?.data_schema || {};
      const schemaColumns = schema.headers || schema.selectedFields || [];
      if (schemaColumns.length) {
        applyFieldsToWidgetSettings(sourceWidget, schemaColumns);
        if (incomingConnection.id) {
          syncConnectionFieldsFromUpstream(widgetManager, incomingConnection.id, sourceWidget);
        }
        return normalizeFieldNames(schemaColumns);
      }
    } catch {
      // ignore
    }
  }

  return [];
}
