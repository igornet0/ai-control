import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  coerceVariableInput,
  isScalarVariableType,
  loadModelVariableOverrides,
  modelVarsPersistenceKey,
  normalizeVariableRow,
  resolveModelVariable,
  saveModelVariableOverrides,
  scalarDefaultsFromRows,
} from '../../../services/dashboardModelVariables.js';

function memoryStorage() {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => {
      store.set(String(k), String(v));
    },
    removeItem: (k) => {
      store.delete(String(k));
    },
    clear: () => store.clear(),
  };
}

describe('dashboardModelVariables', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: memoryStorage(),
    });
  });

  afterEach(() => {
    delete globalThis.localStorage;
  });

  it('treats Table as non-scalar', () => {
    expect(isScalarVariableType('Table')).toBe(false);
    expect(isScalarVariableType('LazyTable')).toBe(false);
    expect(isScalarVariableType('Number')).toBe(true);
    expect(isScalarVariableType('String')).toBe(true);
    expect(isScalarVariableType('Bool')).toBe(true);
  });

  it('parses Number/Bool rows and skips Table defaults', () => {
    const defaults = scalarDefaultsFromRows([
      {
        variable_name: 'transactions',
        variable_type: 'Table',
        table_name: 'transactions',
        value: 'Table[0x5]',
      },
      {
        variable_name: 'sum_amount_sum',
        variable_type: 'Number',
        value: '0',
      },
      {
        variable_name: 'flag',
        variable_type: 'Bool',
        value: 'true',
      },
    ]);
    expect(defaults.transactions).toBeUndefined();
    expect(defaults.sum_amount_sum.value).toBe(0);
    expect(defaults.flag.value).toBe(true);
  });

  it('override wins over default', () => {
    const defaults = new Map([['sum_amount_sum', 0]]);
    const overrides = new Map([['sum_amount_sum', 42]]);
    expect(resolveModelVariable(defaults, overrides, 'sum_amount_sum')).toBe(42);
    expect(resolveModelVariable(defaults, new Map(), 'sum_amount_sum')).toBe(0);
    expect(resolveModelVariable(defaults, overrides, 'missing', null)).toBe(null);
  });

  it('normalizes row keys case-insensitively', () => {
    const v = normalizeVariableRow({
      Variable_Name: 'x',
      Variable_Type: 'Number',
      Value: '12',
    });
    expect(v.name).toBe('x');
    expect(v.type).toBe('Number');
    expect(v.value).toBe(12);
  });

  it('persists overrides in dashboard-scoped localStorage', () => {
    const dashId = 9;
    expect(modelVarsPersistenceKey(dashId)).toBe('dashboardUserModelVars:9');
    saveModelVariableOverrides(dashId, { sum_amount_sum: 7 });
    expect(loadModelVariableOverrides(dashId)).toEqual({ sum_amount_sum: 7 });
  });

  it('coerces button input by catalog type', () => {
    expect(coerceVariableInput('Number', '15')).toBe(15);
    expect(coerceVariableInput('Bool', 'true')).toBe(true);
    expect(coerceVariableInput('', '3.5')).toBe(3.5);
  });
});
