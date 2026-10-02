import { describe, it, expect } from 'vitest';
import {
  applyTransformOpsToFields,
  resolveEffectiveColumnName,
  resolveFieldsFromWidgetChain,
} from './incomingFieldsUtils.js';
import {
  generateRelationshipDataCode,
  normalizeRelationshipSettings,
  patchRelationshipDataCodeInCode,
} from './relationshipDataCodeSync.js';
import { collectRelationshipTableSources } from './relationshipSources.js';

describe('applyTransformOpsToFields / rename', () => {
  it('renames columns in order', () => {
    const fields = applyTransformOpsToFields(['id', 'email', 'name'], {
      operations: [
        { enabled: true, type: 'renameColumn', params: { column: 'email', newName: 'email_address' } },
      ],
    });
    expect(fields).toEqual(['id', 'email_address', 'name']);
  });

  it('resolveEffectiveColumnName follows rename', () => {
    expect(resolveEffectiveColumnName('email', {
      operations: [
        { enabled: true, type: 'renameColumn', params: { column: 'email', newName: 'email_address' } },
      ],
    })).toBe('email_address');
  });
});

describe('relationshipDataCodeSync', () => {
  it('normalizes legacy fromField/toField', () => {
    const n = normalizeRelationshipSettings({
      fromField: 'customers.id',
      toField: 'orders.customer_id',
    });
    expect(n.pk).toEqual({ tableVariable: 'customers', column: 'id', widgetId: null });
    expect(n.foreignKeys[0].tableVariable).toBe('orders');
    expect(n.foreignKeys[0].column).toBe('customer_id');
  });

  it('generates primary_key + relate(PK, FK...)', () => {
    const code = generateRelationshipDataCode({
      name: 'Customers → Orders',
      pk: { tableVariable: 'customers', column: 'id' },
      foreignKeys: [
        { tableVariable: 'orders', column: 'customer_id' },
      ],
    });
    expect(code).toContain('primary_key(customers["id"])');
    expect(code).toContain('relate(customers["id"], orders["customer_id"])');
  });

  it('uses post-rename column names via sources context', () => {
    const transformWidget = {
      id: 't1',
      type: 'processing-block',
      settings: {
        blockType: 'transform',
        operations: [
          { enabled: true, type: 'renameColumn', params: { column: 'email', newName: 'email_address' } },
        ],
      },
      connections: [{ from: 'src', to: 't1' }],
    };
    const code = generateRelationshipDataCode(
      {
        pk: { tableVariable: 'customers', column: 'email' },
        foreignKeys: [{ tableVariable: 'orders', column: 'customer_id' }],
      },
      {
        sources: [
          {
            tableVariable: 'customers',
            widgetId: 't1',
            sourceWidget: transformWidget,
            columns: ['email_address'],
          },
        ],
        widgetManager: {
          getWidget: (id) => (id === 't1' ? transformWidget : null),
        },
      },
    );
    expect(code).toContain('customers["email_address"]');
    expect(code).not.toContain('customers["email"]');
  });

  it('1:1 uses only the first FK', () => {
    const code = generateRelationshipDataCode({
      name: 'Customers → Profiles',
      relationshipType: 'one-to-one',
      pk: { tableVariable: 'customers', column: 'id' },
      foreignKeys: [
        { tableVariable: 'customer_profiles', column: 'customer_id' },
        { tableVariable: 'orders', column: 'customer_id' },
      ],
    });
    expect(code).toContain('# 1:1');
    expect(code).toContain('primary_key(customers["id"])');
    expect(code).toContain('relate(customers["id"], customer_profiles["customer_id"])');
    expect(code).not.toContain('orders["customer_id"]');
  });

  it('N:M generates two primary_key and two relate via junction', () => {
    const code = generateRelationshipDataCode({
      name: 'Orders ↔ Products',
      relationshipType: 'many-to-many',
      left: { tableVariable: 'orders', column: 'id' },
      right: { tableVariable: 'products', column: 'id' },
      junction: {
        tableVariable: 'order_items',
        leftColumn: 'order_id',
        rightColumn: 'product_id',
      },
    });
    expect(code).toContain('# N:M');
    expect(code).toContain('primary_key(orders["id"])');
    expect(code).toContain('primary_key(products["id"])');
    expect(code).toContain('relate(orders["id"], order_items["order_id"])');
    expect(code).toContain('relate(products["id"], order_items["product_id"])');
  });

  it('N:M incomplete settings does not emit relate', () => {
    const code = generateRelationshipDataCode({
      relationshipType: 'many-to-many',
      left: { tableVariable: 'orders', column: 'id' },
    });
    expect(code).toContain('Configure left PK');
    expect(code).not.toContain('relate(');
  });

  it('patches existing relationship block', () => {
    const existing = '# Relationship: Old\nprimary_key(a["id"])\nrelate(a["id"], b["a_id"])\n';
    const { code } = patchRelationshipDataCodeInCode(existing, {
      name: 'New',
      pk: { tableVariable: 'customers', column: 'id' },
      foreignKeys: [{ tableVariable: 'orders', column: 'customer_id' }],
    });
    expect(code).toContain('Relationship: New');
    expect(code).toContain('relate(customers["id"], orders["customer_id"])');
  });
});

