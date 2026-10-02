import { describe, expect, it } from 'vitest';
import {
  diffFieldData,
  formatCellAddress,
  formatCellDiffValue,
  normalizeCellValue,
} from './documentFieldDiff';

describe('documentFieldDiff', () => {
  it('formats spreadsheet cell address with header row offset', () => {
    expect(formatCellAddress(0, 'col_0', 'sheet_0', { hasHeaderRow: true })).toBe('Лист 1 · A2');
    expect(formatCellAddress(0, 'col_0', 'sheet_0')).toBe('Лист 1 · A1');
    expect(formatCellAddress(2, 'col_2')).toBe('C3');
  });

  it('normalizes empty cell values for comparison', () => {
    expect(normalizeCellValue(undefined)).toBe('');
    expect(normalizeCellValue(null)).toBe('');
    expect(formatCellDiffValue('')).toBe('(пусто)');
    expect(formatCellDiffValue('1')).toBe('1');
    expect(formatCellDiffValue(0)).toBe('0');
  });

  it('diffs spreadsheet cells by address', () => {
    const before = {
      Товары: {
        sheet_0: [
          { col_0: 'старое', col_1: '10' },
          { col_0: 'без изменений', col_1: '20' },
        ],
      },
    };
    const after = {
      Товары: {
        sheet_0: [
          { col_0: 'новое', col_1: '10' },
          { col_0: 'без изменений', col_1: '99' },
        ],
      },
    };

    const sheetBlocks = [{
      type: 'spreadsheet',
      field_name: 'Товары',
      hasHeaderRow: true,
    }];

    const changes = diffFieldData(before, after, { sheetBlocks });
    expect(changes).toHaveLength(1);
    expect(changes[0].type).toBe('spreadsheet');
    expect(changes[0].cellChanges).toEqual([
      expect.objectContaining({
        address: 'Лист 1 · A2',
        before: 'старое',
        after: 'новое',
      }),
      expect.objectContaining({
        address: 'Лист 1 · B3',
        before: '20',
        after: '99',
      }),
    ]);
  });

  it('ignores equivalent empty values', () => {
    const before = { items: [{ col_0: undefined }] };
    const after = { items: [{ col_0: '' }] };
    expect(diffFieldData(before, after)).toHaveLength(0);
  });

  it('diffs plain table rows by cell', () => {
    const before = { items: [{ col_0: 'a' }] };
    const after = { items: [{ col_0: 'b' }] };
    const changes = diffFieldData(before, after);
    expect(changes[0].type).toBe('table');
    expect(changes[0].cellChanges[0]).toMatchObject({
      address: 'A1',
      before: 'a',
      after: 'b',
    });
  });

  it('diffs spreadsheet field value with __format metadata', () => {
    const before = {
      Товары: {
        __format: 'sheets',
        sheet_0: [{ col_0: 'старое', col_1: '1' }],
      },
    };
    const after = {
      Товары: {
        __format: 'sheets',
        sheet_0: [{ col_0: 'новое', col_1: '1' }],
      },
    };

    const changes = diffFieldData(before, after);
    expect(changes).toHaveLength(1);
    expect(changes[0].type).toBe('spreadsheet');
    expect(changes[0].cellChanges).toEqual([
      expect.objectContaining({
        address: 'Лист 1 · A1',
        before: 'старое',
        after: 'новое',
      }),
    ]);
  });
});
