import { sanitizeIdentifier, validateIdentifier } from './schema.js';

function escapeString(s) {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

function formatCellValue(value, type) {
  if (value === null || value === undefined || value === '') {
    if (type === 'bool') return 'false';
    if (type === 'int' || type === 'float') return '0';
    if (type === 'array') return '[]';
    if (type === 'object') return '{}';
    return 'null';
  }

  if (type === 'bool') {
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    const s = String(value).toLowerCase();
    return s === 'true' || s === '1' || s === 'yes' ? 'true' : 'false';
  }

  if (type === 'int') {
    const n = parseInt(value, 10);
    return Number.isFinite(n) ? String(n) : '0';
  }

  if (type === 'float') {
    const n = parseFloat(value);
    return Number.isFinite(n) ? String(n) : '0';
  }

  if (type === 'array' || type === 'object') {
    if (typeof value === 'object') {
      try {
        return formatJsonLike(value);
      } catch {
        return type === 'array' ? '[]' : '{}';
      }
    }
    const trimmed = String(value).trim();
    if (!trimmed) return type === 'array' ? '[]' : '{}';
    return trimmed.startsWith('[') || trimmed.startsWith('{') ? trimmed : `"${escapeString(trimmed)}"`;
  }

  // image | audio | video | file → asset://… or URL string
  return `"${escapeString(value)}"`;
}

function formatJsonLike(obj) {
  if (Array.isArray(obj)) {
    return `[${obj.map((v) => formatJsonValue(v)).join(', ')}]`;
  }
  if (obj && typeof obj === 'object') {
    const entries = Object.entries(obj).map(
      ([k, v]) => `${/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(k) ? k : `"${escapeString(k)}"`}: ${formatJsonValue(v)}`
    );
    return `{${entries.join(', ')}}`;
  }
  return formatJsonValue(obj);
}

function formatJsonValue(v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '0';
  if (typeof v === 'string') return `"${escapeString(v)}"`;
  if (Array.isArray(v)) return formatJsonLike(v);
  if (typeof v === 'object') return formatJsonLike(v);
  return `"${escapeString(String(v))}"`;
}

function formatFieldMeta(fields) {
  return fields
    .map((f) => {
      const flags = [];
      if (f.primaryKey) flags.push('pk');
      if (f.unique) flags.push('unique');
      if (f.nullable) flags.push('nullable');
      if (f.defaultValue) flags.push(`default=${f.defaultValue}`);
      const meta = flags.length ? ` (${flags.join(', ')})` : '';
      return `${f.name} (${f.type}${meta})`;
    })
    .join(', ');
}

export function generateDataCodeFromConfig(config, options = {}) {
  const errors = [];
  if (!config || typeof config !== 'object') {
    return { code: '', errors: ['Пустая конфигурация'] };
  }

  const lines = ['# Interactive data source — auto-generated', ''];

  if (config.kind === 'variable') {
    const v = config.variable || {};
    const nameErr = validateIdentifier(v.name);
    if (nameErr) errors.push(nameErr);
    const varName = sanitizeIdentifier(v.name, 'my_variable');
    const val = formatCellValue(v.value, v.type || 'string');
    lines.push(`global ${varName} = ${val}`);
    return { code: lines.join('\n'), errors };
  }

  const table = config.table || {};
  const nameErr = validateIdentifier(table.name);
  if (nameErr) errors.push(nameErr);
  const tableName = sanitizeIdentifier(table.name, 'my_table');
  const fields = Array.isArray(table.fields) ? table.fields : [];
  const rows = Array.isArray(table.rows) ? table.rows : [];

  if (fields.length === 0) {
    errors.push('Добавьте хотя бы одно поле таблицы');
  }

  const headerNames = fields.map((f) => `"${escapeString(f.name)}"`);
  lines.push(`# Schema: ${formatFieldMeta(fields)}`);
  lines.push('');

  const rowLines = rows.map((row) => {
    const cells = fields.map((field, idx) => formatCellValue(row?.[idx], field.type));
    return `    [${cells.join(', ')}]`;
  });

  if (rowLines.length === 0) {
    lines.push(`global ${tableName} = table([], [${headerNames.join(', ')}])`);
    if (options.mergeDataInputSource) {
      // Inline source: DataCode publishes every top-level table variable,
      // so a `${tableName}_source` helper would leak into latest.db.
      lines.push(
        `${tableName} = merge_tables(tables=[${tableName}, source_table("${tableName}")])`,
      );
    }
  } else {
    lines.push(`global ${tableName} = table([`);
    lines.push(rowLines.join(',\n'));
    lines.push(`], [${headerNames.join(', ')}])`);
  }

  lines.push(`print("${tableName}: ", table_info(${tableName}))`);

  return { code: lines.join('\n'), errors };
}

const LEGACY_SOURCE_MERGE_RE =
  /^([ \t]*)([A-Za-z_][\w]*)_source[ \t]*=[ \t]*source_table[ \t]*\([ \t]*(["'])\2\3[ \t]*\)[ \t]*\r?\n[ \t]*\2[ \t]*=[ \t]*merge_tables[ \t]*\([ \t]*tables[ \t]*=[ \t]*\[[ \t]*\2[ \t]*,[ \t]*\2_source[ \t]*\][ \t]*\)/gm;

/**
 * Rewrite the legacy `{name}_source = source_table(...)` helper merge into the
 * inline `merge_tables(tables=[name, source_table("name")])` form.
 *
 * @param {string} code
 * @returns {string}
 */
export function normalizeLegacySourceMerge(code) {
  return String(code || '').replace(
    LEGACY_SOURCE_MERGE_RE,
    (_full, indent, varName) =>
      `${indent}${varName} = merge_tables(tables=[${varName}, source_table("${varName}")])`,
  );
}

/**
 * Ensure interactive empty table() assignments also merge DataInput via source_table.
 * Idempotent once a merge (inline or legacy helper form) is present.
 *
 * @param {string} code
 * @param {string[]|Set<string>|null} [onlyTables]
 * @returns {{ code: string, merged: string[] }}
 */
export function ensureInteractiveDataInputMerge(code, onlyTables = null) {
  const text = normalizeLegacySourceMerge(code);
  if (!text.trim()) return { code: text, merged: [] };

  const allow = onlyTables == null
    ? null
    : new Set([...onlyTables].map((t) => String(t || '').trim()).filter(Boolean));

  const already = new Set();
  const alreadyRe = /([A-Za-z_][\w]*)_source\s*=\s*source_table\s*\(/g;
  let am;
  while ((am = alreadyRe.exec(text))) {
    already.add(am[1]);
  }
  const inlineRe = /([A-Za-z_][\w]*)\s*=\s*merge_tables\s*\(\s*tables\s*=\s*\[\s*\1\s*,\s*source_table\s*\(/g;
  while ((am = inlineRe.exec(text))) {
    already.add(am[1]);
  }

  const emptyAssignRe =
    /(^[ \t]*(?:global[ \t]+)?)([A-Za-z_][\w]*)[ \t]*=[ \t]*table[ \t]*\([ \t]*\[[ \t]*\][ \t]*,[ \t]*(\[[^\]]*\])[ \t]*\)[ \t]*$/gm;

  const merged = [];
  const out = text.replace(emptyAssignRe, (full, prefix, varName, cols) => {
    if (allow && !allow.has(varName)) return full;
    if (already.has(varName)) return full;
    already.add(varName);
    merged.push(varName);
    return (
      `${prefix}${varName} = table([], ${cols})\n` +
      `${varName} = merge_tables(tables=[${varName}, source_table("${varName}")])`
    );
  });

  return { code: out, merged };
}

/** Parse simple DataCode back into interactive config (best-effort round-trip) */
export function parseDataCodeToConfig(code) {
  if (!code || !String(code).trim()) return null;

  const text = String(code);
  const tableMatch = text.match(
    /global\s+(\w+)\s*=\s*table\s*\(\s*(\[[\s\S]*?\])\s*,\s*(?:header\s*=\s*)?\[([\s\S]*?)\]\s*\)/i
  );

  if (tableMatch) {
    const tableName = tableMatch[1];
    const dataStr = tableMatch[2];
    const headerStr = tableMatch[3];
    const headers = parseStringArray(headerStr);
    const rows = parseNestedArray(dataStr);

    const fields = headers.map((name, i) => ({
      id: `field-${i}-${name}`,
      name: name || `field_${i + 1}`,
      type: inferTypeFromRows(rows, i),
      nullable: true,
      defaultValue: '',
      primaryKey: i === 0,
      unique: false,
    }));

    const dataRows = rows.filter((row) => Array.isArray(row) && row.length > 0);

    return {
      kind: 'table',
      table: {
        name: tableName,
        fields,
      rows: dataRows.length ? dataRows : [],
    },
  };
}

  const varMatch = text.match(/^global\s+(\w+)\s*=\s*(.+)$/m);
  if (varMatch) {
    const varName = varMatch[1];
    const rawValue = varMatch[2].trim().replace(/#.*$/, '').trim();
    const { value, type } = parseLiteral(rawValue);
    return {
      kind: 'variable',
      variable: { name: varName, type, value },
    };
  }

  return null;
}

function parseStringArray(str) {
  const results = [];
  const re = /"((?:\\.|[^"\\])*)"/g;
  let m;
  while ((m = re.exec(str)) !== null) {
    results.push(m[1].replace(/\\"/g, '"').replace(/\\n/g, '\n'));
  }
  return results;
}

function parseNestedArray(str) {
  const trimmed = str.trim();
  if (trimmed === '[]') return [];

  try {
    const normalized = trimmed
      .replace(/(\w+):/g, '"$1":')
      .replace(/'/g, '"')
      .replace(/,\s*]/g, ']')
      .replace(/,\s*}/g, '}');
    const parsed = JSON.parse(normalized.replace(/(\[[^\]]*\])/g, (block) =>
      block.replace(/(\d+\.?\d*)/g, '$1').replace(/,\s*,/g, ',')
    ));
    if (Array.isArray(parsed)) return parsed;
  } catch {
    /* fallback below */
  }

  const rows = [];
  const rowRe = /\[([^\[\]]*)\]/g;
  let m;
  while ((m = rowRe.exec(str)) !== null) {
    if (m[0] === '[]') continue;
    const cells = [];
    const cellRe = /"((?:\\.|[^"\\])*)"|(-?\d+\.?\d*)|(true|false|null)/gi;
    let cm;
    while ((cm = cellRe.exec(m[1])) !== null) {
      if (cm[1] !== undefined) cells.push(cm[1].replace(/\\"/g, '"'));
      else if (cm[2] !== undefined) cells.push(parseFloat(cm[2]));
      else if (cm[3] === 'true') cells.push(true);
      else if (cm[3] === 'false') cells.push(false);
      else cells.push(null);
    }
    if (cells.length) rows.push(cells);
  }
  return rows;
}

function parseLiteral(raw) {
  if (/^true$/i.test(raw)) return { value: true, type: 'bool' };
  if (/^false$/i.test(raw)) return { value: false, type: 'bool' };
  if (/^-?\d+$/.test(raw)) return { value: parseInt(raw, 10), type: 'int' };
  if (/^-?\d+\.\d+$/.test(raw)) return { value: parseFloat(raw), type: 'float' };
  if (raw.startsWith('[')) {
    try {
      return { value: JSON.parse(raw.replace(/'/g, '"').replace(/(\w+):/g, '"$1":')), type: 'array' };
    } catch {
      return { value: raw, type: 'array' };
    }
  }
  if (raw.startsWith('{')) {
    try {
      return { value: JSON.parse(raw.replace(/'/g, '"').replace(/(\w+):/g, '"$1":')), type: 'object' };
    } catch {
      return { value: raw, type: 'object' };
    }
  }
  const strMatch = raw.match(/^"((?:\\.|[^"\\])*)"$|^'((?:\\.|[^'\\])*)'$/);
  if (strMatch) {
    return { value: (strMatch[1] || strMatch[2] || '').replace(/\\"/g, '"'), type: 'string' };
  }
  return { value: raw, type: 'string' };
}

function inferTypeFromRows(rows, colIndex) {
  for (const row of rows) {
    const v = row?.[colIndex];
    if (v === null || v === undefined || v === '') continue;
    if (typeof v === 'boolean') return 'bool';
    if (typeof v === 'number') return Number.isInteger(v) ? 'int' : 'float';
    if (Array.isArray(v)) return 'array';
    if (typeof v === 'object') return 'object';
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return 'datetime';
    return 'string';
  }
  return 'string';
}

export function validateConfigTypes(config) {
  const warnings = [];
  if (config?.kind !== 'table') return warnings;

  const { fields = [], rows = [] } = config.table || {};
  rows.forEach((row, ri) => {
    fields.forEach((field, ci) => {
      const v = row?.[ci];
      if (v === null || v === undefined || v === '') {
        if (!field.nullable) warnings.push(`Строка ${ri + 1}, «${field.name}»: значение обязательно`);
        return;
      }
      if (field.type === 'int' && !/^-?\d+$/.test(String(v))) {
        warnings.push(`Строка ${ri + 1}, «${field.name}»: ожидается int`);
      }
      if (field.type === 'float' && !/^-?\d+\.?\d*$/.test(String(v))) {
        warnings.push(`Строка ${ri + 1}, «${field.name}»: ожидается float`);
      }
    });
  });
  return warnings;
}
