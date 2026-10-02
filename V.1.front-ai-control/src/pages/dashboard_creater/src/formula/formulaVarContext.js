/**
 * Контекст @переменных модели для evaluateAst / evaluateAstValue.
 * @param {object|null|undefined} engine
 * @returns {{ getVar: (name: string) => unknown, hasVar: (name: string) => boolean } | null}
 */
export function makeFormulaVarContext(engine) {
  if (!engine || typeof engine.getModelVariable !== 'function') return null;
  return {
    getVar: (name) => engine.getModelVariable(name),
    hasVar: (name) =>
      typeof engine.hasModelVariable === 'function'
        ? engine.hasModelVariable(name)
        : engine.getModelVariable(name) !== undefined,
  };
}

/**
 * Стабильный снимок resolved vars для cache key.
 * @param {object|null|undefined} engine
 */
export function snapshotEngineModelVariables(engine) {
  if (!engine || typeof engine.getModelVariables !== 'function') return {};
  const all = engine.getModelVariables() || {};
  const out = {};
  Object.keys(all)
    .sort()
    .forEach((k) => {
      out[k] = all[k];
    });
  return out;
}
