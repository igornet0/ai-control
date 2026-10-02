import { describe, expect, it } from 'vitest';
import {
  applyFormulaSuggestion,
  extractFormulaNamePrefix,
  matchFormulaSuggestions,
} from './spreadsheetFormulaCatalog';

describe('spreadsheetFormulaCatalog', () => {
  it('extracts prefix after equals', () => {
    expect(extractFormulaNamePrefix('=', 1)).toBeNull();
    expect(extractFormulaNamePrefix('=СУ', 3)).toEqual({ prefix: 'СУ', tokenStart: 1 });
    expect(extractFormulaNamePrefix('=SUM(B1', 4)).toEqual({ prefix: 'SUM', tokenStart: 1 });
  });

  it('filters suggestions by first letters', () => {
    expect(matchFormulaSuggestions('')).toEqual([]);
    const su = matchFormulaSuggestions('С');
    expect(su.some((x) => x.name === 'СУММ')).toBe(true);
    expect(su.some((x) => x.name === 'СРЗНАЧ')).toBe(true);
    const sum = matchFormulaSuggestions('SU');
    expect(sum.some((x) => x.name === 'СУММ')).toBe(true);
  });

  it('inserts function with parenthesis', () => {
    const next = applyFormulaSuggestion('=СУ', 3, 3, { name: 'СУММ' });
    expect(next.value).toBe('=СУММ(');
    expect(next.selectionStart).toBe(6);
  });
});
