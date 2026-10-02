import { eventBus } from '../core/EventBus.js';

/**
 * @typedef {object} WidgetDataAdapter
 * @property {(opts: object) => Promise<unknown>} [queryAggregate]
 * @property {(modelId: string|number) => Promise<object>} [getSchema]
 * @property {() => object[]} [getFilters]
 * @property {(modelId: string|number) => object[]} [filtersForModel]
 *
 * @typedef {object} WidgetNavigationAdapter
 * @property {(sheetId: string|number, payload?: object) => void} [goToSheet]
 * @property {() => (string|number|null)} [getCurrentSheetId]
 *
 * @typedef {object} WidgetUiAdapter
 * @property {(message: string, kind?: string) => void} [notify]
 * @property {(opts: object) => void} [openModal]
 *
 * @typedef {object} WidgetAdapters
 * @property {WidgetDataAdapter} [data]
 * @property {WidgetNavigationAdapter} [navigation]
 * @property {WidgetUiAdapter} [ui]
 *
 * @typedef {object} WidgetContext
 * @property {'editor'|'viewer'|string} mode
 * @property {typeof eventBus} eventBus
 * @property {object|null} engine
 * @property {WidgetDataAdapter} data
 * @property {WidgetNavigationAdapter} navigation
 * @property {WidgetUiAdapter} ui
 */

/**
 * Build a WidgetContext for widget runtime code.
 * Prefer adapters over `ctx.engine` / `window.engine`.
 *
 * @param {object|null} engine
 * @param {WidgetAdapters} [adapters]
 * @returns {WidgetContext}
 */
export function createWidgetContext(engine, adapters = {}) {
  const data = {
    queryAggregate: async () => {
      throw new Error('WidgetContext.data.queryAggregate is not configured by the host');
    },
    getSchema: async () => ({}),
    getFilters: () => {
      if (engine?.filterStore && typeof engine.filterStore.getDescriptors === 'function') {
        return engine.filterStore.getDescriptors();
      }
      return [];
    },
    filtersForModel: () => [],
    ...(adapters.data || {}),
  };

  const navigation = {
    goToSheet: () => {},
    getCurrentSheetId: () => engine?.sheetId ?? null,
    ...(adapters.navigation || {}),
  };

  const ui = {
    notify: () => {},
    openModal: () => {},
    ...(adapters.ui || {}),
  };

  return {
    mode: engine?.mode || 'editor',
    eventBus,
    /** @deprecated Prefer adapters; kept for gradual migration of builtins. */
    engine: engine || null,
    data,
    navigation,
    ui,
  };
}

/**
 * Resolve a context from an engine-like argument (engine or already a context).
 * @param {object|null|undefined} engineOrCtx
 * @returns {WidgetContext|null}
 */
export function resolveWidgetContext(engineOrCtx) {
  if (!engineOrCtx) return null;
  if (engineOrCtx.data && engineOrCtx.eventBus && 'mode' in engineOrCtx) {
    return /** @type {WidgetContext} */ (engineOrCtx);
  }
  if (typeof engineOrCtx.getWidgetContext === 'function') {
    return engineOrCtx.getWidgetContext();
  }
  return createWidgetContext(engineOrCtx);
}
