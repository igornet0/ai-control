/**
 * @param {'sum'|'avg'|'count'|'min'|'max'|string} aggregation
 * @param {string} valueField
 * @param {{ countMode?: 'rows'|'non_null'|'distinct'|string }} [options]
 * @returns {string}
 */
export function buildSimpleFormula(aggregation, valueField, options = {}) {
  const fn = String(aggregation || 'sum').toLowerCase();
  const col = String(valueField || '').trim();
  if (fn === 'count') {
    const countMode = String(options.countMode || '').toLowerCase();
    if (countMode === 'distinct' && col) return `COUNT_DISTINCT(${col})`;
    if ((countMode === 'non_null' || !countMode) && col) return `COUNT(${col})`;
    return 'COUNT(*)';
  }
  if (!col) {
    return '';
  }
  return `${fn.toUpperCase()}(${col})`;
}
