/**
 * Локальный WHERE внутри агрегатов формул.
 * AST: pred | and | or → API leaf filters или group { op:'and'|'or', filters:[] }.
 */

/**
 * @typedef {{ table: string, column: string, op: string, value?: string|number, values?: Array<string|number> }} SqlLocalFilter
 * @typedef {{ t: 'pred', table: string, column: string, op: string, value?: string|number, values?: Array<string|number> }} WherePred
 * @typedef {{ t: 'and'|'or', items: WhereNode[] }} WhereBool
 * @typedef {WherePred | WhereBool} WhereNode
 */

/**
 * @param {unknown} raw
 * @returns {string|number}
 */
function normalizeLit(raw) {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  return String(raw ?? '');
}

/**
 * @param {unknown} values
 * @returns {Array<string|number>}
 */
function cloneValues(values) {
  if (!Array.isArray(values) || !values.length) return [];
  return values.map((v) => normalizeLit(v));
}

/**
 * @param {unknown} f
 * @returns {SqlLocalFilter|null}
 */
function cloneLeafFilter(f) {
  if (!f || typeof f !== 'object') return null;
  const table = String(/** @type {any} */ (f).table ?? '').trim();
  const column = String(/** @type {any} */ (f).column ?? '').trim();
  const op = String(/** @type {any} */ (f).op ?? '').trim().toLowerCase();
  if (!table || !column || !op) return null;
  /** @type {SqlLocalFilter} */
  const out = { table, column, op };
  if (op === 'in' || op === 'not_in') {
    const vals = cloneValues(/** @type {any} */ (f).values);
    if (!vals.length && Array.isArray(/** @type {any} */ (f).value)) {
      vals.push(...cloneValues(/** @type {any} */ (f).value));
    }
    if (!vals.length) return null;
    out.values = vals;
  } else {
    out.value = normalizeLit(/** @type {any} */ (f).value);
  }
  return out;
}

/**
 * @param {unknown} filters
 * @returns {SqlLocalFilter[]}
 */
export function cloneLocalFilters(filters) {
  if (!Array.isArray(filters) || !filters.length) return [];
  /** @type {SqlLocalFilter[]} */
  const out = [];
  for (const f of filters) {
    const leaf = cloneLeafFilter(f);
    if (leaf) out.push(leaf);
  }
  return out;
}

/**
 * @param {SqlLocalFilter} a
 * @param {SqlLocalFilter} b
 */
function compareLeaves(a, b) {
  const va = a.values ? JSON.stringify([...a.values].sort((x, y) => String(x).localeCompare(String(y)))) : String(a.value);
  const vb = b.values ? JSON.stringify([...b.values].sort((x, y) => String(x).localeCompare(String(y)))) : String(b.value);
  const ka = `${a.table}\0${a.column}\0${a.op}\0${va}`;
  const kb = `${b.table}\0${b.column}\0${b.op}\0${vb}`;
  return ka < kb ? -1 : ka > kb ? 1 : 0;
}

/**
 * @param {unknown} filters
 * @returns {SqlLocalFilter[]}
 */
export function canonicalizeLocalFilters(filters) {
  const cloned = cloneLocalFilters(filters).map((f) => {
    if (f.values) {
      return {
        ...f,
        values: [...f.values].sort((a, b) => String(a).localeCompare(String(b))),
      };
    }
    return f;
  });
  cloned.sort(compareLeaves);
  return cloned;
}

/**
 * @param {unknown} filters
 * @returns {string}
 */
export function localFiltersHash(filters) {
  const can = canonicalizeLocalFilters(filters);
  if (!can.length) return '';
  return JSON.stringify(can);
}

/**
 * @param {unknown} filters
 * @returns {boolean}
 */
export function hasLocalFilters(filters) {
  return canonicalizeLocalFilters(filters).length > 0;
}

/**
 * @param {unknown} node
 * @returns {WhereNode|null}
 */
export function cloneWhere(node) {
  if (!node || typeof node !== 'object') return null;
  const t = /** @type {any} */ (node).t;
  if (t === 'pred') {
    const leaf = cloneLeafFilter(node);
    if (!leaf) return null;
    return { t: 'pred', ...leaf };
  }
  if (t === 'and' || t === 'or') {
    const items = Array.isArray(/** @type {any} */ (node).items)
      ? /** @type {any} */ (node).items.map(cloneWhere).filter(Boolean)
      : [];
    if (!items.length) return null;
    if (items.length === 1) return /** @type {WhereNode} */ (items[0]);
    return { t, items: /** @type {WhereNode[]} */ (items) };
  }
  // legacy flat filter object without t
  const leaf = cloneLeafFilter(node);
  if (leaf) return { t: 'pred', ...leaf };
  return null;
}

