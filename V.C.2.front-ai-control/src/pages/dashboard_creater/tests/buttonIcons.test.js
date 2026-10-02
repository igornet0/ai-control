/** @vitest-environment jsdom */

import { describe, expect, test } from 'vitest';
import {
  BUTTON_ICON_OPTIONS,
  drawButtonIcon,
  getButtonIconLabel,
  getButtonIconSvg,
  hasButtonIcon,
} from '../src/widgets/button/buttonIcons.js';

describe('buttonIcons', () => {
  test('catalog includes none + many svg icons', () => {
    expect(BUTTON_ICON_OPTIONS[0]).toMatchObject({ id: '', label: 'Нет' });
    expect(BUTTON_ICON_OPTIONS.length).toBeGreaterThan(30);
    expect(BUTTON_ICON_OPTIONS.every((opt) => typeof opt.svg === 'string' && opt.svg.includes('<svg'))).toBe(true);
  });

  test('known and aliased ids resolve', () => {
    expect(hasButtonIcon('arrow')).toBe(true);
    expect(hasButtonIcon('filter')).toBe(true);
    expect(hasButtonIcon('close')).toBe(true); // alias -> cross
    expect(hasButtonIcon('not_a_real_icon')).toBe(false);
    expect(getButtonIconLabel('settings')).toBe('Настройки');
    expect(getButtonIconSvg('play')).toContain('viewBox="0 0 24 24"');
  });

  test('drawButtonIcon strokes without throwing when Path2D exists', () => {
    if (typeof Path2D === 'undefined') return;
    const calls = { save: 0, restore: 0, stroke: 0 };
    const ctx = {
      save: () => { calls.save += 1; },
      restore: () => { calls.restore += 1; },
      translate() {},
      scale() {},
      stroke() { calls.stroke += 1; },
      fill() {},
      beginPath() {},
      arc() {},
      strokeStyle: '',
      fillStyle: '',
      lineWidth: 1,
      lineCap: '',
      lineJoin: '',
    };
    expect(drawButtonIcon(ctx, 'arrow', 0, 0, 16, '#fff')).toBe(true);
    expect(calls.save).toBe(1);
    expect(calls.restore).toBe(1);
    expect(calls.stroke).toBeGreaterThan(0);
  });
});
