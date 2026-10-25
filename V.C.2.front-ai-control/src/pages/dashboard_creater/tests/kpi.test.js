import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  computeKpiSnapshot,
  stripDateFieldRangeFilters,
  clearKpiComputeQueryCache,
} from '../src/widgets/kpi/kpiCompute.js';
import {
  computePeriodRanges,
  computeComparisonRange,
  formatLocalYMD,
  parseLocalYMD,
  resolveKpiCurrentRange,
  resolveKpiDateRangeWithSource,
} from '../src/widgets/kpi/kpiPeriods.js';
import {
  formatKpiValue,
  formatDelta,
  formatPercentChange,
  chooseTrend,
  computePercentChange,
} from '../src/widgets/kpi/kpiFormat.js';
import { migrateKpiWidgetSettings } from '../src/widgets/KpiWidget.js';
import { buildSimpleFormula } from '../src/widgets/kpi/kpiBuildFormula.js';
import { aggregateSimpleWindowsSinglePass } from '../src/widgets/kpi/kpiBucketAggregate.js';
import {
  alignInclusiveRangeMs,
  autoGranularityFromDurationMs,
  bucket,
  computeComparisonRangeFromMs,
  computePreviousKpiWindowMs,
  formatAlignedRangeForSql,
  formatLocalSqlDateTimeEnd,
  formatLocalSqlDateTimeStart,
  inclusiveRangeToLocalMs,
  normalizeKpiPeriodShift,
  resolveEffectiveGranularity,
  shiftInclusiveRangeByGranularitySteps,
} from '../src/widgets/kpi/kpiGranularity.js';
import { buildSlidingPairWindowsFromAscUnique, resolveKpiWindowsForWidget } from '../src/widgets/kpi/kpiDataRange.js';
import { resolveKpiBackgroundCss, parseKpiBgRuleThresholdInput } from '../src/widgets/kpi/kpiBackgroundStyle.js';

describe('kpiPeriods', () => {
  it('day: current is today, previous is yesterday', () => {
    const now = new Date(2026, 4, 15); // May 15 2026 local
    const { current, previous } = computePeriodRanges('day', {}, now, 'previous');
    expect(current.start).toBe('2026-05-15');
    expect(current.end).toBe('2026-05-15');
    expect(previous.start).toBe('2026-05-14');
    expect(previous.end).toBe('2026-05-14');
  });

  it('month: March vs February (length differs)', () => {
    const now = new Date(2026, 2, 10); // Mar 10 2026
    const { current, previous } = computePeriodRanges('month', {}, now, 'previous');
    expect(current.start).toBe('2026-03-01');
    expect(current.end).toBe('2026-03-31');
    expect(previous.start).toBe('2026-02-01');
    expect(previous.end).toBe('2026-02-28');
  });

  it('custom: previous span matches inclusive length', () => {
    const now = new Date(2026, 0, 1);
    const { current, previous } = computePeriodRanges(
      'custom',
      { start: '2026-01-05', end: '2026-01-07' },
      now,
      'previous',
    );
    expect(current.start).toBe('2026-01-05');
    expect(current.end).toBe('2026-01-07');
    expect(previous.end).toBe('2026-01-04');
    expect(previous.start).toBe('2026-01-02');
  });

  it('previous_year shifts comparison range', () => {
    const cur = { start: '2026-03-01', end: '2026-03-31' };
    const prev = computeComparisonRange(cur, 'previous_year', {});
    expect(prev?.start).toBe('2025-03-01');
    expect(prev?.end).toBe('2025-03-31');
  });

  it('previous_period shifts by inclusive span', () => {
    const cur = { start: '2026-01-01', end: '2026-01-10' };
    const prev = computeComparisonRange(cur, 'previous_period', {});
    expect(prev?.end).toBe('2025-12-31');
    expect(prev?.start).toBe('2025-12-22');
  });

  it('resolveKpiCurrentRange uses gte/lte on date column', () => {
    const filters = [
      { table: 't', column: 'd', op: 'gte', value: '2026-01-05' },
      { table: 't', column: 'd', op: 'lte', value: '2026-01-10' },
    ];
    expect(resolveKpiCurrentRange(filters, 't', 'd', {})).toEqual({
      start: '2026-01-05',
      end: '2026-01-10',
    });
  });

  it('resolveKpiCurrentRange falls back to customRange', () => {
    expect(
      resolveKpiCurrentRange([], 't', 'd', { start: '2026-02-01', end: '2026-02-03' }),
    ).toEqual({ start: '2026-02-01', end: '2026-02-03' });
  });

  it('resolveKpiCurrentRange prefers global over customRange', () => {
    const filters = [
      { table: 't', column: 'd', op: 'gte', value: '2026-01-01' },
      { table: 't', column: 'd', op: 'lte', value: '2026-01-02' },
    ];
    expect(
      resolveKpiCurrentRange(filters, 't', 'd', { start: '2026-12-01', end: '2026-12-31' }),
    ).toEqual({ start: '2026-01-01', end: '2026-01-02' });
  });

  it('resolveKpiDateRangeWithSource classifies dashboard vs widget vs none', () => {
    const f = [
      { table: 't', column: 'd', op: 'gte', value: '2026-01-01' },
      { table: 't', column: 'd', op: 'lte', value: '2026-01-02' },
    ];
    expect(resolveKpiDateRangeWithSource(f, 't', 'd', { start: '2099-01-01', end: '2099-01-02' })).toEqual({
      source: 'dashboard',
      range: { start: '2026-01-01', end: '2026-01-02' },
    });
    expect(resolveKpiDateRangeWithSource([], 't', 'd', { start: '2026-03-01', end: '2026-03-03' })).toEqual({
      source: 'widget',
      range: { start: '2026-03-01', end: '2026-03-03' },
    });
    expect(resolveKpiDateRangeWithSource([], 't', 'd', {})).toEqual({ source: 'none', range: null });
  });
});

