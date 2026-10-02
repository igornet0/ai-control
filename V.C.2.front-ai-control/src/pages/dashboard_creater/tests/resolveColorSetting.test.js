import { describe, expect, it } from 'vitest';
import {
  normalizeHexColor,
  resolveColorSetting,
  resolveColorSettingSync,
} from '../src/widgets/common/resolveColorSetting.js';
import { normalizeWidgetTitleSettings, widgetTitleInlineStyle } from '../src/widgets/common/widgetTitle.js';

describe('resolveColorSetting', () => {
  it('uses hex when formula is empty', () => {
    expect(resolveColorSettingSync({ hex: '#112233', formula: '' })).toBe('#112233');
    expect(resolveColorSettingSync({ hex: '#abc', formula: '  ' })).toBe('#aabbcc');
  });

  it('evaluates local IF/RGB color-AST', () => {
    const hex = resolveColorSettingSync({
      hex: '#000000',
      formula: 'IF([delta] > 0, RGB(74, 222, 128), RGB(255, 107, 107))',
      fieldValues: { delta: 3, value: 10 },
    });
    expect(hex.toLowerCase()).toBe('#4ade80');
  });

  it('accepts bare #hex in formula text', () => {
    expect(resolveColorSettingSync({ hex: '#111111', formula: '#FF00AA' }).toUpperCase()).toBe(
      '#FF00AA',
    );
  });

  it('falls back to hex when AST fails without engine', async () => {
    const hex = await resolveColorSetting({
      hex: '#abcdef',
      formula: 'SUM([t.x])',
      engine: null,
    });
    expect(hex.toLowerCase()).toBe('#abcdef');
  });

  it('normalizeHexColor expands short hex', () => {
    expect(normalizeHexColor('#0f8')).toBe('#00ff88');
  });
});

describe('widgetTitle titleColorFormula', () => {
  it('normalizes and keeps titleColorFormula', () => {
    const s = normalizeWidgetTitleSettings({
      showTitle: true,
      title: 'T',
      titleColor: '#112233',
      titleColorFormula: ' RGB(1,2,3) ',
    });
    expect(s.titleColorFormula).toBe('RGB(1,2,3)');
    expect(s.titleColor).toBe('#112233');
  });

  it('inline style prefers resolvedColor', () => {
    const style = widgetTitleInlineStyle(
      { showTitle: true, titleSize: 14, titleColor: '#111111' },
      { resolvedColor: '#AABBCC' },
    );
    expect(style).toContain('color:#AABBCC');
  });
});
