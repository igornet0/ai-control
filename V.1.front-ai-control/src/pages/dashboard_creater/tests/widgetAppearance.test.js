// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { WidgetBase } from '../src/core/WidgetBase.js';
import { colorToRgba, parseColorRgb } from '../src/widgets/common/colorToRgba.js';

describe('colorToRgba', () => {
  it('parses hex forms', () => {
    expect(parseColorRgb('#fff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseColorRgb('#00e0ff')).toEqual({ r: 0, g: 224, b: 255 });
    expect(parseColorRgb('#00e0ff80')).toEqual({ r: 0, g: 224, b: 255 });
  });

  it('parses rgb()/rgba() with commas and spaces', () => {
    expect(parseColorRgb('rgb(1, 2, 3)')).toEqual({ r: 1, g: 2, b: 3 });
    expect(parseColorRgb('rgba(10 20 30 / 0.5)')).toEqual({ r: 10, g: 20, b: 30 });
  });

  it('builds rgba with clamped alpha', () => {
    expect(colorToRgba('#ffffff', 0.25)).toBe('rgba(255, 255, 255, 0.25)');
    expect(colorToRgba('#000', 5)).toBe('rgba(0, 0, 0, 1)');
    expect(colorToRgba('#000', -1)).toBe('rgba(0, 0, 0, 0)');
  });

  it('falls back to color-mix for named colors and to fallback for empty', () => {
    expect(colorToRgba('red', 0.5)).toBe('color-mix(in srgb, red 50%, transparent)');
    expect(colorToRgba('', 0.5, 'X')).toBe('X');
    expect(colorToRgba('transparent', 0.5, 'X')).toBe('X');
  });
});

function makeWidget(styles) {
  const w = new WidgetBase({ type: 'text', settings: {}, styles });
  const el = document.createElement('div');
  el.className = 'widget';
  el.innerHTML = '<div class="widget-content"></div>';
  w.element = el;
  w.styles = styles;
  return w;
}

describe('WidgetBase.applyStyles appearance', () => {
  it('applies variant and density classes, defaults to glass/normal', () => {
    const w = makeWidget({ appearance: { variant: 'outline', density: 'compact' } });
    w.applyStyles();
    expect(w.element.classList.contains('widget--variant-outline')).toBe(true);
    expect(w.element.classList.contains('widget--density-compact')).toBe(true);

    w.styles = { appearance: { variant: 'bogus' } };
    w.applyStyles();
    expect(w.element.classList.contains('widget--variant-outline')).toBe(false);
    expect(w.element.classList.contains('widget--variant-glass')).toBe(true);
    expect(w.element.classList.contains('widget--density-normal')).toBe(true);
    expect(w.element.classList.contains('widget--density-compact')).toBe(false);
  });

  it('resets inline background and opacity when settings are cleared', () => {
    const w = makeWidget({ appearance: { backgroundType: 'solid', backgroundColor: '#112233', opacity: 0.5 } });
    w.applyStyles();
    expect(w.element.style.background).not.toBe('');
    expect(w.element.style.opacity).toBe('0.5');

    w.styles = { appearance: {} };
    w.applyStyles();
    expect(w.element.style.background).toBe('');
    expect(w.element.style.opacity).toBe('');
  });

  it('keeps opacity 0 and applies glass background', () => {
    const w = makeWidget({
      appearance: { backgroundType: 'glass', glassColor: '#ffffff', glassOpacity: 0.2, glassBlur: 12, opacity: 0 },
    });
    w.applyStyles();
    expect(w.element.style.opacity).toBe('0');
    expect(w.element.style.background).toContain('rgba(255, 255, 255, 0.2)');
  });
});
