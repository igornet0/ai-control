import { intentKey } from './intentTypes.js';

function aggSig(agg) {
  // Include alias-bearing identity: count+id on different tables must not collapse
  // when batching (employees.id vs documents.id both normalize to "id" client-side).
  return `${String(agg?.fn || '').toLowerCase()}\0${String(agg?.column || '')}\0${String(agg?.as || '')}`;
}

function groupSig(job) {
  return intentKey({
    modelId: job.modelId,
    base_table: job.base_table,
    group_by: [...(job.group_by || [])],
    filters: job.filters || [],
    limit: Number(job.limit || 1),
  });
}

/** @typedef {{ entries: Array<{ job: object, resolve: Function, reject: Function }>, first: object, bySig: Map<string, string>, body: object }} GroupPlan */

export class AggregationBatcher {
  /**
   * @param {{ runAggregate: (x: { modelId: *, body: object }) => Promise<any>, runAggregateBatch?: (x: { modelId: *, bodies: object[] }) => Promise<{ results: any[] }> }} handlers
   */
  constructor({ runAggregate, runAggregateBatch }) {
    this.runAggregate = runAggregate;
    this.runAggregateBatch = typeof runAggregateBatch === 'function' ? runAggregateBatch : null;
    this._queue = [];
    this._scheduled = false;
    this._seq = 0;
  }

  enqueue(job) {
    return new Promise((resolve, reject) => {
      this._queue.push({ job, resolve, reject });
      if (!this._scheduled) {
        this._scheduled = true;
        queueMicrotask(() => this._flush());
      }
    });
  }

  /** @returns {GroupPlan} */
  _materializeGroup(entries) {
    const first = entries[0].job;
    const mergedAggs = [];
    const bySig = new Map();
    entries.forEach(({ job }) => {
      (job.aggregations || []).forEach((a) => {
        const sig = aggSig(a);
        if (bySig.has(sig)) return;
        const alias = `b_${this._seq++}`;
        bySig.set(sig, alias);
        mergedAggs.push({
          fn: String(a.fn || '').toLowerCase(),
          column: String(a.column || ''),
          as: alias,
        });
      });
    });
    const body = {
      mode: 'aggregate',
      base_table: first.base_table,
      group_by: [...(first.group_by || [])],
      aggregations: mergedAggs,
      filters: first.filters || [],
      limit: Number(first.limit || 1),
    };
    if (first.dashboard_id != null) body.dashboard_id = first.dashboard_id;
    return { entries, first, bySig, body };
  }

  /** @param {GroupPlan} plan */
  _resolve(plan, data) {
    const rows = Array.isArray(data?.rows) ? data.rows : [];
    plan.entries.forEach(({ job, resolve }) => {
      const aliasMap = new Map();
      (job.aggregations || []).forEach((a) => {
        aliasMap.set(aggSig(a), plan.bySig.get(aggSig(a)));
      });
      const outRows = rows.map((row) => {
        const out = {};
        (job.group_by || []).forEach((g) => {
          out[g] = row[g];
        });
        (job.aggregations || []).forEach((a) => {
          const sig = aggSig(a);
          const alias = aliasMap.get(sig);
          const as = String(a.as || `${a.fn}_${a.column}`);
          out[as] = alias != null ? row[alias] : null;
        });
        return out;
      });
      resolve({ rows: outRows });
    });
  }

  /** @param {GroupPlan} plan */
  async _execSingle(plan) {
    try {
      const data = await this.runAggregate({
        modelId: plan.first.modelId,
        body: plan.body,
      });
      this._resolve(plan, data);
    } catch (error) {
      plan.entries.forEach(({ reject }) => reject(error));
    }
  }

  async _flush() {
    this._scheduled = false;
    const batch = this._queue.splice(0);
    if (!batch.length) return;
    const groups = new Map();
    batch.forEach((entry) => {
      const key = groupSig(entry.job);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(entry);
    });
    /** @type {GroupPlan[]} */
    const plans = [...groups.values()].map((entries) => this._materializeGroup(entries));

    const canBatch =
      plans.length > 1 &&
      this.runAggregateBatch &&
      plans.every((p) => String(p.first.modelId) === String(plans[0].first.modelId));

    if (canBatch) {
      const modelId = plans[0].first.modelId;
      const bodies = plans.map((p) => p.body);
      try {
        const wrapped = await this.runAggregateBatch({ modelId, bodies });
        const results = Array.isArray(wrapped?.results) ? wrapped.results : [];
        plans.forEach((plan, ix) => {
          this._resolve(plan, results[ix] ?? { rows: [] });
        });
      } catch (error) {
        plans.forEach((plan) => {
          plan.entries.forEach(({ reject }) => reject(error));
        });
      }
      return;
    }

    await Promise.all(plans.map((plan) => this._execSingle(plan)));
  }
}
