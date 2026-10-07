import { describe, expect, it } from 'vitest';
import {
  evaluateCellFormula,
  resolveCellDisplayValue,
  computeFormulaDisplayMap,
} from './spreadsheetCellFormula';
import { cellKey, adjustFormulaForOffset } from './spreadsheetGridUtils';
import { extractFormulaReferences, shiftFormulaReferences } from './spreadsheetFormulaTokens';
import { formatNumberByPattern } from './spreadsheetFormulaFunctions';

// A: 10, 20, (пусто), 40 · B: "Иван", "петр" · C1: 2.5 · D1: 0
function makeModel(extra = {}, { colCount = 6, rowCount = 10, dataTypes = {} } = {}) {
  return {
    rowCount,
    colCount,
    hasHeaderRow: false,
    cells: {
      [cellKey(0, 0)]: { value: '10' },
      [cellKey(1, 0)]: { value: '20' },
      [cellKey(3, 0)]: { value: '40' },
      [cellKey(0, 1)]: { value: 'Иван' },
      [cellKey(1, 1)]: { value: 'петр' },
      [cellKey(0, 2)]: { value: '2.5' },
      [cellKey(0, 3)]: { value: '0' },
      ...extra,
    },
    tableColumns: Array.from({ length: colCount }, (_, c) => ({
      key: `col_${c}`,
      label: String.fromCharCode(65 + c),
      dataType: dataTypes[c] || 'string',
    })),
  };
}

const model = makeModel();
const ev = (f, m = model, r = 5, c = 5) => evaluateCellFormula(f, m, r, c, m.tableColumns);

describe('formula engine — Excel compatibility', () => {
  it.each([
    ['=1+2*3', 7],
    ['=(1+2)*3', 9],
    ['=2^3', 8],
    ['=-2^2', 4],
    ['=10%', 0.1],
    ['=-A1', -10],
    ['=SUM(A1:A4)', 70],
    ['=SUM(A1,A2,5)', 35],
    ['=СУММ(A1:A4;5)', 75],
    ['=СУММ(A1:A4)*2', 140],
    ['=AVERAGE(A1:A4)', 70 / 3],
    ['=COUNT(A1:B4)', 3],
    ['=COUNTA(A1:B4)', 5],
    ['=MAX(A1:A4)-MIN(A1:A4)', 30],
    ['=ROUND(C1*3.333,2)', 8.33],
    ['=ROUND(2.5,0)', 3],
    ['=ROUND(-2.5,0)', -3],
    ['=ABS(-5)', 5],
    ['=IF(A1*2>15,1,0)', 1],
    ['=ЕСЛИ(И(A1>5;A2>5);1;0)', 1],
    ['=IF(OR(A1>50,A2>5),1,0)', 1],
    ['=IF(AND(A1>5,A2>50),1,0)', 0],
    ['=IF(B1="иван",1,0)', 1],
    ['=LEN(B1)', 4],
    ['=SUMIF(A1:A4,">15")', 60],
    ['=COUNTIF(A1:A4,">15")', 2],
    ['=COUNTIF(B1:B4,"п*")', 1],
    ['=SUMIFS(A1:A4,A1:A4,">5",A1:A4,"<30")', 30],
    ['=$A$1+A2', 30],
    ['=1,5+1', 2.5],
    ['=ОКРУГЛ(1,555;2)', 1.56],
    ['=IFERROR(A1/D1,0)', 0],
    ['=MOD(10,3)', 1],
    ['=MOD(-3,2)', 1],
    ['=POWER(2,10)', 1024],
    ['=SQRT(16)', 4],
    ['=PRODUCT(A1:A2)', 200],
    ['=SUMPRODUCT(A1:A2,A1:A2)', 500],
    ['=YEAR(DATE(2026,3,1))', 2026],
    ['=МЕСЯЦ("01.03.2026")', 3],
    ['=MATCH(40,A1:A4,0)', 4],
    ['=INDEX(A1:B4,2,1)', 20],
    ['=MEDIAN(A1:A4)', 20],
    ['=LARGE(A1:A4,1)', 40],
    ['=ЧИСТРАБДНИ(ДАТА(2026;3;2);ДАТА(2026;3;8))', 5],
    ['=РАЗНДАТ(ДАТА(2020;5;10);ДАТА(2026;5;9);"Y")', 5],
    ['=DATEDIF(DATE(2026,1,31),DATE(2026,3,1),"M")', 1],
    ['=СТРОКА()', 6],
  ])('%s → %s', (f, expected) => {
    expect(ev(f)).toBeCloseTo(expected, 6);
  });

  it.each([
    ['=IF(A1>5,"big","small")', 'big'],
    ['="Привет, "&B1', 'Привет, Иван'],
    ['=CONCATENATE(B1," ",B2)', 'Иван петр'],
    ['=СЦЕПИТЬ(B1;" ";B2)', 'Иван петр'],
    ['=UPPER(B2)', 'ПЕТР'],
    ['=ПРОПНАЧ("иван иванов")', 'Иван Иванов'],
    ['=VLOOKUP(20,A1:B4,2,FALSE)', 'петр'],
    ['=TEXT(1234.5,"0.00")', '1234.50'],
    ['=ТЕКСТ(1234,5;"# ##0,00")', '1 234,50'],
    ['=ТЕКСТ(ДАТА(2026;3;1);"ДД.ММ.ГГГГ")', '01.03.2026'],
    ['=ЛЕВСИМВ(B1;2)&ПРАВСИМВ(B2;2)', 'Ивтр'],
    ['=ПОДСТАВИТЬ("a-b-c";"-";"+")', 'a+b+c'],
    ['=ОБЪЕДИНИТЬ(", ";ИСТИНА;B1:B4)', 'Иван, петр'],
    ['=ПЕРЕКЛЮЧ(2;1;"один";2;"два";"другое")', 'два'],
    ['=ЕСЛИМН(A1>50;"a";A1>5;"b")', 'b'],
  ])('%s → %s', (f, expected) => {
    expect(ev(f)).toBe(expected);
  });

  it.each([
    ['=A1>5', true],
    ['=A1="10"', true],
    ['=НЕ(A1>5)', false],
    ['=ЕПУСТО(A3)', true],
    ['=ЕЧИСЛО(B1)', false],
    ['=ИСТИНА', true],
  ])('%s → %s', (f, expected) => {
    expect(ev(f)).toBe(expected);
  });

  it.each([
    ['=A1/D1', '#DIV/0!'],
    ['=XYZ(1)', '#NAME?'],
    ['=A1+"abc"', '#VALUE!'],
    ['=VLOOKUP(99,A1:B4,2,FALSE)', '#N/A'],
    ['=VLOOKUP(10,A1:B4,5,FALSE)', '#REF!'],
    ['=SQRT(-1)', '#NUM!'],
    ['=SUM(A1:A4', '#ERROR!'],
    ['=Нет!A1', '#REF!'],
    ['=AVERAGE(A3)', '#DIV/0!'],
  ])('%s → %s', (f, expected) => {
    expect(ev(f)).toBe(expected);
  });

  it('errors propagate through arithmetic but not through IFERROR', () => {
    expect(ev('=1+A1/D1')).toBe('#DIV/0!');
    expect(ev('=ЕСЛИОШИБКА(1+A1/D1;"—")')).toBe('—');
  });

  it('detects circular references instead of hanging', () => {
    const m = makeModel({
      [cellKey(5, 0)]: { value: '=B6+1' },
      [cellKey(5, 1)]: { value: '=A6+1' },
    });
    expect(ev('=B6+1', m, 5, 0)).toBe('#REF!');
  });

  it('empty single reference shows empty like Google Sheets', () => {
    expect(ev('=A3')).toBeNull();
    expect(ev('=A3+1')).toBe(1);
  });
});

