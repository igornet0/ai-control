import { describe, expect, it } from 'vitest';
import {
  applyExtractors,
  assignTableNames,
  buildFolderGroups,
  discoverFiles,
  groupFiles,
  resolveTableName,
} from './folderAttributeEngine.js';
import { matchesFileNameFilter } from './folderFilterUtils.js';
import { ensureFolderConfig, migrateFolderConfigV1, stripFolderConfigForPersist } from './folderConfigSchema.js';

const inventory = [
  { name: 'sales_EU.csv', path: '2025/01/sales_EU.csv', smbPath: 'model_data/2025/01/sales_EU.csv', size: 100, isSmb: true },
  { name: 'sales_US.csv', path: '2025/02/sales_US.csv', smbPath: 'model_data/2025/02/sales_US.csv', size: 120, isSmb: true },
  { name: 'inventory_EU.csv', path: '2025/01/inventory_EU.csv', smbPath: 'model_data/2025/01/inventory_EU.csv', size: 80, isSmb: true },
  { name: 'readme.txt', path: 'readme.txt', smbPath: 'model_data/readme.txt', size: 10, isSmb: true },
];

describe('folderFilterUtils', () => {
  it('matches semicolon-separated patterns', () => {
    expect(matchesFileNameFilter('sales.csv', '*.csv;*.xlsx')).toBe(true);
    expect(matchesFileNameFilter('readme.txt', '*.csv;*.xlsx')).toBe(false);
  });
});

describe('folderAttributeEngine', () => {
  const extractors = [
    { name: 'type', source: 'filename', method: 'split', delimiter: '_', index: 0 },
    { name: 'region', source: 'filename', method: 'regex', pattern: '_(EU|US|ASIA)', group: 1 },
    { name: 'year', source: 'path', method: 'regex', pattern: '([0-9]{4})', group: 1 },
    { name: 'month', source: 'path', method: 'regex', pattern: '/([0-9]{2})/', group: 1 },
  ];

  it('discovers data files only', () => {
    const files = discoverFiles(inventory, { fileNameFilter: '*.csv;*.xlsx', includeCSV: true }, 'model_data');
    expect(files).toHaveLength(3);
  });

  it('extracts attributes from path and filename', () => {
    const discovered = discoverFiles(inventory, { fileNameFilter: '*.csv' }, 'model_data');
    const enriched = applyExtractors(discovered, extractors, 'model_data');
    const sales = enriched.find((f) => f.name === 'sales_EU.csv');
    expect(sales.attributes).toEqual({
      type: 'sales',
      region: 'EU',
      year: '2025',
      month: '01',
    });
  });

  it('groups by type', () => {
    const discovered = discoverFiles(inventory, { fileNameFilter: '*.csv' }, 'model_data');
    const enriched = applyExtractors(discovered, extractors, 'model_data');
    const groups = groupFiles(enriched, { keys: ['type'] });
    expect(groups).toHaveLength(2);
    expect(groups.find((g) => g.key.type === 'sales')?.files).toHaveLength(2);
  });

  it('resolves table name template', () => {
    const name = resolveTableName('{type}_{region}', { type: 'sales', region: 'EU' }, {}, 'dataset');
    expect(name).toBe('sales_EU');
  });

  it('builds named groups with template', () => {
    const config = ensureFolderConfig({
      version: 2,
      name: 'model_data',
      discovery: { fileNameFilter: '*.csv', includeCSV: true, includeXLSX: true },
      extractors,
      grouping: { keys: ['type', 'region'] },
      tableNaming: { template: '{type}_{region}' },
      merge: { strategy: 'append' },
    });
    const groups = buildFolderGroups(config, inventory, 'model_data');
    const names = groups.map((g) => g.tableName).sort();
    expect(names).toContain('sales_EU');
    expect(names).toContain('sales_US');
    expect(names).toContain('inventory_EU');
  });

  it('single table when grouping keys empty', () => {
    const config = ensureFolderConfig({
      version: 2,
      discovery: { fileNameFilter: '*.csv' },
      extractors: [],
      grouping: { keys: [] },
      tableNaming: { template: '{source}' },
    });
    const groups = buildFolderGroups(config, inventory, 'model_data');
    expect(groups).toHaveLength(1);
    expect(groups[0].files.length).toBe(3);
  });
});

describe('folderConfigSchema migration', () => {
  it('migrates v1 merge config', () => {
    const v2 = migrateFolderConfigV1({
      name: 'test',
      settings: {
        aggregationType: 'merge',
        fileNameFilter: '*.csv',
        autoFields: ['year', 'month', 'file_name'],
        fields: [],
      },
    });
    expect(v2.version).toBe(2);
    expect(v2.grouping.keys).toEqual([]);
    expect(v2.extractors.some((e) => e.name === 'year')).toBe(true);
  });

  it('migrates v1 separate config', () => {
    const v2 = migrateFolderConfigV1({
      settings: { aggregationType: 'separate', autoFields: [], fields: [] },
    });
    expect(v2.grouping.keys).toContain('file_stem');
  });

  it('strips ephemeral folderData before persist', () => {
    const stripped = stripFolderConfigForPersist({
      version: 2,
      extractors: [{ name: 'region', source: 'path', method: 'regex' }],
      folderData: { name: 'data', files: [{ name: 'a.csv' }] },
    });
    expect(stripped.folderData).toBeUndefined();
    expect(stripped.extractors).toHaveLength(1);
  });
});
