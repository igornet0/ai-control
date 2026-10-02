import { describe, expect, it } from '@jest/globals';
import {
  computeBarCategoryStats,
  buildBarStatsOverlaySvg,
} from '../src/widgets/bar-chart/barChartStats.js';

describe('bar chart category stats', () => {
  it('computes avg, median and sum', () => {
    const st = computeBarCategoryStats([10, 20, 30, 40]);
    expect(st.count).toBe(4);
    expect(st.avg).toBe(25);
    expect(st.median).toBe(25);
    expect(st.sum).toBe(100);
  });

  it('uses middle pair average for even-length median', () => {
    const st = computeBarCategoryStats([1, 3, 8, 10]);
    expect(st.median).toBe(5.5);
  });

  it('uses middle value for odd-length median', () => {
    const st = computeBarCategoryStats([9, 1, 4]);
    expect(st.median).toBe(4);
    expect(st.avg).toBeCloseTo(14 / 3);
  });

  it('ignores non-finite values', () => {
    const st = computeBarCategoryStats([2, NaN, null, 6, undefined]);
    expect(st.count).toBe(2);
    expect(st.avg).toBe(4);
    expect(st.median).toBe(4);
    expect(st.sum).toBe(8);
  });

  it('returns nulls for empty input', () => {
    const st = computeBarCategoryStats([]);
    expect(st).toEqual({ count: 0, avg: null, median: null, sum: null });
  });
});

describe('bar chart stats overlay', () => {
  const geom = {
    isVert: true,
    orient: 'bottom',
    plotLeft: 40,
    plotTop: 10,
    plotRight: 200,
    plotBottom: 120,
    innerWPlot: 160,
    innerHPlot: 110,
    maxV: 40,
  };
  const stats = { count: 3, avg: 20, median: 10, sum: 60 };

  it('draws dashed avg and median lines when enabled', () => {
    const html = buildBarStatsOverlaySvg(
      stats,
      { showAvg: true, showMedian: true, showSum: false },
      geom,
      'compact',
      'Inter',
      '#fff',
    );
    expect(html).toContain('avg');
    expect(html).toContain('med');
    expect(html).toContain('stroke-dasharray');
    expect(html).not.toContain('Σ');
  });

  it('draws sum badge without a line', () => {
    const html = buildBarStatsOverlaySvg(
      stats,
      { showAvg: false, showMedian: false, showSum: true },
      geom,
      'compact',
      'Inter',
      '#fff',
    );
    expect(html).toContain('Σ');
    expect(html).not.toContain('stroke-dasharray');
  });

  it('draws vertical lines for horizontal bars', () => {
    const html = buildBarStatsOverlaySvg(
      stats,
      { showAvg: true, showMedian: false, showSum: false },
      { ...geom, isVert: false, orient: 'left' },
      'compact',
      'Inter',
      '#fff',
    );
    expect(html).toMatch(/x1="[^"]+" y1="10" x2="[^"]+" y2="120"/);
  });

  it('returns empty when all flags are off', () => {
    expect(
      buildBarStatsOverlaySvg(stats, { showAvg: false, showMedian: false, showSum: false }, geom),
    ).toBe('');
  });
});
