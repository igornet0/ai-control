/**
 * DataCode sync for relationship widgets.
 *
 * relate(A, B, C, ...) means: A is PK, B/C/... are FKs on A.
 *
 * 1:1 / 1:N:
 *   primary_key(customers["id"])
 *   relate(customers["id"], orders["customer_id"])
 *
 * N:M (two 1:N via junction):
 *   primary_key(orders["id"])
 *   primary_key(products["id"])
 *   relate(orders["id"], order_items["order_id"])
 *   relate(products["id"], order_items["product_id"])
 *
 * Column names must be post-rename (after upstream transform .rename).
 */

import { sanitizeIdentifier } from './schema.js';
import { resolveRelateColumnName } from './relationshipSources.js';

function escapeString(s) {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

function quoteField(name) {
  return `"${escapeString(name)}"`;
}

function colRef(tableVar, column) {
  return `${sanitizeIdentifier(tableVar, 'table')}[${quoteField(column)}]`;
}

function emptyColRef() {
  return { tableVariable: '', column: '', widgetId: null };
}

export function normalizeColRef(raw) {
  if (!raw || typeof raw !== 'object') return emptyColRef();
  return {
    tableVariable: String(raw.tableVariable || '').trim(),
    column: String(raw.column || '').trim(),
    widgetId: raw.widgetId != null ? String(raw.widgetId) : null,
  };
}

function parseDotted(field) {
  if (!field) return null;
  const [t, ...rest] = String(field).split('.');
  const col = rest.join('.');
  if (!t || !col) return null;
  return { tableVariable: t, column: col, widgetId: null };
}

/**
 * Normalize settings into pk/foreignKeys (1:1, 1:N) and left/right/junction (N:M).
 * Supports legacy fromField/toField ("table.col").
 */
export function normalizeRelationshipSettings(settings = {}) {
  const relationshipType = settings.relationshipType || 'one-to-many';

  let pk = normalizeColRef(settings.pk);
  let foreignKeys = Array.isArray(settings.foreignKeys)
    ? settings.foreignKeys
      .filter((fk) => fk && typeof fk === 'object')
      .map((fk) => ({
        ...normalizeColRef(fk),
        id: fk.id || `fk_${Math.random().toString(36).slice(2, 9)}`,
      }))
    : [];

  if ((!pk.tableVariable || !pk.column) && settings.fromField) {
    const parsed = parseDotted(settings.fromField);
    if (parsed) pk = { ...parsed, widgetId: pk.widgetId };
  }
  if (!foreignKeys.length && settings.toField) {
    const parsed = parseDotted(settings.toField);
    if (parsed) {
      foreignKeys = [{ id: 'fk_legacy', ...parsed }];
    }
  }

  let left = normalizeColRef(settings.left);
  let right = normalizeColRef(settings.right);
  const j = settings.junction && typeof settings.junction === 'object' ? settings.junction : {};
  const junction = {
    tableVariable: String(j.tableVariable || '').trim(),
    widgetId: j.widgetId != null ? String(j.widgetId) : null,
    leftColumn: String(j.leftColumn || '').trim(),
    rightColumn: String(j.rightColumn || '').trim(),
  };

  return { relationshipType, pk, foreignKeys, left, right, junction };
}

function effectiveRef(tableVariable, column, context = {}) {
  const sources = context.sources || [];
  const src = sources.find((s) => s.tableVariable === tableVariable)
    || sources.find((s) => String(s.widgetId) === String(context.widgetIdHint));
  const col = src
    ? resolveRelateColumnName(column, src.sourceWidget, context.widgetManager)
    : column;
  return colRef(tableVariable, col);
}

function generateOneToManyBlock(settings, context) {
  const { relationshipType, pk, foreignKeys } = normalizeRelationshipSettings(settings);
  const name = settings.name || 'Связь';
  const typeLabel = relationshipType === 'one-to-one' ? '1:1' : '1:N';
  const lines = [
    `# Relationship: ${name}`,
    `# ${typeLabel} — relate(PK, FK…) first arg is primary key, rest are foreign keys on it`,
  ];

  if (!pk.tableVariable || !pk.column) {
    lines.push('# Configure PK and FK columns in the relationship widget settings');
    return `${lines.join('\n')}\n`;
  }

  const pkRef = effectiveRef(pk.tableVariable, pk.column, {
    ...context,
    widgetIdHint: pk.widgetId,
  });
  lines.push(`primary_key(${pkRef})`);

  const fkList = relationshipType === 'one-to-one' ? foreignKeys.slice(0, 1) : foreignKeys;
  const fkRefs = fkList
    .filter((fk) => fk.tableVariable && fk.column)
    .map((fk) => effectiveRef(fk.tableVariable, fk.column, {
      ...context,
      widgetIdHint: fk.widgetId,
    }));

  if (fkRefs.length) {
    lines.push(`relate(${[pkRef, ...fkRefs].join(', ')})`);
  } else {
    lines.push(`# relate(${pkRef}, ...) — add FK columns`);
  }

  return `${lines.join('\n')}\n`;
}

function generateManyToManyBlock(settings, context) {
  const { left, right, junction } = normalizeRelationshipSettings(settings);
  const name = settings.name || 'Связь';
  const lines = [
    `# Relationship: ${name}`,
    '# N:M — two 1:N relates through a junction table',
  ];

  const leftOk = left.tableVariable && left.column;
  const rightOk = right.tableVariable && right.column;
  const juncOk = junction.tableVariable && junction.leftColumn && junction.rightColumn;

  if (!leftOk || !rightOk || !juncOk) {
    lines.push('# Configure left PK, right PK, and junction FK columns');
    return `${lines.join('\n')}\n`;
  }

  const leftPk = effectiveRef(left.tableVariable, left.column, {
    ...context,
    widgetIdHint: left.widgetId,
  });
  const rightPk = effectiveRef(right.tableVariable, right.column, {
    ...context,
    widgetIdHint: right.widgetId,
  });
  const leftFk = effectiveRef(junction.tableVariable, junction.leftColumn, {
    ...context,
    widgetIdHint: junction.widgetId,
  });
  const rightFk = effectiveRef(junction.tableVariable, junction.rightColumn, {
    ...context,
    widgetIdHint: junction.widgetId,
  });

  lines.push(`primary_key(${leftPk})`);
  lines.push(`primary_key(${rightPk})`);
  lines.push(`relate(${leftPk}, ${leftFk})`);
  lines.push(`relate(${rightPk}, ${rightFk})`);
  return `${lines.join('\n')}\n`;
}

/**
 * @returns {string}
 */
export function generateRelationshipDataCode(settings = {}, context = {}) {
  const type = settings.relationshipType || 'one-to-many';
  if (type === 'many-to-many') {
    return generateManyToManyBlock(settings, context);
  }
  return generateOneToManyBlock(settings, context);
}

const REL_BLOCK_RE = /#\s*Relationship:[\s\S]*?(?=\n#\s*---|\n#\s*Relationship:|$)/;

/**
 * Patch existing code: replace the relationship block, keep user extras outside it.
 */
export function patchRelationshipDataCodeInCode(existingCode, settings, context = {}) {
  const generated = generateRelationshipDataCode(settings, context);
  const text = existingCode || '';
  if (!text.trim()) {
    return { code: generated };
  }
  if (REL_BLOCK_RE.test(text)) {
    return { code: text.replace(REL_BLOCK_RE, generated.trimEnd()) };
  }
  if (/^\s*(?:#.*\n)*\s*primary_key\s*\(/m.test(text) || /^\s*(?:#.*\n)*\s*relate\s*\(/m.test(text)) {
    return { code: generated };
  }
  return { code: `${text.trimEnd()}\n\n${generated}` };
}