describe('kpiDataRange sliding windows', () => {
  it('buildSlidingPairWindows matches three-point story (01–02 vs 02–03)', () => {
    const d0 = new Date(2026, 0, 1).getTime();
    const d1 = new Date(2026, 0, 2).getTime();
    const d2 = new Date(2026, 0, 3).getTime();
    const { currentRange, previousRange } = buildSlidingPairWindowsFromAscUnique([d0, d1, d2]);
    expect(currentRange?.start).toBe('2026-01-02');
    expect(currentRange?.end).toBe('2026-01-03');
    expect(previousRange?.start).toBe('2026-01-01');
    expect(previousRange?.end).toBe('2026-01-02');
  });

  it('two points: previous null', () => {
    const d0 = new Date(2026, 0, 1).getTime();
    const d1 = new Date(2026, 0, 2).getTime();
    const { previousRange } = buildSlidingPairWindowsFromAscUnique([d0, d1]);
    expect(previousRange).toBe(null);
  });
});

describe('resolveKpiWindowsForWidget', () => {
  let mockRun;

  beforeEach(() => {
    mockRun = vi.fn(async (_engine, _modelId, body) => {
      if (body.mode === 'select') {
        return { rows: [{ ts: '2026-05-15' }] };
      }
      if (body.mode === 'aggregate') {
        return { rows: [{ c: 5 }] };
      }
      return { rows: [] };
    });
  });

  it('A: last_completed month uses month containing latest data point', async () => {
    const r = await resolveKpiWindowsForWidget(
      {
        engine: {},
        modelId: 1,
        table: 't',
        dateField: 'ts',
        globalFilters: [],
        customRange: { start: '2099-01-01', end: '2099-01-31' },
        periodMode: 'auto',
        deltaMode: 'previous_period',
        deltaCustomRange: {},
        granularitySetting: 'month',
      },
      { runDashboardModelQuery: mockRun },
    );
    expect(r.rangeSource).toBe('data_auto');
    expect(String(r.currentRange?.start)).toMatch(/^2026-05-01/);
    expect(String(r.currentRange?.end)).toMatch(/2026-05-31/);
    expect(String(r.previousRange?.start)).toMatch(/^2026-04-01/);
  });

  it('A2: month uses real max timestamp even if select rows are unsorted by time', async () => {
    const run = vi.fn(async (_engine, _modelId, body) => {
      if (body.mode === 'select') {
        // Имитируем некорректный порядок от SQL по TEXT-колонке даты:
        // первая строка хронологически раньше второй.
        return {
          rows: [
            { timestamp: '2026-06-30T23:59:00+00:00' },
            { timestamp: '2026-07-10T18:10:32+00:00' },
          ],
        };
      }
      if (body.mode === 'aggregate') return { rows: [{ c: 1 }] };
      return { rows: [] };
    });
    const r = await resolveKpiWindowsForWidget(
      {
        engine: {},
        modelId: 1,
        table: 'line_data_table',
        dateField: 'timestamp',
        globalFilters: [],
        customRange: {},
        periodMode: 'auto',
        deltaMode: 'previous_period',
        deltaCustomRange: {},
        granularitySetting: 'month',
      },
      { runDashboardModelQuery: run },
    );
    expect(r.rangeSource).toBe('data_auto');
    expect(String(r.currentRange?.start)).toMatch(/^2026-07-01/);
    expect(String(r.currentRange?.end)).toMatch(/2026-07-31/);
    expect(String(r.previousRange?.start)).toMatch(/^2026-06-01/);
    expect(String(r.previousRange?.end)).toMatch(/2026-06-30/);
  });

  it('B: dashboard date filter clips month bucket to dashboard window', async () => {
    const r = await resolveKpiWindowsForWidget(
      {
        engine: {},
        modelId: 1,
        table: 't',
        dateField: 'ts',
        globalFilters: [
          { table: 't', column: 'ts', op: 'gte', value: '2026-05-01' },
          { table: 't', column: 'ts', op: 'lte', value: '2026-05-10' },
        ],
        customRange: { start: '2099-01-01', end: '2099-01-02' },
        periodMode: 'auto',
        deltaMode: 'previous_period',
        deltaCustomRange: {},
        granularitySetting: 'month',
      },
      { runDashboardModelQuery: mockRun },
    );
    expect(r.rangeSource).toBe('dashboard');
    expect(r.currentRange).toEqual({
      start: '2026-05-01 00:00:00',
      end: '2026-05-10 23:59:59.999',
    });
  });

  it('C: periodMode fallback still uses latest-data month bucket', async () => {
    const r = await resolveKpiWindowsForWidget(
      {
        engine: {},
        modelId: 1,
        table: 't',
        dateField: 'ts',
        globalFilters: [],
        customRange: { start: '2026-03-01', end: '2026-03-31' },
        periodMode: 'fallback',
        deltaMode: 'previous_period',
        deltaCustomRange: {},
        granularitySetting: 'month',
      },
      { runDashboardModelQuery: mockRun },
    );
    expect(r.rangeSource).toBe('data_auto');
    expect(String(r.currentRange?.start)).toMatch(/^2026-05-01/);
    expect(String(r.currentRange?.end)).toMatch(/2026-05-31/);
  });

  it('E: granularity auto with minute-spaced data uses previous full day bucket', async () => {
    const run = vi.fn(async (_engine, _modelId, body) => {
      if (body.mode === 'select') {
        return {
          rows: [{ ts: '2026-05-15 12:35:00' }, { ts: '2026-05-15 12:34:00' }],
        };
      }
      if (body.mode === 'aggregate') {
        return { rows: [{ c: 1 }] };
      }
      return { rows: [] };
    });
    const r = await resolveKpiWindowsForWidget(
      {
        engine: {},
        modelId: 1,
        table: 't',
        dateField: 'ts',
        globalFilters: [],
        customRange: {},
        periodMode: 'auto',
        deltaMode: 'previous_period',
        deltaCustomRange: {},
        granularitySetting: 'auto',
      },
      { runDashboardModelQuery: run },
    );
    expect(r.rangeSource).toBe('data_auto');
    expect(String(r.currentRange?.start)).toMatch(/2026-05-14 00:00:00/);
    expect(String(r.currentRange?.end)).toMatch(/2026-05-14 23:59:59/);
  });
});

