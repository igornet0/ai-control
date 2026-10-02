import { describe, expect, it } from 'vitest';
import {
  buildSourceTableColumnsArg,
  generateDefaultApiSourceCode,
  patchApiSourceInCode,
  resolveApiDataCodeVariableName,
  stripHiddenWsImport,
} from './apiSourceDataCodeSync.js';

describe('apiSourceDataCodeSync', () => {
  it('builds array columns when no renames', () => {
    const arg = buildSourceTableColumnsArg(
      { selectedColumns: ['id', 'value'] },
      ['id', 'value'],
    );
    expect(arg).toBe('["id", "value"]');
  });

  it('builds object columns when renames present', () => {
    const arg = buildSourceTableColumnsArg(
      {
        selectedColumns: ['id', 'value'],
        fieldRenames: { value: 'count' },
      },
      ['id', 'value'],
    );
    expect(arg).toBe('{"id": None, "value": "count"}');
  });

  it('always includes row_id for append mode in source_table columns', () => {
    const arg = buildSourceTableColumnsArg(
      { selectedColumns: ['id', 'value'], apiIngestMode: 'append' },
      ['id', 'value'],
    );
    expect(arg).toBe('["row_id", "id", "value"]');
  });

  it('generates default source_table code without visible ws import', () => {
    const code = generateDefaultApiSourceCode(
      { tableName: 'source_72', selectedColumns: ['A', 'B'] },
      ['A', 'B'],
    );
    expect(code).not.toContain('from ws import');
    expect(code).toContain('source_table("source_72", ["A", "B"])');
    expect(code).not.toContain('ws.source_table');
    expect(code).toMatch(/^global source_72 =/);
  });

  it('patches only source_table assignment (incl. legacy ws.source_table)', () => {
    const existing = 'global source_72 = ws.source_table("source_72", ["A"])\nprint(1)';
    const { code } = patchApiSourceInCode(
      existing,
      { tableName: 'source_72', selectedColumns: ['A', 'B'] },
      ['A', 'B'],
    );
    expect(code).not.toContain('from ws import');
    expect(code).toContain('source_table("source_72", ["A", "B"])');
    expect(code).not.toContain('ws.source_table');
    expect(code).toContain('print(1)');
  });

  it('strips from ws import * from editor code', () => {
    const existing =
      'from ws import *\n\nglobal source_72 = source_table("source_72", ["A"])\n';
    expect(stripHiddenWsImport(existing)).not.toContain('from ws import');
    const { code } = patchApiSourceInCode(
      existing,
      { tableName: 'source_72', selectedColumns: ['A', 'B'] },
      ['A', 'B'],
    );
    expect(code).not.toContain('from ws import');
    expect(code).toContain('source_table("source_72", ["A", "B"])');
  });

  it('resolves variable name from table', () => {
    expect(resolveApiDataCodeVariableName({ tableName: 'source_72' })).toBe('source_72');
  });
});
