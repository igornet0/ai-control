import { describe, expect, it } from 'vitest';
import {
  normalizeTableConditionalRules,
  pickTableRowConditionalStyle,
} from '../src/widgets/common/tableConditionalStyle.js';

describe('tableConditionalStyle', () => {
  it('normalize drops invalid rows', () => {
    const r = normalizeTableConditionalRules([
      { field: 'amount', op: 'gt', value: 1, backgroundColor: '#fff' },
      null,
      { field: '', op: 'gt', value: 1, backgroundColor: '#fff' },
    ]);
    expect(r.length).toBe(1);
    expect(r[0].field).toBe('amount');
  });

  it('pickTableRowConditionalStyle merges zebra override', () => {
    const rules = normalizeTableConditionalRules([
      { field: 'x', op: 'eq', value: 'a', backgroundColor: '#112233', priority: 0 },
    ]);
    const st = pickTableRowConditionalStyle({ x: 'a' }, rules);
    expect(st.backgroundColor).toBe('#112233');
  });
});
