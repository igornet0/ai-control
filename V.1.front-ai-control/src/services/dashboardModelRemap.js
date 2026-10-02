/**
 * Rebind dashboard widgets after linked data models change.
 * Orphan modelIds are remapped to a compatible table.field on current models,
 * or marked unavailable so widgets stop reading/writing the old model.
 */

import { getDashboardSchema, invalidateDashboardSchema } from './dashboardSqliteSchemaService.js';
import { sheetService } from './sheetService.js';
import { widgetService } from './widgetService.js';

export const BINDING_UNAVAILABLE_STATUS = 'unavailable';
export const BINDING_UNAVAILABLE_MESSAGE = 'Поле данных недоступно — обновите привязку';

function norm(s) {
  return String(s ?? '').trim().toLowerCase();
}

export function fieldIndexKey(table, field) {
  return `${norm(table)}\0${norm(field)}`;
}

function cloneJson(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

function parseMaybeJson(raw) {
  if (raw == null || raw === '') return raw;
  if (typeof raw === 'object') return raw;
  if (typeof raw !== 'string') return raw;
  const t = raw.trim();
  if (!t.startsWith('{') && !t.startsWith('[')) return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export function linkedModelIdSet(ids) {
  const set = new Set();
  (ids || []).forEach((id) => {
    if (id == null || id === '') return;
    set.add(String(id));
  });
  return set;
}

export function isLinkedModelId(linkedIdSet, modelId) {
  if (modelId == null || modelId === '') return false;
  return linkedIdSet.has(String(modelId));
}

function coerceModelId(value, sample) {
  if (typeof sample === 'number') {
    const n = Number(value);
    return Number.isFinite(n) ? n : value;
  }
  return value;
}

/**
 * @param {Array<{ modelId?: unknown, tableName?: string, table?: string, name?: string, field?: string, type?: string }>} fields
 * @returns {Map<string, Array<{ modelId: unknown, type?: string, table: string, field: string }>>}
 */
export function buildCompatibleFieldIndex(fields) {
  const index = new Map();
  for (const f of fields || []) {
    const table = f.tableName ?? f.table;
    const field = f.name ?? f.field;
    if (!table || !field) continue;
    const key = fieldIndexKey(table, field);
    const list = index.get(key) || [];
    list.push({
      modelId: f.modelId,
      type: f.type,
      sqliteType: f.sqliteType,
      table,
      field,
    });
    index.set(key, list);
  }
  return index;
}

function pickUniqueHit(hits, linkedIdSet) {
  const linked = (hits || []).filter((h) => isLinkedModelId(linkedIdSet, h.modelId));
  if (linked.length === 1) return linked[0];
  return null;
}

function markUnavailableBinding(binding) {
  const next = { ...binding };
  if (next.modelId != null && next.modelId !== '') {
    next.orphanedModelId = next.modelId;
    next.modelId = null;
  }
  next.dataBindingStatus = BINDING_UNAVAILABLE_STATUS;
  return next;
}

function clearUnavailableOnBinding(binding) {
  const next = { ...binding };
  if (next.dataBindingStatus === BINDING_UNAVAILABLE_STATUS) {
    delete next.dataBindingStatus;
  }
  if (next.orphanedModelId != null) delete next.orphanedModelId;
  return next;
}

/**
 * @param {object} binding — { modelId, table, field }
 * @param {Set<string>} linkedIdSet
 * @param {Map<string, Array>} index
 * @returns {{ status: 'ok'|'remapped'|'unavailable', binding: object }}
 */
export function remapBinding(binding, linkedIdSet, index) {
  if (!binding || typeof binding !== 'object') {
    return { status: 'ok', binding };
  }
  const modelId = binding.modelId;
  const table = binding.table ?? binding.tableName;
  const field = binding.field ?? binding.fieldName ?? binding.name;
  if (modelId == null || modelId === '') {
    if (table && field) {
      const recovered = pickUniqueHit(index.get(fieldIndexKey(table, field)), linkedIdSet);
      if (recovered) {
        const next = clearUnavailableOnBinding({
          ...binding,
          modelId: recovered.modelId,
        });
        if (recovered.type) {
          if (next.type != null) next.type = recovered.type;
          if (next.fieldType != null) next.fieldType = recovered.type;
        }
        return { status: 'remapped', binding: next };
      }
    }
    if (binding.dataBindingStatus === BINDING_UNAVAILABLE_STATUS) {
      return { status: 'unavailable', binding };
    }
    return { status: 'ok', binding };
  }
  if (isLinkedModelId(linkedIdSet, modelId)) {
    return { status: 'ok', binding: clearUnavailableOnBinding(binding) };
  }
  if (!table || !field) {
    return { status: 'unavailable', binding: markUnavailableBinding(binding) };
  }
  const hit = pickUniqueHit(index.get(fieldIndexKey(table, field)), linkedIdSet);
  if (hit) {
    const next = clearUnavailableOnBinding({
      ...binding,
      modelId: coerceModelId(hit.modelId, modelId),
    });
    if (hit.type) {
      if (next.type != null) next.type = hit.type;
      if (next.fieldType != null) next.fieldType = hit.type;
    }
    return { status: 'remapped', binding: next };
  }
  return { status: 'unavailable', binding: markUnavailableBinding(binding) };
}

/**
 * Remap a modelId using unique table presence on linked models (no field required).
 */
export function remapTableModelId(modelId, table, linkedIdSet, index) {
  if (modelId != null && modelId !== '' && isLinkedModelId(linkedIdSet, modelId)) {
    return { status: 'ok', modelId };
  }
  if (!table) {
    if (modelId == null || modelId === '') return { status: 'ok', modelId };
    return { status: 'unavailable', modelId };
  }
  const prefix = `${norm(table)}\0`;
  const ids = new Set();
  for (const [key, hits] of index.entries()) {
    if (!key.startsWith(prefix)) continue;
    for (const h of hits) {
      if (isLinkedModelId(linkedIdSet, h.modelId)) ids.add(String(h.modelId));
    }
  }
  if (ids.size === 1) {
    const next = [...ids][0];
    const coerced = coerceModelId(next, modelId);
    if (modelId == null || modelId === '' || String(modelId) !== String(coerced)) {
      return { status: 'remapped', modelId: coerced };
    }
    return { status: 'ok', modelId: coerced };
  }
  if (modelId == null || modelId === '') {
    return { status: 'ok', modelId };
  }
  return { status: 'unavailable', modelId };
}

function bump(acc, status) {
  if (status === 'remapped') acc.remappedCount += 1;
  if (status === 'unavailable') acc.unavailableCount += 1;
}

function remapModelIdValue(current, table, field, linkedIdSet, index, acc) {
  if (field) {
    const r = remapBinding({ modelId: current, table, field }, linkedIdSet, index);
    bump(acc, r.status);
    if (r.status === 'remapped') return r.binding.modelId;
    if (r.status === 'unavailable') return null;
    return r.binding.modelId ?? current;
  }
  const r = remapTableModelId(current, table, linkedIdSet, index);
  bump(acc, r.status);
  if (r.status === 'unavailable') return null;
  return r.modelId;
}

/**
 * @param {object} dbWidget — API widget ({ id, widget_type, data_source, data_config })
 * @param {Set<string>} linkedIdSet
 * @param {Map<string, Array>} index
 */
export function remapWidgetRecord(dbWidget, linkedIdSet, index) {
  const acc = { remappedCount: 0, unavailableCount: 0 };
  const dataSourceIn = parseMaybeJson(dbWidget?.data_source);
  const dataConfigIn = parseMaybeJson(dbWidget?.data_config);
  const origDs = JSON.stringify(dataSourceIn ?? null);
  const origCfg = JSON.stringify(dataConfigIn ?? null);

  let dataSource =
    dataSourceIn && typeof dataSourceIn === 'object' ? cloneJson(dataSourceIn) : dataSourceIn;
  const dataConfig =
    dataConfigIn && typeof dataConfigIn === 'object' ? cloneJson(dataConfigIn) : {};
  const createdSettings = !dataConfig.settings || typeof dataConfig.settings !== 'object';
  if (createdSettings) {
    dataConfig.settings = {};
  }
  const settings = dataConfig.settings;
  const widgetType = dbWidget?.widget_type || dbWidget?.type;

  if (dataSource && typeof dataSource === 'object' && dataSource.modelId != null && dataSource.modelId !== '') {
    if (dataSource.field || dataSource.fieldName) {
      const r = remapBinding(dataSource, linkedIdSet, index);
      bump(acc, r.status);
      dataSource = r.binding;
    } else {
      const r = remapTableModelId(dataSource.modelId, dataSource.table, linkedIdSet, index);
      bump(acc, r.status);
      if (r.status === 'remapped') dataSource = { ...dataSource, modelId: r.modelId };
      if (r.status === 'unavailable') {
        dataSource = markUnavailableBinding(dataSource);
      }
    }
  }

  const remapList = (arr) => {
    if (!Array.isArray(arr)) return arr;
    return arr.map((item) => {
      if (!item || typeof item !== 'object') return item;
      const r = remapBinding(item, linkedIdSet, index);
      bump(acc, r.status);
      return r.binding;
    });
  };

  if (Array.isArray(settings.bindingFields)) {
    settings.bindingFields = remapList(settings.bindingFields);
  }
  if (settings.bindingDimension && typeof settings.bindingDimension === 'object') {
    const r = remapBinding(settings.bindingDimension, linkedIdSet, index);
    bump(acc, r.status);
    settings.bindingDimension = r.binding;
  }
  if (settings.bindingMeasure && typeof settings.bindingMeasure === 'object') {
    const r = remapBinding(settings.bindingMeasure, linkedIdSet, index);
    bump(acc, r.status);
    settings.bindingMeasure = r.binding;
  }
  if (Array.isArray(settings.bindingMeasures)) {
    settings.bindingMeasures = remapList(settings.bindingMeasures);
  }
  if (Array.isArray(settings.filters)) {
    settings.filters = remapList(settings.filters);
  }

  const tableHint =
    settings.table ||
    (dataSource && typeof dataSource === 'object' ? dataSource.table : '') ||
    settings.bindingFields?.[0]?.table ||
    settings.filters?.[0]?.table ||
    '';
  const fieldHint =
    (dataSource && typeof dataSource === 'object' ? dataSource.field : '') ||
    settings.bindingFields?.[0]?.field ||
    settings.field ||
    '';

  if (settings.modelId != null && settings.modelId !== '') {
    const next = remapModelIdValue(settings.modelId, tableHint, fieldHint, linkedIdSet, index, acc);
    if (next !== settings.modelId) {
      if (next == null && !isLinkedModelId(linkedIdSet, settings.modelId)) {
        settings.orphanedModelId = settings.modelId;
      }
      settings.modelId = next;
    }
  } else if (settings.orphanedModelId != null || settings.dataBindingStatus === BINDING_UNAVAILABLE_STATUS) {
    const recovered = remapModelIdValue(
      settings.orphanedModelId ?? null,
      tableHint,
      fieldHint,
      linkedIdSet,
      index,
      acc,
    );
    if (recovered != null && recovered !== '') {
      settings.modelId = recovered;
      delete settings.orphanedModelId;
    }
  }

  if (settings.resolvedModelId != null && settings.resolvedModelId !== '') {
    settings.resolvedModelId = remapModelIdValue(
      settings.resolvedModelId,
      tableHint,
      fieldHint,
      linkedIdSet,
      index,
      acc,
    );
  }

  if (widgetType === 'data_input' && Array.isArray(settings.fields) && tableHint) {
    for (const f of settings.fields) {
      const name = f?.name;
      if (!name) continue;
      const hits = index.get(fieldIndexKey(tableHint, name));
      const hit = pickUniqueHit(hits, linkedIdSet);
      if (!hit) {
        bump(acc, 'unavailable');
      }
    }
  }

  if (Array.isArray(settings.buttons)) {
    settings.buttons = settings.buttons.map((btn) => {
      const action = btn?.action;
      if (!action || typeof action !== 'object') return btn;
      const payload =
        action.payload && typeof action.payload === 'object' ? { ...action.payload } : null;
      if (!payload) return btn;
      let payloadChanged = false;
      if (payload.modelId != null && payload.modelId !== '') {
        const r = remapBinding(
          {
            modelId: payload.modelId,
            table: payload.table,
            field: payload.field,
          },
          linkedIdSet,
          index,
        );
        bump(acc, r.status);
        if (r.status === 'remapped') {
          payload.modelId = r.binding.modelId;
          payloadChanged = true;
        } else if (r.status === 'unavailable') {
          payload.orphanedModelId = payload.modelId;
          payload.modelId = null;
          payloadChanged = true;
        }
      }
      if (Array.isArray(payload.modelIds)) {
        const nextIds = [];
        for (const id of payload.modelIds) {
          if (isLinkedModelId(linkedIdSet, id)) {
            nextIds.push(id);
            continue;
          }
          if (payload.table && payload.field) {
            const r = remapBinding(
              { modelId: id, table: payload.table, field: payload.field },
              linkedIdSet,
              index,
            );
            bump(acc, r.status);
            if (r.status === 'remapped') nextIds.push(r.binding.modelId);
          } else {
            bump(acc, 'unavailable');
          }
        }
        if (JSON.stringify(nextIds) !== JSON.stringify(payload.modelIds)) {
          payload.modelIds = nextIds;
          payloadChanged = true;
        }
      }
      if (!payloadChanged) return btn;
      return { ...btn, action: { ...action, payload } };
    });
  }

  if (acc.unavailableCount > 0) {
    settings.dataBindingStatus = BINDING_UNAVAILABLE_STATUS;
    settings.bindingError = BINDING_UNAVAILABLE_MESSAGE;
    if (widgetType === 'data_input') {
      if (settings.modelId != null && settings.modelId !== '' && !isLinkedModelId(linkedIdSet, settings.modelId)) {
        settings.orphanedModelId = settings.modelId;
        settings.modelId = null;
      }
      if (
        dataSource &&
        typeof dataSource === 'object' &&
        dataSource.modelId != null &&
        dataSource.modelId !== '' &&
        !isLinkedModelId(linkedIdSet, dataSource.modelId)
      ) {
        dataSource = markUnavailableBinding(dataSource);
      }
    }
  } else {
    if (settings.dataBindingStatus === BINDING_UNAVAILABLE_STATUS) {
      delete settings.dataBindingStatus;
    }
    if (settings.bindingError === BINDING_UNAVAILABLE_MESSAGE) {
      delete settings.bindingError;
    }
    if (settings.orphanedModelId != null) delete settings.orphanedModelId;
  }

  if (createdSettings && settings && Object.keys(settings).length === 0) {
    delete dataConfig.settings;
  }

  const changed =
    JSON.stringify(dataSource ?? null) !== origDs || JSON.stringify(dataConfig ?? null) !== origCfg;

  return {
    widget: changed
      ? { ...dbWidget, data_source: dataSource, data_config: dataConfig }
      : dbWidget,
    changed,
    remappedCount: acc.remappedCount,
    unavailableCount: acc.unavailableCount,
  };
}

export function formatReconcileSummary(summary) {
  if (!summary) return '';
  const { updatedWidgets = 0, remappedCount = 0, unavailableCount = 0 } = summary;
  if (!updatedWidgets && !remappedCount && !unavailableCount) {
    return '';
  }
  const parts = [];
  if (remappedCount) parts.push(`перепривязано полей: ${remappedCount}`);
  if (unavailableCount) parts.push(`недоступно: ${unavailableCount}`);
  if (updatedWidgets) parts.push(`виджетов обновлено: ${updatedWidgets}`);
  return parts.length ? `Привязки виджетов: ${parts.join(', ')}` : '';
}

/**
 * Load current dashboard schema and rewrite widget modelIds on all sheets.
 * @param {number|string} dashboardId
 */
export async function reconcileDashboardWidgetModels(dashboardId) {
  const summary = { remappedCount: 0, unavailableCount: 0, updatedWidgets: 0 };
  if (dashboardId == null || dashboardId === '') return summary;

  invalidateDashboardSchema(dashboardId);
  const schema = await getDashboardSchema(dashboardId);
  const linkedIdSet = linkedModelIdSet((schema.models || []).map((m) => m.id));
  const index = buildCompatibleFieldIndex(schema.fields);

  const sheetsRaw = await sheetService.getDashboardSheets(dashboardId);
  const sheets = Array.isArray(sheetsRaw) ? sheetsRaw : sheetsRaw?.sheets || [];

  for (const sheet of sheets) {
    const sheetId = sheet?.id;
    if (sheetId == null) continue;
    const widgetsRaw = await widgetService.getSheetWidgets(sheetId);
    const widgets = Array.isArray(widgetsRaw) ? widgetsRaw : widgetsRaw?.widgets || [];
    for (const w of widgets) {
      const result = remapWidgetRecord(w, linkedIdSet, index);
      summary.remappedCount += result.remappedCount;
      summary.unavailableCount += result.unavailableCount;
      if (!result.changed || w?.id == null) continue;
      await widgetService.updateWidget(w.id, {
        data_source: result.widget.data_source,
        data_config: result.widget.data_config,
      });
      summary.updatedWidgets += 1;
    }
  }

  return summary;
}
