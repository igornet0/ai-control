import { describe, expect, it } from 'vitest';
import {
  globalDefaultsToMap,
  resolveDocumentPlaceholders,
  resolveFieldDataPlaceholders,
  resolveFieldValuePlaceholders,
  resolveTitleTemplate,
} from './documentPlaceholders';

describe('documentPlaceholders', () => {
  it('globalDefaultsToMap builds key-value map', () => {
    expect(globalDefaultsToMap([{ key: 'CPP', value: '123' }, { key: 'company', value: 'Acme' }])).toEqual({
      CPP: '123',
      company: 'Acme',
    });
  });

  it('resolves built-in and global placeholders', () => {
    const vars = {
      номер: 5,
      вид: 'Договор',
      globalDefaults: { CPP: '7701234567', company_name: 'МОЯ компания' },
    };
    expect(resolveDocumentPlaceholders('ИНН {CPP}, № {номер}', vars)).toBe('ИНН 7701234567, № 5');
    expect(resolveDocumentPlaceholders('{company_name} — {вид}', vars)).toBe('МОЯ компания — Договор');
  });

  it('matches global keys case-insensitively', () => {
    const vars = { globalDefaults: { CPP: '999' } };
    expect(resolveDocumentPlaceholders('{cpp}', vars)).toBe('999');
  });

  it('leaves unknown placeholders intact', () => {
    expect(resolveDocumentPlaceholders('{unknown}', { globalDefaults: {} })).toBe('{unknown}');
  });

  it('resolveTitleTemplate delegates to resolveDocumentPlaceholders', () => {
    expect(resolveTitleTemplate('№ {номер}', { номер: 2 })).toBe('№ 2');
  });

  it('resolves placeholders in field default values', () => {
    const vars = { globalDefaults: { CPP: 'МОЯ название компании' } };
    expect(resolveFieldValuePlaceholders('{CPP}', vars)).toBe('МОЯ название компании');
    expect(resolveFieldValuePlaceholders('ИНН {CPP}', vars)).toBe('ИНН МОЯ название компании');
    expect(resolveFieldValuePlaceholders(42, vars)).toBe(42);
  });

  it('resolves placeholders in table field defaults', () => {
    const vars = { globalDefaults: { CPP: 'Acme' } };
    const rows = [{ name: '{CPP}', qty: '1' }];
    expect(resolveFieldValuePlaceholders(rows, vars)).toEqual([{ name: 'Acme', qty: '1' }]);
  });

  it('resolveFieldDataPlaceholders resolves all fields', () => {
    const vars = { globalDefaults: { CPP: 'Acme' } };
    expect(resolveFieldDataPlaceholders({
      Контрагент: '{CPP}',
      Склад: 'Основной',
    }, vars)).toEqual({
      Контрагент: 'Acme',
      Склад: 'Основной',
    });
  });
});
