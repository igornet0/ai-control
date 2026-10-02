import { describe, it, expect } from 'vitest';
import {
  dataModelHasApiUpdates,
  dashboardModelsSupportAutoRefresh,
  getDashboardAutoRefreshEnabled,
  buildLayoutConfigWithAutoRefresh,
  getDashboardAutoRefreshIntervalSec,
  normalizeLayoutConfig,
} from './dashboardAutoRefresh.js';

describe('dashboardAutoRefresh', () => {
  it('detects ingest tables on a model', () => {
    expect(dataModelHasApiUpdates(null)).toBe(false);
    expect(dataModelHasApiUpdates({ processing_config: {} })).toBe(false);
    expect(
      dataModelHasApiUpdates({
        processing_config: { ingest: { tables: { sales: { mode: 'snapshot' } } } },
      }),
    ).toBe(true);
    expect(dataModelHasApiUpdates({ processing_config: { ingest: { enabled: true } } })).toBe(true);
  });

  it('supports auto-refresh only when any linked model has API updates', () => {
    expect(dashboardModelsSupportAutoRefresh([])).toBe(false);
    expect(
      dashboardModelsSupportAutoRefresh([
        { processing_config: {} },
        { processing_config: { ingest: { tables: { t1: {} } } } },
      ]),
    ).toBe(true);
  });

  it('reads and merges auto_refresh in layout_config', () => {
    expect(getDashboardAutoRefreshEnabled(null)).toBe(false);
    expect(getDashboardAutoRefreshEnabled({ layout_config: { auto_refresh: true } })).toBe(true);
    expect(
      getDashboardAutoRefreshEnabled({ layout_config: '{"auto_refresh":true}' }),
    ).toBe(true);
    expect(
      buildLayoutConfigWithAutoRefresh({ layout_config: { theme: 'dark' } }, true),
    ).toEqual({ theme: 'dark', auto_refresh: true });
    expect(normalizeLayoutConfig('{"a":1}')).toEqual({ a: 1 });
    expect(getDashboardAutoRefreshIntervalSec({ refresh_interval: 120 })).toBe(120);
    expect(getDashboardAutoRefreshIntervalSec({})).toBe(30);
  });
});
