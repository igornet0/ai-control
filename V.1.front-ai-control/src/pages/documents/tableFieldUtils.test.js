import { describe, expect, it } from 'vitest';
import {
  formatScalarFieldPreview,
  isTableFieldBlock,
  isTableFieldValue,
} from './tableFieldUtils';

describe('tableFieldUtils', () => {
  it('detects table field block from structure meta', () => {
    const block = { type: 'field', field_name: 'Товары' };
    const fieldsList = [{ name: 'Товары', type: 'table' }];
    expect(isTableFieldBlock(block, fieldsList)).toBe(true);
  });

  it('detects legacy table values', () => {
    expect(isTableFieldValue([{ name: 'A', qty: 1, unit: 'шт' }])).toBe(true);
    expect(isTableFieldValue(['a', 'b'])).toBe(false);
  });

  it('formats table arrays for scalar preview without crashing', () => {
    const text = formatScalarFieldPreview([{ name: 'A', qty: 1, unit: 'шт' }]);
    expect(text).toBe('1 строк');
  });
});
