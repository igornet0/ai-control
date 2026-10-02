import {
  buildFilterDescriptorsFromEngine,
  reloadDashboardDataWidgets,
  sameDataModelId,
  sqlFiltersFromDescriptors,
} from './dashboardFilterUtils.js';
import {
  bumpDashboardCrossFilterMemo,
  purgeDashboardCrossFilterMemoForModels,
} from './dashboardCrossFilterEngine.js';
import { bumpDashboardQueryCoordinator } from './dashboardQueryCoordinator.js';

function byModel(sqlPredicates) {
  const m = new Map();
  for (const f of sqlPredicates || []) {
    const k = String(f.modelId);
    if (!m.has(k)) m.set(k, []);
    const row = { table: f.table, column: f.column, op: f.op };
    if (f.values != null) row.values = f.values;
    else row.value = f.value;
    m.get(k).push(row);
  }
  return m;
}

function sigRows(rows) {
  return JSON.stringify(
    [...(rows || [])]
      .map((r) => ({
        table: String(r.table || ''),
        column: String(r.column || ''),
        op: String(r.op || ''),
        value: r.value,
        values: Array.isArray(r.values) ? [...r.values].map((x) => String(x)).sort() : undefined,
      }))
      .sort((a, b) => {
        const ka = `${a.table}\0${a.column}\0${a.op}`;
        const kb = `${b.table}\0${b.column}\0${b.op}`;
        return ka.localeCompare(kb);
      }),
  );
}

function changedModelIds(prevMap, nextMap) {
  const keys = new Set([...prevMap.keys(), ...nextMap.keys()]);
  const out = [];
  keys.forEach((k) => {
    if (sigRows(prevMap.get(k)) !== sigRows(nextMap.get(k))) out.push(k);
  });
  return out;
}

function toGlobalSignature(predicatesByModelId) {
  const rows = [];
  predicatesByModelId.forEach((list, modelId) => {
    rows.push({ modelId: String(modelId), sig: sigRows(list) });
  });
  rows.sort((a, b) => a.modelId.localeCompare(b.modelId));
  return JSON.stringify(rows);
}

function setSnapshotOnStore(engine, snapshot) {
  if (!engine?.filterStore || typeof engine.filterStore !== 'object') return;
  engine.filterStore._descriptors = Array.isArray(snapshot.descriptors) ? snapshot.descriptors : [];
  engine.filterStore._snapshot = snapshot;
}

export function getDashboardFilterSnapshot(engine, options = {}) {
  if (!engine?.widgetManager) {
    return {
      revision: 0,
      descriptors: [],
      sqlPredicates: [],
      predicatesByModelId: new Map(),
      changedModelIds: [],
      globalSignature: '[]',
    };
  }
  if (!options.force && engine.__dashboardFilterSnapshot) {
    return engine.__dashboardFilterSnapshot;
  }
  const descriptors = engine.filterStore
    ? engine.filterStore.syncFromEngine(engine)
    : buildFilterDescriptorsFromEngine(engine);
  const sqlPredicates = sqlFiltersFromDescriptors(descriptors);
  const predicatesByModelId = byModel(sqlPredicates);
  const prev = engine.__dashboardFilterSnapshot;
  const prevByModel =
    prev?.predicatesByModelId instanceof Map
      ? prev.predicatesByModelId
      : byModel(Array.isArray(prev?.sqlPredicates) ? prev.sqlPredicates : []);
  const snapshot = {
    revision: Number(prev?.revision || 0) + 1,
    descriptors,
    sqlPredicates,
    predicatesByModelId,
    changedModelIds: changedModelIds(prevByModel, predicatesByModelId),
    globalSignature: toGlobalSignature(predicatesByModelId),
  };
  engine.__dashboardFilterSnapshot = snapshot;
  setSnapshotOnStore(engine, snapshot);
  return snapshot;
}

