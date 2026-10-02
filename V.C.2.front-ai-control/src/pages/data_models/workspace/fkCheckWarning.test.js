import { describe, expect, it } from 'vitest';
import {
  applyFkCheckWarningsToWidgets,
  collectWidgetTableAliases,
  matchWidgetsToFkIssues,
  parseFkCheckWarnings,
} from './fkCheckWarning.js';

const WARNING = 'fk_check=warn: skipped order_items.order_id -> orders(id) (67 orphans)';

describe('parseFkCheckWarnings', () => {
  it('parses skipped FK orphan lines', () => {
    expect(parseFkCheckWarnings(WARNING)).toEqual([
      {
        childTable: 'order_items',
        childColumn: 'order_id',
        parentTable: 'orders',
        parentColumn: 'id',
        orphans: 67,
      },
    ]);
  });

  it('parses multiple skipped FKs', () => {
    const issues = parseFkCheckWarnings(
      `${WARNING}\nskipped payments.order_id -> orders(id) (12 orphans)`,
    );
    expect(issues).toHaveLength(2);
    expect(issues[1].childTable).toBe('payments');
  });
});

describe('matchWidgetsToFkIssues', () => {
  it('marks parent/child sources, in-place filter and relationship', () => {
    const orders = {
      id: '1',
      type: 'data-source',
      settings: { name: 'Orders', sourceType: 'api', tableName: 'orders' },
    };
    const items = {
      id: '2',
      type: 'data-source',
      settings: { name: 'Order Items', sourceType: 'api', tableName: 'order_items' },
    };
    const filter = {
      id: '3',
      type: 'processing-block',
      settings: { name: 'Active orders', blockType: 'filter', filterConditions: [] },
      connections: [{ from: '1', to: '3', settings: { inputVariable: 'orders' } }],
    };
    const rel = {
      id: '4',
      type: 'relationship',
      settings: {
        name: 'Orders ↔ Products',
        pk: { tableVariable: 'orders', column: 'id' },
        foreignKeys: [{ tableVariable: 'order_items', column: 'order_id' }],
      },
    };
    const regions = {
      id: '5',
      type: 'data-source',
      settings: { name: 'Regions', sourceType: 'api', tableName: 'regions' },
    };

    const issues = parseFkCheckWarnings(WARNING);
    const matches = matchWidgetsToFkIssues([orders, items, filter, rel, regions], issues);

    expect(collectWidgetTableAliases(orders).has('orders')).toBe(true);
    expect(matches.has('1')).toBe(true);
    expect(matches.has('2')).toBe(true);
    expect(matches.has('3')).toBe(true);
    expect(matches.has('4')).toBe(true);
    expect(matches.has('5')).toBe(false);
    expect(matches.get('1').roles).toContain('parent');
    expect(matches.get('2').roles).toContain('child');
    expect(matches.get('3').roles).toContain('processing');
    expect(matches.get('1').message).toContain('неполная');
  });

  it('does not mark aggregate with separate output', () => {
    const agg = {
      id: '9',
      type: 'processing-block',
      settings: {
        blockType: 'aggregate',
        aggregateSeparateOutput: true,
        dataCodeVariableName: 'orders_by_customer',
      },
      connections: [{ settings: { inputVariable: 'orders' } }],
    };
    const matches = matchWidgetsToFkIssues([agg], parseFkCheckWarnings(WARNING));
    expect(matches.has('9')).toBe(false);
  });
});

describe('applyFkCheckWarningsToWidgets', () => {
  it('sets and clears widget warnings', () => {
    const widget = {
      id: '1',
      type: 'data-source',
      settings: { tableName: 'orders' },
      fkWarning: null,
      setFkWarning(message) {
        this.fkWarning = message;
      },
    };
    applyFkCheckWarningsToWidgets([widget], WARNING);
    expect(widget.fkWarning).toContain('orders');
    applyFkCheckWarningsToWidgets([widget], '');
    expect(widget.fkWarning).toBeNull();
  });
});
