/** Schema-driven config for interactive data source widget */

export const FIELD_TYPES = [
  { value: 'string', label: 'string' },
  { value: 'int', label: 'int' },
  { value: 'float', label: 'float' },
  { value: 'bool', label: 'bool' },
  { value: 'datetime', label: 'datetime' },
  { value: 'array', label: 'array' },
  { value: 'object', label: 'object' },
  { value: 'image', label: 'image' },
  { value: 'audio', label: 'audio' },
  { value: 'video', label: 'video' },
  { value: 'file', label: 'file' },
];

export const MEDIA_FIELD_TYPES = new Set(['image', 'audio', 'video', 'file']);

export const VARIABLE_TYPES = FIELD_TYPES.filter((t) => t.value !== 'datetime');

export const TABLE_TEMPLATES = {
  users: {
    label: 'Users',
    name: 'users',
    fields: [
      { name: 'id', type: 'int', nullable: false, defaultValue: '', primaryKey: true, unique: true },
      { name: 'name', type: 'string', nullable: false, defaultValue: '', primaryKey: false, unique: false },
      { name: 'email', type: 'string', nullable: true, defaultValue: '', primaryKey: false, unique: true },
      { name: 'age', type: 'int', nullable: true, defaultValue: '', primaryKey: false, unique: false },
    ],
    rows: [
      [1, 'Alex', 'alex@example.com', 28],
      [2, 'John', 'john@example.com', 32],
    ],
  },
  products: {
    label: 'Products',
    name: 'products',
    fields: [
      { name: 'id', type: 'int', nullable: false, defaultValue: '', primaryKey: true, unique: true },
      { name: 'name', type: 'string', nullable: false, defaultValue: '', primaryKey: false, unique: false },
      { name: 'price', type: 'float', nullable: false, defaultValue: '0', primaryKey: false, unique: false },
      { name: 'category', type: 'string', nullable: true, defaultValue: '', primaryKey: false, unique: false },
    ],
    rows: [
      [1, 'Widget A', 19.99, 'Tools'],
      [2, 'Widget B', 29.5, 'Electronics'],
    ],
  },
  orders: {
    label: 'Orders',
    name: 'orders',
    fields: [
      { name: 'id', type: 'int', nullable: false, defaultValue: '', primaryKey: true, unique: true },
      { name: 'user_id', type: 'int', nullable: false, defaultValue: '', primaryKey: false, unique: false },
      { name: 'product_id', type: 'int', nullable: false, defaultValue: '', primaryKey: false, unique: false },
      { name: 'quantity', type: 'int', nullable: false, defaultValue: '1', primaryKey: false, unique: false },
      { name: 'total', type: 'float', nullable: false, defaultValue: '0', primaryKey: false, unique: false },
    ],
    rows: [
      [1, 1, 1, 2, 39.98],
      [2, 2, 2, 1, 29.5],
    ],
  },
  analytics_events: {
    label: 'Analytics Events',
    name: 'analytics_events',
    fields: [
      { name: 'id', type: 'int', nullable: false, defaultValue: '', primaryKey: true, unique: true },
      { name: 'event_type', type: 'string', nullable: false, defaultValue: '', primaryKey: false, unique: false },
      { name: 'timestamp', type: 'datetime', nullable: false, defaultValue: '', primaryKey: false, unique: false },
      { name: 'user_id', type: 'int', nullable: true, defaultValue: '', primaryKey: false, unique: false },
      { name: 'properties', type: 'object', nullable: true, defaultValue: '{}', primaryKey: false, unique: false },
    ],
    rows: [
      [1, 'page_view', '2025-01-15T10:00:00', 1, { page: '/home' }],
      [2, 'click', '2025-01-15T10:05:00', 1, { button: 'signup' }],
    ],
  },
};

const IDENT_RE = /^[\p{L}_][\p{L}\p{N}_]*$/u;

export function fileBaseName(filePath) {
  const name = String(filePath || '').trim();
  const slash = Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\'));
  const base = slash >= 0 ? name.slice(slash + 1) : name;
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(0, dot) : base;
}

export function tableVariableNameFromFileName(fileName, fallback = 'data_table') {
  const base = fileBaseName(fileName);
  if (!base) return fallback;
  return sanitizeIdentifier(`${base}_table`, fallback);
}

