import { describe, expect, it } from 'vitest';
import {
  ensureInteractiveDataInputMerge,
  generateDataCodeFromConfig,
  normalizeLegacySourceMerge,
} from './dataCodeSync.js';

describe('interactive DataInput merge codegen', () => {
  it('generates table + inline source_table merge for empty interactive tables', () => {
    const { code, errors } = generateDataCodeFromConfig(
      {
        kind: 'table',
        table: {
          name: 'categories',
          fields: [
            { name: 'id', type: 'int', primaryKey: true },
            { name: 'name', type: 'string' },
            { name: 'is_income', type: 'bool' },
          ],
          rows: [],
        },
      },
      { mergeDataInputSource: true },
    );
    expect(errors).toEqual([]);
    expect(code).toContain('global categories = table([], ["id", "name", "is_income"])');
    expect(code).toContain(
      'categories = merge_tables(tables=[categories, source_table("categories")])',
    );
    expect(code).not.toContain('categories_source');
  });

  it('patches existing empty table() code idempotently', () => {
    const raw =
      'global categories = table([], ["id", "name", "is_income"])\n' +
      'print("categories: ", table_info(categories))\n';
    const once = ensureInteractiveDataInputMerge(raw);
    expect(once.merged).toEqual(['categories']);
    expect(once.code).toContain('merge_tables(tables=[categories, source_table("categories")])');
    const twice = ensureInteractiveDataInputMerge(once.code);
    expect(twice.merged).toEqual([]);
    expect(twice.code).toBe(once.code);
  });

  it('normalizes the legacy _source helper merge to the inline form', () => {
    const legacy =
      'global categories = table([], ["id"])\n' +
      'categories_source = source_table("categories")\n' +
      'categories = merge_tables(tables=[categories, categories_source])\n';
    const inline =
      'global categories = table([], ["id"])\n' +
      'categories = merge_tables(tables=[categories, source_table("categories")])\n';
    expect(normalizeLegacySourceMerge(legacy)).toBe(inline);
    const ensured = ensureInteractiveDataInputMerge(legacy);
    expect(ensured.code).toBe(inline);
    expect(ensured.merged).toEqual([]);
  });
});
