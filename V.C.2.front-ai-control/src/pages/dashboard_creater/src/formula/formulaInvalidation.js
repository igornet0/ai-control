/**
 * Central invalidation for formula compute caches (results, aggregate reuse, subtree memo).
 */

import { clearWidgetFormulaResultCache } from './widgetFormulaBundleCache.js';
import { clearFormulaAstCache } from './cache.js';
import { clearFormulaAggregateReuseCache } from './formulaCacheManager.js';

/** @type {Promise<void>|null} */
let formulaHooksPromise = null;

/** Lazy-register bump listener — dynamic import so partial vitest mocks on dashboardQueryBump do not fail. */
export async function ensureFormulaInvalidationHooks() {
  if (!formulaHooksPromise) {
    formulaHooksPromise = import('../../../../services/dashboardQueryBump.js')
      .then((m) => {
        if (typeof m.registerDashboardQueryBumpListener === 'function') {
          m.registerDashboardQueryBumpListener(() => {
            clearFormulaComputeCaches({ ast: false, bumpCoversResults: true });
          });
        }
      })
      .catch(() => {});
  }
  await formulaHooksPromise;
}

/**
 * @param {{ ast?: boolean, widgetResults?: boolean, aggregateReuse?: boolean, bumpCoversResults?: boolean }} scope
 */
export function clearFormulaComputeCaches(scope = {}) {
  const {
    ast = false,
    widgetResults = true,
    aggregateReuse = true,
    bumpCoversResults = false,
  } = scope;

  if (widgetResults || bumpCoversResults) {
    clearWidgetFormulaResultCache();
  }
  if (aggregateReuse) {
    clearFormulaAggregateReuseCache();
  }
  if (ast) {
    clearFormulaAstCache();
  }
}

/**
 * Full reset when data/schema/formula definitions change aggressively.
 */
export function invalidateFormulaComputeHard() {
  clearFormulaComputeCaches({ ast: true, widgetResults: true, aggregateReuse: true });
}
