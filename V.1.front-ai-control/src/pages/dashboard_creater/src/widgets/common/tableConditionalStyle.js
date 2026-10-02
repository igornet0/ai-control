/**
 * Условное форматирование строк таблицы (сравнение со значением ячейки, без построчных SQL-формул).
 * @typedef {{ field: string, op: string, value: string|number, backgroundColor?: string, color?: string, priority?: number }} TableConditionalRule
 */

/**
 * @param {unknown} raw
 * @returns {TableConditionalRule[]}
 */
export function normalizeTableConditionalRules(raw) {
  const list = Array.isArray(raw) ? raw : [];
  const ops = new Set(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'not_contains']);
  return list
    .map((r, idx) => {
      if (!r || typeof r !== 'object') return null;
      const field = String(r.field || '').trim();
      if (!field) return null;
      const op = ops.has(String(r.op || 'eq').toLowerCase())
        ? String(r.op || 'eq').toLowerCase()
        : 'eq';
      const backgroundColor =
        r.backgroundColor != null && String(r.backgroundColor).trim()
          ? String(r.backgroundColor).trim()
          : '';
      const color = r.color != null && String(r.color).trim() ? String(r.color).trim() : '';
      if (!backgroundColor && !color) return null;
      return {
        field,
        op,
        value: r.value,
        backgroundColor: backgroundColor || undefined,
        color: color || undefined,
        priority: Number.isFinite(Number(r.priority)) ? Number(r.priority) : idx,
      };
    })
    .filter(Boolean)
    .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
}

/**
 * @param {Record<string, unknown>} row
 * @param {TableConditionalRule[]} rules
 * @returns {{ backgroundColor?: string, color?: string }}
 */
export function pickTableRowConditionalStyle(row, rules) {
  const list = normalizeTableConditionalRules(rules);
  /** @type {{ backgroundColor?: string, color?: string }} */
  const acc = {};
  for (const rule of list) {
    if (!rowMatchesRule(row, rule)) continue;
    if (rule.backgroundColor) acc.backgroundColor = rule.backgroundColor;
    if (rule.color) acc.color = rule.color;
  }
  return acc;
}

/**
 * @param {Record<string, unknown>} row
 * @param {TableConditionalRule} rule
 */
function rowMatchesRule(row, rule) {
  const raw = row[rule.field];
  const cell = raw != null ? raw : '';
  const cmp = rule.value;
  const a = normalizeScalar(cell);
  const b = normalizeScalar(cmp);

  switch (rule.op) {
    case 'eq':
      return a === b || String(cell) === String(cmp);
    case 'neq':
      return !(a === b || String(cell) === String(cmp));
    case 'gt':
      return Number.isFinite(Number(a)) && Number.isFinite(Number(b)) && Number(a) > Number(b);
    case 'gte':
      return Number.isFinite(Number(a)) && Number.isFinite(Number(b)) && Number(a) >= Number(b);
    case 'lt':
      return Number.isFinite(Number(a)) && Number.isFinite(Number(b)) && Number(a) < Number(b);
    case 'lte':
      return Number.isFinite(Number(a)) && Number.isFinite(Number(b)) && Number(a) <= Number(b);
    case 'contains':
      return String(cell).toLowerCase().includes(String(cmp ?? '').toLowerCase());
    case 'not_contains':
      return !String(cell).toLowerCase().includes(String(cmp ?? '').toLowerCase());
    default:
      return false;
  }
}

function normalizeScalar(v) {
  const n = Number(v);
  if (Number.isFinite(n) && String(v).trim() !== '') return n;
  return v;
}
