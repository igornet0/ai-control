/**
 * Побочные эффекты при bumpDashboardQueryCoordinator: инвалидация memo формул KPI,
 * монотонный generation для ключей кэша виджетов.
 */

/** @type {Set<() => void>} */
const listeners = new Set();

let bumpGeneration = 0;

/**
 * @param {() => void} fn
 * @returns {() => void} unsubscribe
 */
export function registerDashboardQueryBumpListener(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function runDashboardQueryBumpSideEffects() {
  bumpGeneration += 1;
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (e) {
      console.error('[dashboardQueryBump] listener', e);
    }
  });
}

/** Увеличивается при каждом bumpDashboardQueryCoordinator — включать в ключ кэша KPI. */
export function getDashboardQueryBumpGeneration() {
  return bumpGeneration;
}
