import { describe, expect, it, vi } from 'vitest';
import { compileFormula, buildKeyToAliasMap, mergeAggSpecsInOrder } from '../src/formula/compile.js';
import {
  buildFiltersForAggGroup,
  fetchMergedAggregateRow,
  fetchMergedAggregateRows,
  groupAggsByFilterSignature,
} from '../src/formula/formulaAggregateFetch.js';

describe('formula WHERE fetch', () => {
  it('groups aggs by ignoreFilters + localFilters signature', () => {
    const a = compileFormula('SUM([t.v] WHERE [t.id] = 1)');
    const b = compileFormula('SUM([t.v] WHERE [t.id] = 2)');
    const c = compileFormula('SUM([t.v])');
    const merged = mergeAggSpecsInOrder([a.aggs, b.aggs, c.aggs]);
    const groups = groupAggsByFilterSignature(merged);
    expect(groups.size).toBe(3);
  });

  it('buildFiltersForAggGroup ANDs dashboard + local; $ ignores dashboard', () => {
    const dash = [{ table: 't', column: 'region', op: 'eq', value: 'EU' }];
    const withWhere = compileFormula('SUM([t.v] WHERE [t.id] = 23)').aggs[0];
    const unfiltered = compileFormula('SUM($[t.v] WHERE [t.id] = 23)').aggs[0];
    expect(buildFiltersForAggGroup(dash, withWhere)).toEqual([
      ...dash,
      { table: 't', column: 'id', op: 'eq', value: 23 },
    ]);
    expect(buildFiltersForAggGroup(dash, unfiltered)).toEqual([
      { table: 't', column: 'id', op: 'eq', value: 23 },
    ]);
  });

  it('fetchMergedAggregateRow issues separate queries per WHERE', async () => {
    const a = compileFormula('SUM([t.v] WHERE [t.id] = 1) + SUM([t.v] WHERE [t.id] = 2)');
    const merged = mergeAggSpecsInOrder([a.aggs]);
    const keyToAlias = buildKeyToAliasMap(merged);
    const calls = [];
    const client = {
      fetchAggregate: vi.fn(async (params) => {
        calls.push(params.filters);
        const asName = params.aggregations[0].as;
        return { rows: [{ [asName]: calls.length * 10 }] };
      }),
    };
    const row = await fetchMergedAggregateRow(client, {
      modelId: 1,
      base_table: 't',
      mergedAggs: merged,
      keyToAlias,
      filters: [{ table: 't', column: 'x', op: 'eq', value: 0 }],
    });
    expect(client.fetchAggregate).toHaveBeenCalledTimes(2);
    expect(calls[0]).toEqual(
      expect.arrayContaining([
        { table: 't', column: 'x', op: 'eq', value: 0 },
        expect.objectContaining({ column: 'id', value: 1 }),
      ]),
    );
    expect(calls[1]).toEqual(
      expect.arrayContaining([
        { table: 't', column: 'x', op: 'eq', value: 0 },
        expect.objectContaining({ column: 'id', value: 2 }),
      ]),
    );
    expect(Object.keys(row).length).toBe(2);
  });

  it('OR WHERE becomes op:or group filter', () => {
    const dash = [{ table: 't', column: 'region', op: 'eq', value: 'EU' }];
    const withOr = compileFormula('SUM([t.v] WHERE [t.id] = 1 OR [t.id] = 2)').aggs[0];
    const filters = buildFiltersForAggGroup(dash, withOr);
    expect(filters[0]).toEqual(dash[0]);
    expect(filters[1]).toMatchObject({
      op: 'or',
      filters: expect.arrayContaining([
        expect.objectContaining({ column: 'id', op: 'eq', value: 1 }),
        expect.objectContaining({ column: 'id', op: 'eq', value: 2 }),
      ]),
    });
  });

  it('fetchMergedAggregateRows passes group_by and merges buckets by group key', async () => {
    const a = compileFormula(
      'SUM([t.v] WHERE [t.id] = 1) + SUM([t.v] WHERE [t.id] = 2) FOR [t.region]',
    );
    const merged = mergeAggSpecsInOrder([a.aggs]);
    const keyToAlias = buildKeyToAliasMap(merged);
    const a0 = keyToAlias.get(merged[0].key);
    const a1 = keyToAlias.get(merged[1].key);
    const client = {
      fetchAggregate: vi.fn(async (params) => {
        expect(params.group_by).toEqual(['region']);
        const asName = params.aggregations[0].as;
        const isFirst = params.filters.some((f) => f.column === 'id' && f.value === 1);
        if (isFirst) {
          return {
            rows: [
              { region: 'EU', [asName]: 10 },
              { region: 'US', [asName]: 20 },
            ],
          };
        }
        return {
          rows: [
            { region: 'EU', [asName]: 3 },
            { region: 'US', [asName]: 7 },
          ],
        };
      }),
    };
    const { rows, groupByColumns } = await fetchMergedAggregateRows(client, {
      modelId: 1,
      base_table: 't',
      mergedAggs: merged,
      keyToAlias,
      filters: [],
      groupBy: a.groupBy,
    });
    expect(groupByColumns).toEqual(['region']);
    expect(client.fetchAggregate).toHaveBeenCalledTimes(2);
    expect(rows).toHaveLength(2);
    const eu = rows.find((r) => r.region === 'EU');
    const us = rows.find((r) => r.region === 'US');
    expect(eu[a0]).toBe(10);
    expect(eu[a1]).toBe(3);
    expect(us[a0]).toBe(20);
    expect(us[a1]).toBe(7);
  });

  it('IN WHERE becomes values list', () => {
    const withIn = compileFormula('SUM([t.v] WHERE [t.id] IN (1, 2))').aggs[0];
    expect(buildFiltersForAggGroup([], withIn)).toEqual([
      expect.objectContaining({
        table: 't',
        column: 'id',
        op: 'in',
        values: expect.arrayContaining([1, 2]),
      }),
    ]);
  });
});