describe('buildSimpleFormula count modes', () => {
  it('rows mode uses COUNT(*)', () => {
    expect(buildSimpleFormula('count', 'amount', { countMode: 'rows' })).toBe('COUNT(*)');
  });

  it('non_null mode uses COUNT(field)', () => {
    expect(buildSimpleFormula('count', 'amount', { countMode: 'non_null' })).toBe('COUNT(amount)');
  });

  it('distinct mode uses COUNT_DISTINCT(field)', () => {
    expect(buildSimpleFormula('count', 'user_id', { countMode: 'distinct' })).toBe('COUNT_DISTINCT(user_id)');
  });
});

describe('kpiFormat', () => {
  it('formatKpiValue number with grouping', () => {
    const s = formatKpiValue(1234, { format: 'number', decimals: 0, compact: false });
    expect(s).toMatch(/1[,.]234/);
  });

  it('formatKpiValue compact uses k suffix', () => {
    const s = formatKpiValue(1234, { format: 'number', decimals: 1, compact: true });
    expect(s).toContain('k');
  });

  it('formatDelta signs', () => {
    expect(formatDelta(12, { compact: false, decimals: 0 })).toBe('+12');
    expect(formatDelta(-3, { compact: false, decimals: 0 })).toBe('-3');
    expect(formatDelta(0, {})).toBe('0');
  });

  it('computePercentChange edge cases', () => {
    expect(computePercentChange(0, 0)).toBe(0);
    expect(computePercentChange(5, 0)).toBe(null);
    expect(computePercentChange(10, 5)).toBe(100);
  });

  it('formatPercentChange null is infinity display', () => {
    expect(formatPercentChange(null)).toBe('∞');
  });

  it('chooseTrend', () => {
    expect(chooseTrend(1)).toBe('up');
    expect(chooseTrend(-2)).toBe('down');
    expect(chooseTrend(0)).toBe('neutral');
  });
});

