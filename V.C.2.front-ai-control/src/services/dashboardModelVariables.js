/**
 * Локальный runtime скалярных переменных модели данных (_datacode_variables).
 * Defaults читаются из скомпилированной SQLite; overrides живут в localStorage
 * и не пишутся в модель / JSON дашборда.
 */

import { dataModelService } from './dataModelService.js';
import { getDashboardDataModelClient } from './dashboardDataModel/DashboardDataModelClient.js';
import { shouldUseLocalFilterPersistence } from './dashboardFilterPersistence.js';

export const DATACODE_VARIABLES_TABLE = '_datacode_variables';

const STORAGE_PREFIX = 'dashboardUserModelVars:';
const TABLE_TYPES = new Set(['table', 'lazytable']);

/**
 * @param {string|number|null|undefined} dashboardId
 * @param {string|number|null|undefined} [flowId]
 */
export function modelVarsPersistenceKey(dashboardId, flowId = null) {
  if (dashboardId == null || dashboardId === '') return null;
  const base = `${STORAGE_PREFIX}${String(dashboardId)}`;
  if (flowId != null && flowId !== '') {
    return `flow:${String(flowId)}:${base}`;
  }
  return base;
}

function rowField(row, ...names) {
  if (!row || typeof row !== 'object') return undefined;
  for (const name of names) {
    if (Object.prototype.hasOwnProperty.call(row, name) && row[name] != null) {
      return row[name];
    }
  }
  const lower = Object.fromEntries(
    Object.entries(row).map(([k, v]) => [String(k).toLowerCase(), v]),
  );
  for (const name of names) {
    const v = lower[String(name).toLowerCase()];
    if (v != null) return v;
  }
  return undefined;
}

/**
 * @param {Record<string, unknown>} row
 * @returns {{
 *   name: string,
 *   type: string,
 *   value: unknown,
 *   rawValue: string,
 *   tableName: string,
 *   rowCount: number|null,
 *   columnCount: number|null,
 *   createdAt: string,
 *   description: string,
 * }}
 */
export function normalizeVariableRow(row = {}) {
  const name = String(rowField(row, 'variable_name', 'name') ?? '').trim();
  const type = String(rowField(row, 'variable_type', 'type') ?? '').trim();
  const rawValue = rowField(row, 'value');
  const tableName = String(rowField(row, 'table_name') ?? '').trim();
  const rowCountRaw = rowField(row, 'row_count');
  const colCountRaw = rowField(row, 'column_count');
  const rowCount =
    rowCountRaw == null || rowCountRaw === '' ? null : Number(rowCountRaw);
  const columnCount =
    colCountRaw == null || colCountRaw === '' ? null : Number(colCountRaw);
  return {
    name,
    type,
    rawValue: rawValue == null ? '' : String(rawValue),
    value: parseVariableValue(type, rawValue),
    tableName,
    rowCount: Number.isFinite(rowCount) ? rowCount : null,
    columnCount: Number.isFinite(columnCount) ? columnCount : null,
    createdAt: String(rowField(row, 'created_at') ?? ''),
    description: String(rowField(row, 'description') ?? ''),
  };
}

export function isScalarVariableType(type) {
  const t = String(type || '').trim().toLowerCase();
  if (!t) return true;
  return !TABLE_TYPES.has(t);
}

/**
 * @param {string} type
 * @param {unknown} raw
 */
