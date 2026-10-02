/** Default settings and migration for data_input widget. */

export const DATA_INPUT_FIELD_TYPES = [
  'text',
  'textarea',
  'number',
  'float',
  'boolean',
  'select',
  'multiselect',
  'date',
  'datetime',
  'email',
  'password',
  'tags',
  'relation',
  'file',
  'image',
  'formula',
];

export const DATA_INPUT_TEAM_ROLES = [
  'CEO',
  'CTO',
  'COO',
  'CFO',
  'CPO',
  'CMO',
  'Manager',
  'TeamLead',
  'Developer',
  'Engineer',
  'QAEngineer',
  'ProductOwner',
  'ProductManager',
  'Analyst',
  'Sales',
  'Marketing',
  'Support',
  'HR',
  'Designer',
  'Guest',
];

export const DEFAULT_DATA_INPUT_INSERT_ROLES = ['CEO', 'Manager'];

const LEGACY_INSERT_ROLES = new Set(['ADMIN', 'EDITOR', 'VIEWER', 'CUSTOM']);

/** @param {unknown} raw */
export function migrateInsertRoles(raw) {
  if (!Array.isArray(raw) || !raw.length) {
    return [...DEFAULT_DATA_INPUT_INSERT_ROLES];
  }
  const allowed = new Set(DATA_INPUT_TEAM_ROLES);
  const byUpper = new Map(DATA_INPUT_TEAM_ROLES.map((r) => [r.toUpperCase(), r]));
  const out = [];
  for (const item of raw) {
    const s = String(item || '').trim();
    if (!s) continue;
    if (LEGACY_INSERT_ROLES.has(s.toUpperCase())) continue;
    const norm = allowed.has(s) ? s : byUpper.get(s.toUpperCase());
    if (norm && !out.includes(norm)) out.push(norm);
  }
  return out.length ? out : [...DEFAULT_DATA_INPUT_INSERT_ROLES];
}

export function createDefaultDataInputSettings() {
  return {
    title: 'Ввод данных',
    showTitle: true,
    titleSize: 14,
    titleColor: '#8B5CF6',
    submitLabel: 'Сохранить',
    columns: 1,
    table: '',
    modelId: null,
    permissions: { insert_roles: [...DEFAULT_DATA_INPUT_INSERT_ROLES] },
    fields: [],
    schema_hash: '',
  };
}

/** @param {Record<string, unknown>} raw */
export function migrateDataInputSettings(raw) {
  const out = { ...createDefaultDataInputSettings(), ...raw };
  if (!Array.isArray(out.fields)) out.fields = [];
  if (!out.permissions || typeof out.permissions !== 'object') {
    out.permissions = { insert_roles: [...DEFAULT_DATA_INPUT_INSERT_ROLES] };
  } else {
    out.permissions = {
      ...out.permissions,
      insert_roles: migrateInsertRoles(out.permissions.insert_roles),
    };
  }
  if (typeof out.showTitle !== 'boolean') out.showTitle = true;
  {
    const t = out.title != null ? String(out.title).trim() : '';
    out.title = t || 'Ввод данных';
    let ts = parseInt(out.titleSize, 10);
    if (!Number.isFinite(ts)) ts = 14;
    out.titleSize = Math.min(48, Math.max(8, ts));
    const c = String(out.titleColor || '').trim();
    out.titleColor = /^#[0-9a-fA-F]{6}$/i.test(c) ? c : '#8B5CF6';
  }
  const mid = out.modelId ?? out.model_id;
  out.modelId = mid != null ? Number(mid) || mid : null;
  delete out.model_id;
  out.columns = Math.min(3, Math.max(1, parseInt(out.columns, 10) || 1));
  return out;
}

/** @param {object} field */
/** Map SQLite / schema column metadata to data_input field type. */
export function mapSchemaColumnToFieldType(colOrType) {
  const t =
    typeof colOrType === 'string'
      ? colOrType.toLowerCase()
      : String(colOrType?.type || colOrType?.sqlite_type || '').toLowerCase();
  if (!t) return 'text';
  if (t.includes('bool')) return 'boolean';
  if (t === 'float' || t === 'real' || t.includes('double') || t.includes('decimal')) return 'float';
  if (t === 'number' || t === 'integer' || t === 'int' || t.includes('int')) return 'number';
  if (
    t.includes('datetime') ||
    t.includes('timestamp') ||
    (t.includes('date') && t.includes('time'))
  ) {
    return 'datetime';
  }
  if (t.includes('date')) return 'date';
  return 'text';
}

/** @param {{ name?: string, type?: string, sqlite_type?: string, nullable?: boolean }} col */
export function createDataInputFieldFromColumn(col) {
  const name = String(col?.name || '').trim();
  if (!name || name.startsWith('__')) return null;
  const isPk = !!(col?.pk || col?.isPrimaryKey || col?.primaryKey);
  return {
    name,
    type: mapSchemaColumnToFieldType(col),
    label: name,
    required: isPk || col?.nullable === false,
    isPrimaryKey: isPk,
  };
}

function normalizeOptionsSource(f) {
  const src = String(f?.optionsSource || '').trim().toLowerCase();
  if (src === 'formula' || src === 'manual') return src;
  return String(f?.optionsFormula || '').trim() ? 'formula' : 'manual';
}

export function normalizeFieldDef(field, index = 0) {
  const f = field || {};
  return {
    id: f.id || `field_${index + 1}`,
    name: String(f.name || ''),
    type: DATA_INPUT_FIELD_TYPES.includes(f.type) ? f.type : 'text',
    label: f.label != null ? String(f.label) : String(f.name || ''),
    placeholder: f.placeholder != null ? String(f.placeholder) : '',
    default: f.default,
    readonly: !!f.readonly,
    hidden: !!f.hidden,
    required: !!f.required,
    isPrimaryKey: !!(f.isPrimaryKey || f.primaryKey || f.pk),
    validationMessage: f.validationMessage || '',
    mask: f.mask || '',
    autocomplete: f.autocomplete || '',
    min: f.min,
    max: f.max,
    max_length: f.max_length ?? f.maxLength,
    regex: f.regex || '',
    options: Array.isArray(f.options) ? f.options : [],
    optionsSource: normalizeOptionsSource(f),
    optionsFormula: String(f.optionsFormula || '').trim(),
    optionsLabelFormula: String(f.optionsLabelFormula || '').trim(),
    enum: Array.isArray(f.enum) ? f.enum : undefined,
    formula: f.formula || '',
    insert_roles: Array.isArray(f.insert_roles) ? f.insert_roles : undefined,
    editable: f.editable !== false,
    relationTable: f.relationTable || '',
    relationColumn: f.relationColumn || '',
  };
}
