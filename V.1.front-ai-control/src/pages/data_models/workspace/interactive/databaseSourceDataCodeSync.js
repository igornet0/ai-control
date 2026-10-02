/**
 * DataCode sync for database data sources:
 *   db = datasource({ ... })
 *   db.connect()
 *   global result = db.get_table({ ... })
 *   db.disconnect()
 */

import { sanitizeIdentifier } from './schema.js';
import { renameIdentifierInCode } from './fileSourceDataCodeSync.js';
import { stripHiddenWsImport } from './apiSourceDataCodeSync.js';

export const DB_TYPES = ['postgresql', 'mysql', 'sqlite', 'mongodb', 'mssql'];

export const DB_TYPE_DEFAULTS = {
  postgresql: { port: 5432, label: 'PostgreSQL' },
  mysql: { port: 3306, label: 'MySQL' },
  sqlite: { port: null, label: 'SQLite' },
  mongodb: { port: 27017, label: 'MongoDB' },
  mssql: { port: 1433, label: 'MS SQL Server' },
};

const SQL_DB_TYPES = new Set(['postgresql', 'mysql', 'sqlite', 'mssql']);

const WS_IMPORT_LINE_RE = /^\s*from\s+ws\s+import\s+\*\s*\n?/gm;

function escapeString(s) {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

function quoteStr(value) {
  return `"${escapeString(value)}"`;
}

function isSqlDb(dbType) {
  return SQL_DB_TYPES.has(normalizeDbType(dbType));
}

/**
 * Normalize legacy / alias db types to canonical keys used in UI.
 */
export function normalizeDbType(dbType) {
  const raw = String(dbType || 'postgresql').toLowerCase().trim();
  if (raw === 'postgres') return 'postgresql';
  if (raw === 'mariadb') return 'mysql';
  if (raw === 'sql' || raw === 'sqlite3') return 'sqlite';
  if (raw === 'mongo') return 'mongodb';
  if (raw === 'sqlserver') return 'mssql';
  if (DB_TYPES.includes(raw)) return raw;
  return 'postgresql';
}

/**
 * Migrate legacy widget settings (connectionString) into current keys.
 */
export function normalizeDatabaseSettings(settings = {}) {
  const dbType = normalizeDbType(settings.dbType);
  const dbUrl = settings.dbUrl || settings.connectionString || '';
  let dbConnectionMode = settings.dbConnectionMode;
  if (dbConnectionMode !== 'url' && dbConnectionMode !== 'fields') {
    dbConnectionMode = dbUrl ? 'url' : 'fields';
  }
  const defaults = DB_TYPE_DEFAULTS[dbType] || DB_TYPE_DEFAULTS.postgresql;
  return {
    ...settings,
    dbType,
    dbConnectionMode,
    dbUrl,
    dbHost: settings.dbHost || 'localhost',
    dbPort: settings.dbPort != null && settings.dbPort !== ''
      ? Number(settings.dbPort)
      : defaults.port,
    database: settings.database || '',
    dbUsername: settings.dbUsername || settings.username || '',
    dbPassword: settings.dbPassword || settings.password || '',
    dbSchema: settings.dbSchema || settings.schema || '',
    dbPath: settings.dbPath || settings.path || '',
    dbCollection: settings.dbCollection || settings.collection || '',
    dbTable: settings.dbTable || settings.tableName || '',
    query: settings.query || '',
    dbTimeout: settings.dbTimeout != null && settings.dbTimeout !== ''
      ? Number(settings.dbTimeout)
      : (settings.timeout != null ? Number(settings.timeout) : null),
  };
}

export function resolveDatabaseDataCodeVariableName(settings) {
  const normalized = normalizeDatabaseSettings(settings);
  const fromTable = normalized.dbTable || normalized.dbCollection || '';
  const autoName = sanitizeIdentifier(
    fromTable || normalized.name || `db_${normalized.dbType}`,
    `db_${normalized.dbType}`,
  );
  const custom = settings?.dataCodeVariableName?.trim();
  if (!custom) return autoName;
  return sanitizeIdentifier(custom, autoName) || autoName;
}

/**
 * Build plain JS object for datasource({...}) keys.
 */
export function buildDatasourceConfigObject(settings) {
  const s = normalizeDatabaseSettings(settings);
  const type = s.dbType;
  const cfg = { type };

  if (type === 'sqlite') {
    if (s.dbConnectionMode === 'url' && s.dbUrl) {
      cfg.url = s.dbUrl;
    } else if (s.dbPath) {
      cfg.path = s.dbPath;
    } else if (s.database) {
      cfg.database = s.database;
    } else if (s.dbUrl) {
      cfg.url = s.dbUrl;
    } else {
      cfg.url = 'sqlite:///:memory:';
    }
  } else if (s.dbConnectionMode === 'url') {
    if (s.dbUrl) cfg.url = s.dbUrl;
    if (type === 'mongodb') {
      if (s.database) cfg.database = s.database;
      if (s.dbCollection) cfg.collection = s.dbCollection;
    }
  } else {
    if (s.dbHost) cfg.host = s.dbHost;
    if (s.dbPort != null && !Number.isNaN(s.dbPort)) cfg.port = s.dbPort;
    if (s.database) cfg.database = s.database;
    if (s.dbUsername) cfg.username = s.dbUsername;
    if (s.dbPassword) cfg.password = s.dbPassword;
    if (type === 'postgresql' && s.dbSchema) cfg.schema = s.dbSchema;
    if (type === 'mongodb' && s.dbCollection) cfg.collection = s.dbCollection;
  }

  if (s.dbTimeout != null && !Number.isNaN(s.dbTimeout) && s.dbTimeout > 0) {
    cfg.timeout = s.dbTimeout;
  }

  return cfg;
}

/**
 * Serialize config object to DataCode object literal.
 */
export function formatDatasourceConfigLiteral(cfg) {
  const lines = Object.entries(cfg).map(([key, value]) => {
    if (typeof value === 'number') {
      return `    ${key}: ${value}`;
    }
    return `    ${key}: ${quoteStr(value)}`;
  });
  return `{\n${lines.join(',\n')}\n}`;
}

export function buildGetTableArg(settings) {
  const s = normalizeDatabaseSettings(settings);
  if (s.dbType === 'mongodb') {
    const collection = s.dbCollection || 'users';
    return `{ collection: ${quoteStr(collection)} }`;
  }

  let sql = (s.query || '').trim();
  if (!sql && s.dbTable) {
    sql = `SELECT * FROM ${s.dbTable}`;
  }
  if (!sql) {
    sql = 'SELECT 1';
  }
  return `{ sql: ${quoteStr(sql)} }`;
}

export function buildDatabaseSourceBlock(settings, variableName = null) {
  const varName = variableName || resolveDatabaseDataCodeVariableName(settings);
  const cfg = buildDatasourceConfigObject(settings);
  const cfgLiteral = formatDatasourceConfigLiteral(cfg);
  const getTableArg = buildGetTableArg(settings);
  const exportGlobal = settings?.exportGlobal !== false;
  const globalPrefix = exportGlobal ? 'global ' : '';

  return [
    `db = datasource(${cfgLiteral})`,
    'db.connect()',
    `${globalPrefix}${varName} = db.get_table(${getTableArg})`,
    'db.disconnect()',
  ].join('\n');
}

export function generateDefaultDatabaseSourceCode(settings) {
  const varName = resolveDatabaseDataCodeVariableName(settings);
  const block = buildDatabaseSourceBlock(settings, varName);
  return `${block}\nprint("${varName}: ", table_info(${varName}))\n`;
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
 * Locate datasource...disconnect block in existing code.
 * Returns { start, end, variableName } or null.
 */
export function findDatabaseSourceBlock(code, variableNameHint = null) {
  if (!code || !String(code).trim()) return null;
  const text = String(code);
  const dsRe = /([\p{L}_][\p{L}\p{N}_]*)\s*=\s*datasource\s*\(/gu;
  let match;
  let best = null;

  while ((match = dsRe.exec(text)) !== null) {
    const dsVar = match[1];
    const openParen = match.index + match[0].length - 1;
    const closeParen = findMatchingParen(text, openParen);
    if (closeParen < 0) continue;

    const afterDs = text.slice(closeParen + 1);
    const disconnectRe = new RegExp(
      `${dsVar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\.\\s*disconnect\\s*\\(\\s*\\)`,
    );
    const discMatch = disconnectRe.exec(afterDs);
    if (!discMatch) continue;

    const blockEnd = closeParen + 1 + discMatch.index + discMatch[0].length;
    const blockText = text.slice(match.index, blockEnd);
    const getTableRe = /(?:(global)\s+)?([\p{L}_][\p{L}\p{N}_]*)\s*=\s*[\p{L}_][\p{L}\p{N}_]*\s*\.\s*get_table\s*\(/u;
    const gt = getTableRe.exec(blockText);
    const variableName = gt ? gt[2] : null;

    const candidate = {
      start: match.index,
      end: blockEnd,
      dsVar,
      variableName,
      exportGlobal: gt ? gt[1] === 'global' : true,
    };

    if (variableNameHint && variableName === variableNameHint) {
      return candidate;
    }
    if (!best) best = candidate;
  }

  return best;
}

/**
 * Patch datasource/connect/get_table/disconnect block; keep trailing user code.
 */
export function patchDatabaseSourceInCode(code, settings, options = {}) {
  const previousVariableName = options.previousVariableName
    || settings.dataCodeVariableName
    || null;
  let resultCode = stripHiddenWsImport(code || '').replace(WS_IMPORT_LINE_RE, '');
  const found = findDatabaseSourceBlock(resultCode, previousVariableName);
  const newVariableName = resolveDatabaseDataCodeVariableName(settings);
  const block = buildDatabaseSourceBlock(settings, newVariableName);

  if (found) {
    const before = resultCode.slice(0, found.start);
    const after = resultCode.slice(found.end);
    resultCode = `${before}${block}${after}`;
    if (found.variableName && found.variableName !== newVariableName) {
      resultCode = renameIdentifierInCode(resultCode, found.variableName, newVariableName);
    }
  } else if (!resultCode.trim()) {
    resultCode = generateDefaultDatabaseSourceCode(settings);
  } else {
    resultCode = `${block}\n${resultCode.trimStart()}`;
  }

  return {
    code: resultCode.endsWith('\n') ? resultCode : `${resultCode}\n`,
    variableName: newVariableName,
    previousVariableName: found?.variableName || previousVariableName,
    exportGlobal: settings?.exportGlobal !== false,
  };
}

export function isSqlDatabaseType(dbType) {
  return isSqlDb(dbType);
}
