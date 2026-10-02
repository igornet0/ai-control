/**
 * Feature flags for formula compute engine (v3 cache, DAG, invalidation).
 * Toggle via localStorage for canary / debug:
 *   localStorage.setItem('formula_cache_v3', '1')
 *   localStorage.setItem('formula_dag_recompute', '1')
 *   localStorage.setItem('formula_invalidation_v2', '1')
 */

function readFlag(key, defaultEnabled = false) {
  try {
    if (typeof globalThis.localStorage === 'undefined') return defaultEnabled;
    const v = globalThis.localStorage.getItem(key);
    if (v == null || v === '') return defaultEnabled;
    const s = String(v).trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(s)) return true;
    if (['0', 'false', 'no', 'off'].includes(s)) return false;
    return defaultEnabled;
  } catch {
    return defaultEnabled;
  }
}

/** Canonical AST + hashed cache keys (default ON for parity with rollout plan). */
export function isFormulaCacheV3() {
  return readFlag('formula_cache_v3', true);
}

/** Dependency graph + partial subtree reuse across widgets on a sheet. */
export function isFormulaDagRecompute() {
  return readFlag('formula_dag_recompute', true);
}

/** Version-tagged lineage invalidation (works with invalidateFormulaCompute). */
export function isFormulaInvalidationV2() {
  return readFlag('formula_invalidation_v2', true);
}
