/**
 * Утилиты для условной окраски (IF / RGB / MATCH) поверх formula AST.
 */

import { compileFormula } from './compile.js';
import { evaluateAstValue } from './evaluate.js';

const COLOR_NODE_TYPES = new Set(['rgb', 'if', 'match', 'null', 'str', 'field', 'cmp', 'logic']);

/**
 * @param {object|null|undefined} node
 * @returns {boolean}
 */
export function astHasColorFeatures(node) {
  if (!node || typeof node !== 'object') return false;
  if (COLOR_NODE_TYPES.has(node.t)) return true;
  if (node.t === 'bin' || node.t === 'cmp' || node.t === 'logic') {
    return astHasColorFeatures(node.l) || astHasColorFeatures(node.r);
  }
  if (node.t === 'ua') return astHasColorFeatures(node.x);
  if (node.t === 'rgb') {
    return (
      astHasColorFeatures(node.r) ||
      astHasColorFeatures(node.g) ||
      astHasColorFeatures(node.b)
    );
  }
  if (node.t === 'if') {
    return (
      astHasColorFeatures(node.cond) ||
      astHasColorFeatures(node.then) ||
      astHasColorFeatures(node.else)
    );
  }
  if (node.t === 'match') {
    if (astHasColorFeatures(node.subject) || astHasColorFeatures(node.else)) return true;
    return (node.cases || []).some((c) => astHasColorFeatures(c?.body));
  }
  return false;
}

/**
 * @param {string} formula
 * @returns {{ ok: true, ast: object, aggs: object[] } | { ok: false, error: unknown }}
 */
export function tryCompileColorFormula(formula) {
  try {
    const compiled = compileFormula(formula, { allowFieldRef: true });
    if (!astHasColorFeatures(compiled.ast)) {
      return { ok: false, error: new Error('not-color-formula') };
    }
    return { ok: true, ast: compiled.ast, aggs: compiled.aggs };
  } catch (e) {
    return { ok: false, error: e };
  }
}

/**
 * @param {unknown} v
 * @returns {string|null} hex color or null
 */
export function coerceFormulaColorResult(v) {
  if (v == null) return null;
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (/^#[0-9a-fA-F]{3}$/.test(s) || /^#[0-9a-fA-F]{6}$/.test(s) || /^#[0-9a-fA-F]{8}$/.test(s)) {
    return s;
  }
  return null;
}

/**
 * @param {object} ast
 * @param {{
 *   label?: string,
 *   value?: number,
 *   dimQualified?: string,
 *   labelField?: string,
 *   fieldValues?: Record<string, unknown>,
 * }} slice
 * @returns {string|null}
 */
export function evaluateSliceColorAst(ast, slice = {}) {
  const dimQ = String(slice.dimQualified || '').trim();
  const labelField = String(slice.labelField || '').trim();
  const label = slice.label;
  const extra = slice.fieldValues && typeof slice.fieldValues === 'object' ? slice.fieldValues : {};

  const getField = (colRaw) => {
    const col = String(colRaw || '').trim();
    if (!col) return null;
    if (Object.prototype.hasOwnProperty.call(extra, col)) return extra[col];
    if (dimQ && col === dimQ) return label;
    if (labelField && (col === labelField || col.endsWith(`.${labelField}`))) return label;
    if (col === 'value' && slice.value != null) return slice.value;
    return null;
  };

  try {
    const getVar =
      typeof slice.getVar === 'function'
        ? slice.getVar
        : slice.engine?.getModelVariable
          ? (n) => slice.engine.getModelVariable(n)
          : typeof window !== 'undefined' && window.engine?.getModelVariable
            ? (n) => window.engine.getModelVariable(n)
            : null;
    const hasVar =
      typeof slice.hasVar === 'function'
        ? slice.hasVar
        : slice.engine?.hasModelVariable
          ? (n) => slice.engine.hasModelVariable(n)
          : typeof window !== 'undefined' && window.engine?.hasModelVariable
            ? (n) => window.engine.hasModelVariable(n)
            : null;
    const v = evaluateAstValue(ast, {}, null, { getField, getVar, hasVar });
    return coerceFormulaColorResult(v);
  } catch {
    return null;
  }
}
