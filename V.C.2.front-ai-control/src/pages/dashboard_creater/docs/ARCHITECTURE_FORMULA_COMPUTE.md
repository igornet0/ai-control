# Formula compute architecture (v3)

## Layers

1. **Parser / AST** — `tokenizer.js`, `parser.js`, `compile.js`; leaf aggs keyed by `fn:column`.
2. **Canonical form** — `formulaCanonical.js` (commutative `+`/`*`, unary fold); **structural hashes** via `formulaHasher.js` (SHA-256).
3. **AST cache** — `cache.js` keys by `can:{rootHash}` when `formula_cache_v3` enabled (defaults on in `formulaFeatures.js`).
4. **Widget bundle runtime** — `widgetFormulaRuntime.js`: effective filters + date window merged once; **`buildNamedFormulaCacheKey`** includes `c3.bundle`, `filterH`, versions; **`runNamedFormulaBundle`** dedupes SQL inputs by canonical hash, optional **aggregate scalar reuse** (`formulaCacheManager.js`), agg-level **subtree memo** during `evaluateAst`.
5. **Dependency index** — `formulaGraph.js` (`FormulaSheetGraph`) when `formula_dag_recompute` runs and `widgetId` is passed: maps subtree/root hashes → widget ids for selective invalidation analysis.
6. **Invalidation** — `formulaInvalidation.js`: bump listener clears widget result + subtree + aggregate reuse caches; **`invalidateFormulaComputeHard`** clears AST layer.

## Integration

- Widgets continue calling `runNamedFormulaBundle(engine, modelId, table, named, window, { widgetId?, sourceVersion?, schemaVersion? })`; `widgetId` enables DAG attachment.
- Realtime: existing `DashboardDataModelClient` filter subscription + bump generation stays source of truth; hook `ensureFormulaInvalidationHooks()` is idempotent.

## Collision safety

- Cache keys compose SHA-256 of canonical JSON payloads; subtree memo additionally keys on **serialized agg slice of the row**.

## Flags (localStorage)

| Key | Effect |
|-----|--------|
| `formula_cache_v3` | `0` disables canonical AST cache keys (legacy raw-key compile path). |
| `formula_dag_recompute` | `0` disables `FormulaSheetGraph` registration. |
| `formula_invalidation_v2` | Reserved alongside bump listener (invalidate engine). |
