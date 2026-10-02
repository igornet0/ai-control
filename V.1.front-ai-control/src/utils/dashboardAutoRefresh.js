/**
 * Helpers for dashboard live auto-refresh when linked data models receive API ingest updates.
 */

/**
 * @param {unknown} layoutConfig
 * @returns {Record<string, unknown>}
 */
export function normalizeLayoutConfig(layoutConfig) {
  if (layoutConfig && typeof layoutConfig === 'object' && !Array.isArray(layoutConfig)) {
    return { ...layoutConfig };
  }
  if (typeof layoutConfig === 'string') {
    const t = layoutConfig.trim();
    if (!t) return {};
    try {
      const parsed = JSON.parse(t);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return { ...parsed };
    } catch {
      /* ignore */
    }
  }
  return {};
}

/**
 * True when a data model has API ingest tables configured (can push table_updated events).
 * @param {{ processing_config?: object|null }|null|undefined} model
 * @returns {boolean}
 */
export function dataModelHasApiUpdates(model) {
  const cfg = model?.processing_config;
  if (!cfg || typeof cfg !== 'object') return false;
  const ingest = cfg.ingest;
  if (!ingest || typeof ingest !== 'object' || Array.isArray(ingest)) return false;
  const tables = ingest.tables;
  if (tables && typeof tables === 'object' && !Array.isArray(tables) && Object.keys(tables).length > 0) {
    return true;
  }
  // Ingest root present (deploy/status) even before tables map is fully shaped.
  return Object.keys(ingest).length > 0;
}

/**
 * @param {Array<{ processing_config?: object|null }>|null|undefined} models
 * @returns {boolean}
 */
export function dashboardModelsSupportAutoRefresh(models) {
  if (!Array.isArray(models) || models.length === 0) return false;
  return models.some((m) => dataModelHasApiUpdates(m));
}

/**
 * Read auto_refresh from dashboard.layout_config (default false).
 * @param {{ layout_config?: object|null|string }|null|undefined} dashboard
 * @returns {boolean}
 */
export function getDashboardAutoRefreshEnabled(dashboard) {
  const layout = normalizeLayoutConfig(dashboard?.layout_config);
  return layout.auto_refresh === true || layout.auto_refresh === 1 || layout.auto_refresh === 'true';
}

/**
 * Merge auto_refresh into layout_config without dropping other keys.
 * @param {{ layout_config?: object|null|string }|null|undefined} dashboard
 * @param {boolean} enabled
 * @returns {object}
 */
export function buildLayoutConfigWithAutoRefresh(dashboard, enabled) {
  const prev = normalizeLayoutConfig(dashboard?.layout_config);
  return {
    ...prev,
    auto_refresh: Boolean(enabled),
  };
}

/**
 * Polling interval (seconds) for auto-refresh fallback when realtime WS is off / quiet.
 * @param {{ refresh_interval?: number|null }|null|undefined} dashboard
 * @returns {number}
 */
export function getDashboardAutoRefreshIntervalSec(dashboard) {
  const n = Number(dashboard?.refresh_interval);
  if (Number.isFinite(n) && n >= 5) return Math.min(3600, Math.floor(n));
  return 30;
}
