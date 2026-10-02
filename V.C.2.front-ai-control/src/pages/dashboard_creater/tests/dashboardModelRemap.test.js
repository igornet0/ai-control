import { describe, expect, it } from 'vitest';
import {
  BINDING_UNAVAILABLE_MESSAGE,
  BINDING_UNAVAILABLE_STATUS,
  buildCompatibleFieldIndex,
  linkedModelIdSet,
  remapBinding,
  remapTableModelId,
  remapWidgetRecord,
} from '../../../services/dashboardModelRemap.js';

function schemaFields(modelId) {
  return [
    { modelId, tableName: 'orders', name: 'amount', type: 'number' },
    { modelId, tableName: 'orders', name: 'status', type: 'string' },
  ];
}

describe('dashboardModelRemap', () => {
  it('remaps orphan modelId when table.field exists on a linked model', () => {
    const linked = linkedModelIdSet([20]);
    const index = buildCompatibleFieldIndex(schemaFields(20));
    const r = remapBinding(
      { modelId: 10, table: 'Orders', field: 'Amount', type: 'number' },
      linked,
      index,
    );
    expect(r.status).toBe('remapped');
    expect(r.binding.modelId).toBe(20);
    expect(r.binding.table).toBe('Orders');
    expect(r.binding.field).toBe('Amount');
  });

  it('marks unavailable when column is missing and clears modelId for write safety', () => {
    const linked = linkedModelIdSet([20]);
    const index = buildCompatibleFieldIndex(schemaFields(20));
    const r = remapBinding(
      { modelId: 10, table: 'orders', field: 'missing_col', type: 'string' },
      linked,
      index,
    );
    expect(r.status).toBe('unavailable');
    expect(r.binding.modelId).toBeNull();
    expect(r.binding.orphanedModelId).toBe(10);
    expect(r.binding.dataBindingStatus).toBe(BINDING_UNAVAILABLE_STATUS);
  });

  it('leaves still-linked modelId unchanged', () => {
    const linked = linkedModelIdSet([10]);
    const index = buildCompatibleFieldIndex(schemaFields(10));
    const binding = { modelId: 10, table: 'orders', field: 'amount' };
    const r = remapBinding(binding, linked, index);
    expect(r.status).toBe('ok');
    expect(r.binding.modelId).toBe(10);
  });

  it('remaps widget data_source and data_input settings to the new model', () => {
    const linked = linkedModelIdSet([99]);
    const index = buildCompatibleFieldIndex(schemaFields(99));
    const result = remapWidgetRecord(
      {
        id: 1,
        widget_type: 'data_input',
        data_source: { type: 'data-model', modelId: 3, table: 'orders' },
        data_config: {
          settings: {
            modelId: 3,
            table: 'orders',
            fields: [{ name: 'amount' }, { name: 'status' }],
          },
        },
      },
      linked,
      index,
    );
    expect(result.changed).toBe(true);
    expect(result.remappedCount).toBeGreaterThan(0);
    expect(result.unavailableCount).toBe(0);
    expect(result.widget.data_source.modelId).toBe(99);
    expect(result.widget.data_config.settings.modelId).toBe(99);
    expect(result.widget.data_config.settings.dataBindingStatus).toBeUndefined();
  });

  it('clears data_input modelId when table has no compatible fields', () => {
    const linked = linkedModelIdSet([99]);
    const index = buildCompatibleFieldIndex(schemaFields(99));
    const result = remapWidgetRecord(
      {
        id: 2,
        widget_type: 'data_input',
        data_source: { type: 'data-model', modelId: 3, table: 'customers', field: 'email' },
        data_config: {
          settings: { modelId: 3, table: 'customers', fields: [{ name: 'email' }] },
        },
      },
      linked,
      index,
    );
    expect(result.changed).toBe(true);
    expect(result.unavailableCount).toBeGreaterThan(0);
    expect(result.widget.data_config.settings.dataBindingStatus).toBe(BINDING_UNAVAILABLE_STATUS);
    expect(result.widget.data_config.settings.bindingError).toBe(BINDING_UNAVAILABLE_MESSAGE);
    expect(result.widget.data_config.settings.modelId).toBeNull();
    expect(result.widget.data_source.modelId).toBeNull();
  });

  it('does not rewrite a widget whose model is still linked', () => {
    const linked = linkedModelIdSet([3]);
    const index = buildCompatibleFieldIndex(schemaFields(3));
    const widget = {
      id: 3,
      widget_type: 'kpi',
      data_source: { type: 'data-model', modelId: 3, table: 'orders', field: 'amount' },
      data_config: { settings: {} },
    };
    const result = remapWidgetRecord(widget, linked, index);
    expect(result.changed).toBe(false);
    expect(result.remappedCount).toBe(0);
    expect(result.unavailableCount).toBe(0);
    expect(result.widget.data_source.modelId).toBe(3);
  });

  it('does not dirty widgets without model bindings', () => {
    const linked = linkedModelIdSet([1]);
    const index = buildCompatibleFieldIndex(schemaFields(1));
    const widget = {
      id: 4,
      widget_type: 'text',
      data_source: null,
      data_config: {},
    };
    const result = remapWidgetRecord(widget, linked, index);
    expect(result.changed).toBe(false);
    expect(result.widget.data_config).toEqual({});
  });

  it('remapTableModelId maps unique table to the linked model', () => {
    const linked = linkedModelIdSet([7]);
    const index = buildCompatibleFieldIndex(schemaFields(7));
    const r = remapTableModelId(1, 'orders', linked, index);
    expect(r.status).toBe('remapped');
    expect(r.modelId).toBe(7);
  });
});
