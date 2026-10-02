/** @vitest-environment jsdom */

import { describe, expect, test } from 'vitest';
import { normalizeButtonStylePartial, resolveButtonDrawStyle } from '../src/widgets/button/ButtonItem.js';

describe('resolveButtonDrawStyle', () => {
  test('applies typography when shared/custom styles are empty', () => {
    const style = resolveButtonDrawStyle({
      typography: { color: '#112233', fontSize: 20, fontWeight: 700, fontFamily: 'Roboto' },
      defaultButtonStyle: {},
      buttonStyle: {},
      useCustomStyle: false,
    });
    expect(style.color).toBe('#112233');
    expect(style.fontSize).toBe(20);
    expect(style.fontWeight).toBe(700);
    expect(style.fontFamily).toContain('Roboto');
  });

  test('custom button style overrides shared and typography', () => {
    const style = resolveButtonDrawStyle({
      typography: { color: '#111111', fontSize: 12 },
      defaultButtonStyle: { background: '#2D6BFF', color: '#EEEEEE' },
      buttonStyle: { background: '#FF0000', color: '#00FF00' },
      useCustomStyle: true,
    });
    expect(style.background).toBe('#FF0000');
    expect(style.color).toBe('#00FF00');
  });

  test('ignores custom style when toggle is off', () => {
    const style = resolveButtonDrawStyle({
      typography: {},
      defaultButtonStyle: { background: '#2D6BFF' },
      buttonStyle: { background: '#FF0000' },
      useCustomStyle: false,
    });
    expect(style.background).toBe('#2D6BFF');
  });

  test('keeps color formulas on custom style', () => {
    const style = normalizeButtonStylePartial({
      background: '#FF0000',
      backgroundFormula: 'RGB(255,0,0)',
      colorFormula: 'IF([v]>0, RGB(0,255,0), RGB(255,0,0))',
    });
    expect(style.background).toBe('#FF0000');
    expect(style.backgroundFormula).toBe('RGB(255,0,0)');
    expect(style.colorFormula).toContain('IF(');
  });
});