describe('formula engine — legacy syntax still works', () => {
  const legacy = {
    rowCount: 3,
    colCount: 5,
    hasHeaderRow: true,
    cells: {
      [cellKey(1, 1)]: { value: '4' },
      [cellKey(1, 2)]: { value: 'да' },
      [cellKey(1, 3)]: { value: '5' },
      [cellKey(2, 1)]: { value: '6' },
      [cellKey(2, 3)]: { value: '2' },
    },
    tableColumns: [
      { key: 'a', label: 'Название', dataType: 'string' },
      { key: 'b', label: 'Цена', dataType: 'number' },
      { key: 'c', label: 'Нужно', dataType: 'boolean' },
      { key: 'd', label: 'Кол-во', dataType: 'number' },
      { key: 'e', label: 'Сумма', dataType: 'number' },
    ],
  };

  it('bare column letters refer to the same row', () => {
    expect(evaluateCellFormula('=B*D', legacy, 1, 4, legacy.tableColumns)).toBe(20);
    expect(evaluateCellFormula('=B*D', legacy, 2, 4, legacy.tableColumns)).toBe(12);
  });

  it('IF with a boolean column and != / == operators', () => {
    expect(evaluateCellFormula('=ЕСЛИ(C, B*D, 0)', legacy, 1, 4, legacy.tableColumns)).toBe(20);
    expect(evaluateCellFormula('=ЕСЛИ(C, B*D, 0)', legacy, 2, 4, legacy.tableColumns)).toBe(0);
    expect(evaluateCellFormula('=ЕСЛИ(C=="да", 1, 0)', legacy, 1, 4, legacy.tableColumns)).toBe(1);
    expect(evaluateCellFormula('=ЕСЛИ(A!="", 1, 0)', legacy, 1, 4, legacy.tableColumns)).toBe(0);
  });

  it('SUM over a bare column excludes the formula cell itself', () => {
    const m = {
      ...legacy,
      cells: { ...legacy.cells, [cellKey(2, 1)]: { value: '=СУММ(B)' } },
    };
    expect(evaluateCellFormula('=СУММ(B)', m, 2, 1, m.tableColumns)).toBe(4);
  });

  it('A1 in an empty header cell returns the column title', () => {
    expect(evaluateCellFormula('=B1', legacy, 1, 4, legacy.tableColumns)).toBe('Цена');
  });

  it('boolean result in a boolean column shows да/нет', () => {
    expect(resolveCellDisplayValue('=B2>3', legacy, 1, 2, legacy.tableColumns)).toBe('да');
    expect(resolveCellDisplayValue('=B2>3', legacy, 1, 4, legacy.tableColumns)).toBe('ИСТИНА');
  });

  it('display map evaluates dependent formulas once and shows errors', () => {
    const m = makeModel({
      [cellKey(4, 0)]: { value: '=A1*2' },
      [cellKey(5, 0)]: { value: '=A5+1' },
      [cellKey(6, 0)]: { value: '=A1/D1' },
    });
    const map = computeFormulaDisplayMap(m, m.tableColumns);
    expect(map[cellKey(4, 0)]).toBe('20');
    expect(map[cellKey(5, 0)]).toBe('21');
    expect(map[cellKey(6, 0)]).toBe('#DIV/0!');
  });

  it('dates from DATE() show as dates outside date columns', () => {
    expect(resolveCellDisplayValue('=ДАТА(2026;3;1)', model, 5, 5, model.tableColumns)).toBe('01.03.2026');
    expect(resolveCellDisplayValue('=ДАТА(2026;3;1)+1', model, 5, 5, model.tableColumns)).toBe('02.03.2026');
    expect(resolveCellDisplayValue('=ДАТА(2026;3;1)-ДАТА(2026;2;1)', model, 5, 5, model.tableColumns)).toBe('28');
  });
});

