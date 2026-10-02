function stableSortObjectKeys(value) {
  if (Array.isArray(value)) return value.map(stableSortObjectKeys);
  if (!value || typeof value !== 'object') return value;
  const out = {};
  Object.keys(value)
    .sort()
    .forEach((k) => {
      out[k] = stableSortObjectKeys(value[k]);
    });
  return out;
}

/**
 * Normalize filter payload values for deterministic hashing (null-state, primitives, nested objects).
 * @param {unknown} v
 */
export function normalizeFilterScalar(v) {
  if (v === undefined || v === null) return null;
  if (typeof v === 'boolean' || typeof v === 'number') {
    return Number.isFinite(v) || typeof v === 'boolean' ? v : null;
  }
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return stableSortObjectKeys(v);
  if (typeof v === 'object') return stableSortObjectKeys(v);
  return String(v);
}

/** @param {unknown} a @param {unknown} b */
function compareCanonicalJsonStable(a, b) {
  return JSON.stringify(a).localeCompare(JSON.stringify(b));
}

export function canonicalizeFilters(filters) {
  const list = Array.isArray(filters) ? filters : [];
  return list
    .map((f) => {
      const row = {
        table: String(f?.table || ''),
        column: String(f?.column || ''),
        op: String(f?.op || '').toLowerCase(),
      };
      if (Array.isArray(f?.values)) {
        row.values = [...f.values].map(normalizeFilterScalar).sort(compareCanonicalJsonStable);
      } else {
        row.value = normalizeFilterScalar(f?.value);
      }
      return row;
    })
    .sort((a, b) => {
      const ka = `${a.table}\0${a.column}\0${a.op}\0${JSON.stringify(a.values ?? a.value ?? null)}`;
      const kb = `${b.table}\0${b.column}\0${b.op}\0${JSON.stringify(b.values ?? b.value ?? null)}`;
      return ka.localeCompare(kb);
    });
}

export function intentKey(intent) {
  return JSON.stringify(stableSortObjectKeys(intent));
}

