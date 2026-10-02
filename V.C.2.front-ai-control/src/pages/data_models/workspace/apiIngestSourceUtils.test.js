import { describe, expect, it } from 'vitest';
import {
  APPEND_ROW_ID_COLUMN,
  buildCurlExamples,
  buildDeveloperDocsUrl,
  buildIngestUrl,
  columnsFromPreviewRows,
  defaultTableName,
  deployStatusLabel,
  deployStatusTone,
  ensureAppendRowIdColumn,
  sanitizeTableName,
} from './apiIngestSourceUtils.js';

describe('apiIngestSourceUtils', () => {
  it('sanitizeTableName normalizes invalid characters', () => {
    expect(sanitizeTableName('Sales Data!')).toBe('Sales_Data');
    expect(sanitizeTableName('123abc')).toBe('t_123abc');
  });

  it('defaultTableName prefers widget id', () => {
    expect(defaultTableName({ id: 42, settings: { name: 'Foo' } })).toBe('source_42');
  });

  it('buildIngestUrl encodes table name', () => {
    expect(buildIngestUrl('http://localhost:8002/', 'sales')).toBe(
      'http://localhost:8002/api/v1/ingest/tables/sales',
    );
  });

  it('buildDeveloperDocsUrl appends apiBase query param', () => {
    expect(buildDeveloperDocsUrl(null)).toBe('/developer-api-docs');
    expect(
      buildDeveloperDocsUrl({
        docs_url: 'https://app.example.com/developer-api-docs',
        base_url: 'https://api.example.com/ext',
      }),
    ).toBe(
      'https://app.example.com/developer-api-docs?apiBase=https%3A%2F%2Fapi.example.com%2Fext',
    );
    expect(
      buildDeveloperDocsUrl({ docs_url: 'https://app.example.com/developer-api-docs' }),
    ).toBe('https://app.example.com/developer-api-docs');
  });

  it('buildCurlExamples includes mode query and columnar init', () => {
    const { csv, json, columnar } = buildCurlExamples('http://x/api/v1/ingest/tables/t', 'snapshot');
    expect(csv).toContain('mode=snapshot');
    expect(json).toContain('application/json');
    expect(columnar).toContain('"id": [1, 2]');
  });

  it('deployStatusLabel maps known statuses', () => {
    expect(deployStatusLabel('pending')).toContain('очеред');
    expect(deployStatusLabel('stored')).toContain('сохранены');
    expect(deployStatusLabel('deployed')).toContain('Деплой');
    expect(deployStatusTone('failed')).toBe('error');
    expect(deployStatusTone('stored')).toBe('ok');
  });

  it('columnsFromPreviewRows preserves column order', () => {
    expect(columnsFromPreviewRows([{ a: 1, b: 2 }, { b: 3, c: 4 }])).toEqual(['a', 'b', 'c']);
  });

  it('ensureAppendRowIdColumn prepends row_id only for append', () => {
    expect(ensureAppendRowIdColumn(['id', 'value'], 'snapshot')).toEqual(['id', 'value']);
    expect(ensureAppendRowIdColumn(['id', 'value'], 'append')).toEqual([
      APPEND_ROW_ID_COLUMN,
      'id',
      'value',
    ]);
    expect(ensureAppendRowIdColumn(['value', APPEND_ROW_ID_COLUMN, 'id'], 'append')).toEqual([
      APPEND_ROW_ID_COLUMN,
      'value',
      'id',
    ]);
  });
});