export function parseVariableValue(type, raw) {
  const t = String(type || '').trim().toLowerCase();
  if (!isScalarVariableType(t)) return raw == null ? '' : String(raw);
  if (raw == null) {
    if (t === 'number' || t === 'currency') return 0;
    if (t === 'bool') return false;
    if (t === 'null') return null;
    return '';
  }
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    if (t === 'bool') return raw !== 0;
    if (t === 'string') return String(raw);
    return raw;
  }
  const s = String(raw).trim();
  if (t === 'null' || s.toLowerCase() === 'null' || s.toLowerCase() === 'none') {
    return t === 'string' ? s : null;
  }
  if (t === 'bool') {
    const low = s.toLowerCase();
    if (low === 'true' || low === '1' || low === 'yes') return true;
    if (low === 'false' || low === '0' || low === 'no' || low === '') return false;
    return Boolean(s);
  }
  if (t === 'number' || t === 'currency') {
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }
  if (t === 'array') {
    try {
      return JSON.parse(s);
    } catch {
      return s;
    }
  }
  if (!t) {
    if (s === 'true') return true;
    if (s === 'false') return false;
    if (s !== '' && Number.isFinite(Number(s))) return Number(s);
  }
  return String(raw);
}

/**
 * Кнопка задаёт строку — приводим к типу известной переменной или к number/bool/string.
 * @param {string} type
 * @param {unknown} raw
 */
export function coerceVariableInput(type, raw) {
  if (isScalarVariableType(type) && type) {
    return parseVariableValue(type, raw);
  }
  return parseVariableValue('', raw);
}

/**
 * @param {unknown[]} rows
 * @returns {Record<string, { value: unknown, type: string, modelId?: string|number }>}
 */
export function scalarDefaultsFromRows(rows, modelId = null) {
  /** @type {Record<string, { value: unknown, type: string, modelId?: string|number }>} */
  const out = {};
  for (const raw of Array.isArray(rows) ? rows : []) {
    const v = normalizeVariableRow(raw);
    if (!v.name || !isScalarVariableType(v.type)) continue;
    out[v.name] = {
      value: v.value,
      type: v.type || 'Number',
      modelId: modelId ?? undefined,
    };
  }
  return out;
}

export function resolveModelVariable(defaults, overrides, name, fallback = undefined) {
  const k = String(name ?? '');
  if (!k) return fallback;
  if (overrides instanceof Map && overrides.has(k)) return overrides.get(k);
  if (defaults instanceof Map && defaults.has(k)) return defaults.get(k);
  return fallback;
}

export function snapshotResolvedVariables(defaults, overrides) {
  /** @type {Record<string, unknown>} */
  const out = {};
  const keys = new Set([
    ...(defaults instanceof Map ? defaults.keys() : []),
    ...(overrides instanceof Map ? overrides.keys() : []),
  ]);
  [...keys]
    .map(String)
    .sort()
    .forEach((k) => {
      out[k] = resolveModelVariable(defaults, overrides, k);
    });
  return out;
}

export function loadModelVariableOverrides(dashboardId, flowId = null) {
  if (typeof localStorage === 'undefined') return {};
  const k = modelVarsPersistenceKey(dashboardId, flowId);
  if (!k) return {};
  try {
    const raw = localStorage.getItem(k);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const vars = parsed.variables && typeof parsed.variables === 'object' ? parsed.variables : parsed;
    /** @type {Record<string, unknown>} */
    const out = {};
    Object.entries(vars).forEach(([name, value]) => {
      const n = String(name || '').trim();
      if (n) out[n] = value;
    });
    return out;
  } catch {
    return {};
  }
}

export function saveModelVariableOverrides(dashboardId, overrides, flowId = null) {
  const k = modelVarsPersistenceKey(dashboardId, flowId);
  if (!k || typeof localStorage === 'undefined') return;
  try {
    const variables =
      overrides instanceof Map ? Object.fromEntries(overrides.entries()) : { ...(overrides || {}) };
    if (!Object.keys(variables).length) {
      localStorage.removeItem(k);
      return;
    }
    localStorage.setItem(
      k,
      JSON.stringify({
        dashboardId,
        variables,
      }),
    );
  } catch (e) {
    console.warn('[dashboard] model variable save failed', e);
  }
}

export function cancelPersistDashboardModelVars(engine) {
  if (!engine) return;
  if (engine._modelVarPersistTimer) {
    clearTimeout(engine._modelVarPersistTimer);
    engine._modelVarPersistTimer = null;
  }
}

