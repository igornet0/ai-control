import { describe, expect, it } from '@jest/globals';
import {
  ensureBindingMeasures,
  buildSortedSeries,
  mergeSeriesRowsByX,
  resolveLineMeasures,
  LINE_SERIES_PALETTE,
  normalizeSeriesPaint,
} from '../src/widgets/line-chart/lineChartSeries.js';
import {
  movingAverageSeries,
  trendSeries,
  pctChangeVsPrev,
  detectAnomalies,
  viewportStats,
  forecastSeries,
  buildDerivedSeries,
  expandViewForForecast,
} from '../src/widgets/line-chart/lineChartAnalytics.js';
import { normalizeLineConfig } from '../src/widgets/line-chart/lineChartConfig.js';

describe('lineChartSeries multi-series', () => {
  it('migrates bindingMeasure to bindingMeasures', () => {
    const s = {
      bindingMeasure: { modelId: 1, table: 't', field: 'revenue', formula: '[t.revenue]' },
    };
    ensureBindingMeasures(s);
    expect(s.bindingMeasures).toHaveLength(1);
    expect(s.bindingMeasures[0].field).toBe('revenue');
    expect(s.bindingMeasures[0].color).toBe(LINE_SERIES_PALETTE[0]);
  });

  it('normalizeSeriesPaint solid vs gradient + legacy line.gradient migrate', () => {
    expect(normalizeSeriesPaint({ color: '#112233' }).colorMode).toBe('solid');
    expect(normalizeSeriesPaint({ colorMode: 'gradient', gradient: { from: '#111111', to: '#222222' } }).colorMode).toBe(
      'gradient',
    );
    const s = {
      bindingMeasures: [{ modelId: 1, table: 't', field: 'y', formula: '[t.y]', color: '#4DA3FF' }],
      line: { gradient: { enabled: true, mode: 'y', from: '#005DFF', to: '#00E0FF' } },
    };
    ensureBindingMeasures(s);
    expect(s.bindingMeasures[0].colorMode).toBe('gradient');
    expect(s.bindingMeasures[0].gradient.mode).toBe('y');
    expect(s.line.gradient.enabled).toBe(false);
  });

  it('builds sorted series from rows', () => {
    const pts = buildSortedSeries(
      [
        { d: '2024-01-02', a: 2 },
        { d: '2024-01-01', a: 1 },
      ],
      'd',
      'a',
      'time',
    );
    expect(pts).toHaveLength(2);
    expect(pts[0].y).toBe(1);
    expect(pts[1].y).toBe(2);
  });

  it('merges parallel series by X', () => {
    const rows = mergeSeriesRowsByX('x', [
      { yField: 'a', rows: [{ x: 1, a: 10 }, { x: 2, a: 20 }] },
      { yField: 'b', rows: [{ x: 1, b: 3 }, { x: 3, b: 9 }] },
    ]);
    expect(rows).toHaveLength(3);
    expect(rows.find((r) => String(r.x) === '1')).toMatchObject({ a: 10, b: 3 });
  });

  it('normalizeLineConfig keeps analytics and chartType', () => {
    const cfg = normalizeLineConfig({
      chartType: 'area',
      analytics: { ma: { enabled: true, window: 5 } },
      bindingMeasure: { modelId: 1, table: 't', field: 'y', formula: '[t.y]' },
    });
    expect(cfg.chartType).toBe('area');
    expect(cfg.analytics.ma.enabled).toBe(true);
    expect(cfg.analytics.ma.window).toBe(5);
    expect(cfg.bindingMeasures?.length).toBe(1);
  });

  it('normalizeLineConfig preserves references (not wiped to [])', () => {
    const cfg = normalizeLineConfig({
      references: [
        { id: 'r1', type: 'constant', value: 4124, label: 'Target', color: '#f59e0b' },
        { id: 'r2', type: 'band', yMin: 100, label: 'half-band' },
      ],
    });
    expect(cfg.references).toHaveLength(2);
    expect(cfg.references[0].value).toBe(4124);
    // band without yMax becomes constant so it still draws
    expect(cfg.references[1].type).toBe('constant');
    expect(cfg.references[1].value).toBe(100);
  });
});

describe('lineChartAnalytics', () => {
  const pts = [
    { x: 1, y: 10, idx: 0 },
    { x: 2, y: 20, idx: 1 },
    { x: 3, y: 30, idx: 2 },
    { x: 4, y: 40, idx: 3 },
    { x: 5, y: 50, idx: 4 },
  ];

  it('moving average window 3', () => {
    const ma = movingAverageSeries(pts, 3);
    expect(ma[0].y).toBeCloseTo(20);
    expect(ma).toHaveLength(3);
  });

  it('linear trend increases', () => {
    const tr = trendSeries(pts, 1);
    expect(tr[tr.length - 1].y).toBeGreaterThan(tr[0].y);
  });

  it('pct change', () => {
    expect(pctChangeVsPrev(pts, pts[2])).toBeCloseTo(50);
  });

  it('viewport stats', () => {
    const st = viewportStats(pts, 2, 4);
    expect(st.count).toBe(3);
    expect(st.avg).toBeCloseTo(30);
    expect(st.sum).toBe(90);
  });

  it('forecast produces horizon points', () => {
    const fc = forecastSeries(pts, 5, 'linear');
    // +1 continuity point at last historical x
    expect(fc.line).toHaveLength(6);
    expect(fc.bandLo).toHaveLength(6);
    expect(fc.line[0].x).toBe(pts[pts.length - 1].x);
  });

  it('buildDerivedSeries forecast works for linear xType', () => {
    const raw = [{ id: 'm1', label: 'Y', color: '#fff', visible: true, kind: 'raw', points: pts }];
    const none = buildDerivedSeries(raw, { forecast: { enabled: true, horizon: 3 } }, { x0: 1, x1: 5 }, 'category');
    expect(none.filter((s) => s.kind === 'forecast')).toHaveLength(0);

    const der = buildDerivedSeries(raw, { forecast: { enabled: true, horizon: 3 } }, { x0: 1, x1: 5 }, 'linear');
    const fc = der.find((s) => s.kind === 'forecast');
    expect(fc?.points?.length).toBeGreaterThan(3);
    expect(fc.points[fc.points.length - 1].x).toBeGreaterThan(5);
  });

  it('expandViewForForecast extends x1 when near data end', () => {
    const raw = [{ id: 'm1', visible: true, kind: 'raw', points: pts }];
    const derived = buildDerivedSeries(
      raw,
      { forecast: { enabled: true, horizon: 4 } },
      { x0: 1, x1: 5 },
      'linear',
    );
    const { view, expanded } = expandViewForForecast({ x0: 1, x1: 5, y0: 10, y1: 50 }, raw, derived);
    expect(expanded).toBe(true);
    expect(view.x1).toBeGreaterThan(5);

    const mid = expandViewForForecast({ x0: 1, x1: 3, y0: 10, y1: 50 }, raw, derived);
    expect(mid.expanded).toBe(false);
  });

  it('detects extreme anomaly', () => {
    const withSpike = [...pts, { x: 6, y: 1000, idx: 5 }];
    const an = detectAnomalies(withSpike, 2);
    expect(an.some((a) => a.point.y === 1000)).toBe(true);
  });

  it('resolveLineMeasures skips invalid', () => {
    const list = resolveLineMeasures([
      { modelId: 1, table: 't', field: 'y', formula: '[t.y]', visible: true },
      { modelId: 1, table: 't', field: '', formula: '', visible: true },
    ]);
    expect(list.length).toBeGreaterThanOrEqual(1);
  });
});
