import { describe, expect, it } from 'vitest';
import {
  createDataInputFieldFromColumn,
  mapSchemaColumnToFieldType,
  migrateDataInputSettings,
  normalizeFieldDef,
} from '../src/widgets/data-input/dataInputSchema.js';
import {
  defaultSelectOptionsFormula,
  distinctValuesToOptions,
  fieldUsesOptionsFormula,
  pairsToOptions,
  parseOptionsFormulaFieldRef,
} from '../src/widgets/data-input/dataInputSelectOptions.js';
import { collectFormData } from '../src/widgets/data-input/dataInputFieldRenderers.js';
import { applyDataFieldToWidget } from '../../../services/dashboardFilterUtils.js';

describe('dataInputSchema', () => {
  it('migrates defaults', () => {
    const s = migrateDataInputSettings({});
    expect(s.title).toBe('Ввод данных');
    expect(s.permissions.insert_roles).toContain('CEO');
    expect(s.permissions.insert_roles).toContain('Manager');
  });

  it('migrates legacy ADMIN/EDITOR insert roles to TeamRole defaults', () => {
    const s = migrateDataInputSettings({
      permissions: { insert_roles: ['ADMIN', 'EDITOR'] },
    });
    expect(s.permissions.insert_roles).toEqual(['CEO', 'Manager']);
  });

  it('keeps TeamRole insert roles', () => {
    const s = migrateDataInputSettings({
      permissions: { insert_roles: ['Developer', 'Analyst'] },
    });
    expect(s.permissions.insert_roles).toEqual(['Developer', 'Analyst']);
  });
});

describe('dataInputSchema fields', () => {
  it('normalizes field def', () => {
    const f = normalizeFieldDef({ name: 'amount', type: 'number', required: true }, 0);
    expect(f.name).toBe('amount');
    expect(f.required).toBe(true);
  });

  it('maps sqlite column types', () => {
    expect(mapSchemaColumnToFieldType('INTEGER')).toBe('number');
    expect(mapSchemaColumnToFieldType({ type: 'boolean' })).toBe('boolean');
    expect(mapSchemaColumnToFieldType({ sqlite_type: 'REAL' })).toBe('float');
  });

  it('creates field from column', () => {
    const f = createDataInputFieldFromColumn({ name: 'title', type: 'string', nullable: false });
    expect(f?.name).toBe('title');
    expect(f?.required).toBe(true);
    expect(createDataInputFieldFromColumn({ name: '__meta' })).toBeNull();
  });

  it('marks schema primary key columns', () => {
    const f = createDataInputFieldFromColumn({ name: 'id', type: 'integer', pk: true, nullable: false });
    expect(f?.isPrimaryKey).toBe(true);
    expect(f?.required).toBe(true);
    const n = normalizeFieldDef({ name: 'id', type: 'number', primaryKey: true }, 0);
    expect(n.isPrimaryKey).toBe(true);
  });
});

describe('applyDataFieldToWidget data_input', () => {
  it('appends field on drop', () => {
    const widget = { type: 'data_input', settings: { fields: [] }, dataSource: null };
    const kind = applyDataFieldToWidget(widget, {
      modelId: 1,
      tableName: 'orders',
      fieldName: 'amount',
      type: 'number',
    });
    expect(kind).toBe('data_input');
    expect(widget.settings.table).toBe('orders');
    expect(widget.settings.fields).toHaveLength(1);
    expect(widget.settings.fields[0].name).toBe('amount');
  });
});

describe('applyDataFieldToWidget table (whole table)', () => {
  it('replaces all bindingFields from table payload', () => {
    const widget = {
      type: 'table',
      settings: {
        bindingFields: [
          { modelId: 1, table: 'old', field: 'x', type: 'string', formula: '[old.x]' },
        ],
      },
      dataSource: { type: 'data-model', modelId: 1, table: 'old' },
    };
    const kind = applyDataFieldToWidget(widget, {
      kind: 'table',
      modelId: 2,
      tableName: 'categories',
      fields: [
        { name: 'id', type: 'number' },
        { name: 'name', type: 'string' },
      ],
    });
    expect(kind).toBe('default');
    expect(widget.settings.bindingFields).toHaveLength(2);
    expect(widget.settings.bindingFields.map((b) => b.field)).toEqual(['id', 'name']);
    expect(widget.settings.bindingFields[0].formula).toBe('[categories.id]');
    expect(widget.dataSource.table).toBe('categories');
    expect(widget.dataSource.modelId).toBe(2);
  });

  it('ignores table payload on non-table widgets', () => {
    const widget = { type: 'kpi', settings: {}, dataSource: null };
    const kind = applyDataFieldToWidget(widget, {
      kind: 'table',
      modelId: 1,
      tableName: 'categories',
      fields: [{ name: 'id', type: 'number' }],
    });
    expect(kind).toBe('ignored');
  });
});

