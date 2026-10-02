import { describe, expect, it } from 'vitest';
import {
  clampAxisOffset,
  clampViewportOffset,
  offsetsForHomePoint,
  parseViewportHomeFromLayout,
  mergeViewportHomeIntoLayout,
} from '../src/core/viewportClamp.js';

describe('clampAxisOffset', () => {
  it('clamps when board is larger than viewport', () => {
    // board 20000, zoom 1, viewport 1000 → offset ∈ [-19000, 0]
    expect(clampAxisOffset(100, 1000, 20000, 1)).toBe(0);
    expect(clampAxisOffset(-500, 1000, 20000, 1)).toBe(-500);
    expect(clampAxisOffset(-25000, 1000, 20000, 1)).toBe(-19000);
  });

  it('centers when board is smaller than viewport', () => {
    // board 500 * zoom 1 = 500, viewport 1000 → center offset = 250
    expect(clampAxisOffset(0, 1000, 500, 1)).toBe(250);
    expect(clampAxisOffset(999, 1000, 500, 1)).toBe(250);
  });

  it('accounts for zoom', () => {
    // board 1000 * 2 = 2000, viewport 800 → offset ∈ [800-2000, 0] = [-1200, 0]
    expect(clampAxisOffset(-100, 800, 1000, 2)).toBe(-100);
    expect(clampAxisOffset(-2000, 800, 1000, 2)).toBe(-1200);
  });
});

describe('clampViewportOffset', () => {
  it('clamps both axes', () => {
    const next = clampViewportOffset(
      { offsetX: 50, offsetY: -99999, zoom: 1 },
      { width: 800, height: 600 },
      { width: 20000, height: 20000 },
    );
    expect(next.offsetX).toBe(0);
    expect(next.offsetY).toBe(600 - 20000);
  });
});

describe('offsetsForHomePoint / goHome math', () => {
  it('maps workspace origin to offset 0,0', () => {
    expect(offsetsForHomePoint(0, 0, 1)).toEqual({ offsetX: 0, offsetY: 0 });
  });

  it('maps home point under top-left of viewport', () => {
    expect(offsetsForHomePoint(100, 50, 2)).toEqual({ offsetX: -200, offsetY: -100 });
  });

  it('goHome then clamp keeps point in bounds', () => {
    const zoom = 1;
    const home = { x: 0, y: 0 };
    const off = offsetsForHomePoint(home.x, home.y, zoom);
    const clamped = clampViewportOffset(
      { ...off, zoom },
      { width: 1200, height: 800 },
      { width: 20000, height: 20000 },
    );
    expect(clamped.offsetX).toBe(0);
    expect(clamped.offsetY).toBe(0);
  });
});

describe('layout_config.viewport home', () => {
  it('parse defaults to 0,0', () => {
    expect(parseViewportHomeFromLayout(null)).toEqual({ x: 0, y: 0, zoom: null });
    expect(parseViewportHomeFromLayout({})).toEqual({ x: 0, y: 0, zoom: null });
  });

  it('parse reads viewport home', () => {
    expect(
      parseViewportHomeFromLayout({ viewport: { homeX: 120, homeY: 40, homeZoom: 1.5 } }),
    ).toEqual({ x: 120, y: 40, zoom: 1.5 });
  });

  it('merge preserves other layout keys', () => {
    const next = mergeViewportHomeIntoLayout(
      { theme: 'dark', viewport: { homeX: 1, homeY: 2 } },
      { x: 10, y: 20, zoom: null },
    );
    expect(next.theme).toBe('dark');
    expect(next.viewport).toEqual({ homeX: 10, homeY: 20, homeZoom: null });
  });
});
