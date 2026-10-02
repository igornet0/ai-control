/**
 * SQL-агрегация веса сектора круговой: SUM для числовых мер, COUNT для прочих (auto).
 */

/** @typedef {'auto' | 'sum' | 'count'} PieSliceWeightMode */

/**
 * @param {string|undefined} measureType — bindingMeasure.type из модели
 * @param {PieSliceWeightMode|string|undefined} pieSliceWeight — настройка виджета
 * @returns {{ fn: 'sum' | 'count', parse: (raw: unknown) => number }}
 */
export function resolvePieSliceSqlAggregation(measureType, pieSliceWeight) {
  const w =
    pieSliceWeight === 'sum' || pieSliceWeight === 'count' ? pieSliceWeight : 'auto';
  const parseNum = (raw) => {
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : 0;
  };
  if (w === 'count') {
    return { fn: 'count', parse: parseNum };
  }
  if (w === 'sum') {
    return { fn: 'sum', parse: parseNum };
  }
  const t = String(measureType || '').toLowerCase();
  const numeric = new Set([
    'int',
    'integer',
    'number',
    'float',
    'double',
    'decimal',
    'real',
    'money',
    'bigint',
    'numeric',
  ]);
  if (numeric.has(t)) {
    return { fn: 'sum', parse: parseNum };
  }
  return { fn: 'count', parse: parseNum };
}
