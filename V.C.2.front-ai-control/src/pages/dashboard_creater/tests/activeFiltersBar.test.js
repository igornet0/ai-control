import { describe, expect, it } from 'vitest';
import {
  gatherActiveDashboardFilterBarItems,
} from '../activeFiltersBar.js';
import {
  ACTIVE_FILTERS_BAR_VIRTUAL_WIDGET_ID,
  ensureDashboardFilterRowExists,
} from '../../../services/dashboardFilterUtils.js';

describe('activeFiltersBar gather', () => {
  it('includes virtual dashboard filter rows when no filter widget duplicates the key', () => {
    const engine = {
      widgetManager: {
        getAllWidgets: () => [],
      },
      __virtualDashboardFilters: [
        {
          id: 'vf_test_1',
          modelId: 1,
          table: 't1',
          field: 'region',
          type: 'string',
          selectedValues: ['East'],
          excludedValues: [],
          pattern: '',
          displayLabel: 'Region',
        },
      ],
    };
    const items = gatherActiveDashboardFilterBarItems(engine);
    expect(items).toHaveLength(1);
    expect(items[0].widgetId).toBe(ACTIVE_FILTERS_BAR_VIRTUAL_WIDGET_ID);
    expect(items[0].filterId).toBe('vf_test_1');
    expect(items[0].field).toBe('region');
    expect(items[0].selectedValues).toEqual(['East']);
    expect(items[0].kind).toBe('virtual-filter');
  });

  it('does not duplicate chips when the same field exists on a filter widget', () => {
    const engine = {
      widgetManager: {
        getAllWidgets: () => [
          {
            id: 'fw1',
            type: 'filter',
            settings: {
              filters: [
                {
                  id: 'row_a',
                  modelId: 1,
                  table: 't1',
                  field: 'region',
                  type: 'string',
                  selectedValues: ['West'],
                  excludedValues: [],
                  pattern: '',
                },
              ],
            },
          },
        ],
      },
      __virtualDashboardFilters: [
        {
          id: 'vf_should_hide',
          modelId: 1,
          table: 't1',
          field: 'region',
          type: 'string',
          selectedValues: ['East'],
          excludedValues: [],
          pattern: '',
        },
      ],
    };
    const items = gatherActiveDashboardFilterBarItems(engine);
    expect(items).toHaveLength(1);
    expect(items[0].widgetId).toBe('fw1');
    expect(items[0].filterId).toBe('row_a');
    expect(items[0].kind).toBeUndefined();
  });

  it('ensureDashboardFilterRowExists does not add rows to the filter widget', () => {
    const filterWidget = {
      id: 'fw1',
      type: 'filter',
      settings: { filters: [] },
      update: () => {},
    };
    const engine = {
      widgetManager: {
        getAllWidgets: () => [filterWidget],
      },
    };
    const dim = { modelId: 1, table: 'orders', field: 'region', type: 'string' };
    const r1 = ensureDashboardFilterRowExists(engine, dim);
    expect(r1.ok).toBe(true);
    expect(r1.created).toBe(true);
    expect(filterWidget.settings.filters).toHaveLength(0);
    expect(engine.__virtualDashboardFilters).toHaveLength(1);
    expect(engine.__virtualDashboardFilters[0].field).toBe('region');

    const r2 = ensureDashboardFilterRowExists(engine, dim);
    expect(r2.ok).toBe(true);
    expect(r2.created).toBe(false);
    expect(engine.__virtualDashboardFilters).toHaveLength(1);
    expect(filterWidget.settings.filters).toHaveLength(0);
  });
});
