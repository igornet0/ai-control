import { describe, expect, it } from 'vitest';
import {
  normalizePieConfig,
  normalizePieValueDisplay,
  pieValueDisplayFlags,
} from '../src/widgets/pie-chart/pieChartConfig.js';

describe('pie value display', () => {
  it('maps flags to mode', () => {
    expect(normalizePieValueDisplay(undefined, true, false)).toBe('percent');
    expect(normalizePieValueDisplay(undefined, false, true)).toBe('value');
    expect(normalizePieValueDisplay(undefined, true, true)).toBe('both');
    expect(normalizePieValueDisplay(undefined, false, false)).toBe('none');
    expect(normalizePieValueDisplay('value', true, false)).toBe('value');
  });

  it('flags follow mode', () => {
    expect(pieValueDisplayFlags('percent')).toEqual({ showPercent: true, showValue: false });
    expect(pieValueDisplayFlags('value')).toEqual({ showPercent: false, showValue: true });
    expect(pieValueDisplayFlags('both')).toEqual({ showPercent: true, showValue: true });
    expect(pieValueDisplayFlags('none')).toEqual({ showPercent: false, showValue: false });
  });

  it('normalizePieConfig syncs labels.valueDisplay onto showPercent/showValue', () => {
    const cfg = normalizePieConfig({
      labels: { position: 'inside', valueDisplay: 'value' },
      legend: { valueDisplay: 'both' },
    });
    expect(cfg.labels.valueDisplay).toBe('value');
    expect(cfg.labels.showPercent).toBe(false);
    expect(cfg.labels.showValue).toBe(true);
    expect(cfg.legend.valueDisplay).toBe('both');
    expect(cfg.legend.showPercent).toBe(true);
    expect(cfg.legend.showValue).toBe(true);
  });
});
