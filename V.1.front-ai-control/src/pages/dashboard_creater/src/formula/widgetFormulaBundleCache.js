import { clearSubtreeEvalCache } from './formulaCacheManager.js';

const MAX_RESULT_CACHE = 128;

/** @type {Map<string, { at: number, data: object }>} */
export const widgetFormulaResultCache = new Map();

/** @type {Map<string, Promise<object>>} */
export const widgetFormulaInflight = new Map();

export function clearWidgetFormulaResultCache() {
  widgetFormulaResultCache.clear();
  widgetFormulaInflight.clear();
  clearSubtreeEvalCache();
}

export function trimWidgetFormulaResultCache() {
  while (widgetFormulaResultCache.size > MAX_RESULT_CACHE) {
    const k = widgetFormulaResultCache.keys().next();
    if (k.done) break;
    widgetFormulaResultCache.delete(k.value);
  }
}
