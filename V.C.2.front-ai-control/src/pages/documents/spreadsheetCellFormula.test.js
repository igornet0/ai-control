import { describe, expect, it } from 'vitest';
import {
  evaluateCellFormula,
  formatFormulaNumber,
  isCellFormula,
  resolveCellDisplayValue,
} from './spreadsheetCellFormula';
import { cellKey } from './spreadsheetGridUtils';

function makeModel(cells, { hasHeaderRow = true, rowCount = 2, colCount = 5 } = {}) {
  return {
    rowCount,
    colCount,
    hasHeaderRow,
    cells,
    tableColumns: Array.from({ length: colCount }, (_, c) => ({
      key: `col_${c}`,
      label: String.fromCharCode(65 + c),
      dataType: 'number',
    })),
  };
}

describe('spreadsheetCellFormula', () => {
  it('detects formulas', () => {
    expect(isCellFormula('=B*D')).toBe(true);
    expect(isCellFormula('10')).toBe(false);
    expect(isCellFormula('=')).toBe(false);
  });

  it('multiplies columns in the same row with bare letters', () => {
    const model = makeModel({
      [cellKey(1, 1)]: { value: '4' },
      [cellKey(1, 3)]: { value: '5' },
      [cellKey(1, 4)]: { value: '=B*D' },
    });
    expect(evaluateCellFormula('=B*D', model, 1, 4, model.tableColumns)).toBe(20);
    expect(resolveCellDisplayValue('=B*D', model, 1, 4, model.tableColumns)).toBe('20');
  });

  it('supports explicit cell refs', () => {
    const model = makeModel({
      [cellKey(1, 1)]: { value: '2' },
      [cellKey(1, 3)]: { value: '3' },
      [cellKey(1, 4)]: { value: '=B2*D2' },
    });
    expect(evaluateCellFormula('=B2*D2', model, 1, 4, model.tableColumns)).toBe(6);
  });

  it('formats decimals', () => {
    expect(formatFormulaNumber(10.123456)).toBe('10.1235');
  });

  it('sums a range with Russian СУММ', () => {
    const model = makeModel({
      [cellKey(0, 1)]: { value: 'Заголовок' },
      [cellKey(1, 1)]: { value: '10' },
      [cellKey(2, 1)]: { value: '20' },
      [cellKey(3, 1)]: { value: '30' },
      [cellKey(4, 1)]: { value: '=СУММ(B1:B4)' },
    }, { rowCount: 5, colCount: 4 });
    expect(evaluateCellFormula('=СУММ(B1:B4)', model, 4, 1, model.tableColumns)).toBe(60);
  });

  it('sums entire column when only column letter is passed', () => {
    const model = makeModel({
      [cellKey(0, 1)]: { value: 'Заголовок' },
      [cellKey(1, 1)]: { value: '5' },
      [cellKey(2, 1)]: { value: '15' },
      [cellKey(3, 1)]: { value: '=СУММ(B)' },
    }, { rowCount: 4, colCount: 4 });
    expect(evaluateCellFormula('=СУММ(B)', model, 3, 1, model.tableColumns)).toBe(20);
    expect(evaluateCellFormula('=SUM(B:B)', model, 3, 1, model.tableColumns)).toBe(20);
  });

  it('sums explicit range with English SUM', () => {
    const model = makeModel({
      [cellKey(1, 1)]: { value: '2' },
      [cellKey(2, 1)]: { value: '3' },
      [cellKey(3, 1)]: { value: '=SUM(B2:B3)' },
    }, { rowCount: 4, colCount: 4 });
    expect(evaluateCellFormula('=SUM(B2:B3)', model, 3, 1, model.tableColumns)).toBe(5);
  });

  it('evaluates ЕСЛИ with boolean column', () => {
    const cols = [
      { key: 'col_0', label: 'A', dataType: 'string' },
      { key: 'col_1', label: 'B', dataType: 'number' },
      { key: 'col_2', label: 'C', dataType: 'boolean' },
      { key: 'col_3', label: 'D', dataType: 'number' },
      { key: 'col_4', label: 'E', dataType: 'number' },
    ];
    const modelYes = {
      rowCount: 2,
      colCount: 5,
      hasHeaderRow: true,
      tableColumns: cols,
      cells: {
        [cellKey(1, 1)]: { value: '4' },
        [cellKey(1, 2)]: { value: 'да' },
        [cellKey(1, 3)]: { value: '5' },
        [cellKey(1, 4)]: { value: '=ЕСЛИ(C, B*D, 0)' },
      },
    };
    expect(evaluateCellFormula('=ЕСЛИ(C, B*D, 0)', modelYes, 1, 4, cols)).toBe(20);

    const modelNo = {
      ...modelYes,
      cells: {
        ...modelYes.cells,
        [cellKey(1, 2)]: { value: 'нет' },
      },
    };
    expect(evaluateCellFormula('=ЕСЛИ(C, B*D, 0)', modelNo, 1, 4, cols)).toBe(0);
  });

  it('evaluates ЕСЛИ with numeric comparison', () => {
    const model = makeModel({
      [cellKey(1, 1)]: { value: '12' },
      [cellKey(1, 3)]: { value: '3' },
      [cellKey(1, 4)]: { value: '=ЕСЛИ(B>10, B*D, 0)' },
    });
    expect(evaluateCellFormula('=ЕСЛИ(B>10, B*D, 0)', model, 1, 4, model.tableColumns)).toBe(36);

    const modelLow = {
      ...model,
      cells: { ...model.cells, [cellKey(1, 1)]: { value: '5' } },
    };
    expect(evaluateCellFormula('=ЕСЛИ(B>10, B*D, 0)', modelLow, 1, 4, model.tableColumns)).toBe(0);
  });

  it('evaluates ЕСЛИ with non-empty string check', () => {
    const model = makeModel({
      [cellKey(1, 0)]: { value: 'x' },
      [cellKey(1, 1)]: { value: '4' },
      [cellKey(1, 3)]: { value: '5' },
      [cellKey(1, 4)]: { value: '=ЕСЛИ(A != "", B*D, 0)' },
    });
    expect(evaluateCellFormula('=ЕСЛИ(A != "", B*D, 0)', model, 1, 4, model.tableColumns)).toBe(20);

    const modelEmpty = {
      ...model,
      cells: { ...model.cells, [cellKey(1, 0)]: { value: '' } },
    };
    expect(evaluateCellFormula('=ЕСЛИ(A != "", B*D, 0)', modelEmpty, 1, 4, model.tableColumns)).toBe(0);
  });

  it('evaluates DATE and formats date column display', () => {
    const cols = [
      { key: 'col_0', label: 'A', dataType: 'date' },
    ];
    const model = { rowCount: 2, colCount: 1, hasHeaderRow: true, tableColumns: cols, cells: {} };
    const serial = evaluateCellFormula('=DATE(2026,1,15)', model, 1, 0, cols);
    expect(serial).toBeGreaterThan(0);
    expect(resolveCellDisplayValue('=DATE(2026,1,15)', model, 1, 0, cols)).toBe('2026-01-15');
  });

  it('resolves boolean formula default as да/нет', () => {
    const cols = [
      { key: 'col_0', label: 'A', dataType: 'number' },
      { key: 'col_1', label: 'B', dataType: 'boolean' },
    ];
    const model = {
      rowCount: 2,
      colCount: 2,
      hasHeaderRow: true,
      tableColumns: cols,
      cells: {
        [cellKey(1, 0)]: { value: '5' },
      },
    };
    expect(resolveCellDisplayValue('=ЕСЛИ(A>0, 1, 0)', model, 1, 1, cols)).toBe('да');
    const modelZero = { ...model, cells: { [cellKey(1, 0)]: { value: '0' } } };
    expect(resolveCellDisplayValue('=ЕСЛИ(A>0, 1, 0)', modelZero, 1, 1, cols)).toBe('нет');
  });

  it('returns header title for A1 instead of 0', () => {
    const model = makeModel({
      [cellKey(0, 0)]: { value: 'Контрагент' },
      [cellKey(0, 1)]: { value: 'Склад' },
      [cellKey(1, 2)]: { value: '=A1' },
    }, { rowCount: 3, colCount: 3 });
    expect(evaluateCellFormula('=A1', model, 1, 2, model.tableColumns)).toBe('Контрагент');
    expect(resolveCellDisplayValue('=A1', model, 1, 2, model.tableColumns)).toBe('Контрагент');
    expect(evaluateCellFormula('=B1', model, 1, 2, model.tableColumns)).toBe('Склад');
  });

  it('falls back to column label for empty header cell', () => {
    const cols = [
      { key: 'col_0', label: 'Наименование', dataType: 'string' },
      { key: 'col_1', label: 'B', dataType: 'number' },
    ];
    const model = {
      rowCount: 2,
      colCount: 2,
      hasHeaderRow: true,
      tableColumns: cols,
      cells: {
        [cellKey(1, 1)]: { value: '=A1' },
      },
    };
    expect(evaluateCellFormula('=A1', model, 1, 1, cols)).toBe('Наименование');
  });

  it('resolves cross-sheet cell refs', () => {
    const sheet1 = makeModel({
      [cellKey(1, 0)]: { value: '10' },
      [cellKey(1, 1)]: { value: "=Лист2!B2" },
    }, { rowCount: 3, colCount: 3 });
    sheet1.id = 's1';
    sheet1.name = 'Лист1';
    const sheet2 = makeModel({
      [cellKey(0, 1)]: { value: 'Склад' },
      [cellKey(1, 1)]: { value: '25' },
    }, { rowCount: 3, colCount: 3 });
    sheet2.id = 's2';
    sheet2.name = 'Лист2';
    const workbook = { sheets: [sheet1, sheet2], activeSheetId: 's1' };
    expect(evaluateCellFormula('=Лист2!B2', sheet1, 1, 1, sheet1.tableColumns, new Set(), workbook)).toBe(25);
    expect(evaluateCellFormula('=Лист2!B1', sheet1, 1, 1, sheet1.tableColumns, new Set(), workbook)).toBe('Склад');
    expect(evaluateCellFormula('=СУММ(Лист2!B2:B2)', sheet1, 1, 1, sheet1.tableColumns, new Set(), workbook)).toBe(25);
  });
});
