import { describe, it, expect } from 'vitest';
import {
  getFieldsFromWidgetSettings,
  normalizeFieldNames,
  resolveFieldsFromWidgetChain,
  resolveIncomingAvailableFields,
} from './incomingFieldsUtils.js';

describe('incomingFieldsUtils', () => {
  it('reads columns from file source settings', () => {
    expect(getFieldsFromWidgetSettings({
      sourceType: 'file',
      selectedColumns: ['Name', 'Age'],
    })).toEqual(['Name', 'Age']);
  });

  it('reads columns from selectedFile when selectedColumns empty', () => {
    expect(getFieldsFromWidgetSettings({
      selectedFile: { name: 'a.csv', columns: ['City', 'Salary'] },
    })).toEqual(['City', 'Salary']);
  });

  it('walks processing-block chain to upstream file source', () => {
    const widgetManager = {
      getWidget: (id) => ({
        'src-1': {
          id: 'src-1',
          type: 'data-source',
          settings: { selectedColumns: ['Name', 'Salary'] },
          connections: [],
        },
        'filter-1': {
          id: 'filter-1',
          type: 'processing-block',
          settings: { blockType: 'filter' },
          connections: [{ to: 'filter-1', from: 'src-1', settings: { filterType: 'all' } }],
        },
      }[id]),
    };

    const fields = resolveIncomingAvailableFields(
      { from: 'filter-1', settings: { filterType: 'all' } },
      widgetManager,
    );
    expect(fields).toEqual(['Name', 'Salary']);
  });

  it('uses connection selectedFields when set', () => {
    const widgetManager = {
      getWidget: () => ({
        type: 'data-source',
        settings: { selectedColumns: ['A', 'B', 'C'] },
        connections: [],
      }),
    };

    const fields = resolveIncomingAvailableFields(
      { from: 'src', settings: { selectedFields: ['A', 'C'] } },
      widgetManager,
    );
    expect(fields).toEqual(['A', 'C']);
  });

  it('applies transform rename when resolving through transform source', () => {
    const widgetManager = {
      getWidget: (id) => ({
        src: {
          id: 'src',
          type: 'data-source',
          settings: { selectedColumns: ['id', 'email'] },
          connections: [],
        },
        tr: {
          id: 'tr',
          type: 'processing-block',
          settings: {
            blockType: 'transform',
            operations: [
              { enabled: true, type: 'renameColumn', params: { column: 'email', newName: 'email_address' } },
            ],
          },
          connections: [{ from: 'src', to: 'tr' }],
        },
      }[id]),
    };

    const fields = resolveIncomingAvailableFields(
      { from: 'tr', settings: { filterType: 'all' } },
      widgetManager,
    );
    expect(fields).toEqual(['id', 'email_address']);
  });

  it('normalizes object field descriptors', () => {
    expect(normalizeFieldNames([{ name: 'X' }, { id: 'Y' }])).toEqual(['X', 'Y']);
  });

  it('requires selectedTable when incoming source is a multi-table data-model', () => {
    const widgetManager = {
      getWidget: () => ({
        id: 'dm',
        type: 'data-model',
        settings: {
          selectedTables: [
            { name: 'employees', alias: 'employees', columns: ['id', 'name'] },
            { name: 'assets', alias: 'linked_assets', columns: ['id', 'sha'] },
          ],
        },
        connections: [],
      }),
    };

    expect(resolveIncomingAvailableFields(
      { from: 'dm', settings: {} },
      widgetManager,
    )).toEqual([]);

    expect(resolveIncomingAvailableFields(
      { from: 'dm', settings: { selectedTable: 'linked_assets' } },
      widgetManager,
    )).toEqual(['id', 'sha']);
  });

  it('unions join inputs and keeps left-only columns for semi join', () => {
    const widgetManager = {
      getWidget: (id) => ({
        left: {
          id: 'left',
          type: 'data-source',
          settings: { selectedColumns: ['id', 'name'] },
          connections: [],
        },
        right: {
          id: 'right',
          type: 'data-source',
          settings: { selectedColumns: ['user_id', 'amount'] },
          connections: [],
        },
        join: {
          id: 'join',
          type: 'processing-block',
          settings: { blockType: 'join', joinType: 'left' },
          connections: [
            { from: 'left', to: 'join' },
            { from: 'right', to: 'join' },
          ],
        },
        semi: {
          id: 'semi',
          type: 'processing-block',
          settings: { blockType: 'join', joinType: 'semi' },
          connections: [
            { from: 'left', to: 'semi' },
            { from: 'right', to: 'semi' },
          ],
        },
      }[id]),
    };

    expect(resolveFieldsFromWidgetChain(widgetManager, 'join')).toEqual(['id', 'name', 'user_id', 'amount']);
    expect(resolveFieldsFromWidgetChain(widgetManager, 'semi')).toEqual(['id', 'name']);
  });

  it('uses the only linked table when data-model has a single table', () => {
    const widgetManager = {
      getWidget: () => ({
        id: 'dm',
        type: 'data-model',
        settings: {
          selectedTables: [{ name: 'orders', columns: ['id', 'amount'] }],
        },
        connections: [],
      }),
    };
    expect(resolveIncomingAvailableFields(
      { from: 'dm', settings: {} },
      widgetManager,
    )).toEqual(['id', 'amount']);
  });

  it('resolves aggregate output columns (groupBy + metric aliases), not input availableFields', () => {
    const widgetManager = {
      getWidget: (id) => ({
        src: {
          id: 'src',
          type: 'data-source',
          settings: { selectedColumns: ['id', 'date', 'amount', 'category_id', 'description'] },
          connections: [],
        },
        agg: {
          id: 'agg',
          type: 'processing-block',
          settings: {
            blockType: 'aggregate',
            name: 'Агрегация по категориям',
            availableFields: ['id', 'date', 'amount', 'category_id', 'description'],
            aggregateGroupBy: [{ field: 'category_id' }],
            aggregateMetrics: [
              { enabled: true, field: 'amount', func: 'sum', alias: 'sum_amount' },
              { enabled: true, field: '', func: 'count', alias: 'row_count' },
            ],
          },
          connections: [{ from: 'src', to: 'agg' }],
        },
      }[id]),
    };

    expect(resolveFieldsFromWidgetChain(widgetManager, 'agg')).toEqual([
      'category_id',
      'sum_amount',
      'row_count',
    ]);

    expect(resolveIncomingAvailableFields(
      {
        from: 'agg',
        fromWidget: widgetManager.getWidget('agg'),
        settings: {
          // stale connection fields from before aggregate was configured
          selectedFields: ['id', 'date', 'amount', 'category_id', 'description'],
        },
      },
      widgetManager,
    )).toEqual(['category_id', 'sum_amount', 'row_count']);
  });
});