describe('kpiCompute', () => {
  beforeEach(() => {
    clearKpiComputeQueryCache();
  });

  it('stripDateFieldRangeFilters removes gte/lte on date column', () => {
    const base = [
      { table: 't', column: 'd', op: 'gte', value: '2020-01-01' },
      { table: 't', column: 'd', op: 'lte', value: '2020-12-31' },
      { table: 't', column: 'x', op: 'eq', value: 1 },
    ];
    const out = stripDateFieldRangeFilters(base, 't', 'd');
    expect(out).toHaveLength(1);
    expect(out[0].column).toBe('x');
  });

  it('recomputes identical snapshot calls (memo moved to data client)', async () => {
    let calls = 0;
    const runQuery = async () => {
      calls += 1;
      return { rows: [{ t_0: 100, t_1: 5 }] };
    };
    const engine = {};
    const params = {
      engine,
      modelId: 1,
      table: 'sales',
      formula: 'SUM(amount) / COUNT(*)',
      dateField: 'dt',
      currentRange: { start: '2026-05-01', end: '2026-05-01' },
      previousRange: { start: '2026-04-01', end: '2026-04-01' },
    };
    const a = await computeKpiSnapshot(params, { runQuery });
    const b = await computeKpiSnapshot(params, { runQuery });
    expect(a.error).toBe('');
    expect(b.error).toBe('');
    expect(a.current).toBe(20);
    expect(b.current).toBe(20);
    expect(calls).toBe(4);
  });

  it('clearKpiComputeQueryCache is compatibility no-op', async () => {
    clearKpiComputeQueryCache();
    let calls = 0;
    const runQuery = async () => {
      calls += 1;
      return { rows: [{ t_0: 100, t_1: 5 }] };
    };
    const params = {
      engine: {},
      modelId: 1,
      table: 'sales',
      formula: 'SUM(amount) / COUNT(*)',
      dateField: 'dt',
      currentRange: { start: '2026-05-01', end: '2026-05-01' },
      previousRange: { start: '2026-04-01', end: '2026-04-01' },
    };
    await computeKpiSnapshot(params, { runQuery });
    expect(calls).toBe(2);
    await computeKpiSnapshot(params, { runQuery });
    expect(calls).toBe(4);
  });

  it('WHERE and $[...] aggregates run as separate queries with their own filters', async () => {
    const bodies = [];
    const runQuery = async (_e, _m, body) => {
      bodies.push(body);
      const alias = body.aggregations[0].as;
      const local = (body.filters || []).some((f) => f.column === 'region' && f.value === 'nw');
      const global = (body.filters || []).some((f) => f.column === 'channel');
      return { rows: [{ [alias]: local ? 25 : global ? 80 : 200 }] };
    };
    const snap = await computeKpiSnapshot(
      {
        engine: {},
        modelId: 1,
        table: 'orders',
        formula: "SUM([orders.amount] WHERE [orders.region] = 'nw') / SUM($[orders.amount])",
        globalFilters: [{ table: 'orders', column: 'channel', op: 'eq', value: 'web' }],
      },
      { runQuery },
    );
    expect(snap.error).toBe('');
    expect(bodies).toHaveLength(2);
    const ignored = bodies.find((b) => !(b.filters || []).some((f) => f.column === 'region'));
    expect(ignored.filters || []).toEqual([]);
    const local = bodies.find((b) => (b.filters || []).some((f) => f.column === 'region'));
    expect(local.filters.some((f) => f.column === 'channel')).toBe(true);
    expect(snap.current).toBeCloseTo(25 / 200);
  });

  it('delta and trend positive', async () => {
    const runQuery = async (_e, _m, body) => {
      const fs = body.filters || [];
      const gte = fs.find((f) => f.op === 'gte' && f.column === 'd');
      const v = gte?.value;
      if (String(v).startsWith('2026-01-02')) return { rows: [{ t_0: 120 }] };
      return { rows: [{ t_0: 100 }] };
    };
    const snap = await computeKpiSnapshot(
      {
        engine: {},
        modelId: 1,
        table: 't',
        formula: 'SUM(rev)',
        dateField: 'd',
        currentRange: { start: '2026-01-02', end: '2026-01-02' },
        previousRange: { start: '2026-01-01', end: '2026-01-01' },
      },
      { runQuery },
    );
    expect(snap.delta).toBe(20);
    expect(snap.trend).toBe('up');
    expect(snap.percent).toBe(20);
  });

  it('currentRange null runs single aggregate query', async () => {
    let calls = 0;
    const runQuery = async (_e, _m, body) => {
      calls += 1;
      const fs = body.filters || [];
      expect(fs.some((f) => f.column === 'd')).toBe(false);
      return { rows: [{ t_0: 42 }] };
    };
    const snap = await computeKpiSnapshot(
      {
        engine: {},
        modelId: 1,
        table: 't',
        formula: 'SUM(rev)',
        dateField: '',
        currentRange: null,
        previousRange: null,
      },
      { runQuery },
    );
    expect(calls).toBe(1);
    expect(snap.current).toBe(42);
    expect(snap.previous).toBe(null);
    expect(snap.delta).toBe(null);
  });

  it('previous query uses only explicit window (global date stripped)', async () => {
    const tMin = new Date('2026-05-10T00:00:00.000Z').getTime();
    const tMax = new Date('2026-05-12T23:59:59.999Z').getTime();
    const engine = {
      widgetManager: {
        getAllWidgets: () => [
          {
            type: 'line-chart',
            id: 'line1',
            settings: {
              dashboardBrushX: {
                modelId: 1,
                table: 't',
                field: 'd',
                fieldType: 'timestamp',
                xMin: tMin,
                xMax: tMax,
                useIsoBounds: true,
              },
            },
          },
        ],
      },
    };
    const seen = [];
    const runQuery = async (_e, _m, body) => {
      seen.push(body.filters || []);
      return { rows: [{ t_0: 1 }] };
    };
    await computeKpiSnapshot(
      {
        engine,
        modelId: 1,
        table: 't',
        formula: 'SUM(rev)',
        dateField: 'd',
        currentRange: { start: '2026-05-01', end: '2026-05-31' },
        previousRange: { start: '2026-04-01', end: '2026-04-30' },
      },
      { runQuery },
    );
    expect(seen).toHaveLength(2);
    const prev = seen[1];
    const gteD = prev.filter((f) => f.table === 't' && f.column === 'd' && f.op === 'gte');
    expect(gteD.length).toBe(1);
    expect(gteD[0].value).toBe('2026-04-01');
    expect(prev.some((f) => String(f.value || '').includes('2026-05-10'))).toBe(false);
  });

  it('formula SUM(line_data_table.value) keeps explicit month window filters', async () => {
    const seen = [];
    const runQuery = async (_e, _m, body) => {
      seen.push(body.filters || []);
      return { rows: [{ t_0: 405007.11841299996 }] };
    };
    const snap = await computeKpiSnapshot(
      {
        engine: {},
        modelId: 1,
        table: 'line_data_table',
        formula: 'SUM(line_data_table.value)',
        dateField: 'timestamp',
        currentRange: {
          start: '2026-07-01 00:00:00',
          end: '2026-07-31 23:59:59.999',
        },
        previousRange: null,
      },
      { runQuery },
    );
    expect(snap.error).toBe('');
    expect(snap.current).toBe(405007.11841299996);
    expect(seen).toHaveLength(1);
    const cur = seen[0];
    const gte = cur.find(
      (f) => f.table === 'line_data_table' && f.column === 'timestamp' && f.op === 'gte',
    );
    const lte = cur.find(
      (f) => f.table === 'line_data_table' && f.column === 'timestamp' && f.op === 'lte',
    );
    expect(gte?.value).toBe('2026-07-01 00:00:00');
    expect(lte?.value).toBe('2026-07-31 23:59:59.999');
  });
});

