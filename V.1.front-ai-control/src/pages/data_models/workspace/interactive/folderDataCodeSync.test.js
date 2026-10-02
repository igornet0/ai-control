import { describe, expect, it } from 'vitest';
import { generateFolderSourceCode } from './folderDataCodeSync.js';
import { ensureFolderConfig } from './folderConfigSchema.js';

describe('folderDataCodeSync', () => {
  const inventory = [
    { name: 'sales_EU.csv', path: '2025/01/sales_EU.csv', smbPath: 'model_data/2025/01/sales_EU.csv', size: 100 },
    { name: 'sales_US.csv', path: '2025/02/sales_US.csv', smbPath: 'model_data/2025/02/sales_US.csv', size: 120 },
    { name: 'inventory_EU.csv', path: '2025/01/inventory_EU.csv', smbPath: 'model_data/2025/01/inventory_EU.csv', size: 80 },
  ];

  const widgetSettings = {
    sourceType: 'folder',
    fileDeliveryMode: 'smb',
    smbShareName: 'Shared_dir',
    smbSharePath: 'model_data',
    selectedFolder: { name: 'model_data', files: inventory },
    exportGlobal: true,
  };

  it('generates append with read for grouped files', () => {
    const config = ensureFolderConfig({
      version: 2,
      name: 'model_data',
      discovery: { fileNameFilter: '*.csv' },
      extractors: [
        { name: 'type', source: 'filename', method: 'split', delimiter: '_', index: 0 },
        { name: 'region', source: 'filename', method: 'regex', pattern: '_(EU|US)', group: 1 },
      ],
      grouping: { keys: ['type'] },
      tableNaming: { template: '{type}' },
      merge: { strategy: 'append' },
    });

    const code = generateFolderSourceCode(widgetSettings, config);
    expect(code).toContain('global sales = append([');
    expect(code).toContain('read(path("lib://Shared_dir/model_data/2025/01/sales_EU.csv")');
    expect(code).toContain('read(path("lib://Shared_dir/model_data/2025/02/sales_US.csv")');
    expect(code).toContain('global inventory =');
  });

  it('generates single read for one-file group', () => {
    const config = ensureFolderConfig({
      version: 2,
      groups: [{
        tableName: 'sales_EU',
        key: { type: 'sales', region: 'EU' },
        files: [inventory[0]],
        schema: { excelHeaderRow: 1, fields: [], perFile: {} },
      }],
    });
    const code = generateFolderSourceCode(widgetSettings, config);
    expect(code).toContain('global sales_EU = read(path("lib://Shared_dir/model_data/2025/01/sales_EU.csv"), header_row=0)');
    expect(code).not.toContain('append');
  });
});
