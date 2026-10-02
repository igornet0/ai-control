import { describe, expect, it, vi } from 'vitest';
import { DashboardFilterStore } from '../../../services/dashboardFilterStore.js';
import {
  commitDashboardFilterTransportChange,
  getDashboardFilterSnapshot,
  invalidateDashboardTransportCaches,
  reloadDashboardDataWidgetsWithSnapshot,
} from '../../../services/dashboardFilterTransport.js';
import { getDashboardQueryBumpGeneration } from '../../../services/dashboardQueryBump.js';

function makeEngine(widgets) {
  return {
    widgetManager: {
      getAllWidgets: () => widgets,
    },
    filterStore: new DashboardFilterStore(),
  };
}

describe('dashboardFilterTransport', () => {
  it('builds snapshot with predicatesByModelId and revision', () => {
    const widgets = [
      {
        id: 'f1',
        type: 'filter',
        settings: {
          filters: [
            {
              id: 'row1',
              modelId: 1,
              table: 'line_data_table',
              field: 'category',
              type: 'string',
              selectedValues: ['A'],
              excludedValues: [],
              pattern: '',
            },
          ],
        },
      },
    ];
    const engine = makeEngine(widgets);
    const snap1 = getDashboardFilterSnapshot(engine, { force: true });
    const rows1 = snap1.predicatesByModelId.get('1') || [];
    expect(rows1).toHaveLength(1);
    expect(rows1[0]).toEqual({
      table: 'line_data_table',
      column: 'category',
      op: 'in',
      values: ['A'],
    });
    const snap2 = getDashboardFilterSnapshot(engine, { force: true });
    expect(snap2.revision).toBe(snap1.revision + 1);
  });

  it('reload by-model uses default fallbackAll=false when changedModelIds non-empty (skip unrelated models)', async () => {
    const wHit = {
      id: 'kpi1',
      type: 'kpi',
      dataSource: { modelId: 1, table: 'line_data_table' },
      reloadFromDataModel: vi.fn(async () => {}),
    };
    const wMiss = {
      id: 'kpi2',
      type: 'kpi',
      dataSource: { modelId: 2, table: 'other_table' },
      reloadFromDataModel: vi.fn(async () => {}),
    };
    const engine = makeEngine([
      {
        id: 'f1',
        type: 'filter',
        settings: {
          filters: [
            {
              id: 'row1',
              modelId: 1,
              table: 'line_data_table',
              field: 'category',
              type: 'string',
              selectedValues: ['A'],
              excludedValues: [],
              pattern: '',
            },
          ],
        },
      },
      wHit,
      wMiss,
    ]);
    getDashboardFilterSnapshot(engine, { force: true });
    engine.widgetManager.getAllWidgets()[0].settings.filters[0].selectedValues = ['B'];
    const snap = getDashboardFilterSnapshot(engine, { force: true });
    expect(Array.isArray(snap.changedModelIds) && snap.changedModelIds.includes('1')).toBe(true);
    await reloadDashboardDataWidgetsWithSnapshot(engine, snap, {
      strategy: 'by-model',
    });
    expect(wHit.reloadFromDataModel).toHaveBeenCalledTimes(1);
    expect(wMiss.reloadFromDataModel).not.toHaveBeenCalled();
  });

  it('reload by model refreshes only impacted widgets', async () => {
    const w1 = {
      id: 'kpi1',
      type: 'kpi',
      dataSource: { modelId: 1, table: 'line_data_table' },
      reloadFromDataModel: vi.fn(async () => {}),
    };
    const w2 = {
      id: 'kpi2',
      type: 'kpi',
      dataSource: { modelId: 2, table: 'other_table' },
      reloadFromDataModel: vi.fn(async () => {}),
    };
    const filter = {
      id: 'f1',
      type: 'filter',
      settings: {
        filters: [
          {
            id: 'row1',
            modelId: 1,
            table: 'line_data_table',
            field: 'category',
            type: 'string',
            selectedValues: ['A'],
            excludedValues: [],
            pattern: '',
          },
        ],
      },
    };
    const engine = makeEngine([filter, w1, w2]);
    getDashboardFilterSnapshot(engine, { force: true });
    filter.settings.filters[0].selectedValues = ['B'];
    const snap = getDashboardFilterSnapshot(engine, { force: true });
    await reloadDashboardDataWidgetsWithSnapshot(engine, snap, {
      strategy: 'by-model',
      fallbackAll: false,
    });
    expect(w1.reloadFromDataModel).toHaveBeenCalledTimes(1);
    expect(w2.reloadFromDataModel).toHaveBeenCalledTimes(0);
  });

  it('reload by-model with empty changedModelIds and fallbackAll refreshes bound widgets', async () => {
    const gauge = {
      id: 'g1',
      type: 'gauge',
      dataSource: { modelId: 9, table: 't', field: 'v' },
      reloadFromDataModel: vi.fn(async () => {}),
    };
    const wOther = {
      id: 'k2',
      type: 'kpi',
      dataSource: { modelId: 2, table: 'other' },
      reloadFromDataModel: vi.fn(async () => {}),
    };
    const engine = makeEngine([gauge, wOther]);
    const snap = {
      changedModelIds: [],
      predicatesByModelId: new Map(),
    };
    await reloadDashboardDataWidgetsWithSnapshot(engine, snap, {
      strategy: 'by-model',
      fallbackAll: true,
    });
    expect(gauge.reloadFromDataModel).toHaveBeenCalledTimes(1);
    expect(wOther.reloadFromDataModel).toHaveBeenCalledTimes(1);
  });

  it('reload by-model with empty changedModelIds and fallbackAll false skips bound widgets', async () => {
    const gauge = {
      id: 'g1',
      type: 'gauge',
      dataSource: { modelId: 9, table: 't', field: 'v' },
      reloadFromDataModel: vi.fn(async () => {}),
    };
    const engine = makeEngine([gauge]);
    const snap = { changedModelIds: [] };
    await reloadDashboardDataWidgetsWithSnapshot(engine, snap, {
      strategy: 'by-model',
      fallbackAll: false,
    });
    expect(gauge.reloadFromDataModel).not.toHaveBeenCalled();
  });

  it('invalidateDashboardTransportCaches with filtersChanged false does not bump generation', () => {
    const g0 = getDashboardQueryBumpGeneration();
    invalidateDashboardTransportCaches({ filtersChanged: false });
    expect(getDashboardQueryBumpGeneration()).toBe(g0);
  });

  it('invalidateDashboardTransportCaches with dataChanged bumps generation for formula refresh', () => {
    const g0 = getDashboardQueryBumpGeneration();
    invalidateDashboardTransportCaches({ filtersChanged: false, dataChanged: true });
    expect(getDashboardQueryBumpGeneration()).toBe(g0 + 1);
  });

  it('commit invalidates query generation by default', () => {
    const engine = makeEngine([]);
    const g0 = getDashboardQueryBumpGeneration();
    commitDashboardFilterTransportChange(engine);
    expect(getDashboardQueryBumpGeneration()).toBe(g0 + 1);
  });
});
