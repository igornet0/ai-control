import { describe, expect, it } from 'vitest';
import { buildExpandedPreviewPages } from './documentPagination';
import { SPREADSHEET_BLOCK_TYPE } from './spreadsheetGridUtils';

describe('documentPagination multi-sheet spreadsheets', () => {
  it('paginates each sheet separately with sheetId on entries', () => {
    const block = {
      type: SPREADSHEET_BLOCK_TYPE,
      field_name: 'Данные',
      sheets: [
        {
          id: 'sheet_0',
          name: 'Лист 1',
          rowCount: 3,
          colCount: 2,
          hasHeaderRow: true,
          cells: {},
          tableColumns: [
            { key: 'col_0', label: 'A', dataType: 'string' },
            { key: 'col_1', label: 'B', dataType: 'string' },
          ],
        },
        {
          id: 'sheet_1',
          name: 'Лист 2',
          rowCount: 3,
          colCount: 2,
          hasHeaderRow: true,
          cells: {},
          tableColumns: [
            { key: 'col_0', label: 'A', dataType: 'string' },
            { key: 'col_1', label: 'B', dataType: 'string' },
          ],
        },
      ],
    };
    const fieldData = {
      Данные: {
        sheet_0: Array.from({ length: 80 }, (_, i) => ({ col_0: `s1-${i}` })),
        sheet_1: [{ col_0: 'only-one' }],
        __format: 'sheets',
      },
    };
    const pages = buildExpandedPreviewPages([block], fieldData);
    const spreadsheetEntries = pages.flatMap((p) => p.blocks).filter((e) => e.block?.type === SPREADSHEET_BLOCK_TYPE);
    const sheetIds = spreadsheetEntries.map((e) => e.sheetId);
    expect(sheetIds).toContain('sheet_0');
    expect(sheetIds).toContain('sheet_1');
    expect(spreadsheetEntries.some((e) => e.sheetId === 'sheet_0' && e.isTableContinuation)).toBe(true);
  });
});
