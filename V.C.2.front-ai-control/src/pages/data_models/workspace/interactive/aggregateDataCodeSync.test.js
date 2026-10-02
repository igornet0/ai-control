import { describe, it, expect } from 'vitest';
import {
  buildAggregateMetricExpression,
  buildAggregateGroupByFields,
  buildAggregateMetricExpressions,
  buildAggregateGroupSpecLiteral,
  generateAggregateDataCode,
  normalizePercentileP,
  patchAggregateDataCodeInCode,
  resolveAggregateOutputVariableName,
  stripAggregateBlocks,
} from './aggregateDataCodeSync.js';

describe('aggregateDataCodeSync', () => {
  it('builds metric entry with alias and op/column', () => {
    const metric = buildAggregateMetricExpression({
      field: 'Sales',
      func: 'sum',
      alias: 'Total Sales',
    });
    expect(metric).toBe('Total_Sales: { op: "sum", column: "Sales" }');
  });

  it('builds count metric as string "count"', () => {
    const metric = buildAggregateMetricExpression({
      func: 'count',
      alias: 'Orders',
    });
    expect(metric).toBe('Orders: "count"');
  });

  it('builds percentile metric with p in 0..1', () => {
    const metric = buildAggregateMetricExpression({
      field: 'Price',
      func: 'percentile',
      percentile: 90,
      alias: 'P90',
    });
    expect(metric).toBe('P90: { op: "percentile", column: "Price", p: 0.9 }');
    expect(normalizePercentileP(0.95)).toBe(0.95);
  });

  it('builds group literal for one and many columns', () => {
    expect(buildAggregateGroupSpecLiteral(['City'])).toBe('group: "City"');
    expect(buildAggregateGroupSpecLiteral(['Department', 'City'])).toBe(
      'group: ["Department", "City"]',
    );
  });

  it('generates aggregate_group when groupBy is set', () => {
    const code = generateAggregateDataCode(
      {
        aggregateGroupBy: [{ field: 'Country' }],
        aggregateMetrics: [
          { field: 'Sales', func: 'sum', alias: 'Total Sales' },
          { func: 'count', alias: 'Orders' },
        ],
      },
      { inputVariable: 'sales_table' },
    );
    expect(code).toContain('sales_table = sales_table.aggregate_group({');
    expect(code).toContain('group: "Country"');
    expect(code).toContain('Total_Sales: { op: "sum", column: "Sales" }');
    expect(code).toContain('Orders: "count"');
    expect(code).not.toContain('group_by');
  });

  it('generates aggregate without groupBy', () => {
    const code = generateAggregateDataCode(
      {
        aggregateGroupBy: [],
        aggregateMetrics: [
          { field: 'id', func: 'min', alias: 'sum_id' },
          { func: 'count', alias: 'order_count' },
        ],
      },
      { inputVariable: 'Customers' },
    );
    expect(code).toContain('Customers = Customers.aggregate({');
    expect(code).not.toContain('aggregate_group');
    expect(code).not.toContain('group:');
    expect(code).toContain('sum_id: { op: "min", column: "id" }');
    expect(code).toContain('order_count: "count"');
  });

  it('generates multi-column group as array', () => {
    const code = generateAggregateDataCode(
      {
        aggregateGroupBy: [{ field: 'id' }, { field: 'city' }],
        aggregateMetrics: [{ field: 'id', func: 'min', alias: 'sum_id' }],
      },
      { inputVariable: 'Customers' },
    );
    expect(code).toContain('Customers = Customers.aggregate_group({');
    expect(code).toContain('group: ["id", "city"]');
  });

  it('generates separate output with global export', () => {
    const code = generateAggregateDataCode(
      {
        aggregateSeparateOutput: true,
        exportGlobal: true,
        aggregateGroupBy: [{ field: 'Country' }],
        aggregateMetrics: [{ field: 'Sales', func: 'sum', alias: 'Total Sales' }],
      },
      { inputVariable: 'sample_table', widgetId: 91 },
    );
    expect(code).toContain('global sample_table_agg_91 = sample_table.aggregate_group({');
    expect(code).toContain('print("sample_table_agg_91: ", table_info(sample_table_agg_91))');
  });

  it('resolves output variable names', () => {
    expect(resolveAggregateOutputVariableName({}, 'sample_table')).toBe('sample_table');
    expect(resolveAggregateOutputVariableName(
      { aggregateSeparateOutput: true },
      'sample_table',
      { widgetId: 2 },
    )).toBe('sample_table_agg_2');
  });

  it('deduplicates aggregate blocks on patch', () => {
    const block = generateAggregateDataCode(
      {
        aggregateGroupBy: [{ field: 'Country' }],
        aggregateMetrics: [{ field: 'Sales', func: 'sum', alias: 'Total Sales' }],
      },
      { inputVariable: 'sample_table' },
    );
    const duplicated = `${block}\n\n${block}`;
    const { code } = patchAggregateDataCodeInCode(
      duplicated,
      {
        aggregateGroupBy: [{ field: 'Country' }],
        aggregateMetrics: [{ field: 'Sales', func: 'sum', alias: 'Total Sales' }],
      },
      { inputVariable: 'sample_table' },
    );
    expect((code.match(/# Aggregate:/g) || []).length).toBe(1);
    expect(stripAggregateBlocks(duplicated)).toBe('');
  });

  it('collects group by and metrics arrays', () => {
    const settings = {
      aggregateGroupBy: [{ field: 'Country' }, { field: '' }, { field: 'Product' }],
      aggregateMetrics: [
        { field: 'Sales', func: 'sum', alias: 'Total' },
        { enabled: false, field: 'Price', func: 'avg', alias: 'Skip' },
      ],
    };
    expect(buildAggregateGroupByFields(settings)).toEqual(['Country', 'Product']);
    expect(buildAggregateMetricExpressions(settings)).toEqual([
      'Total: { op: "sum", column: "Sales" }',
    ]);
  });
});
