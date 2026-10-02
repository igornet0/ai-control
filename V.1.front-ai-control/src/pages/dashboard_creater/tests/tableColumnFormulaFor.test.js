import { describe, expect, it } from 'vitest';
import {
  resolveTableQueryPlan,
  fetchTableGroupedRows,
} from '../src/widgets/common/tableColumnFormula.js';

describe('resolveTableQueryPlan FOR', () => {
  const ds = { modelId: 1, table: 'orders' };

  it('stays on select without FOR', () => {
    const plan = resolveTableQueryPlan(
      [{ table: 'orders', field: 'qty', formula: '[orders.qty]' }],
      ds,
    );
    expect(plan.mode).toBe('select');
  });

  it('switches to aggregate and prepends missing group key', () => {
    const plan = resolveTableQueryPlan(
      [{ table: 'orders', field: 'qty', formula: 'SUM([orders.qty]) FOR [orders.region_id]' }],
      ds,
    );
    expect(plan.mode).toBe('aggregate');
    expect(plan.error).toBeUndefined();
    expect(plan.groupBy).toEqual([{ table: 'orders', column: 'region_id' }]);
    expect(plan.extraDims).toEqual([
      { table: 'orders', column: 'region_id', key: 'region_id' },
    ]);
  });

  it('does not duplicate group key already in columns', () => {
    const plan = resolveTableQueryPlan(
      [
        { table: 'orders', field: 'region_id', formula: '[orders.region_id]' },
        { table: 'orders', field: 'qty', formula: 'SUM([orders.qty]) FOR [orders.region_id]' },
      ],
      ds,
    );
    expect(plan.mode).toBe('aggregate');
    expect(plan.extraDims).toEqual([]);
  });

  it('rejects mixed FOR keys', () => {
    const plan = resolveTableQueryPlan(
      [
        { table: 'orders', field: 'qty', formula: 'SUM([orders.qty]) FOR [orders.region_id]' },
        { table: 'orders', field: 'amount', formula: 'SUM([orders.amount]) FOR [orders.status]' },
      ],
      ds,
    );
    expect(plan.mode).toBe('aggregate');
    expect(String(plan.error || '')).toMatch(/разные поля FOR/i);
  });

  it('rejects row-level field not in FOR', () => {
    const plan = resolveTableQueryPlan(
      [
        { table: 'orders', field: 'status', formula: '[orders.status]' },
        { table: 'orders', field: 'qty', formula: 'SUM([orders.qty]) FOR [orders.region_id]' },
      ],
      ds,
    );
    expect(String(plan.error || '')).toMatch(/не входит в группировку/i);
  });
});

describe('fetchTableGroupedRows', () => {
  it('evaluates measure per group row', async () => {
    const ds = { modelId: 1, table: 'orders' };
    const bf = [
      { table: 'orders', field: 'qty', formula: 'SUM([orders.qty]) FOR [orders.region_id]' },
    ];
    const plan = resolveTableQueryPlan(bf, ds);
    const client = {
      fetchAggregate: async () => ({
        rows: [
          { region_id: 'EU', t_0: 10 },
          { region_id: 'US', t_0: 25 },
        ],
      }),
    };
    const rows = await fetchTableGroupedRows(client, ds, plan, bf, ['qty'], [], 500);
    expect(rows).toEqual([
      { region_id: 'EU', qty: 10 },
      { region_id: 'US', qty: 25 },
    ]);
  });
});
