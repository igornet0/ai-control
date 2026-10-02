import { describe, expect, it } from 'vitest';
import {
  fileBaseName,
  sanitizeIdentifier,
  tableVariableNameFromFileName,
} from './schema.js';

describe('sanitizeIdentifier', () => {
  it('keeps Cyrillic letters', () => {
    expect(sanitizeIdentifier('Товары')).toBe('Товары');
  });

  it('replaces hyphens with a single underscore', () => {
    expect(sanitizeIdentifier('document-2-Товары')).toBe('document_2_Товары');
  });

  it('collapses repeated underscores', () => {
    expect(sanitizeIdentifier('a___b')).toBe('a_b');
  });
});

describe('tableVariableNameFromFileName', () => {
  it('builds a readable table variable from a Cyrillic CSV name', () => {
    expect(tableVariableNameFromFileName('document-2-Товары.csv')).toBe('document_2_Товары_table');
  });

  it('uses only the basename from a path', () => {
    expect(tableVariableNameFromFileName('/data/document-2-Товары.csv')).toBe('document_2_Товары_table');
  });
});

describe('fileBaseName', () => {
  it('strips extension but keeps inner dots', () => {
    expect(fileBaseName('report.v2.csv')).toBe('report.v2');
  });
});