describe('migrateKpiWidgetSettings', () => {
  it('maps comparisonMode yoy and showPercent to deltaMode / deltaType', () => {
    const out = migrateKpiWidgetSettings(
      {
        valueFormula: '',
        comparisonMode: 'yoy',
        showDelta: false,
        showPercent: true,
      },
      {},
    );
    expect(out.deltaMode).toBe('previous_year');
    expect(out.deltaType).toBe('percent');
    expect(out.kpiMode).toBe('simple');
  });

  it('non-empty formula forces formula mode', () => {
    const out = migrateKpiWidgetSettings({ valueFormula: 'SUM(x)' }, {});
    expect(out.kpiMode).toBe('formula');
  });

  it('defaults granularity to auto and fixes invalid', () => {
    expect(migrateKpiWidgetSettings({}, {}).granularity).toBe('auto');
    expect(migrateKpiWidgetSettings({ granularity: 'bogus' }, {}).granularity).toBe('auto');
    expect(migrateKpiWidgetSettings({ granularity: 'hour' }, {}).granularity).toBe('hour');
  });

  it('defaults deltaDisplay to below and fixes invalid', () => {
    expect(migrateKpiWidgetSettings({}, {}).deltaDisplay).toBe('below');
    expect(migrateKpiWidgetSettings({ deltaDisplay: 'inline' }, {}).deltaDisplay).toBe('inline');
    expect(migrateKpiWidgetSettings({ deltaDisplay: 'hidden' }, {}).deltaDisplay).toBe('below');
    expect(migrateKpiWidgetSettings({ deltaDisplay: 'bogus' }, {}).deltaDisplay).toBe('below');
  });

  it('maps hidden deltaDisplay / showDelta=false to deltaEnabled=false', () => {
    expect(migrateKpiWidgetSettings({}, {}).deltaEnabled).toBe(true);
    expect(migrateKpiWidgetSettings({ deltaDisplay: 'hidden' }, {}).deltaEnabled).toBe(false);
    expect(migrateKpiWidgetSettings({ showDelta: false }, {}).deltaEnabled).toBe(false);
    expect(migrateKpiWidgetSettings({ deltaEnabled: false }, {}).deltaEnabled).toBe(false);
    expect(migrateKpiWidgetSettings({ deltaEnabled: true, deltaDisplay: 'hidden' }, {}).deltaEnabled).toBe(true);
  });

  it('normalizes deltaColor and deltaColorFormula', () => {
    expect(migrateKpiWidgetSettings({}, {}).deltaColor).toBe('');
    expect(migrateKpiWidgetSettings({ deltaColor: '#4ade80' }, {}).deltaColor).toBe('#4ade80');
    expect(migrateKpiWidgetSettings({ deltaColor: 'nope' }, {}).deltaColor).toBe('');
    expect(
      migrateKpiWidgetSettings({ deltaColorFormula: ' IF([delta]>0, RGB(1,2,3), RGB(4,5,6)) ' }, {})
        .deltaColorFormula,
    ).toBe('IF([delta]>0, RGB(1,2,3), RGB(4,5,6))');
  });

  it('defaults periodMode to auto and fixes invalid', () => {
    expect(migrateKpiWidgetSettings({}, {}).periodMode).toBe('auto');
    expect(migrateKpiWidgetSettings({ periodMode: 'fallback' }, {}).periodMode).toBe('fallback');
    expect(migrateKpiWidgetSettings({ periodMode: 'bogus' }, {}).periodMode).toBe('auto');
  });

  it('normalizes periodShift to non-negative integer (default 0)', () => {
    expect(migrateKpiWidgetSettings({}, {}).periodShift).toBe(0);
    expect(migrateKpiWidgetSettings({ periodShift: 3 }, {}).periodShift).toBe(3);
    expect(migrateKpiWidgetSettings({ periodShift: -2 }, {}).periodShift).toBe(0);
    expect(migrateKpiWidgetSettings({ periodShift: '12' }, {}).periodShift).toBe(12);
    expect(normalizeKpiPeriodShift('')).toBe(0);
  });

  it('shiftInclusiveRangeByGranularitySteps moves window back by N steps', () => {
    const cur = inclusiveRangeToLocalMs('2026-03-01', '2026-03-31');
    expect(cur).not.toBeNull();
    const a = alignInclusiveRangeMs(cur.loMs, cur.hiMs, 'month');
    const s0 = shiftInclusiveRangeByGranularitySteps(a.loMs, a.hiMs, 'month', 0);
    expect(s0.loMs).toBe(a.loMs);
    expect(s0.hiMs).toBe(a.hiMs);
    const s1 = shiftInclusiveRangeByGranularitySteps(a.loMs, a.hiMs, 'month', 1);
    expect(formatLocalYMD(new Date(s1.loMs))).toBe('2026-02-01');
    expect(formatLocalYMD(new Date(s1.hiMs))).toBe('2026-02-28');
    const s2 = shiftInclusiveRangeByGranularitySteps(a.loMs, a.hiMs, 'month', 2);
    expect(formatLocalYMD(new Date(s2.loMs))).toBe('2026-01-01');
    expect(formatLocalYMD(new Date(s2.hiMs))).toBe('2026-01-31');

    const day = inclusiveRangeToLocalMs('2026-05-10', '2026-05-10');
    const d1 = shiftInclusiveRangeByGranularitySteps(day.loMs, day.hiMs, 'day', 3);
    expect(formatLocalYMD(new Date(d1.loMs))).toBe('2026-05-07');
    expect(formatLocalYMD(new Date(d1.hiMs))).toBe('2026-05-07');
  });

  it('D: leaves empty customRange when no stored range (no auto-fill current month)', () => {
    const out = migrateKpiWidgetSettings({}, {});
    expect(out.customRange).toEqual({ start: '', end: '' });
  });

  it('normalizes format / decimals / compact', () => {
    expect(migrateKpiWidgetSettings({}, {}).format).toBe('number');
    expect(migrateKpiWidgetSettings({ format: 'bogus' }, {}).format).toBe('number');
    expect(migrateKpiWidgetSettings({ format: 'currency' }, {}).format).toBe('currency');
    expect(migrateKpiWidgetSettings({ decimals: '3' }, {}).decimals).toBe(3);
    expect(migrateKpiWidgetSettings({ decimals: -1 }, {}).decimals).toBe(0);
    expect(migrateKpiWidgetSettings({}, {}).numberCompact).toBe(true);
    expect(migrateKpiWidgetSettings({ numberCompact: false }, {}).numberCompact).toBe(false);
  });
});

