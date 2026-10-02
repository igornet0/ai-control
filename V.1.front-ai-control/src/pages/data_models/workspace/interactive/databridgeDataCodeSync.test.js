import { describe, expect, it } from 'vitest';
import {
  generateDefaultDatabridgeSourceCode,
  patchDatabridgeSourceInCode,
  resolveDatabridgeTableName,
} from './databridgeDataCodeSync.js';

describe('databridgeDataCodeSync', () => {
  it('resolves platform table names', () => {
    expect(resolveDatabridgeTableName({ databridgeEntity: 'employees' })).toBe(
      'platform_employees',
    );
    expect(resolveDatabridgeTableName({ databridgeEntity: 'tasks' })).toBe(
      'platform_tasks',
    );
    expect(resolveDatabridgeTableName({ databridgeEntity: 'documents' })).toBe(
      'platform_documents',
    );
    expect(
      resolveDatabridgeTableName({ databridgeEntity: 'document_table_cells' }),
    ).toBe('platform_document_table_cells');
  });

  it('generates source_table assignment', () => {
    const code = generateDefaultDatabridgeSourceCode(
      { databridgeEntity: 'employees', selectedColumns: ['id', 'name'] },
      ['id', 'name'],
    );
    expect(code).toContain('source_table("platform_employees", ["id", "name"])');
    expect(code).toContain('global employees');
  });

  it('patches existing assignment', () => {
    const existing = 'global employees = source_table("platform_employees", ["id"])\nprint(1)\n';
    const { code } = patchDatabridgeSourceInCode(
      existing,
      { databridgeEntity: 'employees', selectedColumns: ['id', 'name'] },
      ['id', 'name'],
    );
    expect(code).toContain('["id", "name"]');
    expect(code).toContain('print(1)');
  });
});
