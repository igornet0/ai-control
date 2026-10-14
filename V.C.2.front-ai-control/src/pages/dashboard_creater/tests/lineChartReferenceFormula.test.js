import { describe, expect, it } from 'vitest';
import { compileFormula, mergeAggSpecsInOrder, toSqliteAggregations, buildKeyToAliasMap } from '../src/formula/compile.js';
import { normalizeLineConfig } from '../src/widgets/line-chart/lineChartConfig.js';
import {
  parsePlainNumberInput,
  validateScalarAggregateFormula,
  normalizeLineReference,
  normalizeLineReferences,
  collectReferenceNamedFormulas,
  applyResolvedReferenceFormulas,
  buildReferenceFromUiInput,
} from '../src/widgets/line-chart/lineChartReferenceFormula.js';
import { resolveChartMeasure } from '../src/widgets/common/chartBindingFormula.js';
import { referenceLineYValues } from '../src/widgets/line-chart/LineChartRenderer.js';

describe('scalar aggregate formulas (Formula API)', () => {
  const cases = [
    'SUM([table.a])',
    'SUM([table.a]) - SUM([table.b])',
    'SUM([table.a]) / SUM([table.b])',
    'SUM([table.a]) * 1.1',
    'AVG([table.a]) + 100',
  ];

  for (const src of cases) {
    it(`compiles and builds SQL aggs: ${src}`, () => {
      const { aggs, ast } = compileFormula(src);
      expect(ast).toBeTruthy();
      expect(aggs.length).toBeGreaterThanOrEqual(1);
      const v = validateScalarAggregateFormula(src);
      expect(v.ok).toBe(true);
      const merged = mergeAggSpecsInOrder([aggs]);
      const aliasMap = buildKeyToAliasMap(merged);
      const sqlite = toSqliteAggregations(merged, aliasMap, 'table');
      expect(sqlite.length).toBe(aggs.length);
    });
  }

  it('line measure rejects composite formula but marks scalarFormulaOk', () => {
    const r = resolveChartMeasure(
      {
        modelId: 1,
        table: 'sales',
        field: 'revenue',
        formula: 'SUM([sales.revenue]) - SUM([sales.expenses])',
      },
      { forLine: true },
    );
    expect(r?.sqlOk).toBe(false);
    expect(r?.scalarFormulaOk).toBe(true);
    expect(String(r?.error || '')).toMatch(/Reference|KPI|Gauge/i);
  });
});

describe('lineChartReferenceFormula', () => {
  it('parsePlainNumberInput', () => {
    expect(parsePlainNumberInput('150000')).toBe(150000);
    expect(parsePlainNumberInput('1,5')).toBe(1.5);
    expect(parsePlainNumberInput('SUM([t.x])')).toBeNull();
  });

  it('normalize constant number and formula', () => {
    const n = normalizeLineReference({ type: 'constant', value: 150000, label: 'T' }, 0);
    expect(n.value).toBe(150000);
    expect(n.valueFormula).toBe('');

    const f = normalizeLineReference(
      { type: 'target', valueFormula: 'SUM([sales.revenue]) * 1.1', label: 'Target' },
      1,
    );
    expect(f.valueFormula).toBe('SUM([sales.revenue]) * 1.1');
    expect(f.value).toBeNull();

    const legacy = normalizeLineReference({ type: 'constant', value: 'AVG([t.x])' }, 2);
    expect(legacy.valueFormula).toBe('AVG([t.x])');
  });

  it('normalize yMin/yMax formulas for band', () => {
    const band = normalizeLineReference({
      type: 'band',
      yMinFormula: 'SUM([t.a])',
      yMaxFormula: 'AVG([t.a]) * 0.8',
      label: 'Zone',
    });
    expect(band.type).toBe('band');
    expect(band.yMinFormula).toBe('SUM([t.a])');
    expect(band.yMaxFormula).toBe('AVG([t.a]) * 0.8');
  });

  it('collect + apply resolved formulas', () => {
    const refs = normalizeLineReferences([
      { id: 'r1', type: 'target', valueFormula: 'SUM([t.a]) * 1.1' },
      { id: 'r2', type: 'band', yMin: 10, yMaxFormula: 'AVG([t.a])' },
      { id: 'r3', type: 'constant', value: 42 },
    ]);
    const named = collectReferenceNamedFormulas(refs);
    expect(named.ref_r1_value).toBe('SUM([t.a]) * 1.1');
    expect(named.ref_r2_yMax).toBe('AVG([t.a])');
    expect(named.ref_r3_value).toBeUndefined();

    const resolved = applyResolvedReferenceFormulas(refs, {
      ref_r1_value: { numeric: 110 },
      ref_r2_yMax: { numeric: 50 },
    });
    expect(resolved[0].value).toBe(110);
    expect(resolved[0].valueFormula).toBe('SUM([t.a]) * 1.1');
    expect(resolved[1].yMax).toBe(50);
    expect(resolved[2].value).toBe(42);

    const ys = referenceLineYValues(resolved, {});
    expect(ys).toEqual(expect.arrayContaining([110, 10, 50, 42]));
  });

  it('buildReferenceFromUiInput number | formula | band', () => {
    const n = buildReferenceFromUiInput({
      type: 'target',
      valueRaw: '150000',
      yMaxRaw: '',
      label: 'Plan',
      color: '#f00',
    });
    expect(n.ok).toBe(true);
    expect(n.row.value).toBe(150000);
    expect(n.row.valueFormula).toBe('');

    const f = buildReferenceFromUiInput({
      type: 'target',
      valueRaw: 'SUM([sales.revenue]) * 1.1',
      yMaxRaw: '',
      label: 'Target',
      color: '#0f0',
    });
    expect(f.ok).toBe(true);
    expect(f.row.valueFormula).toBe('SUM([sales.revenue]) * 1.1');
    expect(f.row.value).toBeNull();

    const avg = buildReferenceFromUiInput({
      type: 'average',
      valueRaw: '',
      yMaxRaw: '',
      label: '',
      color: '#00f',
    });
    expect(avg.ok).toBe(true);
    expect(avg.row.type).toBe('average');

    const band = buildReferenceFromUiInput({
      type: 'band',
      valueRaw: '100000',
      yMaxRaw: 'SUM([sales.revenue])',
      label: 'Band',
      color: '#abc',
    });
    expect(band.ok).toBe(true);
    expect(band.row.type).toBe('band');
    expect(band.row.yMin).toBe(100000);
    expect(band.row.yMaxFormula).toBe('SUM([sales.revenue])');
  });

  it('normalizeLineConfig keeps formula fields on references', () => {
    const cfg = normalizeLineConfig({
      references: [
        { id: 't1', type: 'target', valueFormula: 'SUM([sales.revenue]) * 1.1', label: 'Target' },
        { id: 'b1', type: 'band', yMinFormula: 'AVG([sales.revenue]) * 0.8', yMax: 200000 },
      ],
    });
    expect(cfg.references[0].valueFormula).toBe('SUM([sales.revenue]) * 1.1');
    expect(cfg.references[1].yMinFormula).toBe('AVG([sales.revenue]) * 0.8');
    expect(cfg.references[1].yMax).toBe(200000);
  });
});
