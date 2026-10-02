import { describe, it, expect } from 'vitest';
import {
  buildTransformMethodLine,
  buildTransformChainExpression,
  generateTransformDataCode,
  patchTransformDataCodeInCode,
  resolveTransformOutputVariableName,
  stripTransformBlocks,
} from './transformDataCodeSync.js';

describe('transformDataCodeSync', () => {
  it('builds text transforms via .map(col, fn) per DataCode docs', () => {
    const lines = buildTransformChainExpression({
      transformOperations: [
        { id: '1', type: 'trim', enabled: true, params: { columns: ['Name'] } },
        { id: '2', type: 'upper', enabled: true, params: { columns: ['Name'] } },
        { id: '3', type: 'replace', enabled: true, params: { column: 'Name', find: 'ООО', replaceWith: '' } },
      ],
    });
    expect(lines).toEqual([
      '.map("Name", trim)',
      '.map("Name", upper)',
      '.map("Name", fn(s) => replace(s, "ООО", ""))',
    ]);
  });

  it('builds drop_column / add_column / split_column / value_map', () => {
    expect(buildTransformMethodLine({
      type: 'dropColumn', enabled: true, params: { column: 'Notes' },
    })).toBe('.drop_column("Notes")');
    expect(buildTransformMethodLine({
      type: 'addColumn', enabled: true, params: { name: 'Region', value: 'EMEA' },
    })).toBe('.add_column("Region", "EMEA")');
    expect(buildTransformMethodLine({
      type: 'splitColumn',
      enabled: true,
      params: { column: 'FullName', delimiter: ' ', targetColumns: ['A', 'B'] },
    })).toBe('.split_column("FullName", " ", ["A", "B"])');
    expect(buildTransformMethodLine({
      type: 'valueMap',
      enabled: true,
      params: { column: 'Tag', mappings: [{ from: 'old', to: 'archive' }] },
    })).toBe('.value_map("Tag", {"old": "archive"})');
  });

  it('generates in-place transform DataCode by default', () => {
    const code = generateTransformDataCode(
      {
        name: 'Трансформация',
        transformOperations: [
          { id: '1', type: 'trim', enabled: true, params: { columns: ['Name'] } },
          { id: '2', type: 'upper', enabled: true, params: { columns: ['Name'] } },
        ],
      },
      { inputVariable: 'sample_table' },
    );
    expect(code).toContain('sample_table = sample_table.map("Name", trim)');
    expect(code).toContain('sample_table = sample_table.map("Name", upper)');
    expect(code).toContain('print("sample_table: ", table_info(sample_table))');
  });

  it('generates separate output with global export', () => {
    const code = generateTransformDataCode(
      {
        transformSeparateOutput: true,
        exportGlobal: true,
        transformOperations: [
          { id: '1', type: 'changeType', enabled: true, params: { column: 'Salary', targetType: 'float' } },
        ],
      },
      { inputVariable: 'sample_table_filter_52', widgetId: 55 },
    );
    expect(code).toContain(
      'global sample_table_filter_52_transform_55 = sample_table_filter_52.map("Salary", float)',
    );
    expect(code).toContain('# Input table: sample_table_filter_52');
  });

  it('resolves output variable names', () => {
    expect(resolveTransformOutputVariableName({}, 'sample_table')).toBe('sample_table');
    expect(resolveTransformOutputVariableName(
      { transformSeparateOutput: true },
      'sample_table',
      { widgetId: 3 },
    )).toBe('sample_table_transform_3');
  });

  it('skips disabled operations', () => {
    expect(buildTransformMethodLine({
      type: 'upper',
      enabled: false,
      params: { columns: ['Name'] },
    })).toBeNull();
  });

  it('deduplicates transform blocks on patch', () => {
    const block = generateTransformDataCode(
      { name: 'Трансформация' },
      { inputVariable: 'sample_table' },
    );
    const duplicated = `${block}\n\n${block}`;
    const { code } = patchTransformDataCodeInCode(
      duplicated,
      {
        transformOperations: [
          { id: '1', type: 'trim', enabled: true, params: { columns: ['Name'] } },
        ],
      },
      { inputVariable: 'sample_table' },
    );
    expect((code.match(/# Transform:/g) || []).length).toBe(1);
    expect(stripTransformBlocks(duplicated)).toBe('');
  });
});