describe('collectRelationshipTableSources', () => {
  it('lists connected tables with renamed columns', () => {
    const widgets = {
      src: {
        id: 'src',
        type: 'data-source',
        settings: { name: 'Customers', tableName: 'customers', selectedColumns: ['id', 'email'] },
        connections: [],
      },
      tr: {
        id: 'tr',
        type: 'processing-block',
        settings: {
          name: 'Clean',
          blockType: 'transform',
          operations: [
            { enabled: true, type: 'renameColumn', params: { column: 'email', newName: 'email_address' } },
          ],
        },
        connections: [
          { from: 'src', to: 'tr', settings: { dataCodeVariableName: 'customers' } },
        ],
      },
      orders: {
        id: 'orders',
        type: 'data-source',
        settings: {
          name: 'Orders',
          tableName: 'orders',
          selectedColumns: ['id', 'customer_id'],
          dataCodeVariableName: 'orders',
        },
        connections: [],
      },
      rel: {
        id: 'rel',
        type: 'relationship',
        settings: { name: 'Link' },
        connections: [
          { from: 'tr', to: 'rel', settings: { dataCodeVariableName: 'customers' } },
          { from: 'orders', to: 'rel', settings: { dataCodeVariableName: 'orders' } },
        ],
      },
    };
    const widgetManager = { getWidget: (id) => widgets[id] };
    const sources = collectRelationshipTableSources(widgets.rel, widgetManager);
    expect(sources.map((s) => s.tableVariable).sort()).toEqual(['customers', 'orders']);
    const customers = sources.find((s) => s.tableVariable === 'customers');
    expect(customers.columns).toContain('email_address');
    expect(customers.columns).not.toContain('email');
  });

  it('uses selectedTable from a data-model connection', () => {
    const widgets = {
      dm: {
        id: 'dm',
        type: 'data-model',
        settings: {
          name: 'HR',
          selectedTables: [
            { name: 'employees', alias: 'employees', columns: ['id', 'name'] },
            { name: 'assets', alias: 'linked_assets', columns: ['id', 'sha'] },
          ],
        },
        connections: [],
      },
      rel: {
        id: 'rel',
        type: 'relationship',
        settings: { name: 'Link' },
        connections: [
          { from: 'dm', to: 'rel', settings: { selectedTable: 'employees' } },
        ],
      },
    };
    const sources = collectRelationshipTableSources(widgets.rel, { getWidget: (id) => widgets[id] });
    expect(sources.map((s) => s.tableVariable)).toEqual(['employees']);
    expect(sources[0].columns).toEqual(['id', 'name']);
  });
});

describe('resolveFieldsFromWidgetChain with transform', () => {
  it('applies rename when walking from transform', () => {
    const widgetManager = {
      getWidget: (id) => ({
        src: {
          id: 'src',
          type: 'data-source',
          settings: { selectedColumns: ['id', 'email'] },
          connections: [],
        },
        tr: {
          id: 'tr',
          type: 'processing-block',
          settings: {
            blockType: 'transform',
            operations: [
              { enabled: true, type: 'renameColumn', params: { column: 'email', newName: 'email_address' } },
            ],
          },
          connections: [{ from: 'src', to: 'tr' }],
        },
      }[id]),
    };
    expect(resolveFieldsFromWidgetChain(widgetManager, 'tr')).toEqual(['id', 'email_address']);
  });
});
