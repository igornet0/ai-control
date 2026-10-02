import { describe, expect, it } from 'vitest';
import {
  resolveModelTableFromFormula,
  resolvePreviewExecutionContext,
} from '../src/formula/formulaInference.js';

const schemaTables = [
  { modelId: 10, tableName: 'orders', label: 'Sales → orders' },
  { modelId: 20, tableName: 'orders', label: 'Warehouse → orders' },
  { modelId: 20, tableName: 'stock', label: 'Warehouse → stock' },
];

describe('resolveModelTableFromFormula with several data models', () => {
  it('does not pick the first model when the same table exists in two models', () => {
    expect(resolveModelTableFromFormula('SUM([orders.amount])', schemaTables)).toBeNull();
  });

  it('uses preferredModelId when table names collide', () => {
    expect(resolveModelTableFromFormula('SUM([orders.amount])', schemaTables, 20)).toEqual({
      modelId: 20,
      table: 'orders',
    });
    expect(resolveModelTableFromFormula('SUM([orders.amount])', schemaTables, '10')).toEqual({
      modelId: 10,
      table: 'orders',
    });
  });

  it('still resolves a unique table name across models', () => {
    expect(resolveModelTableFromFormula('SUM([stock.qty])', schemaTables)).toEqual({
      modelId: 20,
      table: 'stock',
    });
  });
});

describe('resolvePreviewExecutionContext', () => {
  it('keeps an explicit widget dataSource even when table names collide', () => {
    expect(
      resolvePreviewExecutionContext(
        { modelId: '20', table: 'orders' },
        'SUM([orders.amount])',
        schemaTables,
      ),
    ).toEqual({ modelId: '20', table: 'orders' });
  });

  it('uses dataSource.modelId when formula has no explicit table binding', () => {
    expect(
      resolvePreviewExecutionContext(
        { modelId: 10 },
        'SUM([orders.amount])',
        schemaTables,
        'orders',
      ),
    ).toEqual({ modelId: 10, table: 'orders' });
  });
});
