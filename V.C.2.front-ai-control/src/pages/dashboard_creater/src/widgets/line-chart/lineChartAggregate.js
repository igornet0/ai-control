/**
 * Клиентская агрегация временных рядов для линейного графика (O(n)).
 */

import { parseXToNumber } from './lineChartScales.js';
import { bucketStartMs } from './lineChartTimeframe.js';

/** @typedef {'sum'|'avg'|'min'|'max'|'count'} LineTimeframeAggregation */

/**
 * @param {Record<string, unknown>[]} rows
 * @param {{
 *   xField: string,
 *   yField: string,
 *   intervalMs: number,
 *   presetId: string,
 *   aggregation: LineTimeframeAggregation
 * }} opts
 * @returns {Record<string, unknown>[]}
 */
export function aggregateLineChartData(rows, opts) {
    const xField = String(opts.xField || 'x');
    const yField = String(opts.yField || 'y');
    const intervalMs = Number(opts.intervalMs);
    const presetId = String(opts.presetId || 'custom');
    const aggregation = normalizeAgg(opts.aggregation);

    if (!Array.isArray(rows) || rows.length === 0) return [];
    if (!Number.isFinite(intervalMs) || intervalMs <= 0) return rows.slice();

    /** @type {Map<number, { sum: number, min: number, max: number, count: number }>} */
    const buckets = new Map();

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row || typeof row !== 'object') continue;
        const rawX = row[xField];
        const t = parseXToNumber(rawX);
        if (t == null || !Number.isFinite(t)) continue;

        const y = parseFloat(row[yField]);
        if (aggregation !== 'count' && !Number.isFinite(y)) continue;

        const key = bucketStartMs(t, presetId, intervalMs);
        let acc = buckets.get(key);
        if (!acc) {
            const y0 = Number.isFinite(y) ? y : 0;
            acc = { sum: 0, min: y0, max: y0, count: 0 };
            buckets.set(key, acc);
        }
        acc.count += 1;
        if (aggregation === 'count') {
            continue;
        }
        acc.sum += y;
        acc.min = Math.min(acc.min, y);
        acc.max = Math.max(acc.max, y);
    }

    const keys = Array.from(buckets.keys()).sort((a, b) => a - b);
    /** @type {Record<string, unknown>[]} */
    const out = [];
    for (const k of keys) {
        const acc = buckets.get(k);
        if (!acc || acc.count === 0) continue;
        let yVal = 0;
        switch (aggregation) {
            case 'sum':
                yVal = acc.sum;
                break;
            case 'avg':
                yVal = acc.sum / acc.count;
                break;
            case 'min':
                yVal = acc.min;
                break;
            case 'max':
                yVal = acc.max;
                break;
            case 'count':
                yVal = acc.count;
                break;
            default:
                yVal = acc.sum / acc.count;
        }
        const rec = { [xField]: k, [yField]: yVal };
        rec._bucketCount = acc.count;
        out.push(rec);
    }
    return out;
}

/**
 * @param {unknown} v
 * @returns {LineTimeframeAggregation}
 */
function normalizeAgg(v) {
    const s = String(v || 'avg').toLowerCase();
    if (s === 'sum' || s === 'min' || s === 'max' || s === 'count' || s === 'avg') return s;
    return 'avg';
}
