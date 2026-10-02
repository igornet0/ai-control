import { describe, expect, it } from 'vitest';
import {
  downsampleForViewport,
  downsampleLTTB,
  downsampleMinMax,
  resolveLodTargetPointCount,
  LOD_RENDER_MIN,
  LOD_RENDER_MAX,
} from '../src/widgets/line-chart/lineChartLOD.js';
import { normalizeLineConfig } from '../src/widgets/line-chart/lineChartConfig.js';

function makeSeries(n) {
  return Array.from({ length: n }, (_, i) => ({ x: i, y: Math.sin(i / 10) * 100 + (i % 17), idx: i }));
}

describe('line chart auto LOD', () => {
  it('resolveLodTargetPointCount scales with plot width and clamps', () => {
    expect(resolveLodTargetPointCount(100)).toBe(LOD_RENDER_MIN);
    expect(resolveLodTargetPointCount(1500)).toBe(4500);
    expect(resolveLodTargetPointCount(5000)).toBe(LOD_RENDER_MAX);
  });

  it('downsampleForViewport keeps small series intact', () => {
    const pts = makeSeries(100);
    const out = downsampleForViewport(pts, 800, 'minmax');
    expect(out.length).toBe(100);
  });

  it('downsampleForViewport reduces large series under pixel budget', () => {
    const pts = makeSeries(50_000);
    const out = downsampleForViewport(pts, 1500, 'minmax');
    expect(out.length).toBeLessThanOrEqual(LOD_RENDER_MAX);
    expect(out.length).toBeLessThan(pts.length);
    expect(out[0].idx).toBe(0);
    expect(out[out.length - 1].idx).toBe(pts.length - 1);
  });

  it('minmax preserves a sharp peak', () => {
    const pts = makeSeries(10_000);
    pts[5000] = { x: 5000, y: 1e6, idx: 5000 };
    const out = downsampleMinMax(pts, 500);
    expect(out.some((p) => p.y === 1e6)).toBe(true);
  });

  it('lttb reduces to target size', () => {
    const pts = makeSeries(20_000);
    const out = downsampleLTTB(pts, 800);
    expect(out.length).toBeLessThanOrEqual(800);
    expect(out.length).toBeGreaterThan(3);
  });

  it('normalizeLineConfig drops manual LOD thresholds and enables pan refetch', () => {
    const cfg = normalizeLineConfig({
      lod: { enabled: false, threshold: 9999, maxRenderPoints: 400, mode: 'none' },
      auto_refetch_on_pan: undefined,
    });
    expect(cfg.lod.enabled).toBe(true);
    expect(cfg.lod.mode).toBe('minmax');
    expect(cfg.lod.threshold).toBeUndefined();
    expect(cfg.lod.maxRenderPoints).toBeUndefined();
    expect(cfg.auto_refetch_on_pan).toBe(true);
  });

  it('normalizeLineConfig keeps explicit auto_refetch_on_pan false', () => {
    const cfg = normalizeLineConfig({ auto_refetch_on_pan: false });
    expect(cfg.auto_refetch_on_pan).toBe(false);
  });

  it('normalizeLineConfig preserves widget title fields from settings', () => {
    const cfg = normalizeLineConfig({
      showTitle: true,
      title: '  Orders over time  ',
      titleSize: 20,
      titleColor: '#AABBCC',
    });
    expect(cfg.showTitle).toBe(true);
    expect(cfg.title).toBe('Orders over time');
    expect(cfg.titleSize).toBe(20);
    expect(cfg.titleColor).toBe('#AABBCC');
  });

  it('normalizeLineConfig defaults showTitle to false when omitted', () => {
    const cfg = normalizeLineConfig({});
    expect(cfg.showTitle).toBe(false);
    expect(cfg.title).toBe('Линейный график');
  });
});