describe('kpiGranularity', () => {
  it('autoGranularityFromDurationMs picks coarser steps for longer spans', () => {
    expect(autoGranularityFromDurationMs(3600000)).toBe('minute'); // 1h
    expect(autoGranularityFromDurationMs(86400000)).toBe('day'); // 1d
    expect(autoGranularityFromDurationMs(3 * 86400000)).toBe('day');
    expect(autoGranularityFromDurationMs(30 * 86400000)).toBe('week');
    expect(autoGranularityFromDurationMs(120 * 86400000)).toBe('month');
    expect(autoGranularityFromDurationMs(500 * 86400000)).toBe('month');
  });

  it('formatAlignedRangeForSql: end bound has ms for lte; start without .000 when ms=0', () => {
    const lo = new Date(2026, 4, 15, 12, 34, 0, 0).getTime();
    const hi = new Date(2026, 4, 15, 12, 34, 59, 999).getTime();
    const r = formatAlignedRangeForSql(lo, hi);
    expect(r.start).toBe('2026-05-15 12:34:00');
    expect(r.end).toBe('2026-05-15 12:34:59.999');
    expect(formatLocalSqlDateTimeStart(new Date(2026, 4, 15, 12, 34, 0, 1))).toMatch(/\.001$/);
    expect(formatLocalSqlDateTimeEnd(new Date(2026, 4, 15, 0, 0, 0, 0))).toBe('2026-05-15 00:00:00.000');
  });

  it('resolveEffectiveGranularity respects fixed setting', () => {
    expect(resolveEffectiveGranularity('week', 0, 86400000)).toBe('week');
    expect(resolveEffectiveGranularity('auto', 0, 86400000)).toBe('day');
  });

  it('computePreviousKpiWindowMs: month → previous calendar month', () => {
    const cur = inclusiveRangeToLocalMs('2026-03-01', '2026-03-31');
    expect(cur).not.toBeNull();
    const a = alignInclusiveRangeMs(cur.loMs, cur.hiMs, 'month');
    const prev = computePreviousKpiWindowMs(a.loMs, a.hiMs, 'month', 'previous_period', {});
    expect(prev).not.toBeNull();
    expect(formatLocalYMD(new Date(prev.loMs))).toBe('2026-02-01');
    expect(formatLocalYMD(new Date(prev.hiMs))).toBe('2026-02-28');
  });

  it('computePreviousKpiWindowMs shift: 10-day filter → previous 10 days', () => {
    const cur = inclusiveRangeToLocalMs('2026-05-01', '2026-05-10');
    expect(cur).not.toBeNull();
    const prev = computePreviousKpiWindowMs(
      cur.loMs,
      cur.hiMs,
      'month',
      'previous_period',
      {},
      { mode: 'shift' },
    );
    expect(prev).not.toBeNull();
    expect(formatLocalYMD(new Date(prev.loMs))).toBe('2026-04-21');
    expect(formatLocalYMD(new Date(prev.hiMs))).toBe('2026-04-30');
  });

  it('bucket floors to local bucket start', () => {
    const d = new Date(2026, 4, 2, 14, 37, 22, 333);
    expect(bucket(d, 'minute').getTime()).toBe(new Date(2026, 4, 2, 14, 37, 0, 0).getTime());
    expect(bucket(d, 'hour').getTime()).toBe(new Date(2026, 4, 2, 14, 0, 0, 0).getTime());
    expect(bucket(d, 'day').getTime()).toBe(new Date(2026, 4, 2, 0, 0, 0, 0).getTime());
    expect(bucket(d, 'month').getTime()).toBe(new Date(2026, 4, 1, 0, 0, 0, 0).getTime());
  });

  it('alignInclusiveRangeMs expands YMD window to full day buckets', () => {
    const { loMs, hiMs } = inclusiveRangeToLocalMs('2026-01-05', '2026-01-06');
    const a = alignInclusiveRangeMs(loMs, hiMs, 'day');
    expect(a.loMs).toBe(loMs);
    expect(a.hiMs).toBe(new Date(2026, 0, 6, 23, 59, 59, 999).getTime());
  });

  it('computeComparisonRangeFromMs previous_period matches duration', () => {
    const cur = inclusiveRangeToLocalMs('2026-01-10', '2026-01-12');
    expect(cur).not.toBeNull();
    const prev = computeComparisonRangeFromMs(cur.loMs, cur.hiMs, 'previous_period', {});
    expect(prev).not.toBeNull();
    const durCur = cur.hiMs - cur.loMs + 1;
    const durPrev = prev.hiMs - prev.loMs + 1;
    expect(durPrev).toBe(durCur);
    expect(prev.hiMs).toBe(cur.loMs - 1);
  });
});

