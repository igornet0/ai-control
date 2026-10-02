import { describe, expect, it } from 'vitest';
import {
  buildSpreadsheetBlock,
  createEmptySpreadsheetWorkbook,
  createSheetId,
  gridWorkbookToFieldValue,
  isLegacySpreadsheetFieldValue,
  normalizeSpreadsheetFieldValue,
  normalizeSpreadsheetSheets,
  serializeSpreadsheetFieldValue,
  spreadsheetBlockToGridModel,
  SPREADSHEET_BLOCK_TYPE,
} from './spreadsheetGridUtils';

describe('spreadsheet multi-sheet adapters', () => {
  it('normalizes legacy block as single sheet', () => {
    const block = {
      type: SPREADSHEET_BLOCK_TYPE,
      field_name: 'Данные',
      rowCount: 5,
      colCount: 3,
      hasHeaderRow: true,
      cells: {},
    };
    const sheets = normalizeSpreadsheetSheets(block);
    expect(sheets).toHaveLength(1);
    expect(sheets[0].name).toBe('Лист 1');
    expect(sheets[0].id).toBe(createSheetId(0));
  });

  it('converts legacy field value array to sheet map', () => {
    const sheets = normalizeSpreadsheetSheets({
      type: SPREADSHEET_BLOCK_TYPE,
      sheets: [
        { id: 'sheet_0', name: 'A', rowCount: 3, colCount: 2, hasHeaderRow: true, cells: {} },
        { id: 'sheet_1', name: 'B', rowCount: 3, colCount: 2, hasHeaderRow: true, cells: {} },
      ],
    });
    const legacy = [{ col_0: '1' }, { col_0: '2' }];
    const map = normalizeSpreadsheetFieldValue(legacy, sheets);
    expect(isLegacySpreadsheetFieldValue(legacy)).toBe(true);
    expect(map.sheet_0).toHaveLength(2);
    expect(map.sheet_1).toEqual([]);
  });

  it('builds block with sheets array from workbook', () => {
    const wb = createEmptySpreadsheetWorkbook(2);
    const block = buildSpreadsheetBlock('Данные', wb);
    expect(block.sheets).toHaveLength(2);
    expect(block.field_name).toBe('Данные');
    expect(block.rowCount).toBe(wb.sheets[0].rowCount);
  });

  it('roundtrips workbook through block and field value', () => {
    const wb = createEmptySpreadsheetWorkbook(2);
    const block = buildSpreadsheetBlock('Данные', wb);
    const restored = spreadsheetBlockToGridModel(block);
    expect(restored.sheets).toHaveLength(2);
    const fv = gridWorkbookToFieldValue(wb, block);
    expect(fv.__format).toBe('sheets');
    expect(Object.keys(fv).filter((k) => k !== '__format')).toHaveLength(2);
    const serialized = serializeSpreadsheetFieldValue(fv, restored.sheets);
    expect(serialized.__format).toBe('sheets');
  });
});
