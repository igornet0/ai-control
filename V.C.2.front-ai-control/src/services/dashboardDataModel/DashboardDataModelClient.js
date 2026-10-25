import { runDashboardModelQuery, runDashboardModelQueryBatch } from '../dashboardQueryCoordinator.js';
import { postColumnDistinct } from '../dashboardQueryService.js';
import { collectDashboardFilters, filtersForModel } from '../dashboardFilterUtils.js';
import { fetchKpiBucketSnapshot } from './bucketSemantic.js';
import { AggregationBatcher } from './aggregationBatcher.js';
import { canonicalizeFilters, intentKey } from './intentTypes.js';

const TTL_MS = 15000;
const MAX_CACHE = 256;
const _clients = new WeakMap();

function trimCache(cache, meta) {
  while (cache.size > MAX_CACHE) {
    const first = cache.keys().next();
    if (first.done) break;
    cache.delete(first.value);
    meta.delete(first.value);
  }
}

function withDashboardId(engine, body) {
  const did = engine?.dashboardId;
  if (did != null && did !== '') {
    const n = Number(did);
    return { ...body, dashboard_id: Number.isFinite(n) ? n : did };
  }
  return body;
}

export class DashboardDataModelClient {
  constructor(engine) {
    this.engine = engine;
    this._cache = new Map();
    this._meta = new Map();
    this._inflight = new Map();
    /** Поколение кэша: ответы, начатые до invalidate, не пишутся в кэш. */
    this._gen = 0;
    this._subs = new Set();
    this._aggBatcher = new AggregationBatcher({
      runAggregate: ({ modelId, body }) => runDashboardModelQuery(this.engine, modelId, body),
      runAggregateBatch: ({ modelId, bodies }) =>
        runDashboardModelQueryBatch(this.engine, modelId, bodies),
    });
    if (engine?.filterStore?.subscribe) {
      this._unsubFilterStore = engine.filterStore.subscribe((_descriptors, options = {}) => {
        const fullRefresh = !!options.fullDataModelRefresh;
        if (fullRefresh) {
          this.invalidate(null);
          this._refreshSubscribers([], { all: true });
          return;
        }
        const changed = [...(engine?.__dashboardFilterSnapshot?.changedModelIds || [])].map((x) => String(x));
        if (!changed.length) {
          // Сброс всех фильтров → changedModelIds может быть пуст при битом prev-снимке.
          // Полный invalidate, иначе KPI/aggregate остаются на старом TTL-кэше.
          this.invalidate(null);
          this._refreshSubscribers([], { all: true });
          return;
        }
        this.invalidate(changed);
        this._refreshSubscribers(changed);
      });
    } else {
      this._unsubFilterStore = null;
    }
  }

  destroy() {
    if (typeof this._unsubFilterStore === 'function') this._unsubFilterStore();
    this._cache.clear();
    this._meta.clear();
    this._inflight.clear();
    this._subs.clear();
  }

  getModelFilters(modelId) {
    return filtersForModel(collectDashboardFilters(this.engine), modelId);
  }

  invalidate(modelIds = null) {
    this._gen += 1;
    if (!Array.isArray(modelIds) || !modelIds.length) {
      this._cache.clear();
      this._meta.clear();
      this._inflight.clear();
      return;
    }
    const idSet = new Set(modelIds.map((x) => String(x)));
    [...this._meta.entries()].forEach(([key, m]) => {
      if (idSet.has(String(m.modelId))) {
        this._cache.delete(key);
        this._meta.delete(key);
      }
    });
    // In-flight запросы по этим моделям начаты со старыми фильтрами — не переиспользуем.
    [...this._inflight.entries()].forEach(([key, entry]) => {
      if (idSet.has(String(entry.modelId))) this._inflight.delete(key);
    });
  }

  subscribe(intent, callback) {
    const sub = { intent, callback };
    this._subs.add(sub);
    return () => this._subs.delete(sub);
  }

  /**
   * Обновляет подписчиков данных по изменённым моделям.
   * @param {string[]} changedModelIds
   * @param {{ all?: boolean }} [opts] — если all=true (явно), обрабатывает всех подписчиков.
   */
  _refreshSubscribers(changedModelIds = [], opts = {}) {
    const changed = new Set((changedModelIds || []).map((x) => String(x)));
    const refreshAll = !!opts.all;
    if (!refreshAll && changed.size === 0) return;
    this._subs.forEach((sub) => {
      const modelId = String(sub.intent?.modelId ?? '');
      if (!refreshAll && changed.size && !changed.has(modelId)) return;
      this.query(sub.intent)
        .then((data) => sub.callback(data))
        .catch(() => {});
    });
  }

  async _cached(intent, runner) {
    if (this.engine?.requestSignal?.aborted) {
      throw new DOMException('aborted', 'AbortError');
    }
    const bypassCache = this.engine?.__dashboardBypassCache === true;
    if (bypassCache) {
      return Promise.resolve().then(runner);
    }
    const key = intentKey(intent);
    const now = Date.now();
    const hit = this._cache.get(key);
    if (hit && now - hit.at < TTL_MS) return hit.data;
    const pending = this._inflight.get(key);
    if (pending) return pending.promise ?? pending;
    const gen = this._gen;
    const release = () => {
      if (this._inflight.get(key)?.promise === p) this._inflight.delete(key);
    };
    const p = Promise.resolve()
      .then(runner)
      .then((data) => {
        if (gen === this._gen) {
          this._cache.set(key, { at: Date.now(), data });
          this._meta.set(key, { modelId: intent.modelId });
          trimCache(this._cache, this._meta);
        }
        release();
        return data;
      })
      .catch((e) => {
        release();
        throw e;
      });
    this._inflight.set(key, { promise: p, modelId: intent.modelId });
    return p;
  }

