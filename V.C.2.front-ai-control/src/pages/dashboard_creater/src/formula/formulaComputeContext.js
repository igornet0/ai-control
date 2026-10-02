/**
 * Context hashes for deterministic formula/cache keys (v3).
 */

import { canonicalizeFilters } from '../../../../services/dashboardDataModel/intentTypes.js';
import { sha256Hex } from './formulaHasher.js';

/**
 * @param {{
 *   modelId?: string|number,
 *   base_table?: string,
 *   filtersSnapshot?: unknown[],
 *   bumpGen?: number,
 *   window?: object|null,
 *   formulaRootHashes?: Record<string,string>,
 *   formulaVersions?: Record<string,string>,
 *   varsSnapshot?: Record<string, unknown>,
 * }} opts
 */
export function buildFormulaComputeContextV3(opts) {
  const m = String(opts.modelId ?? '');
  const t = String(opts.base_table ?? '');
  const fl = canonicalizeFilters(opts.filtersSnapshot ?? []);
  const w =
    opts.window?.dateField && opts.window?.range?.start && opts.window?.range?.end
      ? { d: String(opts.window.dateField), r: { ...opts.window.range } }
      : null;

  const filterHash = sha256Hex(JSON.stringify(fl));
  const varsSnap = opts.varsSnapshot && typeof opts.varsSnapshot === 'object' ? opts.varsSnapshot : {};
  const varsHash = sha256Hex(JSON.stringify(varsSnap));
  const scopeHash = sha256Hex(JSON.stringify({ m, t, fl, vars: varsSnap }));

  const hashes = {};
  const rh = opts.formulaRootHashes || {};
  const fv = opts.formulaVersions || {};
  Object.keys(rh)
    .sort()
    .forEach((k) => {
      hashes[k] = { rh: rh[k], fv: fv[k] || '' };
    });
  const formulaBundleHash = sha256Hex(JSON.stringify(hashes));

  return {
    modelId: m,
    baseTable: t,
    filtersCanonical: fl,
    window: w,
    filterHash,
    scopeHash,
    formulaBundleHash,
    bumpGeneration: opts.bumpGen ?? 0,
    varsHash,
  };
}

/**
 * Compose cache key suffix for subtree memo / aggregate reuse.
 */
export function composeSubtreeContextKey(parts) {
  return sha256Hex(
    JSON.stringify({
      fh: parts.filterHash,
      sh: parts.scopeHash,
      bg: parts.bumpGen,
      w: parts.window ?? null,
      src: parts.sourceVersion ?? '',
      sch: parts.schemaVersion ?? '',
    }),
  );
}
