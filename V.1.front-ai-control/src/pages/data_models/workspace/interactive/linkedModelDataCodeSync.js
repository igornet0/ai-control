/**
 * DataCode for the «Модель данных» widget: tables imported from another model.
 *
 *   global orders = source_table("orders", ["id", "amount"])
 *   print("orders: ", table_info(orders))
 */

import { sanitizeIdentifier } from './schema.js';

/** DCP stores binary attachments under `assets/{sha}`; that name cannot be a source_table. */
const DCP_RESERVED_TABLE_ALIASES = {
  assets: 'linked_assets',
  __asset_index__: 'linked_asset_index',
  __code__: 'linked_code',
  __sql__: 'linked_sql',
  __config__: 'linked_config',
  __metadata__: 'linked_metadata',
  __variables__: 'linked_variables',
};

export function safeDcpTableAlias(name, fallback = 'linked_table') {
  const raw = String(name || '').trim();
  if (!raw) return fallback;
  const mapped = DCP_RESERVED_TABLE_ALIASES[raw.toLowerCase()] || DCP_RESERVED_TABLE_ALIASES[raw];
  if (mapped) return mapped;
  if (raw.startsWith('__') && raw.endsWith('__')) {
    return `linked_${raw.replace(/^_+|_+$/g, '') || 'table'}`;
  }
  return sanitizeIdentifier(raw, fallback);
}

function escapeString(s) {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

export function normalizeLinkedTables(settings = {}) {
  const raw = Array.isArray(settings.selectedTables) ? settings.selectedTables : [];
  const out = [];
  const seen = new Set();
  for (const item of raw) {
    if (!item) continue;
    const name = String(item.name || '').trim();
    if (!name) continue;
    const alias = safeDcpTableAlias(item.alias || name, name);
    if (!alias || seen.has(alias)) continue;
    seen.add(alias);
    const columns = Array.isArray(item.columns)
      ? item.columns.map((c) => String(c || '').trim()).filter(Boolean)
      : [];
    out.push({ name, alias, columns });
  }
  return out;
}

export function linkedTableAliases(settings = {}) {
  return normalizeLinkedTables(settings).map((t) => t.alias);
}

export function findLinkedTable(settings = {}, hint = '') {
  const tables = normalizeLinkedTables(settings);
  const key = String(hint || '').trim();
  if (!key) return tables.length === 1 ? tables[0] : null;
  return tables.find((t) => t.alias === key || t.name === key) || null;
}

export function defaultLinkedModelConnectionSettings(sourceWidget) {
  if (sourceWidget?.type !== 'data-model') return {};
  const tables = normalizeLinkedTables(sourceWidget.settings);
  if (tables.length !== 1) return {};
  const alias = tables[0].alias;
  return { selectedTable: alias, inputVariable: alias };
}

export function columnsArgForTable(columns = []) {
  if (!columns.length) return 'None';
  return `[${columns.map((col) => `"${escapeString(col)}"`).join(', ')}]`;
}

export function buildLinkedTableAssignment(table) {
  const alias = table.alias;
  const sourceName = table.alias;
  return `global ${alias} = source_table("${escapeString(sourceName)}", ${columnsArgForTable(table.columns)})`;
}

export function generateLinkedModelDataCode(settings = {}) {
  const tables = normalizeLinkedTables(settings);
  const modelName = settings.sourceModelName || settings.name || 'модель';
  const modelId = settings.sourceModelId;
  if (!tables.length) {
    const lines = [
      `# Linked model: ${modelName}`,
      '# No tables selected',
    ];
    if (modelId) lines.splice(1, 0, `# source_model_id: ${modelId}`);
    return lines.join('\n');
  }
  const lines = [`# Linked model: ${modelName}`];
  if (modelId) lines.push(`# source_model_id: ${modelId}`);
  for (const table of tables) {
    lines.push('');
    lines.push(buildLinkedTableAssignment(table));
    lines.push(`print("${table.alias}: ", table_info(${table.alias}))`);
  }
  return lines.join('\n').trim() + '\n';
}

export function generateDefaultLinkedModelSourceCode(settings = {}) {
  return generateLinkedModelDataCode(settings);
}