describe('cross-sheet references', () => {
  const sheet2 = {
    id: 's2',
    name: 'Прайс 2',
    rowCount: 3,
    colCount: 2,
    hasHeaderRow: false,
    cells: { [cellKey(0, 0)]: { value: 'чай' }, [cellKey(0, 1)]: { value: '120' }, [cellKey(1, 0)]: { value: 'кофе' }, [cellKey(1, 1)]: { value: '200' } },
    tableColumns: [{ key: 'a', label: 'A', dataType: 'string' }, { key: 'b', label: 'B', dataType: 'number' }],
  };
  const main = { ...makeModel(), id: 's1', name: 'Лист1' };
  const workbook = { sheets: [main, sheet2], activeSheetId: 's1' };

  it('reads quoted sheet names, ranges and lookups', () => {
    const run = (f) => evaluateCellFormula(f, main, 5, 5, main.tableColumns, null, workbook);
    expect(run("='Прайс 2'!B2")).toBe(200);
    expect(run("=СУММ('Прайс 2'!B1:B3)")).toBe(320);
    expect(run("=ВПР(\"кофе\";'Прайс 2'!A1:B3;2;ЛОЖЬ)")).toBe(200);
    expect(run("=СУММ('Прайс 2'!B:B)")).toBe(320);
  });
});

describe('reference shifting (fill / paste)', () => {
  it.each([
    ['=A1+$B$1', 1, 0, '=A2+$B$1'],
    ['=SUM(A1:A3)', 0, 1, '=SUM(B1:B3)'],
    ['="A1"&A1', 1, 0, '="A1"&A2'],
    ['=$A1*B$2', 2, 2, '=$A3*D$2'],
    ['=Лист2!B3', 1, 0, '=Лист2!B4'],
    ['=B*D', 0, 1, '=C*E'],
    ['=B*D', 3, 0, '=B*D'],
    ['=СУММ(B:B)', 5, 0, '=СУММ(B:B)'],
    ['=A1', -1, 0, '=#REF!'],
    ['=LOG10(A1)', 1, 0, '=LOG10(A2)'],
  ])('%s shifted by (%i,%i) → %s', (f, dr, dc, expected) => {
    expect(shiftFormulaReferences(f, dr, dc)).toBe(expected);
    expect(adjustFormulaForOffset(f, dr, dc)).toBe(expected);
  });
});

describe('reference extraction for highlighting', () => {
  it('returns positions of every reference', () => {
    const f = "=СУММ(A1:B3)+'Лист 2'!C4*$D$5+E";
    const refs = extractFormulaReferences(f);
    expect(refs.map((r) => f.slice(r.start, r.end))).toEqual(['A1:B3', "'Лист 2'!C4", '$D$5', 'E']);
    expect(refs[0]).toMatchObject({ r0: 0, c0: 0, r1: 2, c1: 1, sheetName: null });
    expect(refs[1]).toMatchObject({ sheetName: 'Лист 2', r0: 3, c0: 2 });
  });

  it('ignores references inside strings and function names', () => {
    expect(extractFormulaReferences('="A1"&LOG10(B2)').map((r) => r.kind)).toEqual(['cell']);
  });
});

describe('TEXT number formats', () => {
  it.each([
    [1234.5, '0.00', '1234.50'],
    [1234.5, '#,##0', '1,235'],
    [1234.567, '# ##0,00', '1 234,57'],
    [0.256, '0%', '26%'],
    [0.256, '0.0%', '25.6%'],
    [5, '000', '005'],
    [-3.5, '0.0 ₽', '-3.5 ₽'],
  ])('%s with "%s" → %s', (n, fmt, expected) => {
    expect(formatNumberByPattern(n, fmt)).toBe(expected);
  });
});
