import { describe, expect, it, vi, beforeEach } from 'vitest';
import { isFormulaCacheV3 } from '../src/formula/formulaFeatures.js';
import {
  runNamedFormulaBundle,
  clearWidgetFormulaResultCache,
  buildNamedFormulaCacheKey,
} from '../src/formula/widgetFormulaRuntime.js';

vi.mock('../../../services/dashboardDataModel/DashboardDataModelClient.js', () => ({
  getDashboardDataModelClient: () => ({
    fetchAggregate: vi.fn(async () => ({
      rows: [{ k0: 42, k1: 42 }],
    })),
  }),
}));

vi.mock('../../../services/dashboardFilterUtils.js', () => ({
  collectDashboardFilters: () => [],
  filtersForModel: () => [],
}));

vi.mock('../../../services/dashboardQueryBump.js', () => ({
  getDashboardQueryBumpGeneration: () => 1,
}));

beforeEach(() => {
  clearWidgetFormulaResultCache();
  vi.clearAllMocks();
});

describe('runNamedFormulaBundle', () => {
  it('returns empty when no formulas', async () => {
    const out = await runNamedFormulaBundle({}, 1, 't', {}, null);
    expect(out.byId).toEqual({});
    expect(out.errors).toEqual({});
  });

  it('rejects FOR formulas in scalar bundle', async () => {
    const out = await runNamedFormulaBundle(
      {},
      1,
      'orders',
      { x: 'SUM([orders.qty]) FOR [orders.region_id]' },
      null,
    );
    expect(out.byId.x?.error || out.errors.x).toMatch(/FOR/);
    expect(out.byId.x?.numeric).toBeNull();
  });

  it('stable cache key for same named set', () => {
    const k1 = buildNamedFormulaCacheKey({}, 1, 't', { x: 'SUM([t.a])' }, null);
    const k2 = buildNamedFormulaCacheKey({}, 1, 't', { x: 'SUM([t.a])' }, null);
    expect(k1).toBe(k2);
    if (isFormulaCacheV3()) {
      const p1 = JSON.parse(k1);
      expect(p1.v).toBe(3);
      expect(typeof p1.c3?.bundle).toBe('string');
    }
  });
});
