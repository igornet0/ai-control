/**
 * Helpers for formula-widget global variables exported to SQLite build.
 *
 * kinds:
 *   literal    — global x = 42 / "text" / true
 *   aggregate  — global suma = sum(orders["amount"])
 *   expression — global x = <free DataCode>
 */

import { sanitizeIdentifier } from './schema.js';

export const FORMULA_VARIABLE_FUNCS = [
  { value: 'sum', label: 'Сумма (sum)' },
  { value: 'count', label: 'Количество (count)' },
  { value: 'min', label: 'Минимум (min)' },
  { value: 'max', label: 'Максимум (max)' },
  { value: 'avg', label: 'Среднее (avg)' },
];

export function createFormulaVariable(partial = {}) {
  return {
    id: partial.id || `v_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: partial.name || '',
    kind: partial.kind || 'aggregate',
    exportGlobal: partial.exportGlobal !== false,
    value: partial.value ?? '',
    field: partial.field || '',
    func: partial.func || 'sum',
    expression: partial.expression || '',
  };
}

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

export function formatFormulaLiteralValue(raw) {
  if (raw === null || raw === undefined) return 'null';
  if (typeof raw === 'boolean') return raw ? 'true' : 'false';
  if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw);

  const text = String(raw).trim();
  if (!text) return 'null';
  if (text === 'true' || text === 'false' || text === 'null') return text;
  if (/^-?\d+(\.\d+)?$/.test(text)) return text;
  // Already quoted string
  if (
    (text.startsWith('"') && text.endsWith('"'))
    || (text.startsWith("'") && text.endsWith("'"))
  ) {
    return text;
  }
  return `"${escapeString(text)}"`;
}

/**
 * @param {object} variable
 * @param {string} inputVar — upstream table variable
 * @returns {string|null}
 */
export function buildFormulaVariableLine(variable = {}, inputVar = 'data') {
  const nameRaw = String(variable.name || '').trim();
  if (!nameRaw) return null;
  const name = sanitizeIdentifier(nameRaw, 'var');
  const prefix = variable.exportGlobal === false ? '' : 'global ';
  const table = sanitizeIdentifier(inputVar || 'data', 'data');
  const kind = variable.kind || 'aggregate';

  if (kind === 'literal') {
    return `${prefix}${name} = ${formatFormulaLiteralValue(variable.value)}`;
  }

  if (kind === 'expression') {
    const expr = String(variable.expression || '').trim();
    if (!expr) return null;
    return `${prefix}${name} = ${expr}`;
  }

  // aggregate
  const func = String(variable.func || 'sum').trim().toLowerCase() || 'sum';
  const field = String(variable.field || '').trim();

  if (func === 'count' && !field) {
    // count of rows via counting a synthetic ones column is awkward;
    // use count on first available approach: table column count needs a field.
    // Fallback: count of all columns isn't valid — require field or use expression.
    return `${prefix}${name} = count(${table})`;
  }

  if (!field) return null;

  if (func === 'avg') {
    // No global avg() in DataCode — express as sum/count.
    return `${prefix}${name} = sum(${table}[${quoteField(field)}]) / count(${table}[${quoteField(field)}])`;
  }

  return `${prefix}${name} = ${func}(${table}[${quoteField(field)}])`;
}

/**
 * Example variable templates based on available fields / input table.
 */
export function buildFormulaVariableTemplates(availableFields = [], inputVar = 'data') {
  const fields = (availableFields || [])
    .map((f) => (typeof f === 'string' ? f : f?.name))
    .filter(Boolean);
  const numeric = fields.find((n) =>
    /amount|price|qty|quantity|sum|total|cost|count|value|score|rate/i.test(n),
  ) || fields[0] || 'amount';
  const table = sanitizeIdentifier(inputVar || 'data', 'data');

  return [
    {
      id: 'sum_field',
      label: 'Σ Сумма поля',
      hint: `global suma = sum(${table}["${numeric}"])`,
      variable: createFormulaVariable({
        name: `sum_${numeric}`,
        kind: 'aggregate',
        func: 'sum',
        field: numeric,
        exportGlobal: true,
      }),
    },
    {
      id: 'count_field',
      label: 'Количество',
      hint: `global n = count(${table}["${numeric}"])`,
      variable: createFormulaVariable({
        name: 'row_count',
        kind: 'aggregate',
        func: 'count',
        field: numeric,
        exportGlobal: true,
      }),
    },
    {
      id: 'avg_field',
      label: 'Среднее',
      hint: `global avg_x = sum(${table}["${numeric}"]) / count(${table}["${numeric}"])`,
      variable: createFormulaVariable({
        name: `avg_${numeric}`,
        kind: 'aggregate',
        func: 'avg',
        field: numeric,
        exportGlobal: true,
      }),
    },
    {
      id: 'literal_num',
      label: 'Своё число',
      hint: 'global rate = 1.2',
      variable: createFormulaVariable({
        name: 'rate',
        kind: 'literal',
        value: '1.2',
        exportGlobal: true,
      }),
    },
    {
      id: 'literal_text',
      label: 'Свой текст',
      hint: 'global label = "ok"',
      variable: createFormulaVariable({
        name: 'label',
        kind: 'literal',
        value: 'ok',
        exportGlobal: true,
      }),
    },
  ];
}
