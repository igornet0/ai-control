/**
 * DataBridge auto-rebuild settings on DataModel.processing_config.databridge.
 *
 * Shown in model settings only when the workspace has a data-source widget
 * with sourceType === 'databridge'.
 */

export const DATABRIDGE_REFRESH_PRESETS = [
  { value: 300, label: 'Каждые 5 минут' },
  { value: 900, label: 'Каждые 15 минут' },
  { value: 1800, label: 'Каждые 30 минут' },
  { value: 3600, label: 'Каждый час' },
  { value: 21600, label: 'Каждые 6 часов' },
  { value: 86400, label: 'Раз в сутки' },
];

export const DEFAULT_DATABRIDGE_REFRESH_INTERVAL_SEC = 900;
export const MIN_DATABRIDGE_REFRESH_INTERVAL_SEC = 300;
export const MAX_DATABRIDGE_REFRESH_INTERVAL_SEC = 86400;

/**
 * @param {unknown} widget
 * @returns {boolean}
 */
export function widgetUsesDatabridge(widget) {
  if (!widget || typeof widget !== 'object') return false;
  const type = widget.widget_type || widget.type;
  if (type !== 'data-source') return false;
  const settings = widget.widget_config?.settings
    || widget.config?.settings
    || widget.settings
    || {};
  if (settings.sourceType === 'databridge') return true;
  return Boolean(String(settings.databridgeEntity || settings.entity || '').trim());
}

/**
 * @param {unknown} widgets
 * @returns {boolean}
 */
export function dataModelWidgetsUseDatabridge(widgets) {
  if (!Array.isArray(widgets) || widgets.length === 0) return false;
  return widgets.some(widgetUsesDatabridge);
}

/**
 * @param {{ processing_config?: object|null }|null|undefined} model
 * @returns {Record<string, unknown>}
 */
export function getDatabridgeConfig(model) {
  const cfg = model?.processing_config;
  if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) return {};
  const bridge = cfg.databridge;
  if (!bridge || typeof bridge !== 'object' || Array.isArray(bridge)) return {};
  return { ...bridge };
}

/**
 * @param {{ processing_config?: object|null }|null|undefined} model
 * @returns {boolean}
 */
export function getDatabridgeAutoRefreshEnabled(model) {
  const bridge = getDatabridgeConfig(model);
  return bridge.auto_refresh === true
    || bridge.auto_refresh === 1
    || bridge.auto_refresh === 'true';
}

/**
 * @param {{ processing_config?: object|null }|null|undefined} model
 * @returns {number}
 */
export function getDatabridgeRefreshIntervalSec(model) {
  const bridge = getDatabridgeConfig(model);
  const n = Number(bridge.refresh_interval_sec);
  if (Number.isFinite(n) && n >= MIN_DATABRIDGE_REFRESH_INTERVAL_SEC) {
    return Math.min(MAX_DATABRIDGE_REFRESH_INTERVAL_SEC, Math.floor(n));
  }
  return DEFAULT_DATABRIDGE_REFRESH_INTERVAL_SEC;
}

/**
 * Merge DataBridge auto-refresh into processing_config without dropping other keys.
 *
 * @param {{ processing_config?: object|null }|null|undefined} model
 * @param {{ auto_refresh?: boolean, refresh_interval_sec?: number }} patch
 * @returns {object}
 */
export function buildProcessingConfigWithDatabridgeRefresh(model, patch = {}) {
  const prev = (model?.processing_config && typeof model.processing_config === 'object'
    && !Array.isArray(model.processing_config))
    ? { ...model.processing_config }
    : {};
  const prevBridge = getDatabridgeConfig(model);
  const nextBridge = { ...prevBridge };

  if (patch.auto_refresh !== undefined) {
    nextBridge.auto_refresh = Boolean(patch.auto_refresh);
  }
  if (patch.refresh_interval_sec !== undefined) {
    const n = Number(patch.refresh_interval_sec);
    nextBridge.refresh_interval_sec = Number.isFinite(n)
      ? Math.min(
        MAX_DATABRIDGE_REFRESH_INTERVAL_SEC,
        Math.max(MIN_DATABRIDGE_REFRESH_INTERVAL_SEC, Math.floor(n)),
      )
      : DEFAULT_DATABRIDGE_REFRESH_INTERVAL_SEC;
  }

  if (nextBridge.refresh_interval_sec == null) {
    nextBridge.refresh_interval_sec = DEFAULT_DATABRIDGE_REFRESH_INTERVAL_SEC;
  }

  return {
    ...prev,
    databridge: nextBridge,
  };
}
