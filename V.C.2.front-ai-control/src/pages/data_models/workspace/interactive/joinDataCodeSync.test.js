import { describe, expect, it } from 'vitest';
import {
  buildJoinCall,
  formatJoinOnArgs,
  generateJoinDataCode,
  patchJoinDataCodeInCode,
  resolveJoinOutputVariableName,
  syncJoinStepsWithSources,
} from './joinDataCodeSync.js';

const users = {
  tableVariable: 'users',
  columns: ['id', 'name'],
  connectionId: 'c1',
  widgetId: '1',
  widgetName: 'Users',
};
const orders = {
  tableVariable: 'orders',
  columns: ['order_id', 'user_id', 'amount'],
  connectionId: 'c2',
  widgetId: '2',
  widgetName: 'Orders',
};

describe('joinDataCodeSync', () => {
  it('formats single and multi-key ON args', () => {
    expect(formatJoinOnArgs([{ leftColumn: 'id', rightColumn: 'user_id' }]))
      .toBe(', "id", "user_id"');
    expect(formatJoinOnArgs([{ leftColumn: 'id', rightColumn: 'id' }]))
      .toBe(', "id"');
    expect(formatJoinOnArgs([
      { leftColumn: 'department', rightColumn: 'department' },
      { leftColumn: 'country', rightColumn: 'country' },
    ])).toBe(', [["department", "department"], ["country", "country"]]');
  });

  it('builds specialized join calls', () => {
    expect(buildJoinCall('left', 'users', 'orders', {
      keys: [{ leftColumn: 'id', rightColumn: 'user_id' }],
    })).toBe('left_join(users, orders, "id", "user_id")');
    expect(buildJoinCall('cross', 'a', 'b', {})).toBe('cross_join(a, b)');
    expect(buildJoinCall('anti', 'users', 'orders', {
      keys: [{ leftColumn: 'id', rightColumn: 'user_id' }],
    })).toBe('anti_join(users, orders, "id", "user_id")');
  });

  it('generates a new-table left join', () => {
    const code = generateJoinDataCode(
      {
        name: 'Отчёт',
        joinType: 'left',
        joinSeparateOutput: true,
        exportGlobal: true,
        joinSteps: [{
          connectionId: 'c2',
          rightTableVariable: 'orders',
          keys: [{ leftColumn: 'id', rightColumn: 'user_id' }],
        }],
      },
      { sources: [users, orders], widgetId: 12 },
    );
    expect(code).toContain('# Join: Отчёт');
    expect(code).toContain('global users_join_12 = left_join(users, orders, "id", "user_id")');
    expect(code).toContain('table_info(users_join_12)');
  });

  it('assigns join back onto the parent table when separate output is off', () => {
    const code = generateJoinDataCode(
      {
        joinType: 'inner',
        joinSeparateOutput: false,
        joinSteps: [{
          rightTableVariable: 'orders',
          keys: [{ leftColumn: 'id', rightColumn: 'user_id' }],
        }],
      },
      { sources: [users, orders] },
    );
    expect(code).toContain('users = inner_join(users, orders, "id", "user_id")');
    expect(resolveJoinOutputVariableName({ joinSeparateOutput: false }, 'users')).toBe('users');
  });

  it('generates merge_tables for stacked union', () => {
    const q2 = { ...orders, tableVariable: 'q2', connectionId: 'c3' };
    const code = generateJoinDataCode(
      { joinMode: 'merge', joinSeparateOutput: true, exportGlobal: true },
      { sources: [users, orders, q2], widgetId: 3 },
    );
    expect(code).toContain('merge_tables([users, orders, q2])');
  });

  it('requires two tables and keeps a stub otherwise', () => {
    const code = generateJoinDataCode({ name: 'Join' }, { sources: [users] });
    expect(code).toContain('Need at least two incoming tables');
    expect(code).toContain('users_join = users');
  });

  it('syncs join steps to incoming right tables', () => {
    const steps = syncJoinStepsWithSources(
      { joinSteps: [{ connectionId: 'c2', keys: [{ leftColumn: 'id', rightColumn: 'user_id' }] }] },
      [users, orders],
    );
    expect(steps).toHaveLength(1);
    expect(steps[0].rightTableVariable).toBe('orders');
    expect(steps[0].keys[0].rightColumn).toBe('user_id');
  });

  it('replaces previous join block on patch', () => {
    const first = generateJoinDataCode(
      {
        joinType: 'left',
        joinSeparateOutput: true,
        joinSteps: [{ keys: [{ leftColumn: 'id', rightColumn: 'user_id' }] }],
      },
      { sources: [users, orders] },
    );
    const { code } = patchJoinDataCodeInCode(
      `${first}\n\n${first}`,
      {
        joinType: 'inner',
        joinSeparateOutput: true,
        joinSteps: [{ keys: [{ leftColumn: 'id', rightColumn: 'user_id' }] }],
      },
      { sources: [users, orders] },
    );
    expect((code.match(/# Join:/g) || []).length).toBe(1);
    expect(code).toContain('inner_join(users, orders');
  });
});
