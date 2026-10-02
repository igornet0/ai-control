import { describe, expect, it } from 'vitest';
import {
  defaultLinkedModelConnectionSettings,
  findLinkedTable,
  generateLinkedModelDataCode,
  linkedTableAliases,
  normalizeLinkedTables,
} from './linkedModelDataCodeSync.js';

describe('linkedModelDataCodeSync', () => {
  it('normalizes selected tables and skips duplicate aliases', () => {
    const tables = normalizeLinkedTables({
      selectedTables: [
        { name: 'orders', columns: ['id', 'amount'] },
        { name: 'orders', alias: 'orders', columns: ['id'] },
        { name: 'customers', alias: 'cust', columns: ['id', 'email'] },
      ],
    });
    expect(tables).toEqual([
      { name: 'orders', alias: 'orders', columns: ['id', 'amount'] },
      { name: 'customers', alias: 'cust', columns: ['id', 'email'] },
    ]);
    expect(linkedTableAliases({ selectedTables: tables })).toEqual(['orders', 'cust']);
  });

  it('generates source_table assignments for selected tables', () => {
    const code = generateLinkedModelDataCode({
      sourceModelId: 27,
      sourceModelName: 'Commerce',
      selectedTables: [
        { name: 'orders', columns: ['id', 'amount'] },
        { name: 'customers', columns: ['id'] },
      ],
    });
    expect(code).toContain('# source_model_id: 27');
    expect(code).toContain('global orders = source_table("orders", ["id", "amount"])');
    expect(code).toContain('global customers = source_table("customers", ["id"])');
    expect(code).toContain('table_info(orders)');
  });

  it('aliases reserved DCP name assets to linked_assets', () => {
    const tables = normalizeLinkedTables({
      selectedTables: [{ name: 'assets', columns: ['id', 'sha'] }],
    });
    expect(tables[0]).toEqual({ name: 'assets', alias: 'linked_assets', columns: ['id', 'sha'] });
    const code = generateLinkedModelDataCode({
      sourceModelId: 1,
      selectedTables: tables,
    });
    expect(code).toContain('global linked_assets = source_table("linked_assets", ["id", "sha"])');
    expect(code).not.toContain('source_table("assets"');
  });

  it('finds a linked table by alias or sqlite name', () => {
    const settings = {
      selectedTables: [
        { name: 'assets', columns: ['id'] },
        { name: 'employees', alias: 'employees', columns: ['id', 'name'] },
      ],
    };
    expect(findLinkedTable(settings, 'linked_assets')?.name).toBe('assets');
    expect(findLinkedTable(settings, 'assets')?.alias).toBe('linked_assets');
    expect(findLinkedTable(settings, '')).toBeNull();
  });

  it('auto-selects the only table on a new connection', () => {
    expect(defaultLinkedModelConnectionSettings({
      type: 'data-model',
      settings: { selectedTables: [{ name: 'orders', columns: ['id'] }] },
    })).toEqual({ selectedTable: 'orders', inputVariable: 'orders' });
    expect(defaultLinkedModelConnectionSettings({
      type: 'data-model',
      settings: {
        selectedTables: [
          { name: 'orders', columns: ['id'] },
          { name: 'items', columns: ['id'] },
        ],
      },
    })).toEqual({});
  });

  it('emits a stub when no tables are selected', () => {
    const code = generateLinkedModelDataCode({
      sourceModelId: 3,
      sourceModelName: 'Empty',
      selectedTables: [],
    });
    expect(code).toContain('No tables selected');
    expect(code).not.toContain('source_table(');
  });
});
