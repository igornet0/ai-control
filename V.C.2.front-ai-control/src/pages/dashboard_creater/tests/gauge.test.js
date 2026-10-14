import { describe, expect, it } from 'vitest';
import {
  buildGaugeTargetZones,
  createDefaultGaugeSettings,
  GAUGE_DEFAULT_TARGET_COLOR,
  normalizeGaugeSettings,
} from '../src/widgets/gauge/gaugeSettingsSchema.js';
import { buildGaugeMarkup } from '../src/widgets/gauge/gaugeRenderSvg.js';
import { resolveGaugeFillStyle } from '../src/widgets/gauge/gaugeColor.js';
import { formatGaugeDisplayValue } from '../src/widgets/gauge/gaugeFormatValue.js';
import { computeGaugeValue } from '../src/widgets/gauge/gaugeCompute.js';
import { hasDataBinding } from '../src/core/widgetDataBinding.js';

describe('buildGaugeMarkup full_circle', () => {
  it('track path is two semicircle arcs (SVG single 360° arc is invalid)', () => {
    const defs = createDefaultGaugeSettings();
    const html = buildGaugeMarkup({
      widgetId: 'gfc1',
      settings: normalizeGaugeSettings({ ...defs, gaugeStyleType: 'full_circle' }, { dataSource: null }),
      typography: {},
      dataBound: true,
      unboundHintHtml: '',
      displayText: '0',
      v: 0,
      percent: 0,
      normalized01: 0,
      computeError: '',
      box: { width: 220, height: 220 },
      interactionEnabled: false,
    });
    const m = html.match(/gauge-track" d="([^"]+)"/);
    expect(m).toBeTruthy();
    const d = m[1];
    expect((d.match(/ A /g) || []).length).toBe(2);
  });
});

describe('buildGaugeMarkup progress_bar', () => {
  it('renders horizontal bar markup with rounded rects and clip for fill', () => {
    const defs = createDefaultGaugeSettings();
    const html = buildGaugeMarkup({
      widgetId: 'pb1',
      settings: normalizeGaugeSettings(
        { ...defs, gaugeStyleType: 'progress_bar', progressBarCornerRadius: 12, thickness: 24 },
        { dataSource: null },
      ),
      typography: {},
      dataBound: true,
      unboundHintHtml: '',
      displayText: '50%',
      v: 50,
      percent: 50,
      normalized01: 0.5,
      computeError: '',
      box: { width: 240, height: 64 },
      interactionEnabled: false,
    });
    expect(html).toContain('gauge-wrapper--progress-bar');
    expect(html).toContain('gauge-progress-track');
    expect(html).toContain('gauge-progress-fill');
    expect(html).toContain('rx="12"');
    expect(html).toMatch(/clipPath id="[^"]+"/);
    expect(html).toContain('clip-path="url(#');
  });
});

describe('normalizeGaugeSettings', () => {
  it('legacy JSON: only dataSource infers field_value and sum aggregation', () => {
    const raw = { min: 0, max: 100, value: 5 };
    const out = normalizeGaugeSettings(raw, {
      dataSource: { modelId: 1, table: 'sales', field: 'amount' },
    });
    expect(out.valueSource).toBe('field_value');
    expect(out.aggregation).toBe('sum');
  });

  it('static inference when numeric value and no dataSource', () => {
    const out = normalizeGaugeSettings({ value: 7 }, { dataSource: null });
    expect(out.valueSource).toBe('static_value');
  });

  it('new gauge without field or values infers field_value', () => {
    const out = normalizeGaugeSettings({}, { dataSource: null });
    expect(out.valueSource).toBe('field_value');
  });

  it('normalizes valueNumberNotation', () => {
    expect(normalizeGaugeSettings({ valueNumberNotation: 'compact' }, { dataSource: null }).valueNumberNotation).toBe(
      'compact',
    );
    expect(normalizeGaugeSettings({ valueNumberNotation: 'bogus' }, { dataSource: null }).valueNumberNotation).toBe(
      'standard',
    );
  });

  it('migrates legacy targetValue/targetFormula into targets[]', () => {
    const out = normalizeGaugeSettings(
      { targetValue: 75, targetFormula: 'AVG([t.x])' },
      { dataSource: null },
    );
    expect(out.targets).toHaveLength(1);
    expect(out.targets[0].value).toBe(75);
    expect(out.targets[0].formula).toBe('AVG([t.x])');
    expect(out.targets[0].color).toBe(GAUGE_DEFAULT_TARGET_COLOR);
    expect(out.targets[0].label).toBe('Цель');
    expect(out.targetsPaintTrack).toBe(true);
  });

  it('keeps explicit targets and does not duplicate legacy fields', () => {
    const out = normalizeGaugeSettings(
      {
        targetValue: 10,
        targets: [{ id: 'a', value: 40, color: '#ef4444', label: 'A' }],
      },
      { dataSource: null },
    );
    expect(out.targets).toHaveLength(1);
    expect(out.targets[0].id).toBe('a');
    expect(out.targets[0].value).toBe(40);
  });
});

describe('buildGaugeTargetZones', () => {
  it('builds sorted zone segments min→t1→…→max', () => {
    const zones = buildGaugeTargetZones(0, 100, [
      { id: 'b', value: 60, color: '#22c55e' },
      { id: 'a', value: 20, color: '#ef4444' },
      { id: 'c', value: 40, color: '#f59e0b' },
    ]);
    expect(zones.map((z) => [z.from, z.to, z.color])).toEqual([
      [0, 20, '#ef4444'],
      [20, 40, '#f59e0b'],
      [40, 60, '#22c55e'],
      [60, 100, '#22c55e'],
    ]);
  });
});

describe('buildGaugeMarkup targets zones', () => {
  it('renders track zones and markers for arc', () => {
    const defs = createDefaultGaugeSettings();
    const html = buildGaugeMarkup({
      widgetId: 'gz1',
      settings: normalizeGaugeSettings(
        { ...defs, gaugeStyleType: 'arc', targetsPaintTrack: true },
        { dataSource: null },
      ),
      typography: {},
      dataBound: true,
      unboundHintHtml: '',
      displayText: '50%',
      v: 50,
      percent: 50,
      normalized01: 0.5,
      computeError: '',
      box: { width: 220, height: 220 },
      interactionEnabled: false,
      resolvedTargets: [
        { id: 't1', label: '20%', value: 20, color: '#ef4444' },
        { id: 't2', label: '60%', value: 60, color: '#22c55e' },
      ],
      scaleMin: 0,
      scaleMax: 100,
    });
    expect(html).toContain('gauge-track-zone');
    expect(html).toContain('gauge-target-marker');
    expect(html).toContain('data-target-id="t1"');
    expect(html).toContain('20%');
  });

  it('renders progress_bar zones and markers', () => {
    const defs = createDefaultGaugeSettings();
    const html = buildGaugeMarkup({
      widgetId: 'gzpb',
      settings: normalizeGaugeSettings(
        { ...defs, gaugeStyleType: 'progress_bar', targetsPaintTrack: true },
        { dataSource: null },
      ),
      typography: {},
      dataBound: true,
      unboundHintHtml: '',
      displayText: '40%',
      v: 40,
      percent: 40,
      normalized01: 0.4,
      computeError: '',
      box: { width: 240, height: 64 },
      interactionEnabled: false,
      resolvedTargets: [{ id: 'm', label: 'Цель', value: 50, color: '#f59e0b' }],
      scaleMin: 0,
      scaleMax: 100,
    });
    expect(html).toContain('gauge-progress-zone');
    expect(html).toContain('gauge-progress-zones');
    expect(html).toContain('gpb_track_clip_');
    expect(html).toContain('gauge-target-marker');
    expect(html).not.toContain('gauge-progress-track');
  });

  it('progress_bar zones use shared rounded track clip (not only left rounded)', () => {
    const defs = createDefaultGaugeSettings();
    const html = buildGaugeMarkup({
      widgetId: 'gzpb2',
      settings: normalizeGaugeSettings(
        {
          ...defs,
          gaugeStyleType: 'progress_bar',
          targetsPaintTrack: true,
          progressBarCornerRadius: 12,
        },
        { dataSource: null },
      ),
      typography: {},
      dataBound: true,
      unboundHintHtml: '',
      displayText: '100%',
      v: 100,
      percent: 100,
      normalized01: 1,
      computeError: '',
      box: { width: 240, height: 64 },
      interactionEnabled: false,
      resolvedTargets: [
        { id: 'a', label: 'A', value: 33, color: '#ef4444' },
        { id: 'b', label: 'B', value: 100, color: '#22c55e' },
      ],
      scaleMin: 0,
      scaleMax: 100,
    });
    expect(html).toMatch(/clipPath id="gpb_track_clip_[^"]+"/);
    // zone rects themselves should not carry per-segment rx (end looked square)
    expect(html).not.toMatch(/gauge-progress-zone"[^>]*\srx="/);
  });
});

describe('resolveGaugeFillStyle', () => {
  it('range mode picks matching rule by normalized 0–1', () => {
    const s = {
      fillColorMode: 'range',
      rangeColorRules: [
        { from: 0, to: 0.5, color: '#00ff00' },
        { from: 0.5, to: 1, color: '#ff0000' },
      ],
    };
    expect(resolveGaugeFillStyle(0.2, '#fff', s).strokeCss).toBe('#00ff00');
    expect(resolveGaugeFillStyle(0.8, '#fff', s).strokeCss).toBe('#ff0000');
  });
});

describe('formatGaugeDisplayValue', () => {
  it('percent of_range matches fill percent', () => {
    const s = { valueFormat: 'percent', valuePercentMode: 'of_range', valuePrecision: 0 };
    expect(formatGaugeDisplayValue(50, 0, 100, s)).toBe('50%');
  });

  it('compact number uses short scale for large values', () => {
    const s = {
      valueFormat: 'number',
      valuePrecision: 1,
      valueNumberNotation: 'compact',
      valueSuffix: '',
    };
    expect(formatGaugeDisplayValue(1500000, 0, 100, s)).toMatch(/1\.?5\s*M/i);
    const sSuffix = {
      ...s,
      valueSuffix: ' ₽',
    };
    expect(formatGaugeDisplayValue(1500000, 0, 100, sSuffix)).toMatch(/M.*₽/);
  });

  it('compact does not alter percent branch', () => {
    const s = {
      valueFormat: 'percent',
      valuePercentMode: 'of_range',
      valuePrecision: 0,
      valueNumberNotation: 'compact',
    };
    expect(formatGaugeDisplayValue(75, 0, 100, s)).toBe('75%');
  });
});

describe('hasDataBinding gauge', () => {
  it('false until field dropped or static number set', () => {
    expect(
      hasDataBinding({
        type: 'gauge',
        dataSource: null,
        settings: normalizeGaugeSettings({}, { dataSource: null }),
      }),
    ).toBe(false);
    expect(
      hasDataBinding({
        type: 'gauge',
        dataSource: null,
        settings: normalizeGaugeSettings(
          { valueSource: 'static_value', staticValue: 10 },
          { dataSource: null },
        ),
      }),
    ).toBe(true);
  });
});

describe('computeGaugeValue', () => {
  it('static_value returns staticValue / value without engine', async () => {
    const w = {
      dataSource: null,
      settings: { valueSource: 'static_value', staticValue: 12, value: 0 },
    };
    const r = await computeGaugeValue(null, w);
    expect(r.error).toBe('');
    expect(r.numeric).toBe(12);
  });
});
