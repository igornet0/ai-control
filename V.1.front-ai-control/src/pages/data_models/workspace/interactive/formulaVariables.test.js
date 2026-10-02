import { describe, it, expect } from 'vitest';
import {
  buildFormulaVariableLine,
  createFormulaVariable,
  formatFormulaLiteralValue,
} from './formulaVariables.js';
import { generateFormulaDataCode } from './formulaDataCodeSync.js';

describe('formulaVariables', () => {
  it('formats literals', () => {
    expect(formatFormulaLiteralValue(1.2)).toBe('1.2');
    expect(formatFormulaLiteralValue('ok')).toBe('"ok"');
    expect(formatFormulaLiteralValue('true')).toBe('true');
    expect(formatFormulaLiteralValue(null)).toBe('null');
  });

  it('builds global sum aggregation', () => {
    expect(buildFormulaVariableLine(
      createFormulaVariable({ name: 'suma', kind: 'aggregate', func: 'sum', field: 'amount' }),
      'orders',
    )).toBe('global suma = sum(orders["amount"])');
  });

  it('builds literal without quotes for numbers', () => {
    expect(buildFormulaVariableLine(
      createFormulaVariable({ name: 'rate', kind: 'literal', value: '1.2' }),
      'orders',
    )).toBe('global rate = 1.2');
  });

  it('omits global when exportGlobal is false', () => {
    expect(buildFormulaVariableLine(
      createFormulaVariable({
        name: 'tmp',
        kind: 'expression',
        expression: '1 + 2',
        exportGlobal: false,
      }),
      'orders',
    )).toBe('tmp = 1 + 2');
  });
});

describe('generateFormulaDataCode with variables', () => {
  it('emits column formulas and global variables', () => {
    const code = generateFormulaDataCode(
      {
        name: 'Totals',
        expressions: [{ name: 'amount_vat', expression: 'amount * 1.2' }],
        variables: [
          createFormulaVariable({ name: 'suma', kind: 'aggregate', func: 'sum', field: 'amount' }),
        ],
        availableFields: ['amount'],
        outputMode: 'add',
      },
      { inputVariable: 'orders' },
    );
    expect(code).toContain('orders!["amount_vat"]');
    expect(code).toContain('global suma = sum(orders["amount"])');
    expect(code).toContain('# --- global variables (SQLite export) ---');
  });
});
