import { describe, expect, it } from 'vitest';
import {
  applyChartBindingFormula,
  chartDimMeasBindingsOk,
  chartMeasureAggColumn,
  chartMeasureForMatchesDimension,
  defaultChartBindingFormula,
  resolveChartDimension,
  resolveChartMeasure,
  resolveFieldFromChartFormula,
} from '../src/widgets/common/chartBindingFormula.js';

describe('chartBindingFormula', () => {
  const dim = { modelId: 1, table: 'orders', field: 'status', type: 'text' };
  const meas = { modelId: 1, table: 'orders', field: 'amount', type: 'float' };

  it('defaults formula to [table.field]', () => {
    expect(defaultChartBindingFormula(dim)).toBe('[orders.status]');
  });

  it('parses simple field and SUM measure', () => {
    expect(resolveFieldFromChartFormula('[orders.region]')).toEqual({
      table: 'orders',
      field: 'region',
      aggFn: null,
      ignoreFilters: false,
    });
    expect(resolveFieldFromChartFormula('SUM([orders.amount])')).toMatchObject({
      table: 'orders',
      field: 'amount',
      aggFn: 'sum',
    });
  });

  it('resolveChartDimension rejects aggregates', () => {
    const r = resolveChartDimension({
      ...dim,
      formula: 'SUM([orders.status])',
    });
    expect(r?.sqlOk).toBe(false);
  });

  it('resolveChartMeasure uses SUM fn and weight mode for plain field', () => {
    const sum = resolveChartMeasure({ ...meas, formula: 'SUM([orders.amount])' });
    expect(sum?.sqlOk).toBe(true);
    expect(sum?.aggFn).toBe('sum');
    expect(sum?.field).toBe('amount');

    const plain = resolveChartMeasure({ ...meas, formula: '[orders.amount]' }, { weightMode: 'count' });
    expect(plain?.aggFn).toBe('count');
  });

  it('applyChartBindingFormula syncs field', () => {
    const b = { ...meas };
    applyChartBindingFormula(b, 'AVG([orders.qty])');
    expect(b.field).toBe('qty');
    expect(b.formula).toBe('AVG([orders.qty])');
  });

  it('resolveChartMeasure keeps WHERE localFilters', () => {
    const sum = resolveChartMeasure({
      ...meas,
      formula: 'SUM([orders.amount] WHERE [orders.id] = 23)',
    });
    expect(sum?.sqlOk).toBe(true);
    expect(sum?.aggFn).toBe('sum');
    expect(sum?.field).toBe('amount');
    expect(sum?.localFilters).toEqual([
      { table: 'orders', column: 'id', op: 'eq', value: 23 },
    ]);
  });

  it('resolveChartMeasure keeps IN localWhere', () => {
    const sum = resolveChartMeasure({
      ...meas,
      formula: 'SUM([orders.amount] WHERE [orders.id] IN (1, 23))',
    });
    expect(sum?.sqlOk).toBe(true);
    expect(sum?.localWhere).toMatchObject({
      t: 'pred',
      op: 'in',
      values: expect.arrayContaining([1, 23]),
    });
  });

  it('resolveChartDimension rejects WHERE', () => {
    const r = resolveChartDimension({
      ...dim,
      formula: 'SUM([orders.status] WHERE [orders.id] = 1)',
    });
    expect(r?.sqlOk).toBe(false);
    expect(String(r?.error || '')).toMatch(/WHERE/i);
  });

  it('parseFieldRefWithWhere for line series filter', () => {
    const r = resolveFieldFromChartFormula(
      '[source_data_124.value] WHERE [source_data_124.id] LIKE "*arduino*"',
    );
    expect(r).toMatchObject({
      table: 'source_data_124',
      field: 'value',
      aggFn: null,
      localWhere: { t: 'pred', op: 'like', column: 'id', value: '%arduino%' },
    });
    const meas = resolveChartMeasure(
      {
        modelId: 1,
        table: 'source_data_124',
        field: 'value',
        formula: '[source_data_124.value] WHERE [source_data_124.id] LIKE "*arduino*"',
      },
      { forLine: true },
    );
    expect(meas?.sqlOk).toBe(true);
    expect(meas?.field).toBe('value');
    expect(meas?.aggFn).toBeNull();
    expect(meas?.localWhere).toMatchObject({ op: 'like', value: '%arduino%' });
  });

  it('resolveChartMeasure marks composite formula as scalar-only (not series SQL)', () => {
    const r = resolveChartMeasure(
      {
        ...meas,
        formula: 'SUM([orders.amount]) - SUM([orders.qty])',
      },
      { forLine: true },
    );
    expect(r?.sqlOk).toBe(false);
    expect(r?.scalarFormulaOk).toBe(true);
  });

  it('resolveFieldFromChartFormula unwraps SUM FOR', () => {
    const r = resolveFieldFromChartFormula('SUM([orders.qty]) FOR [orders.region_id]');
    expect(r).toMatchObject({
      table: 'orders',
      field: 'qty',
      aggFn: 'sum',
      groupBy: [{ table: 'orders', column: 'region_id' }],
    });
  });

  it('resolveChartMeasure keeps FOR groupBy for bar/pie', () => {
    const r = resolveChartMeasure({
      ...meas,
      field: 'qty',
      formula: 'SUM([orders.qty]) FOR [orders.region_id]',
    });
    expect(r?.sqlOk).toBe(true);
    expect(r?.aggFn).toBe('sum');
    expect(r?.groupBy).toEqual([{ table: 'orders', column: 'region_id' }]);
  });

  it('resolveChartMeasure rejects FOR on line series', () => {
    const r = resolveChartMeasure(
      {
        ...meas,
        field: 'qty',
        formula: 'SUM([orders.qty]) FOR [orders.region_id]',
      },
      { forLine: true },
    );
    expect(r?.sqlOk).toBe(false);
    expect(String(r?.error || '')).toMatch(/FOR/i);
  });

  it('chartMeasureForMatchesDimension', () => {
    const ok = chartMeasureForMatchesDimension(
      { groupBy: [{ table: 'orders', column: 'status' }] },
      dim,
    );
    expect(ok.ok).toBe(true);
    const bad = chartMeasureForMatchesDimension(
      { groupBy: [{ table: 'orders', column: 'region_id' }] },
      dim,
    );
    expect(bad.ok).toBe(false);
  });

  it('chartDimMeasBindingsOk', () => {
    expect(chartDimMeasBindingsOk(dim, meas)).toBe(true);
    expect(chartDimMeasBindingsOk(dim, { ...meas, modelId: 2 })).toBe(false);
    expect(
      chartDimMeasBindingsOk(
        { modelId: 1, table: 'customers', field: 'name', formula: '[customers.name]' },
        { modelId: 1, table: 'orders', field: 'id', formula: 'COUNT([orders.id])' },
      ),
    ).toBe(true);
  });

  it('chartMeasureAggColumn qualifies foreign table', () => {
    expect(
      chartMeasureAggColumn(
        { table: 'customers' },
        { table: 'orders', field: 'id' },
      ),
    ).toBe('orders.id');
    expect(
      chartMeasureAggColumn(
        { table: 'orders' },
        { table: 'orders', field: 'amount' },
      ),
    ).toBe('amount');
    expect(
      chartMeasureAggColumn(
        { table: 'customers' },
        { table: 'orders', field: '*' },
      ),
    ).toBe('*');
  });
});
