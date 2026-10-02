import { describe, expect, it } from 'vitest';
import {
  applyImportedTableColumns,
  buildImportedColumnsMap,
  inferTableColumnsFromRows,
} from './documentTableColumns';

describe('documentTableColumns import helpers', () => {
  it('infers columns from table row keys', () => {
    expect(inferTableColumnsFromRows([{ name: 'A', qty: 1 }])).toEqual([
      { key: 'name', label: 'name' },
      { key: 'qty', label: 'qty' },
    ]);
  });

  it('prefers sheet_content columns over structure_fields', () => {
    const map = buildImportedColumnsMap({
      structureFields: [{ name: 'Товары', type: 'table', columns: [{ key: 'name', label: 'Структура' }] }],
      sheetContent: [{
        type: 'field',
        field_name: 'Товары',
        displayType: 'table',
        tableColumns: [{ key: 'name', label: 'Лист' }],
      }],
    });
    expect(map.Товары).toEqual([{ key: 'name', label: 'Лист' }]);
  });

  it('applies imported columns onto existing blocks', () => {
    const blocks = [{
      type: 'field',
      field_name: 'Товары',
      displayType: 'table',
      tableColumns: [{ key: '№', label: '№' }],
    }];
    const next = applyImportedTableColumns(blocks, [{ name: 'Товары', type: 'table' }], {
      Товары: [{ key: 'name', label: 'Наименование' }],
    });
    expect(next[0].tableColumns).toEqual([{ key: 'name', label: 'Наименование' }]);
  });
});
