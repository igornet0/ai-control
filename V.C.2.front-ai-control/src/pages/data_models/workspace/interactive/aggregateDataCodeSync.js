/**
 * DataCode generation for aggregate processing-block widgets.
 *
 * DataCode API (see external/DataCode docs tables.md):
 *   table.aggregate({ alias: "count", total: { op: "sum", column: "Amount" } })
 *   table.aggregate_group({ group: "City" | ["A", "B"], ...same metrics })
 */

import { sanitizeIdentifier } from './schema.js';

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

function normalizeFunc(func) {
  return String(func || 'sum').trim().toLowerCase();
}

function defaultAlias(metric = {}) {
  const fieldPart = metric.field ? `_${sanitizeIdentifier(metric.field, 'field')}` : '';
  return `${normalizeFunc(metric.func)}${fieldPart}`;
}

/** Percentile UI stores 0–100; DataCode `p` expects 0–1. */
export function normalizePercentileP(raw) {
  const n = Number(raw ?? 90);
  if (!Number.isFinite(n)) return 0.9;
  if (n > 1) return Math.min(Math.max(n / 100, 0), 1);
  return Math.min(Math.max(n, 0), 1);
}

/**
 * Build one metric entry for aggregate / aggregate_group spec object.
 * Returns e.g. `order_count: "count"` or `total_amount: { op: "sum", column: "amount" }`.
 */
export function buildAggregateMetricExpression(metric = {}) {
  if (metric.enabled === false) return null;
  const func = normalizeFunc(metric.func);
  const alias = sanitizeIdentifier(metric.alias?.trim() || defaultAlias(metric), 'metric');

  if (func === 'count') {
    return `${alias}: "count"`;
  }

  if (!metric.field?.trim()) return null;
  const column = quoteField(metric.field.trim());

  if (func === 'percentile') {
    const p = normalizePercentileP(metric.percentile);
    return `${alias}: { op: "percentile", column: ${column}, p: ${p} }`;
  }

  return `${alias}: { op: "${escapeString(func)}", column: ${column} }`;
}

export function buildAggregateGroupByFields(settings = {}) {
  return (settings.aggregateGroupBy || [])
    .map((g) => g?.field?.trim())
    .filter(Boolean);
}

export function buildAggregateMetricExpressions(settings = {}) {
  return (settings.aggregateMetrics || [])
    .map(buildAggregateMetricExpression)
    .filter(Boolean);
}

/** `group: "City"` or `group: ["Department", "City"]` */
export function buildAggregateGroupSpecLiteral(groupByFields = []) {
  if (!groupByFields.length) return null;
  if (groupByFields.length === 1) {
    return `group: ${quoteField(groupByFields[0])}`;
  }
  return `group: [${groupByFields.map(quoteField).join(', ')}]`;
}

export function buildDefaultSeparateAggregateVariableName(inputVariable = 'data', widgetId = null) {
  const base = sanitizeIdentifier(inputVariable, 'data');
  if (widgetId == null || widgetId === '') {
    return sanitizeIdentifier(`${base}_agg`, 'aggregated_data');
  }
  return sanitizeIdentifier(`${base}_agg_${widgetId}`, `${base}_agg`);
}

export function isAggregateSeparateOutput(settings = {}) {
  if (settings.aggregateSeparateOutput === true) return true;
  if (settings.aggregateSeparateOutput === false) return false;
  return !!settings.dataCodeVariableName?.trim();
}

export function resolveAggregateOutputVariableName(settings = {}, inputVariable = 'data', context = {}) {
  const inputVar = sanitizeIdentifier(inputVariable, 'data');
  if (!isAggregateSeparateOutput(settings)) return inputVar;
  const custom = settings.dataCodeVariableName?.trim();
  if (custom) {
    return sanitizeIdentifier(
      custom,
      buildDefaultSeparateAggregateVariableName(inputVar, context.widgetId),
    );
  }
  return buildDefaultSeparateAggregateVariableName(inputVar, context.widgetId);
}

/**
 * Generate DataCode for aggregate block.
 * - with groupBy → `.aggregate_group({ group: ..., metrics... })`
 * - without groupBy → `.aggregate({ metrics... })`
 */
export function generateAggregateDataCode(aggregateSettings = {}, context = {}) {
  const inputVar = sanitizeIdentifier(context.inputVariable || 'data', 'data');
  const outputVar = resolveAggregateOutputVariableName(aggregateSettings, inputVar, context);
  const globalPrefix = aggregateSettings.exportGlobal && isAggregateSeparateOutput(aggregateSettings)
    ? 'global '
    : '';
  const groupBy = buildAggregateGroupByFields(aggregateSettings);
  const metrics = buildAggregateMetricExpressions(aggregateSettings);
  const aggregateName = aggregateSettings.name || 'Агрегация';

  const lines = [
    `# Aggregate: ${aggregateName}`,
    `# Input table: ${inputVar}`,
  ];

  if (!metrics.length) {
    lines.push('# No aggregate metrics — pass-through');
    lines.push(`${globalPrefix}${outputVar} = ${inputVar}`);
    lines.push(`print("${outputVar}: ", table_info(${outputVar}))`);
    return lines.join('\n');
  }

  const method = groupBy.length ? 'aggregate_group' : 'aggregate';
  const groupLiteral = buildAggregateGroupSpecLiteral(groupBy);

  lines.push(`${globalPrefix}${outputVar} = ${inputVar}.${method}({`);
  if (groupLiteral) {
    lines.push(`  ${groupLiteral},`);
  }
  metrics.forEach((entry, idx) => {
    const suffix = idx === metrics.length - 1 ? '' : ',';
    lines.push(`  ${entry}${suffix}`);
  });
  lines.push('})');
  lines.push(`print("${outputVar}: ", table_info(${outputVar}))`);

  return lines.join('\n');
}

const AGGREGATE_BLOCK_RE = /# Aggregate:[^\n]*\r?\n[\s\S]*?print\s*\([^)]*table_info\s*\([\p{L}_][\p{L}\p{N}_]*\)\s*\)/gmu;

export function stripAggregateBlocks(code) {
  if (!code?.trim()) return '';
  return String(code)
    .replace(AGGREGATE_BLOCK_RE, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function patchAggregateDataCodeInCode(code, aggregateSettings, context = {}) {
  const generated = generateAggregateDataCode(aggregateSettings, context);
  const outputVariable = resolveAggregateOutputVariableName(
    aggregateSettings,
    context.inputVariable,
    context,
  );
  const cleaned = stripAggregateBlocks(code);
  if (!cleaned) {
    return { code: generated, outputVariable };
  }
  return {
    code: `${cleaned}\n\n${generated}`.trim(),
    outputVariable,
  };
}