export function flushPersistDashboardModelVars(engine, shareContext, flowId = null) {
  cancelPersistDashboardModelVars(engine);
  if (!shouldUseLocalFilterPersistence(shareContext)) return;
  if (!engine || engine._destroyed) return;
  const dashId = engine.dashboardId;
  if (dashId == null) return;
  saveModelVariableOverrides(dashId, engine.modelVariableOverrides || new Map(), flowId);
}

export function schedulePersistDashboardModelVars(engine, shareContext, flowId = null) {
  if (!shouldUseLocalFilterPersistence(shareContext)) return;
  if (!engine || engine._destroyed) return;
  const dashId = engine.dashboardId;
  if (dashId == null) return;
  if (engine._modelVarPersistTimer) clearTimeout(engine._modelVarPersistTimer);
  engine._modelVarPersistTimer = setTimeout(() => {
    engine._modelVarPersistTimer = null;
    if (engine._destroyed) return;
    saveModelVariableOverrides(dashId, engine.modelVariableOverrides || new Map(), flowId);
  }, 400);
}

/**
 * @param {object} engine
 * @param {unknown} extraModels
 * @returns {Array<string|number>}
 */
export function collectDashboardModelIds(engine, extraModels = []) {
  const ids = new Set();
  const list = Array.isArray(extraModels)
    ? extraModels
    : extraModels?.data_models || extraModels?.data || [];
  for (const m of list) {
    const id = m?.id ?? m?.model_id ?? m;
    if (id != null && id !== '') ids.add(id);
  }
  const widgets =
    typeof engine?.widgetManager?.getAllWidgets === 'function'
      ? engine.widgetManager.getAllWidgets()
      : [];
  for (const w of widgets) {
    const id =
      w?.dataSource?.modelId ??
      w?.dataSource?.model_id ??
      w?.settings?.modelId ??
      w?.settings?.model_id;
    if (id != null && id !== '') ids.add(id);
  }
  return [...ids];
}

function extractRows(res) {
  if (Array.isArray(res?.rows)) return res.rows;
  if (Array.isArray(res)) return res;
  return [];
}

/**
 * @param {object|null} engine
 * @param {string|number} modelId
 * @returns {Promise<unknown[]>}
 */
export async function fetchModelVariableRows(engine, modelId) {
  if (modelId == null || modelId === '') return [];
  if (engine) {
    try {
      const client = getDashboardDataModelClient(engine);
      const res = await client.fetchSelect({
        modelId,
        base_table: DATACODE_VARIABLES_TABLE,
        columns: [
          'variable_name',
          'variable_type',
          'table_name',
          'row_count',
          'column_count',
          'created_at',
          'description',
          'value',
        ],
        filters: [],
        limit: 500,
      });
      return extractRows(res);
    } catch {
      /* fallback to rows API */
    }
  }
  try {
    const res = await dataModelService.getModelTableRows(modelId, DATACODE_VARIABLES_TABLE, {
      limit: 500,
      offset: 0,
      includeSource: false,
    });
    return extractRows(res);
  } catch {
    return [];
  }
}

/**
 * @param {object} engine
 * @param {{ shareContext?: object, flowId?: string|number|null, linkedModels?: unknown }} [opts]
 */
export async function hydrateDashboardModelVariables(engine, opts = {}) {
  if (!engine || typeof engine.replaceModelVariableDefaults !== 'function') return;
  const { linkedModels = [] } = opts;
  const modelIds = collectDashboardModelIds(engine, linkedModels);
  /** @type {Record<string, { value: unknown, type: string, modelId?: string|number }>} */
  const merged = {};
  await Promise.all(
    modelIds.map(async (modelId) => {
      const rows = await fetchModelVariableRows(engine, modelId);
      Object.assign(merged, scalarDefaultsFromRows(rows, modelId));
    }),
  );
  engine.replaceModelVariableDefaults(merged, { silent: true });
}
