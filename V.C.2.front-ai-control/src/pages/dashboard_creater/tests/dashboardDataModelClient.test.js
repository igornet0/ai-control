import { afterEach, describe, expect, it, vi } from 'vitest';
import { DashboardDataModelClient } from '../../../services/dashboardDataModel/DashboardDataModelClient.js';

function makeEngine() {
  let onNotify = null;
  return {
    widgetManager: {},
    __dashboardFilterSnapshot: { changedModelIds: [] },
    filterStore: {
      subscribe(fn) {
        onNotify = fn;
        return () => {
          onNotify = null;
        };
      },
      emit() {
        if (onNotify) onNotify([], {});
      },
      notify(options = {}) {
        if (onNotify) onNotify([], options);
      },
    },
    __emitFilterNotify() {
      this.filterStore.emit();
    },
  };
}

describe('DashboardDataModelClient', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('deduplicates identical intents in _cached', async () => {
    const engine = makeEngine();
    const client = new DashboardDataModelClient(engine);
    let calls = 0;
    const intent = { kind: 'select', modelId: '7', body: { base_table: 't', columns: ['x'] } };
    const [a, b] = await Promise.all([
      client._cached(intent, async () => {
        calls += 1;
        return { rows: [{ x: 1 }] };
      }),
      client._cached(intent, async () => {
        calls += 1;
        return { rows: [{ x: 1 }] };
      }),
    ]);
    expect(a.rows[0].x).toBe(1);
    expect(b.rows[0].x).toBe(1);
    expect(calls).toBe(1);
  });

  it('invalidates cached entries by model id', async () => {
    const engine = makeEngine();
    const client = new DashboardDataModelClient(engine);
    client._cache.set('a', { at: Date.now(), data: { rows: [] } });
    client._cache.set('b', { at: Date.now(), data: { rows: [] } });
    client._meta.set('a', { modelId: '5' });
    client._meta.set('b', { modelId: '6' });
    client.invalidate(['5']);
    expect(client._cache.has('a')).toBe(false);
    expect(client._cache.has('b')).toBe(true);
  });

  it('refreshes subscribers for changed model ids', async () => {
    const engine = makeEngine();
    const client = new DashboardDataModelClient(engine);
    const cb = vi.fn();
    client.subscribe({ kind: 'custom', modelId: '9' }, cb);
    client.query = vi.fn(async () => ({ ok: true }));
    engine.__dashboardFilterSnapshot.changedModelIds = ['9'];
    engine.__emitFilterNotify();
    await Promise.resolve();
    expect(client.query).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith({ ok: true });
  });

  it('does not refresh unrelated model subscribers', async () => {
    const engine = makeEngine();
    const client = new DashboardDataModelClient(engine);
    const cb = vi.fn();
    client.subscribe({ kind: 'custom', modelId: '10' }, cb);
    client.query = vi.fn(async () => ({ ok: true }));
    engine.__dashboardFilterSnapshot.changedModelIds = ['11'];
    engine.__emitFilterNotify();
    await Promise.resolve();
    expect(client.query).toHaveBeenCalledTimes(0);
    expect(cb).toHaveBeenCalledTimes(0);
  });

  it('clears all caches on global invalidate', () => {
    const engine = makeEngine();
    const client = new DashboardDataModelClient(engine);
    client._cache.set('k', { at: Date.now(), data: {} });
    client._meta.set('k', { modelId: '1' });
    client._inflight.set('k', Promise.resolve(null));
    client.invalidate(null);
    expect(client._cache.size).toBe(0);
    expect(client._meta.size).toBe(0);
    expect(client._inflight.size).toBe(0);
  });

  it('subscribers can unsubscribe', async () => {
    const engine = makeEngine();
    const client = new DashboardDataModelClient(engine);
    const cb = vi.fn();
    const off = client.subscribe({ kind: 'custom', modelId: '9' }, cb);
    off();
    client.query = vi.fn(async () => ({ ok: true }));
    engine.__dashboardFilterSnapshot.changedModelIds = ['9'];
    engine.__emitFilterNotify();
    await Promise.resolve();
    expect(cb).not.toHaveBeenCalled();
  });

  it('filterStore callback invalidates changed models', async () => {
    const engine = makeEngine();
    const client = new DashboardDataModelClient(engine);
    client._cache.set('a', { at: Date.now(), data: {} });
    client._meta.set('a', { modelId: '77' });
    engine.__dashboardFilterSnapshot.changedModelIds = ['77'];
    engine.__emitFilterNotify();
    await Promise.resolve();
    expect(client._cache.size).toBe(0);
  });

  it('destroy unsubscribes from filterStore', async () => {
    const engine = makeEngine();
    const client = new DashboardDataModelClient(engine);
    const cb = vi.fn();
    client.subscribe({ kind: 'custom', modelId: '9' }, cb);
    client.query = vi.fn(async () => ({ ok: true }));
    client.destroy();
    engine.__dashboardFilterSnapshot.changedModelIds = ['9'];
    engine.__emitFilterNotify();
    await Promise.resolve();
    expect(client.query).toHaveBeenCalledTimes(0);
    expect(cb).toHaveBeenCalledTimes(0);
  });

  it('handles _cached runner rejection', async () => {
    const engine = makeEngine();
    const client = new DashboardDataModelClient(engine);
    await expect(
      client._cached({ kind: 'x', modelId: '1' }, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(client._inflight.size).toBe(0);
  });

  it('stores modelId metadata in _cached', async () => {
    const engine = makeEngine();
    const client = new DashboardDataModelClient(engine);
    await client._cached({ kind: 'x', modelId: '55' }, async () => ({ ok: true }));
    const key = [...client._meta.keys()][0];
    expect(client._meta.get(key)?.modelId).toBe('55');
  });

  it('refreshSubscribers without changedModelIds does not refresh (requires explicit all)', async () => {
    const engine = makeEngine();
    const client = new DashboardDataModelClient(engine);
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    client.subscribe({ kind: 'custom', modelId: '1' }, cb1);
    client.subscribe({ kind: 'custom', modelId: '2' }, cb2);
    client.query = vi.fn(async () => ({ ok: true }));
    client._refreshSubscribers([]);
    await Promise.resolve();
    expect(client.query).not.toHaveBeenCalled();
    expect(cb1).not.toHaveBeenCalled();
    expect(cb2).not.toHaveBeenCalled();
  });

  it('refreshSubscribers with all:true refreshes every subscriber', async () => {
    const engine = makeEngine();
    const client = new DashboardDataModelClient(engine);
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    client.subscribe({ kind: 'custom', modelId: '1' }, cb1);
    client.subscribe({ kind: 'custom', modelId: '2' }, cb2);
    client.query = vi.fn(async () => ({ ok: true }));
    client._refreshSubscribers([], { all: true });
    await Promise.resolve();
    expect(client.query).toHaveBeenCalledTimes(2);
    expect(cb1).toHaveBeenCalled();
    expect(cb2).toHaveBeenCalled();
  });

  it('invalidates all caches when filter notify has empty changedModelIds', async () => {
    const engine = makeEngine();
    const client = new DashboardDataModelClient(engine);
    client._cache.set('a', { at: Date.now(), data: {} });
    client._meta.set('a', { modelId: '42' });
    engine.__dashboardFilterSnapshot.changedModelIds = [];
    engine.__emitFilterNotify();
    await Promise.resolve();
    expect(client._cache.size).toBe(0);
  });

  it('fullDataModelRefresh clears caches and refreshes subscribers', async () => {
    const engine = makeEngine();
    const client = new DashboardDataModelClient(engine);
    const cb = vi.fn();
    client.subscribe({ kind: 'custom', modelId: '1' }, cb);
    client.query = vi.fn(async () => ({ ok: true }));
    client._cache.set('z', { at: Date.now(), data: {} });
    engine.filterStore.notify({ fullDataModelRefresh: true });
    await Promise.resolve();
    expect(client._cache.size).toBe(0);
    expect(client.query).toHaveBeenCalled();
    expect(cb).toHaveBeenCalledWith({ ok: true });
  });

  it('unsubscribe function removes subscriber', () => {
    const engine = makeEngine();
    const client = new DashboardDataModelClient(engine);
    const cb = vi.fn();
    const off = client.subscribe({ kind: 'custom', modelId: '1' }, cb);
    expect(client._subs.size).toBe(1);
    off();
    expect(client._subs.size).toBe(0);
  });

  it('invalidate with unknown model keeps cache', () => {
    const engine = makeEngine();
    const client = new DashboardDataModelClient(engine);
    client._cache.set('a', { at: Date.now(), data: {} });
    client._meta.set('a', { modelId: '5' });
    client.invalidate(['99']);
    expect(client._cache.has('a')).toBe(true);
  });

  it('destroy clears internal state', () => {
    const engine = makeEngine();
    const client = new DashboardDataModelClient(engine);
    client._cache.set('a', { at: Date.now(), data: {} });
    client._meta.set('a', { modelId: '1' });
    client._inflight.set('a', Promise.resolve(null));
    client.subscribe({ kind: 'x', modelId: '1' }, () => {});
    client.destroy();
    expect(client._cache.size).toBe(0);
    expect(client._meta.size).toBe(0);
    expect(client._inflight.size).toBe(0);
    expect(client._subs.size).toBe(0);
  });

  it('query returns null for unsupported intent kind', async () => {
    const engine = makeEngine();
    const client = new DashboardDataModelClient(engine);
    const r = await client.query({ kind: 'unknown', modelId: 1 });
    expect(r).toBe(null);
  });

  it('invalidate handles empty modelIds array as global clear', () => {
    const engine = makeEngine();
    const client = new DashboardDataModelClient(engine);
    client._cache.set('a', { at: Date.now(), data: {} });
    client._meta.set('a', { modelId: '1' });
    client.invalidate([]);
    expect(client._cache.size).toBe(0);
  });

  it('cached result reused by intent key stability', async () => {
    const engine = makeEngine();
    const client = new DashboardDataModelClient(engine);
    let runs = 0;
    const runner = async () => {
      runs += 1;
      return { ok: true };
    };
    await client._cached({ modelId: '1', kind: 'x', a: 1, b: 2 }, runner);
    await client._cached({ kind: 'x', b: 2, modelId: '1', a: 1 }, runner);
    expect(runs).toBe(1);
  });

  it('fetchAggregate passes through merged response format', async () => {
    const engine = makeEngine();
    const client = new DashboardDataModelClient(engine);
    client._aggBatcher.enqueue = vi.fn(async () => ({ rows: [{ a: 1 }] }));
    const r = await client.fetchAggregate({
      modelId: 1,
      base_table: 't',
      group_by: [],
      aggregations: [{ fn: 'sum', column: 'x', as: 'a' }],
      filters: [],
      limit: 1,
    });
    expect(r.rows[0].a).toBe(1);
    expect(client._aggBatcher.enqueue).toHaveBeenCalled();
  });

  it('does not cache a response that started before invalidate', async () => {
    const client = new DashboardDataModelClient(makeEngine());
    const intent = { kind: 'select', modelId: '7', body: { base_table: 't' } };
    let release;
    const first = client._cached(intent, () => new Promise((r) => { release = r; }));
    await Promise.resolve();
    client.invalidate(['7']);
    // in-flight по модели снят — новый вызов идёт заново, а не ждёт старый ответ
    const runner = vi.fn(async () => 'fresh');
    const second = client._cached(intent, runner);
    release('stale');
    expect(await first).toBe('stale');
    expect(await second).toBe('fresh');
    expect(runner).toHaveBeenCalledTimes(1);
    expect(await client._cached(intent, async () => 'other')).toBe('fresh');
  });

  it('stale in-flight does not drop the newer in-flight entry', async () => {
    const client = new DashboardDataModelClient(makeEngine());
    const intent = { kind: 'select', modelId: '7', body: { base_table: 't' } };
    let releaseOld;
    const old = client._cached(intent, () => new Promise((r) => { releaseOld = r; }));
    await Promise.resolve();
    client.invalidate(['7']);
    let releaseNew;
    const fresh = client._cached(intent, () => new Promise((r) => { releaseNew = r; }));
    await Promise.resolve();
    releaseOld('old');
    await old;
    expect(client._inflight.size).toBe(1);
    releaseNew('new');
    expect(await fresh).toBe('new');
    expect(client._inflight.size).toBe(0);
  });
});
