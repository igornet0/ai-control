import { describe, expect, it } from 'vitest';
import {
  domainFromMinMax,
  filtersExcludingField,
  formatFilterSelectionSummary,
  isBooleanFilterType,
  isNumericFilterType,
  numericDomainFromValues,
  normalizeFilterAppearance,
  normalizeFilterSelection,
  resolveFilterAppearance,
  resolveFilterSelection,
} from '../src/widgets/filter/filterAppearance.js';

describe('filterAppearance', () => {
  it('normalizes unknown appearance to auto', () => {
    expect(normalizeFilterAppearance('')).toBe('auto');
    expect(normalizeFilterAppearance('cards')).toBe('auto');
    expect(normalizeFilterAppearance('Segmented')).toBe('segmented');
  });

  it('auto: boolean → segmented, float → slider, integer/string → select', () => {
    expect(resolveFilterAppearance({ appearance: 'auto', type: 'boolean' })).toBe('segmented');
    expect(resolveFilterAppearance({ appearance: 'auto', type: 'float' })).toBe('slider');
    expect(resolveFilterAppearance({ appearance: 'auto', type: 'integer' })).toBe('select');
    expect(resolveFilterAppearance({ appearance: 'auto', type: 'string' })).toBe('select');
  });

  it('auto uses cardinality for string enums', () => {
    expect(resolveFilterAppearance({ type: 'string' }, { distinctCount: 3 })).toBe('segmented');
    expect(resolveFilterAppearance({ type: 'string' }, { distinctCount: 8 })).toBe('chips');
    expect(resolveFilterAppearance({ type: 'string' }, { distinctCount: 80 })).toBe('select');
  });

  it('explicit appearance wins over auto', () => {
    expect(resolveFilterAppearance({ appearance: 'chips', type: 'boolean' })).toBe('chips');
    expect(resolveFilterAppearance({ appearance: 'select', type: 'integer' })).toBe('select');
  });

  it('selection defaults: segmented single, chips/checkbox multiple', () => {
    expect(resolveFilterSelection({}, 'segmented')).toBe('single');
    expect(resolveFilterSelection({}, 'chips')).toBe('multiple');
    expect(resolveFilterSelection({}, 'checkbox')).toBe('multiple');
    expect(resolveFilterSelection({ selection: 'single' }, 'checkbox')).toBe('single');
  });

  it('formats select summary', () => {
    expect(formatFilterSelectionSummary({ selectedValues: [] })).toBe('Все');
    expect(formatFilterSelectionSummary({ selectedValues: ['Active'] })).toBe('Active');
    expect(formatFilterSelectionSummary({ selectedValues: ['A', 'B'] })).toBe('2 выбрано');
  });

  it('numeric helpers', () => {
    expect(isNumericFilterType('float')).toBe(true);
    expect(isBooleanFilterType('boolean')).toBe(true);
    expect(numericDomainFromValues(['10', '2', 'x', '8'])).toEqual({ min: 2, max: 10 });
    expect(normalizeFilterSelection('multiple')).toBe('multiple');
  });

  it('filtersExcludingField drops the slider column so domain can expand again', () => {
    const filters = [
      { table: 'sales', column: 'amount', op: 'gte', value: 10 },
      { table: 'sales', column: 'amount', op: 'lte', value: 50 },
      { table: 'sales', column: 'status', op: 'in', values: ['A'] },
    ];
    expect(filtersExcludingField(filters, { table: 'sales', field: 'amount' })).toEqual([
      { table: 'sales', column: 'status', op: 'in', values: ['A'] },
    ]);
  });

  it('domainFromMinMax', () => {
    expect(domainFromMinMax('2', '10')).toEqual({ min: 2, max: 10 });
    expect(domainFromMinMax(5, 5)).toEqual({ min: 5, max: 6 });
  });
});
