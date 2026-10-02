import { describe, it, expect } from 'vitest';
import { buildFormulaTemplates } from './formulaTemplates.js';

describe('buildFormulaTemplates', () => {
  it('uses available fields in examples', () => {
    const templates = buildFormulaTemplates(['price', 'qty']);
    const vat = templates.find((t) => t.id === 'vat');
    expect(vat.expression).toBe('price * 1.2');
    expect(vat.name).toBe('price_vat');
    const product = templates.find((t) => t.id === 'product');
    expect(product.expression).toBe('price * qty');
  });

  it('falls back to amount/qty when no fields', () => {
    const templates = buildFormulaTemplates([]);
    expect(templates.find((t) => t.id === 'vat').expression).toBe('amount * 1.2');
    expect(templates.some((t) => t.id === 'sum_example' || t.id === 'sum')).toBe(true);
  });
});
