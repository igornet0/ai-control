import { describe, it, expect } from 'vitest';
import {
    parseCustomTimeframeInput,
    bucketStartMs,
    resolveActiveTimeframe,
    MS_MIN,
    MS_HOUR,
} from '../src/widgets/line-chart/lineChartTimeframe.js';
import { aggregateLineChartData } from '../src/widgets/line-chart/lineChartAggregate.js';
import { normalizeLineConfig } from '../src/widgets/line-chart/lineChartConfig.js';

describe('lineChartTimeframe', () => {
    it('parseCustomTimeframeInput accepts w mo y', () => {
        expect(parseCustomTimeframeInput('2w').intervalMs).toBe(2 * 7 * 86400000);
        expect(parseCustomTimeframeInput('3mo').intervalMs).toBe(3 * 30 * 86400000);
        expect(parseCustomTimeframeInput('1y').intervalMs).toBe(365 * 86400000);
    });

    it('parseCustomTimeframeInput accepts s m h d', () => {
        expect(parseCustomTimeframeInput('7m').intervalMs).toBe(7 * MS_MIN);
        expect(parseCustomTimeframeInput('3h').intervalMs).toBe(3 * MS_HOUR);
        expect(parseCustomTimeframeInput('2d').intervalMs).toBe(2 * 86400000);
        expect(parseCustomTimeframeInput('30s').intervalMs).toBe(30000);
    });

    it('parseCustomTimeframeInput rejects bad input', () => {
        expect(parseCustomTimeframeInput('').error).toBeTruthy();
        expect(parseCustomTimeframeInput('7x').error).toBeTruthy();
    });

    it('bucketStartMs aligns 1h to local hour', () => {
        const t = new Date(2026, 4, 5, 14, 37, 22, 333).getTime();
        const b = bucketStartMs(t, '1h', MS_HOUR);
        expect(new Date(b).getHours()).toBe(14);
        expect(new Date(b).getMinutes()).toBe(0);
    });

    it('bucketStartMs custom uses epoch buckets', () => {
        const interval = 7 * MS_MIN;
        const t = 1_700_000_000_000;
        const b = bucketStartMs(t, 'custom', interval);
        expect(b % interval).toBe(0);
        expect(b).toBeLessThanOrEqual(t);
    });

    it('resolveActiveTimeframe disabled returns raw', () => {
        const tf = resolveActiveTimeframe({ enabled: false, id: '5m' });
        expect(tf.id).toBe('raw');
        expect(tf.intervalMs).toBe(0);
    });

    it('resolveActiveTimeframe custom uses customIntervalMs', () => {
        const tf = resolveActiveTimeframe({
            enabled: true,
            id: 'custom',
            customIntervalMs: 123000,
        });
        expect(tf.id).toBe('custom');
        expect(tf.intervalMs).toBe(123000);
    });

    it('normalizeLineConfig clamps timeframe barLayout and barDensity', () => {
        const c1 = normalizeLineConfig({ timeframe: { barLayout: 'row', barDensity: 'compact' } });
        expect(c1.timeframe.barLayout).toBe('row');
        expect(c1.timeframe.barDensity).toBe('compact');
        const c2 = normalizeLineConfig({ timeframe: { barLayout: 'nope', barDensity: '' } });
        expect(c2.timeframe.barLayout).toBe('column');
        expect(c2.timeframe.barDensity).toBe('comfortable');
    });
});

describe('lineChartAggregate', () => {
    it('aggregates 1m buckets with avg', () => {
        const base = new Date(2026, 0, 1, 12, 0, 0, 0).getTime();
        const rows = [];
        for (let i = 0; i < 60; i++) {
            rows.push({ t: base + i * 1000, v: i });
        }
        const out = aggregateLineChartData(rows, {
            xField: 't',
            yField: 'v',
            intervalMs: MS_MIN,
            presetId: '1m',
            aggregation: 'avg',
        });
        expect(out.length).toBe(1);
        expect(out[0].v).toBeCloseTo(29.5, 5);
    });

    it('sum across two minute buckets', () => {
        const t0 = new Date(2026, 0, 1, 12, 0, 15, 0).getTime();
        const t1 = new Date(2026, 0, 1, 12, 1, 10, 0).getTime();
        const rows = [
            { ts: t0, y: 10 },
            { ts: t0 + 20000, y: 20 },
            { ts: t1, y: 100 },
        ];
        const out = aggregateLineChartData(rows, {
            xField: 'ts',
            yField: 'y',
            intervalMs: MS_MIN,
            presetId: '1m',
            aggregation: 'sum',
        });
        expect(out.length).toBe(2);
        expect(out[0].y).toBe(30);
        expect(out[1].y).toBe(100);
    });

    it('handles 10k rows in one pass', () => {
        const base = Date.now();
        const rows = [];
        for (let i = 0; i < 10000; i++) {
            rows.push({ x: base + i * 1000, y: i % 7 });
        }
        const t0 = performance.now();
        const out = aggregateLineChartData(rows, {
            xField: 'x',
            yField: 'y',
            intervalMs: 60 * MS_MIN,
            presetId: 'custom',
            aggregation: 'avg',
        });
        const dt = performance.now() - t0;
        expect(out.length).toBeGreaterThan(0);
        expect(out.length).toBeLessThan(rows.length);
        expect(dt).toBeLessThan(500);
    });

    it('count ignores invalid y', () => {
        const base = new Date(2026, 0, 1, 12, 0, 0, 0).getTime();
        const out = aggregateLineChartData(
            [
                { x: base, y: NaN },
                { x: base + 5000, y: 1 },
                { x: base + 10000 },
            ],
            {
                xField: 'x',
                yField: 'y',
                intervalMs: MS_MIN,
                presetId: '1m',
                aggregation: 'count',
            },
        );
        expect(out.length).toBe(1);
        expect(out[0].y).toBe(3);
    });
});
