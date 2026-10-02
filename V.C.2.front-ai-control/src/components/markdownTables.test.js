import { describe, expect, it } from 'vitest';
import {
  matrixToClipboard,
  normalizeMarkdownTables,
} from './markdownTables';

describe('normalizeMarkdownTables', () => {
  it('expands collapsed GFM tables onto multiple lines', () => {
    const raw =
      '| Показатель | Значение | |---|---| | Всего задач | 116 | | Открыто | 75 |';
    const out = normalizeMarkdownTables(raw);
    const lines = out.split('\n');
    expect(lines.length).toBe(4);
    expect(lines[0]).toContain('Показатель');
    expect(lines[1]).toMatch(/---/);
    expect(lines[2]).toContain('Всего задач');
    expect(lines[3]).toContain('Открыто');
  });

  it('leaves already valid tables alone', () => {
    const raw = ['| A | B |', '|---|---|', '| 1 | 2 |'].join('\n');
    expect(normalizeMarkdownTables(raw)).toBe(raw);
  });
});

describe('matrixToClipboard', () => {
  const matrix = [
    ['Показатель', 'Значение'],
    ['Всего', '116'],
  ];

  it('exports TSV', () => {
    expect(matrixToClipboard(matrix, 'tsv')).toBe('Показатель\tЗначение\nВсего\t116');
  });

  it('exports CSV', () => {
    expect(matrixToClipboard(matrix, 'csv')).toBe('Показатель,Значение\nВсего,116');
  });

  it('exports markdown', () => {
    const md = matrixToClipboard(matrix, 'markdown');
    expect(md).toContain('| Показатель | Значение |');
    expect(md).toContain('| --- | --- |');
  });
});
