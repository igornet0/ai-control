import { describe, expect, it } from 'vitest';
import {
  ensureJsonTableName,
  generateDefaultJsonSourceCode,
  parseJsonTextToTable,
  patchJsonSourceInCode,
} from './jsonSourceDataCodeSync.js';

describe('jsonSourceDataCodeSync', () => {
  it('parses array of objects', () => {
    const { columns, rows, error } = parseJsonTextToTable(
      JSON.stringify([{ id: 1, name: 'A' }, { id: 2, name: 'B', extra: true }]),
    );
    expect(error).toBeNull();
    expect(columns).toEqual(['id', 'name', 'extra']);
    expect(rows).toHaveLength(2);
  });

  it('parses columnar json', () => {
    const { columns, rows, error } = parseJsonTextToTable(
      JSON.stringify({ id: [1, 2], name: ['a', 'b'] }),
    );
    expect(error).toBeNull();
    expect(columns).toEqual(['id', 'name']);
    expect(rows[0]).toEqual({ id: 1, name: 'a' });
  });

  it('generates source_table DataCode', () => {
    const code = generateDefaultJsonSourceCode(
      { tableName: 'source_112', selectedColumns: ['id', 'name'] },
      ['id', 'name'],
    );
    expect(code).toContain('global source_112 = source_table("source_112", ["id", "name"])');
    expect(code).toContain('print("source_112: ", table_info(source_112))');
  });

  it('patches existing source_table', () => {
    const { code } = patchJsonSourceInCode(
      'global source_112 = source_table("source_112", ["id"])\nprint(1)',
      { tableName: 'source_112', selectedColumns: ['id', 'name'] },
      ['id', 'name'],
    );
    expect(code).toContain('["id", "name"]');
    expect(code).toContain('print(1)');
  });

  it('ensures table name from widget id', () => {
    expect(ensureJsonTableName({}, { id: 55 })).toBe('source_55');
  });
});