export function commitDashboardFilterTransportChange(engine, options = {}) {
  const snapshot = getDashboardFilterSnapshot(engine, { force: true });
  /** Подача активной полосы чипов: откладывает тяжёлые subtitle-distinct пока фильтры «перетряхиваются». */
  try {
    if (typeof engine === 'object' && engine != null && typeof performance?.now === 'function') {
      engine.__dashboardFilterBurstUntilTs = performance.now() + 600;
    } else if (typeof engine === 'object' && engine != null && typeof Date !== 'undefined') {
      engine.__dashboardFilterBurstUntilTs = Date.now() + 600;
    }
  } catch (_) {
    /* ignore */
  }
  if (options.invalidateCaches !== false) {
    invalidateDashboardTransportCaches({
      filtersChanged: true,
      changedModelIds: snapshot.changedModelIds,
    });
  }
  if (engine?.filterStore && options.notifyStore !== false) {
    engine.filterStore.notify();
  }
  if (typeof options.onCommitted === 'function') {
    options.onCommitted(snapshot);
  }
  return snapshot;
}

export function invalidateDashboardTransportCaches(options = {}) {
  const filtersChanged = options.filtersChanged !== false;
  const dataChanged = options.dataChanged === true;
  // filtersChanged defaults to true for backward compatibility; dataChanged is explicit
  // for ingest / auto-refresh / data-input (must bump so formula keys miss TTL cache).
  if (!filtersChanged && !dataChanged) return;
  const mids = options.changedModelIds;
  if (Array.isArray(mids) && mids.length > 0) {
    purgeDashboardCrossFilterMemoForModels(mids);
  } else {
    bumpDashboardCrossFilterMemo();
  }
  bumpDashboardQueryCoordinator();
  // Filter apply/clear must drop formula result + aggregate reuse caches (not only dataChanged).
  if (filtersChanged || dataChanged) {
    void import('../pages/dashboard_creater/src/formula/formulaInvalidation.js')
      .then((m) => {
        if (typeof m.clearFormulaComputeCaches === 'function') {
          m.clearFormulaComputeCaches({
            ast: false,
            widgetResults: true,
            aggregateReuse: true,
          });
        }
        if (typeof m.ensureFormulaInvalidationHooks === 'function') {
          return m.ensureFormulaInvalidationHooks();
        }
        return undefined;
      })
      .catch(() => {});
  }
}

/** Явный полный сброс кешей `DashboardDataModelClient` и refresh всех подписчиков (редко). */
export function notifyDashboardDataModelFullRefresh(engine) {
  engine?.filterStore?.notify?.({ fullDataModelRefresh: true });
}

export function filtersForModelFromSnapshot(snapshot, modelId) {
  const kNum = Number(modelId);
  const keys = [...(snapshot?.predicatesByModelId?.keys?.() || [])];
  for (const k of keys) {
    if (sameDataModelId(k, modelId)) {
      return snapshot.predicatesByModelId.get(k) || [];
    }
  }
  if (Number.isFinite(kNum) && snapshot?.predicatesByModelId?.has?.(String(kNum))) {
    return snapshot.predicatesByModelId.get(String(kNum)) || [];
  }
  return [];
}

export function reloadDashboardDataWidgetsWithSnapshot(engine, snapshot, options = {}) {
  const useByModel = options.strategy === 'by-model';
  const hasTrustworthyChangedModels =
    Array.isArray(snapshot?.changedModelIds) && snapshot.changedModelIds.length > 0;
  /** When diff knows affected models — skip broad fallback reload of unbound widgets. */
  const defaultFallbackAll = !hasTrustworthyChangedModels;
  const fallbackAll =
    typeof options.fallbackAll === 'boolean' ? options.fallbackAll : defaultFallbackAll;
  return reloadDashboardDataWidgets(
    engine,
    useByModel
      ? {
          strategy: 'by-model',
          modelIds: snapshot?.changedModelIds || [],
          fallbackAll,
          reloadOptions: {
            bypassCache: options.bypassCache === true,
          },
          maxConcurrentWidgetReloads: options.maxConcurrentWidgetReloads,
        }
      : {
          reloadOptions: {
            bypassCache: options.bypassCache === true,
          },
          maxConcurrentWidgetReloads: options.maxConcurrentWidgetReloads,
        },
  );
}