describe('aggregateSimpleWindowsSinglePass', () => {
  it('COUNT counts rows with valid date even if value is null', () => {
    const rows = [
      { d: '2026-01-10 12:00:00', v: 1 },
      { d: '2026-01-10 13:00:00', v: null },
    ];
    const curLo = new Date(2026, 0, 10, 0, 0, 0, 0).getTime();
    const curHi = new Date(2026, 0, 10, 23, 59, 59, 999).getTime();
    const { current } = aggregateSimpleWindowsSinglePass(rows, 'd', 'v', 'count', curLo, curHi, 0, 0, 'day');
    expect(current).toBe(2);
  });
});

describe('parseLocalYMD / formatLocalYMD round-trip', () => {
  it('round-trip', () => {
    const d = parseLocalYMD('2026-02-28');
    expect(formatLocalYMD(d)).toBe('2026-02-28');
  });
});

describe('kpiBackgroundStyle', () => {
  it('solid mode uses backgroundColor', () => {
    expect(resolveKpiBackgroundCss({ backgroundColor: '#112233', kpiBackgroundMode: 'solid' }, 50)).toBe(
      '#112233',
    );
  });

  it('rules mode picks first matching rule', () => {
    const st = {
      backgroundColor: '#000000',
      kpiBackgroundMode: 'rules',
      kpiBackgroundDefaultColor: '#999999',
      kpiBackgroundRules: [
        { op: 'lt', value: 10, value2: 0, color: '#ff0000' },
        { op: 'gte', value: 10, value2: 0, color: '#00ff00' },
      ],
    };
    expect(resolveKpiBackgroundCss(st, 5)).toBe('#ff0000');
    expect(resolveKpiBackgroundCss(st, 15)).toBe('#00ff00');
  });

  it('rules mode no match returns default color', () => {
    const st = {
      backgroundColor: '#000000',
      kpiBackgroundMode: 'rules',
      kpiBackgroundDefaultColor: '#abcdef',
      kpiBackgroundRules: [{ op: 'gt', value: 100, value2: 0, color: '#111111' }],
    };
    expect(resolveKpiBackgroundCss(st, 50)).toBe('#abcdef');
  });

  it('uses resolved numeric threshold when valueFormula is set', () => {
    const st = {
      backgroundColor: '#000',
      kpiBackgroundMode: 'rules',
      kpiBackgroundDefaultColor: '#999999',
      kpiBackgroundRules: [
        { op: 'gte', value: 0, value2: 0, valueFormula: 'SUM(x)', color: '#00ff00' },
      ],
    };
    expect(resolveKpiBackgroundCss(st, 15, [{ value: 10, value2: 0 }])).toBe('#00ff00');
    expect(resolveKpiBackgroundCss(st, 5, [{ value: 10, value2: 0 }])).toBe('#999999');
    expect(resolveKpiBackgroundCss(st, 15, null)).toBe('#999999');
  });

  it('delta mode: negative / positive / zero / missing delta', () => {
    const st = {
      backgroundColor: '#000000',
      kpiBackgroundMode: 'delta',
      kpiBackgroundDefaultColor: '#333333',
      kpiBackgroundDeltaNegativeColor: '#ff0000',
      kpiBackgroundDeltaPositiveColor: '#00ff00',
    };
    expect(resolveKpiBackgroundCss(st, 100, null, -5)).toBe('#ff0000');
    expect(resolveKpiBackgroundCss(st, 100, null, 3)).toBe('#00ff00');
    expect(resolveKpiBackgroundCss(st, 100, null, 0)).toBe('#333333');
    expect(resolveKpiBackgroundCss(st, 100, null, null)).toBe('#333333');
  });

  it('delta mode: default colors when settings omit hex', () => {
    const st = {
      backgroundColor: '#000000',
      kpiBackgroundMode: 'delta',
      kpiBackgroundDefaultColor: 'transparent',
    };
    expect(resolveKpiBackgroundCss(st, 1, null, -1)).toBe('#c62828');
    expect(resolveKpiBackgroundCss(st, 1, null, 1)).toBe('#2e7d32');
  });
});

describe('parseKpiBgRuleThresholdInput', () => {
  it('parses plain number string as literal', () => {
    expect(parseKpiBgRuleThresholdInput('100')).toEqual({ value: 100, valueFormula: '' });
    expect(parseKpiBgRuleThresholdInput('-3.5')).toEqual({ value: -3.5, valueFormula: '' });
  });

  it('treats non-numeric text as formula', () => {
    expect(parseKpiBgRuleThresholdInput('SUM(revenue)')).toEqual({ value: 0, valueFormula: 'SUM(revenue)' });
  });
});