  async fetchAggregate(params) {
    const filters = canonicalizeFilters(params.filters ?? this.getModelFilters(params.modelId));
    const groupBy = [...(params.group_by || [])];
    const aggregations = (params.aggregations || []).map((a) => ({
      fn: String(a.fn || '').toLowerCase(),
      column: String(a.column || ''),
      as: String(a.as || `${a.fn}_${a.column}`),
    }));
    const intent = {
      kind: 'aggregate',
      modelId: String(params.modelId),
      base_table: String(params.base_table),
      group_by: groupBy,
      aggregations: aggregations.map((a) => ({ fn: a.fn, column: a.column, as: a.as })),
      filters,
      limit: Number(params.limit || 500),
    };
    return this._cached(intent, () =>
      this._aggBatcher.enqueue({
        modelId: params.modelId,
        base_table: params.base_table,
        group_by: groupBy,
        aggregations,
        filters,
        limit: params.limit || 500,
        dashboard_id: this.engine?.dashboardId != null ? Number(this.engine.dashboardId) || this.engine.dashboardId : undefined,
      }),
    );
  }

  async fetchSelect(params) {
    const filters = canonicalizeFilters(params.filters ?? this.getModelFilters(params.modelId));
    const body = {
      mode: 'select',
      base_table: String(params.base_table),
      columns: Array.isArray(params.columns) ? [...params.columns] : undefined,
      column_refs: Array.isArray(params.column_refs) ? [...params.column_refs] : undefined,
      filters,
      limit: Number(params.limit || 500),
      order_by: Array.isArray(params.order_by) ? [...params.order_by] : undefined,
    };
    if (params.line_time_bucket && typeof params.line_time_bucket === 'object') {
      const b = params.line_time_bucket;
      body.line_time_bucket = {
        x_column: String(b.x_column || ''),
        y_column: String(b.y_column || ''),
        interval_ms: Math.round(Number(b.interval_ms) || 0),
        aggregation: String(b.aggregation || 'avg').toLowerCase(),
        x_encoding: String(b.x_encoding || 'iso_text').toLowerCase(),
      };
    }
    const intent = {
      kind: 'select',
      modelId: String(params.modelId),
      body,
    };
    return this._cached(intent, () => runDashboardModelQuery(this.engine, params.modelId, withDashboardId(this.engine, body)));
  }

  async fetchColumnDistinct(params) {
    const body = {
      table: String(params.table),
      column: String(params.column),
      pattern: params.pattern == null ? '' : String(params.pattern),
      limit: Number(params.limit || 300),
      filters: canonicalizeFilters(params.filters ?? this.getModelFilters(params.modelId)),
    };
    const intent = { kind: 'column_distinct', modelId: String(params.modelId), body };
    return this._cached(intent, () =>
      postColumnDistinct(params.modelId, body, { signal: this.engine?.requestSignal }),
    );
  }

  async fetchKpiBucketSnapshot(params) {
    const globalFilters = params.globalFilters ?? this.getModelFilters(params.modelId);
    const intent = {
      kind: 'kpi_bucket_snapshot',
      modelId: String(params.modelId),
      table: String(params.table),
      formula: String(params.formula || ''),
      dateField: String(params.dateField || ''),
      current: {
        customRange: params.customRange || {},
        periodMode: params.periodMode || 'auto',
        deltaMode: params.deltaMode || 'previous_period',
        deltaCustomRange: params.deltaCustomRange || {},
        granularitySetting: params.granularitySetting || 'auto',
        kpiBucketMode: params.kpiBucketMode || 'last_completed',
        periodShift: Number(params.periodShift) || 0,
      },
      filters: canonicalizeFilters(globalFilters),
    };
    return this._cached(intent, () =>
      fetchKpiBucketSnapshot({
        ...params,
        engine: this.engine,
        globalFilters,
      }),
    );
  }

  async query(intent) {
    if (!intent || typeof intent !== 'object') return null;
    if (intent.kind === 'aggregate') return this.fetchAggregate(intent);
    if (intent.kind === 'select') return this.fetchSelect(intent.body || intent);
    if (intent.kind === 'column_distinct') return this.fetchColumnDistinct(intent.body || intent);
    if (intent.kind === 'kpi_bucket_snapshot') return this.fetchKpiBucketSnapshot(intent);
    return null;
  }
}

export function getDashboardDataModelClient(engine) {
  if (!engine || typeof engine !== 'object') return null;
  if (_clients.has(engine)) return _clients.get(engine);
  const client = new DashboardDataModelClient(engine);
  _clients.set(engine, client);
  return client;
}

/** Снять кеш клиента и отписаться от filterStore (при `WorkspaceEngine.destroy`). */
export function forgetDashboardDataModelClient(engine) {
  if (!engine || typeof engine !== 'object') return;
  const client = _clients.get(engine);
  if (!client) return;
  client.destroy();
  _clients.delete(engine);
}