describe('collectFormData', () => {
  it('reads text input values', () => {
    document.body.innerHTML = `
      <form id="f">
        <input name="title" value="Hello" />
        <input type="checkbox" name="active" checked />
      </form>`;
    const form = document.getElementById('f');
    const data = collectFormData(form, [
      { name: 'title', type: 'text' },
      { name: 'active', type: 'boolean' },
    ]);
    expect(data.title).toBe('Hello');
    expect(data.active).toBe(true);
  });
});

describe('parseDataInputErrorDetail', () => {
  it('parses pk_taken payload', async () => {
    const { parseDataInputErrorDetail } = await import('../src/widgets/data-input/dataInputFieldRenderers.js');
    const parsed = parseDataInputErrorDetail({
      code: 'pk_taken',
      message: 'занят',
      fields: ['id'],
    });
    expect(parsed?.code).toBe('pk_taken');
    expect(parsed?.fields).toEqual(['id']);
    expect(parsed?.message).toContain('занят');
  });
});

describe('dataInput select options formula', () => {
  it('normalizes optionsSource and optionsFormula', () => {
    const manual = normalizeFieldDef({ name: 'status', type: 'select', options: [{ value: 'a', label: 'A' }] }, 0);
    expect(manual.optionsSource).toBe('manual');
    expect(manual.optionsFormula).toBe('');

    const fromFormula = normalizeFieldDef(
      { name: 'status', type: 'select', optionsFormula: '[orders.status]' },
      0,
    );
    expect(fromFormula.optionsSource).toBe('formula');
    expect(fromFormula.optionsFormula).toBe('[orders.status]');
    expect(fromFormula.optionsLabelFormula).toBe('');

    const withLabel = normalizeFieldDef(
      {
        name: 'region_id',
        type: 'select',
        optionsFormula: '[orders.region_id]',
        optionsLabelFormula: '[orders.name]',
      },
      0,
    );
    expect(withLabel.optionsLabelFormula).toBe('[orders.name]');

    const explicit = normalizeFieldDef(
      {
        name: 'status',
        type: 'select',
        optionsSource: 'manual',
        optionsFormula: '[orders.status]',
      },
      0,
    );
    expect(explicit.optionsSource).toBe('manual');
  });

  it('parses field refs for unique values', () => {
    expect(parseOptionsFormulaFieldRef('[orders.status]')).toEqual({ table: 'orders', field: 'status' });
    expect(parseOptionsFormulaFieldRef('$[orders.status]')).toEqual({ table: 'orders', field: 'status' });
    expect(parseOptionsFormulaFieldRef('UNIQUE([orders.status])')).toEqual({
      table: 'orders',
      field: 'status',
    });
    expect(parseOptionsFormulaFieldRef('[status]', 'orders')).toEqual({ table: 'orders', field: 'status' });
    expect(parseOptionsFormulaFieldRef('status', 'orders')).toEqual({ table: 'orders', field: 'status' });
    expect(defaultSelectOptionsFormula('orders', 'status')).toBe('[orders.status]');
  });

  it('maps distinct values to options', () => {
    expect(distinctValuesToOptions(['open', 'open', null, 'done'])).toEqual([
      { value: 'open', label: 'open' },
      { value: 'done', label: 'done' },
    ]);
  });

  it('maps unique value/label pairs', () => {
    expect(
      pairsToOptions(
        [
          { region_id: 1, label: 'West' },
          { region_id: 1, label: 'West duplicate' },
          { region_id: 2, label: 'East' },
          { region_id: 3, label: null },
        ],
        'region_id',
        'label',
      ),
    ).toEqual([
      { value: '1', label: 'West' },
      { value: '2', label: 'East' },
      { value: '3', label: '3' },
    ]);
  });

  it('fieldUsesOptionsFormula only for select-like formula fields', () => {
    expect(
      fieldUsesOptionsFormula({
        type: 'select',
        optionsSource: 'formula',
        optionsFormula: '[t.f]',
      }),
    ).toBe(true);
    expect(fieldUsesOptionsFormula({ type: 'select', optionsSource: 'manual', optionsFormula: '[t.f]' })).toBe(
      false,
    );
    expect(fieldUsesOptionsFormula({ type: 'text', optionsSource: 'formula', optionsFormula: '[t.f]' })).toBe(
      false,
    );
  });
});

describe('dataInputPayloadFingerprint', () => {
  it('is stable regardless of key order and trims strings', async () => {
    const { fingerprintDataInputPayload } = await import(
      '../src/widgets/data-input/dataInputPayloadFingerprint.js'
    );
    const a = fingerprintDataInputPayload({ name: '  Food ', id: '1', is_income: false });
    const b = fingerprintDataInputPayload({ is_income: false, id: '1', name: 'Food' });
    expect(a).toBe(b);
    expect(a).not.toBe(fingerprintDataInputPayload({ id: '2', name: 'Food', is_income: false }));
  });
});