/**
 * @param {WhereNode} a
 * @param {WhereNode} b
 */
function whereSortKey(a, b) {
  return whereHash(a).localeCompare(whereHash(b));
}

/**
 * @param {unknown} node
 * @returns {WhereNode|null}
 */
export function canonicalizeWhere(node) {
  const n = cloneWhere(node);
  if (!n) return null;
  if (n.t === 'pred') {
    if (n.values) {
      n.values = [...n.values].sort((a, b) => String(a).localeCompare(String(b)));
    }
    return n;
  }
  const items = n.items.map((it) => canonicalizeWhere(it)).filter(Boolean);
  if (!items.length) return null;
  if (items.length === 1) return /** @type {WhereNode} */ (items[0]);
  // flatten nested same-op
  /** @type {WhereNode[]} */
  const flat = [];
  for (const it of /** @type {WhereNode[]} */ (items)) {
    if (it.t === n.t) flat.push(...it.items);
    else flat.push(it);
  }
  flat.sort(whereSortKey);
  return { t: n.t, items: flat };
}

/**
 * @param {unknown} node
 * @returns {string}
 */
export function whereHash(node) {
  const can = canonicalizeWhere(node);
  if (!can) return '';
  return JSON.stringify(can);
}

/**
 * @param {unknown} node
 * @returns {boolean}
 */
export function hasLocalWhere(node) {
  return !!canonicalizeWhere(node);
}

/**
 * Если WHERE — чистый AND из листьев (или один pred), вернуть плоский список.
 * @param {unknown} node
 * @returns {SqlLocalFilter[]|null}
 */
export function flattenAndLeaves(node) {
  const can = canonicalizeWhere(node);
  if (!can) return null;
  if (can.t === 'pred') {
    const { t: _t, ...rest } = can;
    return [rest];
  }
  if (can.t === 'and' && can.items.every((it) => it.t === 'pred')) {
    return can.items.map((it) => {
      const { t: _t, ...rest } = /** @type {WherePred} */ (it);
      return rest;
    });
  }
  return null;
}

/**
 * AND-список листьев → AST.
 * @param {unknown} filters
 * @returns {WhereNode|null}
 */
export function whereFromLocalFilters(filters) {
  const leaves = canonicalizeLocalFilters(filters);
  if (!leaves.length) return null;
  if (leaves.length === 1) return { t: 'pred', ...leaves[0] };
  return { t: 'and', items: leaves.map((f) => ({ t: 'pred', ...f })) };
}

/**
 * Нормализовать LIKE-паттерн: * → %.
 * @param {string} pattern
 */
export function normalizeLikePattern(pattern) {
  return String(pattern ?? '').replace(/\*/g, '%');
}

/**
 * AST → элементы API filters (листья и/или group-ноды).
 * Чистый AND из листьев разворачивается в плоский список; иначе одна group-нода.
 * @param {unknown} node
 * @returns {object[]}
 */
export function whereNodeToApiFilters(node) {
  const can = canonicalizeWhere(node);
  if (!can) return [];
  const flat = flattenAndLeaves(can);
  if (flat) {
    return flat.map((f) => {
      if (f.values) return { table: f.table, column: f.column, op: f.op, values: [...f.values] };
      return { table: f.table, column: f.column, op: f.op, value: f.value };
    });
  }
  return [whereNodeToApiGroup(can)];
}

/**
 * @param {WhereNode} node
 * @returns {object}
 */
function whereNodeToApiGroup(node) {
  if (node.t === 'pred') {
    if (node.values) {
      return { table: node.table, column: node.column, op: node.op, values: [...node.values] };
    }
    return { table: node.table, column: node.column, op: node.op, value: node.value };
  }
  return {
    op: node.t,
    filters: node.items.map((it) => whereNodeToApiGroup(it)),
  };
}

/**
 * Hash для сигнатуры fetch: localWhere предпочтительнее legacy localFilters.
 * @param {{ localWhere?: unknown, localFilters?: unknown }} agg
 */
export function aggWhereHash(agg) {
  if (agg?.localWhere) {
    const h = whereHash(agg.localWhere);
    if (h) return h;
  }
  return localFiltersHash(agg?.localFilters);
}
