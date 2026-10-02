import { describe, it, expect, vi } from 'vitest';
import { AggregationBatcher } from '../../../services/dashboardDataModel/aggregationBatcher.js';

describe('AggregationBatcher', () => {
  it('batches aggregate requests with same signature', async () => {
    const runAggregate = vi.fn(async ({ body }) => {
      const row = {};
      (body.aggregations || []).forEach((a, i) => {
        row[a.as] = i + 1;
      });
      return { rows: [row] };
    });
    const batcher = new AggregationBatcher({ runAggregate });

    const p1 = batcher.enqueue({
      modelId: 1,
      base_table: 'orders',
      group_by: [],
      filters: [],
      limit: 1,
      aggregations: [{ fn: 'sum', column: 'amount', as: 'a' }],
    });
    const p2 = batcher.enqueue({
      modelId: 1,
      base_table: 'orders',
      group_by: [],
      filters: [],
      limit: 1,
      aggregations: [{ fn: 'count', column: '*', as: 'b' }],
    });

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(runAggregate).toHaveBeenCalledTimes(1);
    expect(r1.rows[0].a).toBe(1);
    expect(r2.rows[0].b).toBe(2);
  });

  it('does not batch different group_by signatures', async () => {
    const runAggregate = vi.fn(async () => ({ rows: [{}] }));
    const batcher = new AggregationBatcher({ runAggregate });
    await Promise.all([
      batcher.enqueue({
        modelId: 1,
        base_table: 'orders',
        group_by: ['status'],
        filters: [],
        limit: 100,
        aggregations: [{ fn: 'count', column: '*', as: 'c1' }],
      }),
      batcher.enqueue({
        modelId: 1,
        base_table: 'orders',
        group_by: [],
        filters: [],
        limit: 1,
        aggregations: [{ fn: 'count', column: '*', as: 'c2' }],
      }),
    ]);
    expect(runAggregate).toHaveBeenCalledTimes(2);
  });

  it('uses runAggregateBatch for multiple merged groups same modelId', async () => {
    const runAggregate = vi.fn();
    const runAggregateBatch = vi.fn(async ({ bodies }) => ({
      results: bodies.map((body, ix) => {
        const row = {};
        (body.aggregations || []).forEach((a, i) => {
          row[a.as] = 10 * ix + i;
        });
        return { rows: [row] };
      }),
    }));
    const batcher = new AggregationBatcher({ runAggregate, runAggregateBatch });

    const p1 = batcher.enqueue({
      modelId: 5,
      base_table: 'orders',
      group_by: ['region'],
      filters: [],
      limit: 100,
      aggregations: [{ fn: 'count', column: '*', as: 'c1' }],
    });
    const p2 = batcher.enqueue({
      modelId: 5,
      base_table: 'orders',
      group_by: [],
      filters: [],
      limit: 1,
      aggregations: [{ fn: 'sum', column: 'amount', as: 'tot' }],
    });

    await Promise.all([p1, p2]);
    expect(runAggregate).not.toHaveBeenCalled();
    expect(runAggregateBatch).toHaveBeenCalledTimes(1);
    expect(runAggregateBatch.mock.calls[0][0].bodies.length).toBe(2);
  });
});