export function createId() {
  return crypto.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createField(overrides = {}) {
  return {
    id: createId(),
    name: `field_${Math.floor(Math.random() * 900 + 100)}`,
    type: 'string',
    nullable: true,
    defaultValue: '',
    primaryKey: false,
    unique: false,
    ...overrides,
  };
}

export function sanitizeIdentifier(name, fallback = 'item') {
  let cleaned = String(name || '')
    .trim()
    .replace(/[^\p{L}\p{N}_]/gu, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (cleaned && /^\d/u.test(cleaned)) {
    cleaned = `_${cleaned}`;
  }
  if (!cleaned || !IDENT_RE.test(cleaned)) return fallback;
  return cleaned;
}

export function validateIdentifier(name) {
  if (!name || !String(name).trim()) return 'Имя обязательно';
  if (!IDENT_RE.test(String(name).trim())) {
    return 'Только буквы, цифры и _, не начиная с цифры';
  }
  return null;
}

export function createDefaultInteractiveConfig(kind = 'table') {
  if (kind === 'variable') {
    return {
      kind: 'variable',
      variable: {
        name: 'my_variable',
        type: 'string',
        value: '',
      },
    };
  }
  return {
    kind: 'table',
    table: {
      name: 'my_table',
      fields: [
        createField({ name: 'id', type: 'int', nullable: false, primaryKey: true, unique: true }),
        createField({ name: 'name', type: 'string', nullable: false }),
      ],
      rows: [[1, 'Example']],
    },
  };
}

export function normalizeInteractiveConfig(raw) {
  if (!raw || typeof raw !== 'object') {
    return createDefaultInteractiveConfig('table');
  }
  const kind = raw.kind === 'variable' ? 'variable' : 'table';
  if (kind === 'variable') {
    const v = raw.variable || {};
    return {
      kind: 'variable',
      variable: {
        name: sanitizeIdentifier(v.name, 'my_variable'),
        type: VARIABLE_TYPES.some((t) => t.value === v.type) ? v.type : 'string',
        value: v.value ?? '',
      },
    };
  }
  const t = raw.table || {};
  const fields = Array.isArray(t.fields) && t.fields.length
    ? t.fields.map((f) => ({
        ...createField(),
        ...f,
        id: f.id || createId(),
        name: sanitizeIdentifier(f.name, 'field'),
      }))
    : createDefaultInteractiveConfig('table').table.fields;
  const colCount = fields.length;
  const rows = Array.isArray(t.rows)
    ? t.rows.map((row) => {
        const arr = Array.isArray(row) ? [...row] : [];
        while (arr.length < colCount) arr.push('');
        return arr.slice(0, colCount);
      })
    : [];
  return {
    kind: 'table',
    table: {
      name: sanitizeIdentifier(t.name, 'my_table'),
      fields,
      rows,
    },
  };
}

export function generateMockRows(fields, count = 5) {
  const rows = [];
  for (let i = 0; i < count; i += 1) {
    rows.push(
      fields.map((field, idx) => {
        switch (field.type) {
          case 'int':
            return field.primaryKey ? i + 1 : Math.floor(Math.random() * 100);
          case 'float':
            return Math.round(Math.random() * 1000) / 10;
          case 'bool':
            return Math.random() > 0.5;
          case 'datetime':
            return new Date(Date.now() - Math.random() * 1e10).toISOString().slice(0, 19);
          case 'array':
            return [`item_${i + 1}`, `tag_${idx}`];
          case 'object':
            return { index: i + 1, field: field.name };
          default:
            return `${field.name}_${i + 1}`;
        }
      })
    );
  }
  return rows;
}

export function parsePastedTable(text, fieldCount) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  return lines.map((line) => {
    const cells = line.includes('\t') ? line.split('\t') : line.split(',');
    const row = cells.map((c) => c.trim());
    while (row.length < fieldCount) row.push('');
    return row.slice(0, fieldCount);
  });
}

function parseNumericCellValue(raw, type) {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = type === 'int' ? parseInt(raw, 10) : parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

/** Next PK value = max existing numeric value in column + 1 (or 1 if empty). */
export function getNextPrimaryKeyValue(field, rows, colIndex, excludeRowIndex = null) {
  if (!field?.primaryKey) return null;
  if (field.type !== 'int' && field.type !== 'float') return null;

  let max = null;
  for (let i = 0; i < rows.length; i += 1) {
    if (i === excludeRowIndex) continue;
    const n = parseNumericCellValue(rows[i]?.[colIndex], field.type);
    if (n !== null) {
      max = max === null ? n : Math.max(max, n);
    }
  }

  if (max === null) return field.type === 'int' ? 1 : 1;
  return field.type === 'int' ? Math.floor(max) + 1 : max + 1;
}

/** Build a new row; PK int/float columns get max + 1. */
export function buildNewRow(fields, rows) {
  return fields.map((field, colIndex) => {
    if (field.type === 'bool') return false;
    const pkValue = getNextPrimaryKeyValue(field, rows, colIndex);
    if (pkValue !== null) return pkValue;
    return field.defaultValue ?? '';
  });
}

/** Fill empty PK cells in pasted/appended rows sequentially from max + 1. */
export function fillPrimaryKeysInRows(fields, existingRows, incomingRows) {
  const allRows = [...existingRows];
  const filled = incomingRows.map((row) => {
    const nextRow = [...row];
    fields.forEach((field, colIndex) => {
      const raw = nextRow[colIndex];
      if (
        field.primaryKey
        && (raw === null || raw === undefined || raw === '')
      ) {
        const pkValue = getNextPrimaryKeyValue(field, allRows, colIndex);
        if (pkValue !== null) nextRow[colIndex] = pkValue;
      }
    });
    allRows.push(nextRow);
    return nextRow;
  });
  return filled;
}
