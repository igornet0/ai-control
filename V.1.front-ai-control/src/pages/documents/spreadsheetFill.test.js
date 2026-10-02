import { describe, expect, it } from 'vitest';
import {
  adjustFormulaForRowOffset,
  adjustFormulaForColOffset,
  applyParsedPasteToCells,
  cellKey,
  fillColumnDownFromCell,
  findFillDownEndRow,
  getCellState,
  insertRowAt,
  resizeSheetGrid,
} from './spreadsheetGridUtils';

function makeModel(cells, { rowCount = 5, colCount = 4, hasHeaderRow = true } = {}) {
  return { rowCount, colCount, hasHeaderRow, cells };
}

describe('spreadsheet fill down', () => {
  it('finds end row by neighbor column to the left', () => {
    const model = makeModel({
      [cellKey(1, 0)]: { value: 'a' },
      [cellKey(2, 0)]: { value: 'b' },
      [cellKey(3, 0)]: { value: 'c' },
      [cellKey(1, 1)]: { value: 'x' },
    });
    expect(findFillDownEndRow(model, 1, 1)).toBe(3);
  });

  it('copies value and style down the column', () => {
    const model = makeModel({
      [cellKey(1, 0)]: { value: '1' },
      [cellKey(2, 0)]: { value: '2' },
      [cellKey(3, 0)]: { value: '3' },
      [cellKey(1, 1)]: { value: '=B*2', bold: true },
    });
    const next = fillColumnDownFromCell(model, 1, 1);
    expect(next).not.toBeNull();
    expect(getCellState(next.cells, 2, 1).value).toBe('=B*2');
    expect(getCellState(next.cells, 3, 1).value).toBe('=B*2');
    expect(getCellState(next.cells, 2, 1).bold).toBe(true);
  });

  it('shifts explicit row refs in formulas', () => {
    expect(adjustFormulaForRowOffset('=B2*D2', 1)).toBe('=B3*D3');
  });

  it('shifts column refs in formulas', () => {
    expect(adjustFormulaForColOffset('=B2*D2', 1)).toBe('=C2*E2');
    expect(adjustFormulaForColOffset('=B*A', 1)).toBe('=C*B');
    expect(adjustFormulaForColOffset('=SUM(B2:B10)', 1)).toBe('=SUM(C2:C10)');
  });

  it('pastes single formula into multi-cell vertical selection', () => {
    const cells = {
      [cellKey(1, 1)]: { value: '=B*A' },
    };
    const next = applyParsedPasteToCells(
      cells,
      [['=B*A']],
      { r0: 1, r1: 3, c0: 1, c1: 1 },
      { rowCount: 5, colCount: 4, dataStart: 1 },
    );
    expect(getCellState(next, 1, 1).value).toBe('=B*A');
    expect(getCellState(next, 2, 1).value).toBe('=B*A');
    expect(getCellState(next, 3, 1).value).toBe('=B*A');
  });
});

describe('spreadsheet row style inheritance', () => {
  it('insertRowAt copies style from the row above', () => {
    const model = makeModel({
      [cellKey(1, 0)]: { value: 'a', bold: true, align: 'center', displayType: 'currency' },
      [cellKey(2, 0)]: { value: 'b', italic: true, align: 'right' },
    }, { rowCount: 3, colCount: 2 });
    const next = insertRowAt(model, 2);
    expect(next).not.toBeNull();
    expect(getCellState(next.cells, 2, 0).value).toBe('');
    expect(getCellState(next.cells, 2, 0).bold).toBe(true);
    expect(getCellState(next.cells, 2, 0).align).toBe('center');
    expect(getCellState(next.cells, 2, 0).displayType).toBe('currency');
    expect(getCellState(next.cells, 3, 0).value).toBe('b');
    expect(getCellState(next.cells, 3, 0).italic).toBe(true);
    expect(getCellState(next.cells, 3, 0).align).toBe('right');
  });

  it('resizeSheetGrid copies style when adding rows at the bottom', () => {
    const model = makeModel({
      [cellKey(1, 0)]: { value: 'x', bold: true, displayType: 'number' },
    }, { rowCount: 2, colCount: 1, hasHeaderRow: true });
    const next = resizeSheetGrid(model, 4, 1);
    expect(next.rowCount).toBe(4);
    expect(getCellState(next.cells, 2, 0).bold).toBe(true);
    expect(getCellState(next.cells, 2, 0).displayType).toBe('number');
    expect(getCellState(next.cells, 3, 0).bold).toBe(true);
    expect(getCellState(next.cells, 3, 0).displayType).toBe('number');
  });
});
