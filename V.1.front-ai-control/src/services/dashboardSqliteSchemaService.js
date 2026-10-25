import axios from 'axios';
import api from './api';
import { dashboardService } from './dashboardService';
import { getDashboardShareContext } from './shareLinkContext';
import { getApiBaseUrl } from './apiBaseUrl';

const MIME_FIELD = 'application/x-aic-data-field';

/** Системные / служебные таблицы SQLite (имя начинается с `_`), не показываемые в UI выбора данных */
function isHiddenSystemTable(name) {
  const n = String(name || '');
  return !n || n.startsWith('_');
}

const _cache = new Map();
const _inflight = new Map();

function apiRoot() {
  return getApiBaseUrl();
}

function schemaErrorMessage(reason) {
  const status = reason?.response?.status;
  if (status === 404) {
    return 'Нет скомпилированной SQLite (latest.db)';
  }
  const detail = reason?.response?.data?.detail;
  if (typeof detail === 'string' && detail.trim()) return detail;
  return reason?.message || 'Не удалось загрузить схему';
}

function emptySchemaResult() {
  return { tables: [], fields: [], rawByModelId: new Map(), models: [] };
}

async function fetchDashboardSchema(dashboardId) {
  const share = getDashboardShareContext();

  let dmRes;
  let settled;
  /** @type {Array} */
  let dataModels;
  if (share?.token) {
    const t = encodeURIComponent(share.token);
    dmRes = await axios.get(`${apiRoot()}/api/public/dashboard-links/${t}/data-models`);
    dataModels = Array.isArray(dmRes.data) ? dmRes.data : dmRes.data?.data_models || [];
    settled = await Promise.allSettled(
      dataModels.map((m) =>
        axios.get(`${apiRoot()}/api/public/dashboard-links/${t}/data-models/${m.id}/sqlite-db/schema`)
      )
    );
  } else {
    const dm = await dashboardService.getDashboardDataModels(dashboardId);
    dataModels = Array.isArray(dm) ? dm : dm?.data_models || [];
    settled = await Promise.allSettled(
      dataModels.map((m) => api.get(`/api/data-models/${m.id}/sqlite-db/schema`))
    );
  }

  /** @type {Array<{ id: string, label: string, modelId: number, modelName: string, tableName: string }>} */
  const tables = [];
  /** @type {Array<{ id: string, name: string, type: string, tableId: string, tableName: string, modelId: number, modelName: string }>} */
  const fields = [];
  const rawByModelId = new Map();
  /** @type {Array<{ id: number, name: string, schemaOk: boolean, schemaError: string|null }>} */
  const models = [];

  dataModels.forEach((model, idx) => {
    const modelName = model.name || `Модель ${model.id}`;
    const r = settled[idx];
    if (r.status !== 'fulfilled') {
      const schemaError = schemaErrorMessage(r.reason);
      console.warn('[dashboard schema] skip tables for model', model.id, schemaError);
      models.push({ id: model.id, name: modelName, schemaOk: false, schemaError });
      return;
    }
    const schema = r.value.data;
    rawByModelId.set(model.id, schema);
    rawByModelId.set(String(model.id), schema);
    models.push({ id: model.id, name: modelName, schemaOk: true, schemaError: null });
    (schema.tables || []).forEach((tbl) => {
      if (tbl.skipped || isHiddenSystemTable(tbl.name)) {
        return;
      }
      const tableId = `${model.id}::${tbl.name}`;
      tables.push({
        id: tableId,
        label: `${modelName} → ${tbl.name}`,
        modelId: model.id,
        modelName,
        tableName: tbl.name,
      });
      (tbl.columns || []).forEach((col) => {
        fields.push({
          id: `${model.id}::${tbl.name}::${col.name}`,
          name: col.name,
          type: col.type || 'string',
          sqliteType: col.sqlite_type,
          tableId,
          tableName: tbl.name,
          modelId: model.id,
          modelName,
        });
      });
    });
  });

  return { tables, fields, rawByModelId, models };
}

/**
 * @param {number|string} dashboardId
 * @returns {Promise<{ tables: Array, fields: Array, rawByModelId: Map, models: Array }>}
 */
export async function getDashboardSchema(dashboardId) {
  if (!dashboardId) {
    return emptySchemaResult();
  }
  const share = getDashboardShareContext();
  const key = share?.token ? `share:${share.token}:${dashboardId}` : String(dashboardId);
  if (_cache.has(key)) {
    return _cache.get(key);
  }
  if (_inflight.has(key)) {
    return _inflight.get(key);
  }
  const pending = fetchDashboardSchema(dashboardId)
    .then((out) => {
      if (_inflight.get(key) === pending) {
        _cache.set(key, out);
        _inflight.delete(key);
      }
      return out;
    })
    .catch((err) => {
      if (_inflight.get(key) === pending) {
        _inflight.delete(key);
      }
      throw err;
    });
  _inflight.set(key, pending);
  return pending;
}

export function invalidateDashboardSchema(dashboardId) {
  if (dashboardId == null) {
    _cache.clear();
    _inflight.clear();
    return;
  }
  const id = String(dashboardId);
  for (const key of [..._cache.keys()]) {
    if (key === id || key.endsWith(`:${id}`)) _cache.delete(key);
  }
  for (const key of [..._inflight.keys()]) {
    if (key === id || key.endsWith(`:${id}`)) _inflight.delete(key);
  }
}

export const DATA_FIELD_DRAG_MIME = MIME_FIELD;
