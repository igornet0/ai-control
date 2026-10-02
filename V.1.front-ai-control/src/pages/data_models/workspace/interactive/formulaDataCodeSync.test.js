import { describe, it, expect } from 'vitest';
import {
  buildFormulaExpressionLine,
  generateFormulaDataCode,
  resolveFormulaExpressionMode,
  stripFormulaBlocks,
  patchFormulaDataCodeInCode,
} from './formulaDataCodeSync.js';

describe('formulaDataCodeSync', () => {
  const fields = ['id', 'amount', 'qty', 'status'];

  it('generates simple map expression for add mode', () => {
    const line = buildFormulaExpressionLine(
      'orders',
      { name: 'amount_vat', expression: 'amount * 1.2' },
      fields,
    );
    expect(line).toBe('orders!["amount_vat"] = orders["amount"].map(fn(v) => v * 1.2)');
  });

  it('auto-replaces when target name is an existing field', () => {
    expect(resolveFormulaExpressionMode({ name: 'amount' }, fields)).toBe('replace');
    expect(resolveFormulaExpressionMode({ name: 'amount_vat' }, fields)).toBe('add');
    const line = buildFormulaExpressionLine(
      'orders',
      { name: 'amount', expression: 'amount * 1.2' },
      fields,
    );
    expect(line).toBe('orders!["amount"] = orders["amount"].map(fn(v) => v * 1.2)');
  });

  it('generates multi-column expression (no replacement) as-is', () => {
    const line = buildFormulaExpressionLine(
      'orders',
      { name: 'profit', expression: 'amount - qty' },
      fields,
    );
    // When expression references multiple columns, the first detected source is used.
    expect(line).toBe('orders!["profit"] = orders["amount"].map(fn(v) => v - qty)');
  });

  it('returns null for empty name or expression', () => {
    expect(buildFormulaExpressionLine('orders', { name: '', expression: 'x * 2' }, fields)).toBeNull();
    expect(buildFormulaExpressionLine('orders', { name: 'x', expression: '' }, fields)).toBeNull();
  });

  it('generates full DataCode block', () => {
    const code = generateFormulaDataCode(
      {
        name: 'Order VAT',
        expressions: [{ name: 'amount_vat', expression: 'amount * 1.2' }],
        availableFields: fields,
      },
      { inputVariable: 'orders' },
    );
    expect(code).toContain('# Formula: Order VAT');
    expect(code).toContain('# Input table: orders');
    expect(code).toContain('# expressions: amount_vat = amount * 1.2 (add)');
    expect(code).toContain('orders!["amount_vat"] = orders["amount"].map(fn(v) => v * 1.2)');
    expect(code).toContain('print("orders: ", table_info(orders))');
  });

  it('generates multiple expression lines', () => {
    const code = generateFormulaDataCode(
      {
        name: 'Calc',
        expressions: [
          { name: 'amount_vat', expression: 'amount * 1.2' },
          { name: 'qty_double', expression: 'qty * 2' },
        ],
        availableFields: fields,
      },
      { inputVariable: 'orders' },
    );
    expect(code).toContain('orders!["amount_vat"] = orders["amount"].map(fn(v) => v * 1.2)');
    expect(code).toContain('orders!["qty_double"] = orders["qty"].map(fn(v) => v * 2)');
  });

  it('generates pass-through comment when no expressions', () => {
    const code = generateFormulaDataCode(
      { name: 'Empty', expressions: [], availableFields: fields },
      { inputVariable: 'orders' },
    );
    expect(code).toContain('# No expressions / variables defined — pass-through');
    expect(code).toContain('print("orders: ", table_info(orders))');
  });

  it('strips and deduplicates formula blocks on patch', () => {
    const block = generateFormulaDataCode(
      {
        name: 'Order VAT',
        expressions: [{ name: 'amount_vat', expression: 'amount * 1.2' }],
        availableFields: fields,
      },
      { inputVariable: 'orders' },
    );
    const duplicated = `${block}\n\n${block}`;
    const { code } = patchFormulaDataCodeInCode(
      duplicated,
      {
        name: 'Order VAT',
        expressions: [{ name: 'amount_vat', expression: 'amount * 1.2' }],
        availableFields: fields,
      },
      { inputVariable: 'orders' },
    );
    expect((code.match(/# Formula:/g) || []).length).toBe(1);
    expect(stripFormulaBlocks(duplicated)).toBe('');
  });
});
