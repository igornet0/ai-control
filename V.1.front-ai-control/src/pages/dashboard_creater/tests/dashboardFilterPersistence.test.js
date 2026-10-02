import { describe, expect, it, beforeEach, afterEach } from '@jest/globals';
import {
  cancelPersistDashboardFilters,
  filterPersistenceStorageKey,
  flushPersistDashboardFilters,
  loadDashboardFiltersFromLocalStorage,
  saveDashboardFiltersToLocalStorage,
  schedulePersistDashboardFilters,
} from '../../../services/dashboardFilterPersistence.js';
import { applyDashboardFilterSnapshot } from '../../../services/dashboardFilterUtils.js';

describe('dashboardFilterPersistence dashboard scope', () => {
  const dashId = 7;
  const sheetId = 42;
  const key = filterPersistenceStorageKey(dashId);

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('storage key is dashboard-scoped (not per sheet)', () => {
    expect(filterPersistenceStorageKey(dashId)).toBe(`dashboardUserFilters:${dashId}`);
    expect(filterPersistenceStorageKey(dashId, null, sheetId)).toBe(`dashboardUserFilters:${dashId}`);
  });

  it('save/load roundtrip keeps active filter fields for whole dashboard', () => {
    saveDashboardFiltersToLocalStorage(dashId, sheetId, {
      sheetId,
      fields: [{ key: 'm|t|status', modelId: 1, table: 't', field: 'status', values: ['cancelled'], selectedValues: ['cancelled'] }],
    });
    const loaded = loadDashboardFiltersFromLocalStorage(dashId, 99);
    expect(loaded?.fields?.[0]?.selectedValues).toEqual(['cancelled']);
    expect(localStorage.getItem(key)).toBeTruthy();
  });

  it('migrates legacy per-sheet key to dashboard key', () => {
    const legacy = `dashboardUserFilters:${dashId}:${sheetId}`;
    localStorage.setItem(
      legacy,
      JSON.stringify({
        sheetId,
        fields: [{ key: 'm|t|status', modelId: 1, table: 't', field: 'status', selectedValues: ['cancelled'] }],
      }),
    );
    const loaded = loadDashboardFiltersFromLocalStorage(dashId, sheetId);
    expect(loaded?.fields?.[0]?.selectedValues).toEqual(['cancelled']);
    expect(localStorage.getItem(key)).toBeTruthy();
  });

  it('schedule after destroy does not wipe dashboard filters', async () => {
    saveDashboardFiltersToLocalStorage(dashId, sheetId, {
      sheetId,
      fields: [{ key: 'm|t|status', modelId: 1, table: 't', field: 'status', selectedValues: ['cancelled'] }],
    });

    const engine = {
      dashboardId: dashId,
      _destroyed: false,
      widgetManager: {
        getAllWidgets: () => [{ type: 'filter', settings: { filters: [] } }],
      },
    };
    schedulePersistDashboardFilters(engine, sheetId, null, null);
    engine._destroyed = true;
    engine.widgetManager = { getAllWidgets: () => [] };

    await new Promise((r) => setTimeout(r, 450));
    expect(loadDashboardFiltersFromLocalStorage(dashId)?.fields?.[0]?.selectedValues).toEqual([
      'cancelled',
    ]);
  });

  it('flushPersist is no-op when engine already destroyed', () => {
    saveDashboardFiltersToLocalStorage(dashId, null, {
      fields: [{ key: 'm|t|status', modelId: 1, table: 't', field: 'status', selectedValues: ['cancelled'] }],
    });
    flushPersistDashboardFilters(
      { dashboardId: dashId, _destroyed: true, widgetManager: { getAllWidgets: () => [] } },
      sheetId,
      null,
      null,
    );
    expect(loadDashboardFiltersFromLocalStorage(dashId)?.fields?.[0]?.selectedValues).toEqual([
      'cancelled',
    ]);
  });

  it('cancelPersist clears pending timer', async () => {
    saveDashboardFiltersToLocalStorage(dashId, null, {
      fields: [{ key: 'm|t|status', modelId: 1, table: 't', field: 'status', selectedValues: ['cancelled'] }],
    });
    const engine = {
      dashboardId: dashId,
      _destroyed: false,
      widgetManager: { getAllWidgets: () => [] },
    };
    schedulePersistDashboardFilters(engine, sheetId, null, null);
    cancelPersistDashboardFilters(engine);
    expect(engine._filterPersistTimer).toBeNull();
    await new Promise((r) => setTimeout(r, 450));
    expect(loadDashboardFiltersFromLocalStorage(dashId)?.fields?.[0]?.selectedValues).toEqual([
      'cancelled',
    ]);
  });

  it('clearing filters writes empty marker and does not resurrect legacy', () => {
    const legacy = `dashboardUserFilters:${dashId}:${sheetId}`;
    localStorage.setItem(
      legacy,
      JSON.stringify({
        sheetId,
        fields: [
          {
            key: '1::t::status',
            modelId: 1,
            table: 't',
            field: 'status',
            selectedValues: ['cancelled'],
          },
        ],
      }),
    );
    saveDashboardFiltersToLocalStorage(dashId, sheetId, {
      fields: [
        {
          key: '1::t::status',
          modelId: 1,
          table: 't',
          field: 'status',
          selectedValues: ['cancelled'],
        },
      ],
    });
    expect(loadDashboardFiltersFromLocalStorage(dashId)?.fields?.[0]?.selectedValues).toEqual([
      'cancelled',
    ]);

    // Сброс
    saveDashboardFiltersToLocalStorage(dashId, sheetId, { fields: [] });
    expect(loadDashboardFiltersFromLocalStorage(dashId)).toBeNull();
    expect(localStorage.getItem(legacy)).toBeNull();
    expect(JSON.parse(localStorage.getItem(key)).fields).toEqual([]);
  });
});

describe('applyDashboardFilterSnapshot virtual rows', () => {
  it('puts unmatched active fields into __virtualDashboardFilters', () => {
    const engine = {
      widgetManager: {
        getAllWidgets: () => [],
        getWidget: () => null,
      },
      saveSnapshot: () => {},
    };
    applyDashboardFilterSnapshot(engine, {
      fields: [
        {
          key: '1|orders|status',
          modelId: 1,
          table: 'orders',
          field: 'status',
          type: 'string',
          selectedValues: ['cancelled'],
          excludedValues: [],
          pattern: '',
          displayLabel: 'STATUS',
        },
      ],
    });
    expect(engine.__virtualDashboardFilters).toHaveLength(1);
    expect(engine.__virtualDashboardFilters[0].selectedValues).toEqual(['cancelled']);
    expect(engine.__virtualDashboardFilters[0].field).toBe('status');
  });
});
