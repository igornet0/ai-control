/**
 * Локальное сохранение снимка фильтров дашборда (не перекрывает shared realtime-сессию).
 * Область действия — весь dashboardId (все листы), не отдельный sheet.
 */

import { serializeDashboardFilterSnapshot } from './dashboardFilterUtils.js';

const PREFIX = 'dashboardUserFilters:';

/**
 * Ключ хранилища: один на дашборд (опционально flow).
 * @param {string|number|null|undefined} dashboardId
 * @param {string|number|null|undefined} [flowId]
 * @param {string|number|null|undefined} [_sheetId] — устаревший аргумент, игнорируется
 */
export function filterPersistenceStorageKey(dashboardId, flowId = null, _sheetId = null) {
  if (dashboardId == null || dashboardId === '') return null;
  const base = `${PREFIX}${String(dashboardId)}`;
  if (flowId != null && flowId !== '') {
    return `flow:${String(flowId)}:${base}`;
  }
  return base;
}

/** @deprecated старый формат dashboardUserFilters:{dash}:{sheet} */
function legacySheetKeyPrefix(dashboardId, flowId = null) {
  if (dashboardId == null || dashboardId === '') return null;
  const base = `${PREFIX}${String(dashboardId)}:`;
  if (flowId != null && flowId !== '') {
    return `flow:${String(flowId)}:${base}`;
  }
  return base;
}

/**
 * Удалить устаревшие ключи `dashboardUserFilters:{dash}:{sheet}` —
 * иначе после сброса (пустой снимок) миграция снова поднимает старый фильтр.
 */
export function purgeLegacyDashboardFilterKeys(dashboardId, flowId = null) {
  if (typeof localStorage === 'undefined') return;
  const legacyPrefix = legacySheetKeyPrefix(dashboardId, flowId);
  if (!legacyPrefix) return;
  const toRemove = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(legacyPrefix)) continue;
    // Не трогаем новый dashboard-ключ: он равен PREFIX+id без «:sheet»
    const primary = filterPersistenceStorageKey(dashboardId, flowId);
    if (key === primary) continue;
    toRemove.push(key);
  }
  toRemove.forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  });
}

/** Shared-комната: состояние приходит от пиров, не восстанавливаем из localStorage. */
export function shouldUseLocalFilterPersistence(shareContext) {
  if (!shareContext) return true;
  if (shareContext.sessionType === 'shared') return false;
  return true;
}

function parseFilterSnapshot(raw) {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.fields)) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Загрузить снимок фильтров дашборда.
 * @param {string|number|null|undefined} dashboardId
 * @param {string|number|null|undefined} [_sheetId] — игнорируется (совместимость вызовов)
 * @param {string|number|null|undefined} [flowId]
 */
export function loadDashboardFiltersFromLocalStorage(dashboardId, _sheetId = null, flowId = null) {
  if (typeof localStorage === 'undefined') return null;
  const k = filterPersistenceStorageKey(dashboardId, flowId);
  if (!k) return null;
  try {
    const raw = localStorage.getItem(k);
    // Ключ есть (в т.ч. fields: []) — явный снимок/сброс; legacy не трогаем.
    if (raw != null) {
      const primary = parseFilterSnapshot(raw);
      if (primary?.fields?.length) return primary;
      return null;
    }

    // Миграция со старых ключей по листам → один раз в dashboard-ключ
    const legacyPrefix = legacySheetKeyPrefix(dashboardId, flowId);
    if (!legacyPrefix) return null;
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(legacyPrefix)) continue;
      const snap = parseFilterSnapshot(localStorage.getItem(key));
      if (snap?.fields?.length) {
        saveDashboardFiltersToLocalStorage(dashboardId, null, snap, flowId);
        return snap;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * @param {string|number|null|undefined} dashboardId
 * @param {string|number|null|undefined} [_sheetId]
 * @param {object} snapshot
 * @param {string|number|null|undefined} [flowId]
 */
export function saveDashboardFiltersToLocalStorage(dashboardId, _sheetId, snapshot, flowId = null) {
  const k = filterPersistenceStorageKey(dashboardId, flowId);
  if (!k || typeof localStorage === 'undefined') return;
  try {
    if (!snapshot?.fields?.length) {
      // Пишем пустой маркер, чтобы load не мигрировал legacy обратно после сброса.
      localStorage.setItem(
        k,
        JSON.stringify({
          fields: [],
          dashboardId: dashboardId != null ? dashboardId : snapshot?.dashboardId ?? null,
          scope: 'dashboard',
          cleared: true,
        }),
      );
      purgeLegacyDashboardFilterKeys(dashboardId, flowId);
      return;
    }
    const toSave = {
      ...snapshot,
      dashboardId: dashboardId != null ? dashboardId : snapshot.dashboardId,
      // sheetId больше не ограничивает область — оставляем для отладки
      scope: 'dashboard',
    };
    localStorage.setItem(k, JSON.stringify(toSave));
    purgeLegacyDashboardFilterKeys(dashboardId, flowId);
  } catch (e) {
    console.warn('[dashboard] local filter save failed', e);
  }
}

export function cancelPersistDashboardFilters(engine) {
  if (!engine) return;
  if (engine._filterPersistTimer) {
    clearTimeout(engine._filterPersistTimer);
    engine._filterPersistTimer = null;
  }
}

/**
 * Синхронно сохранить снимок фильтров дашборда (перед сменой листа / destroy).
 */
export function flushPersistDashboardFilters(engine, sheetId, shareContext, flowId = null) {
  cancelPersistDashboardFilters(engine);
  if (!shouldUseLocalFilterPersistence(shareContext)) return;
  if (!engine || engine._destroyed) return;
  const dashId = engine.dashboardId;
  if (dashId == null) return;
  try {
    const snap = serializeDashboardFilterSnapshot(engine, sheetId);
    saveDashboardFiltersToLocalStorage(dashId, sheetId, snap, flowId);
  } catch (e) {
    console.warn('[dashboard] filter persist flush', e);
  }
}

/**
 * Отложенное сохранение снимка фильтров дашборда.
 */
export function schedulePersistDashboardFilters(engine, sheetId, shareContext, flowId = null) {
  if (!shouldUseLocalFilterPersistence(shareContext)) return;
  const dashId = engine?.dashboardId;
  if (dashId == null) return;
  if (engine._destroyed) return;

  if (engine._filterPersistTimer) clearTimeout(engine._filterPersistTimer);
  engine._filterPersistTimer = setTimeout(() => {
    engine._filterPersistTimer = null;
    if (engine._destroyed) return;
    try {
      const snap = serializeDashboardFilterSnapshot(engine, sheetId);
      const widgetCount =
        typeof engine.widgetManager?.getAllWidgets === 'function'
          ? engine.widgetManager.getAllWidgets().length
          : 0;
      // Пустой снимок при уже пустом движке — не затираем dashboard-ключ
      if (!snap?.fields?.length && widgetCount === 0) {
        return;
      }
      saveDashboardFiltersToLocalStorage(dashId, sheetId, snap, flowId);
    } catch (e) {
      console.warn('[dashboard] filter persist', e);
    }
  }, 400);
}
