/**
 * DataCode sync for API ingest sources: source_table(table_name, columns).
 * `from ws import *` is injected on execute/compile (hidden from the editor).
 *
 * Examples (shown to user):
 *   global orders = source_table("orders", ["id", "date", "value"])
 *   global orders = source_table("orders", {"id": None, "value": "count"})
 */

import { sanitizeIdentifier } from './schema.js';
import { renameIdentifierInCode } from './fileSourceDataCodeSync.js';
import { ensureAppendRowIdColumn, sanitizeTableName } from '../apiIngestSourceUtils.js';

const WS_IMPORT_LINE_RE = /^\s*from\s+ws\s+import\s+\*\s*\n?/gm;

function escapeString(s) {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

/** Remove editor-visible `from ws import *` (server injects it on send). */
export function stripHiddenWsImport(code) {
  if (!code) return code || '';
  return code.replace(WS_IMPORT_LINE_RE, '').replace(/^\n+/, '');
}

function findMatchingParen(str, openIndex) {
  let depth = 0;
  let inString = false;
  let stringChar = '';
  for (let i = openIndex; i < str.length; i += 1) {
    const ch = str[i];
    const prev = str[i - 1];
    if (inString) {
      if (ch === stringChar && prev !== '\\') inString = false;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = true;
      stringChar = ch;
      continue;
    }
    if (ch === '(') depth += 1;
    else if (ch === ')') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Find `var = source_table(...)` / `global var = source_table(...)`
 * (also matches legacy `ws.source_table`).
 */
export function findSourceTableAssignment(code, variableNameHint = null) {
  if (!code || !String(code).trim()) return null;
  const text = String(code);
  const re = /(?:(global)\s+)?([\p{L}_][\p{L}\p{N}_]*)\s*=\s*(?:ws\.)?source_table\s*\(/gu;
  const matches = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    const variableName = m[2];
    const openParenIndex = m.index + m[0].length - 1;
    const closeParenIndex = findMatchingParen(text, openParenIndex);
    if (closeParenIndex < 0) continue;
    matches.push({
      variableName,
      exportGlobal: m[1] === 'global',
      argsStr: text.slice(openParenIndex + 1, closeParenIndex),
      start: m.index,
      end: closeParenIndex + 1,
      fullMatch: text.slice(m.index, closeParenIndex + 1),
    });
  }
  if (!matches.length) return null;
  if (variableNameHint) {
    const hinted = matches.find((item) => item.variableName === variableNameHint);
    if (hinted) return hinted;
  }
  return matches[0];
}

export function resolveApiTableName(settings) {
  return sanitizeTableName(settings?.tableName || settings?.name || 'source_data');
}

export function resolveApiDataCodeVariableName(settings) {
  const tableName = resolveApiTableName(settings);
  const autoName = sanitizeIdentifier(tableName, 'api_table');
  const custom = settings?.dataCodeVariableName?.trim();
  if (!custom) return autoName;
  const sanitized = sanitizeIdentifier(custom, autoName);
  return sanitized || autoName;
}

/**
 * Build second arg for source_table: array[str] or object[str, str|None].
 */
export function buildSourceTableColumnsArg(settings, fileColumns = []) {
  const selected = ensureAppendRowIdColumn(
    (settings.selectedColumns?.length
      ? settings.selectedColumns
      : (fileColumns || []))
      .filter(Boolean),
    settings?.apiIngestMode,
  );
  if (!selected.length) return 'None';

  const fieldRenames = settings.fieldRenames || {};
  const hasRenames = Object.keys(fieldRenames).some((key) => fieldRenames[key]);

  if (hasRenames) {
    const entries = selected.map((col) => {
      const renamed = fieldRenames[col];
      if (renamed) {
        return `"${escapeString(col)}": "${escapeString(renamed)}"`;
      }
      return `"${escapeString(col)}": None`;
    });
    return `{${entries.join(', ')}}`;
  }

  const items = selected.map((col) => `"${escapeString(col)}"`).join(', ');
  return `[${items}]`;
}

export function buildApiSourceAssignmentLine(settings, fileColumns = [], variableName = null) {
  const varName = variableName || resolveApiDataCodeVariableName(settings);
  const tableName = resolveApiTableName(settings);
  const columnsArg = buildSourceTableColumnsArg(settings, fileColumns);
  // API tables must be global for --build_model sqlite export
  const exportGlobal = settings.exportGlobal !== false;
  const globalPrefix = exportGlobal ? 'global ' : '';
  return `${globalPrefix}${varName} = source_table("${escapeString(tableName)}", ${columnsArg})`;
}

export function generateDefaultApiSourceCode(settings, fileColumns = []) {
  const tableName = resolveApiTableName(settings);
  if (!tableName) return '';
  const variableName = resolveApiDataCodeVariableName(settings);
  const assignment = buildApiSourceAssignmentLine(settings, fileColumns, variableName);
  return `${assignment}\nprint("${variableName}: ", table_info(${variableName}))`;
}

/**
 * Patch only the source_table(...) assignment; keep the rest of DataCode intact.
 * Does not show `from ws import *` — it is injected server-side on execute.
 */
export function patchApiSourceInCode(code, settings, fileColumns = [], options = {}) {
  const previousVariableName = options.previousVariableName || settings.dataCodeVariableName || null;
  let resultCode = stripHiddenWsImport(code || '');
  const found = findSourceTableAssignment(resultCode, previousVariableName);
  const effectiveSettings = {
    ...settings,
    exportGlobal: settings.exportGlobal !== false,
  };
  const newVariableName = resolveApiDataCodeVariableName(settings);
  const assignmentLine = buildApiSourceAssignmentLine(effectiveSettings, fileColumns, newVariableName);

  if (found) {
    const before = resultCode.slice(0, found.start);
    const after = resultCode.slice(found.end);
    resultCode = `${before}${assignmentLine}${after}`;
    if (found.variableName !== newVariableName) {
      resultCode = renameIdentifierInCode(resultCode, found.variableName, newVariableName);
    }
  } else if (!resultCode.trim()) {
    resultCode = generateDefaultApiSourceCode(settings, fileColumns);
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
