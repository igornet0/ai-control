import { describe, it, expect } from 'vitest';
import {
  buildFilterBracketExpression,
  buildSingleFilterCondition,
  generateFilterDataCode,
  patchFilterDataCodeInCode,
  resolveFilterOutputVariableName,
  resolveUpstreamDataCodeVariable,
  stripFilterBlocks,
} from './filterDataCodeSync.js';

describe('filterDataCodeSync', () => {
  it('builds OR condition expression', () => {
    const expr = buildFilterBracketExpression({
      filterLogic: 'or',
      filterConditions: [
        { field: 'Age', operator: 'gt', value: '25' },
        { field: 'City', operator: 'eq', value: 'Houston' },
      ],
    });
    expect(expr).toBe('("Age" > 25 or "City" == "Houston")');
  });

  it('builds AND condition expression', () => {
    const expr = buildFilterBracketExpression({
      filterLogic: 'and',
      filterConditions: [
        { field: 'Age', operator: 'gt', value: '25' },
        { field: 'City', operator: 'eq', value: 'Houston' },
      ],
    });
    expect(expr).toBe('("Age" > 25 and "City" == "Houston")');
  });

  it('combines flat conditions with filter groups', () => {
    const expr = buildFilterBracketExpression({
      filterLogic: 'or',
      filterConditions: [{ field: 'Age', operator: 'gt', value: '25' }],
      filterGroups: [
        {
          logic: 'and',
          conditions: [
            { field: 'Salary', operator: 'gt', value: '40000' },
          ],
        },
      ],
    });
    expect(expr).toBe('("Age" > 25 and "Salary" > 40000)');
  });

  it('generates in-place filter DataCode by default', () => {
    const code = generateFilterDataCode(
      {
        name: 'Фильтр',
        filterLogic: 'or',
        filterConditions: [
          { field: 'Age', operator: 'gt', value: '25' },
          { field: 'City', operator: 'eq', value: 'Houston' },
        ],
      },
      { inputVariable: 'sample_table' },
    );
    expect(code).toContain('sample_table = sample_table[("Age" > 25 or "City" == "Houston")]');
    expect(code).toContain('print("sample_table: ", table_info(sample_table))');
    expect(code).not.toContain('global ');
  });

  it('generates separate output variable with global export', () => {
    const code = generateFilterDataCode(
      {
        name: 'Фильтр',
        filterSeparateOutput: true,
        exportGlobal: true,
        filterConditions: [{ field: 'Salary', operator: 'contains', value: '1' }],
      },
      { inputVariable: 'sample_table', widgetId: 42 },
    );
    expect(code).toContain('global sample_table_filter_42 = sample_table["Salary" & contains(1)]');
    expect(code).toContain('print("sample_table_filter_42: ", table_info(sample_table_filter_42))');
  });

  it('resolves output variable with custom name when separate output enabled', () => {
    expect(resolveFilterOutputVariableName(
      { filterSeparateOutput: true, dataCodeVariableName: 'my_data' },
      'sample_table',
      { widgetId: 1 },
    )).toBe('my_data');
    expect(resolveFilterOutputVariableName({}, 'sample_table')).toBe('sample_table');
  });

  it('resolves upstream variable from file source', () => {
    const name = resolveUpstreamDataCodeVariable({
      settings: {
        sourceType: 'file',
        selectedFile: { name: 'sample.csv' },
      },
    });
    expect(name).toBe('sample_table');
  });

  it('resolves in-place filter upstream as input table', () => {
    const name = resolveUpstreamDataCodeVariable(
      { settings: { blockType: 'filter', filterSeparateOutput: false } },
      { inputVariable: 'sample_table' },
    );
    expect(name).toBe('sample_table');
  });

  it('uses upstream filter widget id for separate output variable', () => {
    const filterWidget = {
      id: '52',
      type: 'processing-block',
      settings: { blockType: 'filter', filterSeparateOutput: true },
      connections: [{ to: '52', from: '10', settings: {} }],
    };
    const widgetManager = {
      getWidget: (id) => (id === '10' ? {
        id: '10',
        type: 'data-source',
        settings: { sourceType: 'file', selectedFile: { name: 'sample.csv' } },
        connections: [],
      } : null),
    };
    const name = resolveUpstreamDataCodeVariable(
      filterWidget,
      {},
      { widgetId: 55, widgetManager },
    );
    expect(name).toBe('sample_table_filter_52');
  });

  it('resolves transform input from upstream filter with correct widget id', () => {
    const widgetManager = {
      getWidget: (id) => ({
        52: {
          id: '52',
          type: 'processing-block',
          settings: { blockType: 'filter', filterSeparateOutput: true },
          connections: [{
            to: '52',
            from: '10',
            settings: {},
          }],
        },
        10: {
          id: '10',
          type: 'data-source',
          settings: {
            sourceType: 'file',
            selectedFile: { name: 'sample.csv' },
          },
          connections: [],
        },
      }[id]),
    };

    const filterSource = widgetManager.getWidget(52);
    const inputVariable = resolveUpstreamDataCodeVariable(
      filterSource,
      {},
      { widgetId: 55, widgetManager },
    );
    expect(inputVariable).toBe('sample_table_filter_52');
  });

  it('uses selectedTable from a data-model connection', () => {
    const source = {
      id: 'dm',
      type: 'data-model',
      settings: {
        selectedTables: [
          { name: 'employees', alias: 'employees', columns: ['id'] },
          { name: 'assets', alias: 'linked_assets', columns: ['id'] },
        ],
      },
    };
    expect(resolveUpstreamDataCodeVariable(source, { selectedTable: 'linked_assets' })).toBe('linked_assets');
    expect(resolveUpstreamDataCodeVariable(source, { selectedTable: 'assets' })).toBe('linked_assets');
  });

  it('builds between condition', () => {
    expect(buildSingleFilterCondition({
      field: 'Age',
      operator: 'between',
      value: '20',
      value2: '30',
    })).toBe('("Age" > 20 and "Age" < 30)');
  });

  it('builds in / not in list conditions', () => {
    expect(buildSingleFilterCondition({
      field: 'City',
      operator: 'in',
      value: 'Houston, Chicago',
    })).toBe('"City" in ["Houston", "Chicago"]');
    expect(buildSingleFilterCondition({
      field: 'City',
      operator: 'notIn',
      value: 'Houston, Chicago',
    })).toBe('"City" not in ["Houston", "Chicago"]');
  });

  it('builds string predicate conditions with & syntax', () => {
    expect(buildSingleFilterCondition({
      field: 'City',
      operator: 'contains',
      value: 'Hou',
    })).toBe('"City" & contains("Hou")');
    expect(buildSingleFilterCondition({
      field: 'City',
      operator: 'startsWith',
      value: 'Ho',
    })).toBe('"City" & starts_with("Ho")');
    expect(buildSingleFilterCondition({
      field: 'City',
      operator: 'endsWith',
      value: 'n',
    })).toBe('"City" & ends_with("n")');
  });

  it('deduplicates repeated filter blocks on patch', () => {
    const block = generateFilterDataCode(
      { name: 'Фильтр' },
      { inputVariable: 'sample_table' },
    );
    const duplicated = `${block}\n\n${block}\n\n${block}`;
    const { code } = patchFilterDataCodeInCode(
      duplicated,
      { name: 'Фильтр', filterConditions: [{ field: 'Age', operator: 'gt', value: '25' }] },
      { inputVariable: 'sample_table' },
    );
    expect((code.match(/# Filter:/g) || []).length).toBe(1);
    expect(code).toContain('sample_table = sample_table["Age" > 25]');
    expect(stripFilterBlocks(duplicated)).toBe('');
  });
});
