/**
 * DataCode generation for formula widgets.
 *
 * Column expressions:
 *   table!["new_col"] = table["source_col"].map(fn(v) => <expr>)
 *
 * Global variables (exported to SQLite build):
 *   global suma = sum(orders["amount"])
 *   global rate = 1.2
 */

import { sanitizeIdentifier } from './schema.js';
import { buildFormulaVariableLine } from './formulaVariables.js';

function escapeString(s) {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

function quoteField(name) {
  return `"${escapeString(name)}"`;
}

/**
 * Determine which source column an expression primarily references.
 * Simple heuristic: find the first known field name that appears as a
 * whole word in the expression. Falls back to null.
 */
function detectSourceColumn(expression, availableFields = []) {
  if (!expression) return null;
  const fieldNames = availableFields
    .map((f) => (typeof f === 'string' ? f : f?.name))
    .filter(Boolean);
  for (const name of fieldNames) {
    const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
    if (re.test(expression)) return name;
  }
  return null;
}

/**
 * Resolve add vs replace for one expression.
 * - Explicit expr.outputMode wins when set to 'add' | 'replace'
 * - Else: name already in source fields → replace in place; otherwise add a column
 *
 * @param {{ name?: string, outputMode?: string }} expr
 * @param {Array<string|{name?: string}>} availableFields
 * @returns {'add'|'replace'}
 */
export function resolveFormulaExpressionMode(expr, availableFields = []) {
  const explicit = expr?.outputMode;
  if (explicit === 'add' || explicit === 'replace') return explicit;

  const targetName = expr?.name?.trim();
  if (!targetName) return 'add';

  const fieldNames = availableFields
    .map((f) => (typeof f === 'string' ? f : f?.name))
    .filter(Boolean);
  return fieldNames.includes(targetName) ? 'replace' : 'add';
}

/**
 * Build one DataCode line for a single formula expression.
 *
 * Mode (auto or explicit):
 *   'add'     — table!["new_col"] = table["src"].map(fn(v) => expr)
 *   'replace' — table!["col"] = table["col"].map(fn(v) => expr)
 *
 * @param {string} outputVar  - variable name (e.g. "orders")
 * @param {{ name: string, expression: string, outputMode?: string }} expr
 * @param {string[]} availableFields
 * @param {string} [outputMode] - optional override; default auto from name
 * @returns {string|null}
 */
export function buildFormulaExpressionLine(outputVar, expr, availableFields, outputMode) {
  const targetName = expr?.name?.trim();
  const expression = expr?.expression?.trim();
  if (!targetName || !expression) return null;

  const mode = outputMode === 'add' || outputMode === 'replace'
    ? outputMode
    : resolveFormulaExpressionMode(expr, availableFields);

  const srcCol = detectSourceColumn(expression, availableFields) || targetName;

  // Replace field names with table column access syntax in the lambda body.
  // e.g. "amount * 1.2" becomes the body of fn(v) => v * 1.2
  // when srcCol === "amount". For multi-column or complex expressions we keep
  // the expression as-is (user may reference arbitrary DataCode globals).
  let lambdaBody;
  const fieldNames = availableFields
    .map((f) => (typeof f === 'string' ? f : f?.name))
    .filter(Boolean);

  if (srcCol && fieldNames.includes(srcCol)) {
    // Replace only the detected primary source column with the lambda param.
    const re = new RegExp(`\\b${srcCol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
    lambdaBody = expression.replace(re, 'v');
  } else {
    lambdaBody = expression;
  }

  const src = quoteField(mode === 'replace' ? targetName : srcCol);
  return `${outputVar}!["${escapeString(targetName)}"] = ${outputVar}[${src}].map(fn(v) => ${lambdaBody})`;
}

/**
 * Generate complete DataCode block for a formula widget.
 *
 * @param {object} formulaSettings - widget.settings from FormulaWidget
 * @param {object} context - { inputVariable?: string }
 * @returns {string}
 */
export function generateFormulaDataCode(formulaSettings = {}, context = {}) {
  const inputVar = sanitizeIdentifier(context.inputVariable || 'data', 'data');
  const formulaName = formulaSettings.name || 'Формула';
  const expressions = formulaSettings.expressions || [];
  const variables = formulaSettings.variables || [];
  const availableFields = formulaSettings.availableFields || [];

  const lines = [
    `# Formula: ${formulaName}`,
    `# Input table: ${inputVar}`,
  ];

  if (expressions.length) {
    const exprSummary = expressions
      .map((e) => {
        const mode = resolveFormulaExpressionMode(e, availableFields);
        return `${e.name} = ${e.expression} (${mode})`;
      })
      .join('; ');
    lines.push(`# expressions: ${exprSummary}`);
  }

  if (variables.length) {
    const varSummary = variables
      .map((v) => `${v.exportGlobal === false ? '' : 'global '}${v.name}`)
      .filter(Boolean)
      .join('; ');
    if (varSummary) lines.push(`# variables: ${varSummary}`);
  }

  const exprLines = expressions
    .map((e) => buildFormulaExpressionLine(inputVar, e, availableFields))
    .filter(Boolean);

  const varLines = variables
    .map((v) => buildFormulaVariableLine(v, inputVar))
    .filter(Boolean);

  if (!exprLines.length && !varLines.length) {
    lines.push('# No expressions / variables defined — pass-through');
  } else {
    if (exprLines.length) {
      lines.push('# --- column formulas ---');
      lines.push(...exprLines);
    }
    if (varLines.length) {
      lines.push('# --- global variables (SQLite export) ---');
      lines.push(...varLines);
    }
  }

  lines.push(`print("${inputVar}: ", table_info(${inputVar}))`);
  return lines.join('\n');
}

const FORMULA_BLOCK_RE = /# Formula:[^\n]*\r?\n[\s\S]*?print\s*\([^)]*table_info\s*\([\p{L}_][\p{L}\p{N}_]*\)\s*\)/gmu;

export function stripFormulaBlocks(code) {
  if (!code?.trim()) return '';
  return String(code)
    .replace(FORMULA_BLOCK_RE, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function patchFormulaDataCodeInCode(code, formulaSettings, context = {}) {
  const generated = generateFormulaDataCode(formulaSettings, context);
  const cleaned = stripFormulaBlocks(code);
  if (!cleaned) {
    return { code: generated };
  }
  return {
    code: `${cleaned}\n\n${generated}`.trim(),
  };
}
