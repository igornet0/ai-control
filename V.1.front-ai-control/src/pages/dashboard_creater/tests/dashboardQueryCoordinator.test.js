import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as queryService from '../../../services/dashboardQueryService.js';
import {
  bumpDashboardQueryCoordinator,
  runDashboardModelQuery,
  runDashboardModelQueryBatch,
} from '../../../services/dashboardQueryCoordinator.js';

describe('dashboardQueryCoordinator batch data exchange', () => {
  beforeEach(() => {
    bumpDashboardQueryCoordinator();
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('stores batch results into cache for subsequent single queries', async () => {
    const body1 = { mode: 'aggregate', base_table: 'orders', aggregations: [{ fn: 'sum', column: 'amount', as: 's' }] };
    const body2 = { mode: 'aggregate', base_table: 'orders', aggregations: [{ fn: 'count', column: '*', as: 'c' }] };

    const batchSpy = vi
      .spyOn(queryService, 'postModelSqliteQueryBatch')
      .mockResolvedValue({
        results: [
          { rows: [{ s: 45.5 }], sql: 'SELECT SUM(amount) AS s FROM orders' },
          { rows: [{ c: 3 }], sql: 'SELECT COUNT(*) AS c FROM orders' },
        ],
      });
    const singleSpy = vi
      .spyOn(queryService, 'postModelSqliteQuery')
      .mockRejectedValue(new Error('single endpoint should not be called after cache warmup'));

    const batch = await runDashboardModelQueryBatch(null, 11, [body1, body2]);
    expect(batch.results).toHaveLength(2);
    expect(batch.results[0].rows[0].s).toBe(45.5);
    expect(batchSpy).toHaveBeenCalledTimes(1);

    const cached1 = await runDashboardModelQuery(null, 11, body1);
    const cached2 = await runDashboardModelQuery(null, 11, body2);
    expect(cached1.rows[0].s).toBe(45.5);
    expect(cached2.rows[0].c).toBe(3);
    expect(singleSpy).toHaveBeenCalledTimes(0);
  });

  it('returns empty results for empty batch and does not call API', async () => {
    const batchSpy = vi.spyOn(queryService, 'postModelSqliteQueryBatch');
    const out = await runDashboardModelQueryBatch(null, 42, []);
    expect(out).toEqual({ results: [] });
    expect(batchSpy).toHaveBeenCalledTimes(0);
  });

  it('rejects with AbortError when engine signal is aborted before fetch', async () => {
    const ac = new AbortController();
    ac.abort();
    const engine = { requestSignal: ac.signal };
    const spy = vi.spyOn(queryService, 'postModelSqliteQuery');
    const body = { mode: 'select', base_table: 'orders', columns: ['id'], limit: 5 };
    await expect(runDashboardModelQuery(engine, 9, body)).rejects.toMatchObject({ name: 'AbortError' });
    expect(spy).not.toHaveBeenCalled();
  });

  it('batch rejects with AbortError when engine signal is aborted', async () => {
    const ac = new AbortController();
    ac.abort();
    const engine = { requestSignal: ac.signal };
    const spy = vi.spyOn(queryService, 'postModelSqliteQueryBatch');
    const body = { mode: 'select', base_table: 'orders', columns: ['id'], limit: 5 };
    await expect(runDashboardModelQueryBatch(engine, 9, [body])).rejects.toMatchObject({ name: 'AbortError' });
    expect(spy).not.toHaveBeenCalled();
  });
});

