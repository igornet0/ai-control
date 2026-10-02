/**
 * Варианты select/multiselect виджета «Ввод данных»:
 * ручной список или уникальные значения поля данных из формулы
 * (опционально с полем имени для подписи).
 */

import { getDashboardDataModelClient } from '../../../../../services/dashboardDataModel/DashboardDataModelClient.js';
import { parseSimpleTableFieldRef } from '../common/tableColumnFormula.js';

const ANY_FIELD_REF_RE = /\$?\[([^\].]+)\.([^\].]+)\]/;
const UNIQUE_WRAP_RE = /^\s*(?:UNIQUE|DISTINCT)\s*\(\s*(\$?\[[^\]]+\])\s*\)\s*$/i;
const BARE_BRACKET_RE = /^\s*\[([^\].]+)\]\s*$/;
const BARE_IDENT_RE = /^[A-Za-z_][\w]*$/;

export const SELECT_OPTIONS_TYPES = new Set(['select', 'multiselect', 'tags']);

export function isSelectOptionsFieldType(type) {
  return SELECT_OPTIONS_TYPES.has(String(type || '').toLowerCase());
}

/**
 * @param {object|null|undefined} field
 */
export function fieldUsesOptionsFormula(field) {
  if (!isSelectOptionsFieldType(field?.type)) return false;
  if (String(field?.optionsSource || '') !== 'formula') return false;
  return String(field?.optionsFormula || '').trim() !== '';
}

/**
 * @param {string} table
 * @param {string} fieldName
 */
export function defaultSelectOptionsFormula(table, fieldName) {
  const t = String(table || '').trim();
  const n = String(fieldName || '').trim();
  if (!t || !n) return '';
  return `[${t}.${n}]`;
}

/**
 * `[table.field]`, `$[table.field]`, `UNIQUE([table.field])`, либо имя колонки при fallbackTable.
 * @param {string} formula
 * @param {string} [fallbackTable]
 * @returns {{ table: string, field: string } | null}
 */
export function parseOptionsFormulaFieldRef(formula, fallbackTable = '') {
  const src = String(formula ?? '').trim();
  if (!src) return null;
  const wrapped = src.match(UNIQUE_WRAP_RE);
  const inner = wrapped ? String(wrapped[1] || '').trim() : src;
  const simple = parseSimpleTableFieldRef(inner);
  if (simple) return { table: simple.table, field: simple.field };
  const m = inner.match(ANY_FIELD_REF_RE);
  if (m) return { table: m[1].trim(), field: m[2].trim() };
  const fb = String(fallbackTable || '').trim();
  const bare = inner.match(BARE_BRACKET_RE);
  if (bare && fb) return { table: fb, field: bare[1].trim() };
  if (fb && BARE_IDENT_RE.test(inner)) return { table: fb, field: inner };
  return null;
}

/**
 * @param {unknown[]} values
 * @returns {{ value: string, label: string }[]}
 */
export function distinctValuesToOptions(values) {
  if (!Array.isArray(values)) return [];
  const seen = new Set();
  const out = [];
  for (const v of values) {
    if (v == null) continue;
    const s = String(v);
    if (seen.has(s)) continue;
    seen.add(s);
    out.push({ value: s, label: s });
  }
  return out;
}

/**
 * Уникальные value → label из строк GROUP BY / SELECT.
 * @param {Array<Record<string, unknown>>} rows
 * @param {string} valueKey
 * @param {string} labelKey
 * @returns {{ value: string, label: string }[]}
 */
export function pairsToOptions(rows, valueKey, labelKey) {
  if (!Array.isArray(rows)) return [];
  const vKey = String(valueKey || '');
  const lKey = String(labelKey || '');
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const raw = row[vKey];
    if (raw == null) continue;
    const value = String(raw);
    if (seen.has(value)) continue;
    seen.add(value);
    const lab = lKey ? row[lKey] : null;
    const label = lab == null || String(lab).trim() === '' ? value : String(lab);
    out.push({ value, label });
  }
  return out;
}

function labelAggColumn(valueRef, labelRef) {
  if (!labelRef?.field) return '';
  const vt = String(valueRef.table || '').toLowerCase();
  const lt = String(labelRef.table || '').toLowerCase();
  if (lt && vt && lt !== vt) return `${labelRef.table}.${labelRef.field}`;
  return labelRef.field;
}

/**
 * Все уникальные значения колонки из формулы (без фильтров дашборда).
 * Если задано поле имени — подпись берётся из него (одно имя на каждое уникальное значение).
 * @param {object|null|undefined} engine
 * @param {{ modelId?: number|string|null, formula?: string, labelFormula?: string, fallbackTable?: string }} params
 */
export async function fetchSelectOptionsFromFormula(engine, params = {}) {
  const formula = String(params.formula || '').trim();
  const ref = parseOptionsFormulaFieldRef(formula, params.fallbackTable);
  const modelId = params.modelId;
  if (!engine || !ref || modelId == null || modelId === '') return [];
  const client = getDashboardDataModelClient(engine);
  const labelRef = parseOptionsFormulaFieldRef(params.labelFormula, ref.table);
  const sameField =
    labelRef &&
    String(labelRef.field || '').toLowerCase() === String(ref.field || '').toLowerCase() &&
    String(labelRef.table || ref.table).toLowerCase() === String(ref.table || '').toLowerCase();

  if (labelRef && !sameField) {
    try {
      const { rows } = await client.fetchAggregate({
        modelId,
        base_table: ref.table,
        group_by: [ref.field],
        aggregations: [{ fn: 'min', column: labelAggColumn(ref, labelRef), as: 'label' }],
        filters: [],
        limit: 10000,
      });
      const opts = pairsToOptions(rows, ref.field, 'label');
      if (opts.length) return opts;
    } catch (err) {
      console.warn('DataInput select options label field', err);
    }
  }

  const res = await client.fetchColumnDistinct({
    modelId,
    table: ref.table,
    column: ref.field,
    limit: 10000,
    filters: [],
  });
  return distinctValuesToOptions(res?.values);
}
