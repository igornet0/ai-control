import { describe, it, expect } from 'vitest';
import {
  escapeCsvCell,
  rowsToCsv,
  sanitizeFilename,
  mapCsvHeadersToKeys,
  papaResultToFieldRows,
} from './csvUtils';

describe('escapeCsvCell', () => {
  it('returns plain values as-is when no special chars', () => {
    expect(escapeCsvCell('hello')).toBe('hello');
    expect(escapeCsvCell(42)).toBe('42');
  });

  it('wraps fields with comma, quote or newline', () => {
    expect(escapeCsvCell('a,b')).toBe('"a,b"');
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvCell('line1\nline2')).toBe('"line1\nline2"');
  });
});

describe('rowsToCsv', () => {
  const cols = [
    { key: 'name', label: 'Наименование' },
    { key: 'qty', label: 'Кол-во' },
  ];

  it('writes header and rows with BOM by default', () => {
    const csv = rowsToCsv([{ name: 'A', qty: '1' }], cols);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('Наименование');
    expect(csv).toContain('Кол-во');
    expect(csv).toContain('A');
    expect(csv).toContain('1');
  });

  it('can omit BOM', () => {
    const csv = rowsToCsv([], cols, { bom: false });
    expect(csv.startsWith('\uFEFF')).toBe(false);
  });
});

describe('sanitizeFilename', () => {
  it('strips unsafe characters', () => {
    expect(sanitizeFilename('doc/1')).toBe('doc_1');
    expect(sanitizeFilename('  ')).toBe('document');
  });
});

describe('mapCsvHeadersToKeys', () => {
  const columns = [
    { key: 'name', label: 'Наименование' },
    { key: 'qty', label: 'Кол-во' },
  ];

  it('maps by key or label', () => {
    expect(mapCsvHeadersToKeys(['Наименование', 'qty'], columns)).toEqual(['name', 'qty']);
    expect(mapCsvHeadersToKeys(['name', 'Кол-во'], columns)).toEqual(['name', 'qty']);
  });
});

describe('papaResultToFieldRows', () => {
  const columns = [
    { key: 'name', label: 'Наименование' },
    { key: 'qty', label: 'Кол-во' },
  ];

  it('maps rows by header labels', () => {
    const result = papaResultToFieldRows(
      {
        data: [{ Наименование: 'X', 'Кол-во': '2' }],
        meta: { fields: ['Наименование', 'Кол-во'] },
      },
      columns
    );
    expect(result).toEqual([{ name: 'X', qty: '2' }]);
  });

  it('falls back to column order when headers do not match', () => {
    const result = papaResultToFieldRows(
      {
        data: [{ ColA: 'a', ColB: 'b' }],
        meta: { fields: ['ColA', 'ColB'] },
      },
      columns
    );
    expect(result).toEqual([{ name: 'a', qty: 'b' }]);
  });
});
