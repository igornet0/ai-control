import { describe, expect, it } from 'vitest';
import { computeTransposedColumnNames, resolveColumnsFromRawRows } from './fileTransposeUtils.js';

describe('fileTransposeUtils', () => {
  it('returns original headers when not transposed', () => {
    const matrix = [
      ['Product', 'Price', 'Quantity'],
      ['Apple', 100, 5],
      ['Banana', 50, 3],
    ];
    expect(resolveColumnsFromRawRows(matrix, 1, false)).toEqual(['Product', 'Price', 'Quantity']);
  });

  it('returns transposed headers from first transposed row', () => {
    const matrix = [
      ['Product', 'Price', 'Quantity'],
      ['Apple', 100, 5],
      ['Banana', 50, 3],
    ];
    expect(computeTransposedColumnNames(matrix, 0)).toEqual(['Product', 'Apple', 'Banana']);
  });
});
