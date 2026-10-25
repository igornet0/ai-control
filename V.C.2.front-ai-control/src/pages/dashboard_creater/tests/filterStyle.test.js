// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FILTER_STYLE,
  filterStyleClasses,
  filterStyleCssVars,
  normalizeFilterStyle,
} from '../src/widgets/filter/filterStyle.js';
import { FilterWidget } from '../src/widgets/FilterWidget.js';

describe('filterStyle', () => {
  it('returns defaults for empty / invalid input', () => {
    expect(normalizeFilterStyle(null)).toEqual({ ...DEFAULT_FILTER_STYLE });
    expect(normalizeFilterStyle({ variant: 'neon', size: 'xl', layout: 'grid' })).toEqual({
      ...DEFAULT_FILTER_STYLE,
    });
  });

  it('clamps numbers and validates accent', () => {
    const s = normalizeFilterStyle({ radius: 99, gap: -5, accent: '#ff00aa' });
    expect(s.radius).toBe(24);
    expect(s.gap).toBe(0);
    expect(s.accent).toBe('#FF00AA');
    expect(normalizeFilterStyle({ radius: -7 }).radius).toBe(-1);
    expect(normalizeFilterStyle({ accent: 'red' }).accent).toBe('');
    expect(normalizeFilterStyle({ radius: '6', gap: '12' })).toMatchObject({ radius: 6, gap: 12 });
  });

  it('builds classes and css vars', () => {
    expect(filterStyleClasses({ variant: 'glass', size: 'lg' })).toBe(
      'filter-widget--v-glass filter-widget--size-lg',
    );
    expect(filterStyleCssVars({})).toBe('--filter-gap:8px');
    expect(filterStyleCssVars({ accent: '#112233', radius: 0, gap: 4 })).toBe(
      '--filter-accent:#112233;--filter-radius:0px;--filter-gap:4px',
    );
  });
});

function mountFilter(settings) {
  const w = new FilterWidget({ settings: { filters: [], ...settings } });
  const el = document.createElement('div');
  el.innerHTML = '<div class="widget-content"></div>';
  w.element = el;
  w.render();
  return el.querySelector('.filter-widget');
}

describe('FilterWidget filterStyle render', () => {
  it('applies variant, size and vars to the shell', () => {
    const shell = mountFilter({
      filterStyle: { variant: 'pill', size: 'sm', accent: '#00AAFF', radius: 4, gap: 14 },
    });
    expect(shell.classList.contains('filter-widget--v-pill')).toBe(true);
    expect(shell.classList.contains('filter-widget--size-sm')).toBe(true);
    const style = shell.getAttribute('style');
    expect(style).toContain('--filter-accent:#00AAFF');
    expect(style).toContain('--filter-radius:4px');
    expect(style).toContain('--filter-gap:14px');
  });

  it('forced layout wins over size heuristic', () => {
    expect(mountFilter({ filterStyle: { layout: 'column' } }).classList.contains('filter-widget--layout-col')).toBe(
      true,
    );
    expect(mountFilter({ filterStyle: { layout: 'row' } }).classList.contains('filter-widget--layout-row')).toBe(
      true,
    );
  });

  it('defaults to soft/md for legacy widgets without filterStyle', () => {
    const shell = mountFilter({});
    expect(shell.classList.contains('filter-widget--v-soft')).toBe(true);
    expect(shell.classList.contains('filter-widget--size-md')).toBe(true);
  });
});
