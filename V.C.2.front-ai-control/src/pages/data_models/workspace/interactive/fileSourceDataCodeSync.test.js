import { describe, expect, it } from 'vitest';
import {
  buildFileSourceAssignmentLine,
  parseFileSourceFromCode,
  patchFileSourceInCode,
  renameIdentifierInCode,
  settingsUpdatesFromParsedRead,
  resolveSourcePathForSettings,
  generateDefaultFolderSourceCode,
} from './fileSourceDataCodeSync.js';

describe('fileSourceDataCodeSync', () => {
  it('parses read() call with header array', () => {
    const code = `global document_2_Товары_table = read(path("document-2-Товары.csv"), header_row=0, header=["Наименование", "Кол-во", "Ед."])
print(table_info(document_2_Товары_table))`;

    const parsed = parseFileSourceFromCode(code);
    expect(parsed.variableName).toBe('document_2_Товары_table');
    expect(parsed.exportGlobal).toBe(true);
    expect(parsed.fileName).toBe('document-2-Товары.csv');
    expect(parsed.selectedColumns).toEqual(['Наименование', 'Кол-во', 'Ед.']);
  });

  it('parses read() call without global', () => {
    const parsed = parseFileSourceFromCode(
      'sample_table = read(path("sample.csv"), header_row=0, header=["A"])',
    );
    expect(parsed.variableName).toBe('sample_table');
    expect(parsed.exportGlobal).toBe(false);
  });

  it('patches only read() line and keeps other code', () => {
    const code = `# custom logic
global document_2_Товары_table = read(path("document-2-Товары.csv"), header_row=0, header=["Наименование", "Кол-во", "Ед."])
print("done", document_2_Товары_table)`;

    const settings = {
      selectedFile: { name: 'document-2-Товары.csv' },
      selectedColumns: ['Наименование', 'Кол-во'],
      excelHeaderRow: 1,
      exportGlobal: true,
    };

    const { code: patched } = patchFileSourceInCode(code, settings, ['Наименование', 'Кол-во', 'Ед.']);

    expect(patched).toContain('# custom logic');
    expect(patched).toContain('print("done", document_2_Товары_table)');
    expect(patched).toMatch(
      /global document_2_Товары_table = read\(path\("document-2-Товары\.csv"\), header_row=0, header=\["Наименование", "Кол-во"\]\)/
    );
  });

  it('patches read() line without global by default', () => {
    const code = `document_2_Товары_table = read(path("document-2-Товары.csv"), header_row=0, header=["Наименование", "Кол-во", "Ед."])`;

    const settings = {
      selectedFile: { name: 'document-2-Товары.csv' },
      selectedColumns: ['Наименование', 'Кол-во'],
      excelHeaderRow: 1,
    };

    const { code: patched } = patchFileSourceInCode(code, settings, ['Наименование', 'Кол-во', 'Ед.']);

    expect(patched).toMatch(
      /^document_2_Товары_table = read\(path\("document-2-Товары\.csv"\), header_row=0, header=\["Наименование", "Кол-во"\]\)$/
    );
    expect(patched).not.toMatch(/^global /m);
  });

  it('renames variable when file changes', () => {
    const code = `global old_file_table = read(path("old.csv"), header_row=0, header=["A"])
print(table_info(old_file_table))`;

    const settings = {
      selectedFile: { name: 'sample.csv' },
      selectedColumns: ['X', 'Y'],
      excelHeaderRow: 1,
      exportGlobal: true,
    };

    const { code: patched, variableName } = patchFileSourceInCode(
      code,
      settings,
      ['X', 'Y'],
      { previousVariableName: 'old_file_table' },
    );

    expect(variableName).toBe('sample_table');
    expect(patched).toContain('global sample_table = read(path("sample.csv")');
    expect(patched).toContain('print(table_info(sample_table))');
    expect(patched).not.toContain('old_file_table');
  });

  it('maps parsed read() back to widget settings', () => {
    const parsed = parseFileSourceFromCode(
      'global sample_table = read(path("sample.csv"), header_row=2, header=["A", "B"])',
    );
    const updates = settingsUpdatesFromParsedRead(parsed, ['A', 'B', 'C']);

    expect(updates.sourcePath).toBe('sample.csv');
    expect(updates.selectedColumns).toEqual(['A', 'B']);
    expect(updates.excelHeaderRow).toBe(3);
    expect(updates.dataCodeVariableName).toBe('');
    expect(updates.exportGlobal).toBe(true);
  });

  it('preserves global from existing code when settings omit exportGlobal', () => {
    const code = 'global sample_table = read(path("sample.csv"), header_row=0, header=["A"])';
    const settings = {
      selectedFile: { name: 'sample.csv' },
      selectedColumns: ['A'],
      excelHeaderRow: 1,
    };

    const { code: patched, exportGlobal } = patchFileSourceInCode(code, settings, ['A']);

    expect(exportGlobal).toBe(true);
    expect(patched).toMatch(/^global sample_table = read\(/);
  });

  it('maps parsed read() without global to exportGlobal false', () => {
    const parsed = parseFileSourceFromCode(
      'sample_table = read(path("sample.csv"), header_row=0, header=["A"])',
    );
    const updates = settingsUpdatesFromParsedRead(parsed, ['A']);
    expect(updates.exportGlobal).toBe(false);
  });

  it('builds read() without global by default', () => {
    const line = buildFileSourceAssignmentLine(
      { selectedFile: { name: 'a.csv' }, selectedColumns: ['Col'] },
      ['Col'],
    );
    expect(line).toMatch(/^a_table = read\(/);
    expect(line).not.toContain('global');
    expect(line).not.toContain('read_file');
  });

  it('builds read() with global when exportGlobal is enabled', () => {
    const line = buildFileSourceAssignmentLine(
      { selectedFile: { name: 'a.csv' }, selectedColumns: ['Col'], exportGlobal: true },
      ['Col'],
    );
    expect(line).toMatch(/^global a_table = read\(/);
  });

  it('builds read() with headerT when transposed', () => {
    const line = buildFileSourceAssignmentLine(
      {
        selectedFile: { name: 'a.csv' },
        selectedColumns: ['Product', 'Apple', 'Banana'],
        isTransposed: true,
      },
      ['Product', 'Apple', 'Banana'],
    );
    expect(line).toContain('headerT=["Product", "Apple", "Banana"]');
    expect(line).not.toContain('header=[');
  });

  it('parses headerT from code and sets isTransposed', () => {
    const parsed = parseFileSourceFromCode(
      'sample_table = read(path("sample.csv"), header_row=0, headerT=["Product", "Apple"])',
    );
    expect(parsed.isTransposed).toBe(true);
    expect(parsed.selectedColumns).toEqual(['Product', 'Apple']);
  });

  it('uses custom dataCodeVariableName in assignment line', () => {
    const line = buildFileSourceAssignmentLine(
      {
        selectedFile: { name: 'sample.xlsx' },
        selectedColumns: ['A'],
        dataCodeVariableName: 'my_sales_table',
      },
      ['A'],
    );
    expect(line).toMatch(/^my_sales_table = read\(/);
    expect(line).not.toContain('sample_table');
  });

  it('patches variable rename when dataCodeVariableName changes', () => {
    const code = 'sample_table = read(path("sample.csv"), header_row=0, header=["A"])\nprint(table_info(sample_table))';
    const settings = {
      selectedFile: { name: 'sample.csv' },
      selectedColumns: ['A'],
      dataCodeVariableName: 'sales_data',
    };
    const { code: patched } = patchFileSourceInCode(code, settings, ['A'], {
      previousVariableName: 'sample_table',
    });
    expect(patched).toContain('sales_data = read(');
    expect(patched).toContain('print(table_info(sales_data))');
    expect(patched).not.toContain('sample_table');
  });

  it('does not overwrite explicit custom variable name from stale code', () => {
    const parsed = parseFileSourceFromCode(
      'sample_table = read(path("sample.csv"), header_row=0, header=["A"])',
    );
    const updates = settingsUpdatesFromParsedRead(parsed, ['A'], {
      selectedFile: { name: 'sample.csv' },
      dataCodeVariableName: 'my_sales',
    });
    expect(updates.dataCodeVariableName).toBeUndefined();
  });

  it('keeps custom variable name when reopening editor after rename', () => {
    const code = 'my_sales = read(path("sample.csv"), header_row=0, header=["A"])\nprint(table_info(my_sales))';
    const settings = {
      selectedFile: { name: 'sample.csv' },
      selectedColumns: ['A'],
      dataCodeVariableName: 'my_sales',
    };
    const { code: patched, variableName } = patchFileSourceInCode(code, settings, ['A'], {
      previousVariableName: 'my_sales',
    });
    expect(variableName).toBe('my_sales');
    expect(patched).toContain('my_sales = read(');
    expect(patched).not.toContain('sample_table');
  });

  it('builds folder source code with smb lib path', () => {
    const code = generateDefaultFolderSourceCode({
      sourceType: 'folder',
      fileDeliveryMode: 'smb',
      smbShareName: 'Shared_dir',
      smbSharePath: 'data/reports',
      selectedFolder: { name: 'reports', smbPath: 'data/reports' },
    });
    expect(code).toContain('list_files(path("lib://Shared_dir/data/reports"))');
  });

  it('resolves folder smb source path', () => {
    expect(resolveSourcePathForSettings({
      sourceType: 'folder',
      fileDeliveryMode: 'smb',
      smbShareName: 'Data',
      smbSharePath: 'reports',
    })).toBe('lib://Data/reports');
  });

  it('renames identifier without touching substrings', () => {
    const code = 'global foo_table = read(...)\nprint(foo_table)';
    expect(renameIdentifierInCode(code, 'foo_table', 'bar_table')).toBe(
      'global bar_table = read(...)\nprint(bar_table)',
    );
  });
});
