/**
 * DataCode sync for DataBridge sources: source_table("platform_*", columns).
 */

import { sanitizeIdentifier } from './schema.js';
import { renameIdentifierInCode } from './fileSourceDataCodeSync.js';
import {
  findSourceTableAssignment,
  stripHiddenWsImport,
} from './apiSourceDataCodeSync.js';

export const PLATFORM_TABLE_BY_ENTITY = {
  employees: 'platform_employees',
  tasks: 'platform_tasks',
  projects: 'platform_projects',
  documents: 'platform_documents',
  document_field_values: 'platform_document_field_values',
  document_tables: 'platform_document_tables',
  document_table_cells: 'platform_document_table_cells',
};

function escapeString(s) {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

export function resolveDatabridgeEntity(settings) {
  return String(settings?.databridgeEntity || settings?.entity || '').trim();
}

export function resolveDatabridgeTableName(settings) {
  const entity = resolveDatabridgeEntity(settings);
  if (settings?.tableName && String(settings.tableName).startsWith('platform_')) {
    return String(settings.tableName);
  }
  return PLATFORM_TABLE_BY_ENTITY[entity] || (entity ? `platform_${entity}` : '');
}

export function resolveDatabridgeVariableName(settings) {
  const entity = resolveDatabridgeEntity(settings) || 'platform_data';
  const autoName = sanitizeIdentifier(entity, 'platform_data');
  const custom = settings?.dataCodeVariableName?.trim();
  if (!custom) return autoName;
  return sanitizeIdentifier(custom, autoName) || autoName;
}

export function buildDatabridgeColumnsArg(settings, columns = []) {
  const selected = (settings.selectedColumns?.length
    ? settings.selectedColumns
    : (columns || []))
    .filter(Boolean);
  if (!selected.length) return 'None';
  const items = selected.map((col) => `"${escapeString(col)}"`).join(', ');
  return `[${items}]`;
}

export function buildDatabridgeAssignmentLine(settings, columns = [], variableName = null) {
  const varName = variableName || resolveDatabridgeVariableName(settings);
  const tableName = resolveDatabridgeTableName(settings);
  const columnsArg = buildDatabridgeColumnsArg(settings, columns);
  const exportGlobal = settings.exportGlobal !== false;
  const globalPrefix = exportGlobal ? 'global ' : '';
  return `${globalPrefix}${varName} = source_table("${escapeString(tableName)}", ${columnsArg})`;
}

export function generateDefaultDatabridgeSourceCode(settings, columns = []) {
  const tableName = resolveDatabridgeTableName(settings);
  if (!tableName) return '';
  const variableName = resolveDatabridgeVariableName(settings);
  const assignment = buildDatabridgeAssignmentLine(settings, columns, variableName);
  return `${assignment}\nprint("${variableName}: ", table_info(${variableName}))`;
}

export function patchDatabridgeSourceInCode(code, settings, columns = [], options = {}) {
  const previousVariableName = options.previousVariableName || settings.dataCodeVariableName || null;
  let resultCode = stripHiddenWsImport(code || '');
  const found = findSourceTableAssignment(resultCode, previousVariableName);
  const effectiveSettings = {
    ...settings,
    exportGlobal: settings.exportGlobal !== false,
  };
  const newVariableName = resolveDatabridgeVariableName(settings);
  const assignmentLine = buildDatabridgeAssignmentLine(
    effectiveSettings,
    columns,
    newVariableName,
  );

  if (found) {
    const before = resultCode.slice(0, found.start);
    const after = resultCode.slice(found.end);
    resultCode = `${before}${assignmentLine}${after}`;
    if (found.variableName !== newVariableName) {
      resultCode = renameIdentifierInCode(resultCode, found.variableName, newVariableName);
    }
  } else if (!resultCode.trim()) {
    resultCode = generateDefaultDatabridgeSourceCode(settings, columns);
  } else {
    resultCode = `${resultCode.trimEnd()}\n${assignmentLine}`;
  }

  return {
    code: resultCode,
    variableName: newVariableName,
    previousVariableName: found?.variableName || previousVariableName,
    exportGlobal: effectiveSettings.exportGlobal,
  };
}
