/**
 * Schema helpers for Aggregate processing-block widget.
 */

export const AGGREGATE_FUNCTIONS = [
  { value: 'count', label: 'Количество (COUNT)' },
  { value: 'count_distinct', label: 'Уникальные (COUNT DISTINCT)' },
  { value: 'sum', label: 'Сумма (SUM)' },
  { value: 'avg', label: 'Среднее (AVG)' },
  { value: 'min', label: 'Минимум (MIN)' },
  { value: 'max', label: 'Максимум (MAX)' },
  { value: 'first', label: 'Первое значение (FIRST)' },
  { value: 'last', label: 'Последнее значение (LAST)' },
  { value: 'median', label: 'Медиана (MEDIAN)' },
  { value: 'mode', label: 'Мода (MODE)' },
  { value: 'stddev', label: 'Стандартное отклонение (STDDEV)' },
  { value: 'variance', label: 'Дисперсия (VARIANCE)' },
  { value: 'percentile', label: 'Перцентиль (PERCENTILE)' },
  { value: 'list', label: 'Список (LIST)' },
  { value: 'any', label: 'Любое значение (ANY)' },
];

export function createDefaultAggregateMetric(availableFields = []) {
  const firstField = availableFields[0] || '';
  return {
    id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    enabled: true,
    field: firstField,
    func: 'sum',
    alias: firstField ? `sum_${firstField}` : 'metric_1',
    resultType: 'float',
    percentile: 90,
  };
}

export function createDefaultGroupByField(availableFields = []) {
  return {
    id: `g_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    field: availableFields[0] || '',
  };
}

export function normalizeAggregateSettings(settings = {}, availableFields = []) {
  return {
    aggregateGroupBy: settings.aggregateGroupBy || [createDefaultGroupByField(availableFields)],
    aggregateMetrics: settings.aggregateMetrics || [createDefaultAggregateMetric(availableFields)],
  };
}

function defaultMetricAlias(metric = {}) {
  const func = String(metric.func || 'sum').trim().toLowerCase() || 'sum';
  const field = String(metric.field || '').trim();
  if (func === 'count' && !field) return 'count';
  const fieldPart = field
    ? `_${field.replace(/[^a-zA-Z0-9_]+/g, '_').replace(/^_+|_+$/g, '') || 'field'}`
    : '';
  return `${func}${fieldPart}`;
}

/**
 * Output columns of an aggregate block: group-by fields + metric aliases.
 * Do not use settings.availableFields here — those are input columns.
 */
export function getAggregateOutputFields(settings = {}) {
  const groupBy = (settings.aggregateGroupBy || [])
    .map((g) => String(g?.field || '').trim())
    .filter(Boolean);

  const metrics = (settings.aggregateMetrics || [])
    .filter((m) => m && m.enabled !== false)
    .map((m) => {
      const alias = String(m.alias || '').trim();
      if (alias) return alias;
      return defaultMetricAlias(m);
    })
    .filter(Boolean);

  const out = [];
  const seen = new Set();
  for (const name of [...groupBy, ...metrics]) {
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}
