import { sanitizeIdentifier, tableVariableNameFromFileName } from './schema.js';

function escapeString(s) {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
 * Find `var = read(...)` / `global var = read(...)` assignment in DataCode.
 */
export function findReadAssignment(code, variableNameHint = null) {
  if (!code || !String(code).trim()) return null;
  const text = String(code);
  const re = /(?:(global)\s+)?([\p{L}_][\p{L}\p{N}_]*)\s*=\s*read(?:_file)?\s*\(/gu;
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
      lineIndex: (text.slice(0, m.index).match(/\n/g) || []).length,
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

export function parseReadCallArgs(argsStr) {
  const result = {
    fileName: null,
    headerRow: 0,
    sheetName: null,
    selectedColumns: [],
    fieldRenames: {},
    isTransposed: false,
  };
  if (!argsStr) return result;

  const pathMatch = argsStr.match(/path\s*\(\s*"((?:\\.|[^"\\])*)"\s*\)/);
  if (pathMatch) {
    result.fileName = pathMatch[1].replace(/\\"/g, '"');
  }

  const headerRowMatch = argsStr.match(/header_row\s*=\s*(\d+)/);
  if (headerRowMatch) {
    result.headerRow = parseInt(headerRowMatch[1], 10);
  }

  const sheetMatch = argsStr.match(/sheet_name\s*=\s*"((?:\\.|[^"\\])*)"/);
  if (sheetMatch) {
    result.sheetName = sheetMatch[1].replace(/\\"/g, '"');
  }

  const headerTArrayMatch = argsStr.match(/headerT\s*=\s*\[([\s\S]*?)\]/);
  if (headerTArrayMatch) {
    result.selectedColumns = parseStringArray(headerTArrayMatch[1]);
    result.isTransposed = true;
    return result;
  }

  const headerTDictMatch = argsStr.match(/headerT\s*=\s*\{([\s\S]*?)\}/);
  if (headerTDictMatch) {
    const dictBody = headerTDictMatch[1];
    const pairRe = /"((?:\\.|[^"\\])*)"\s*:\s*(?:"((?:\\.|[^"\\])*)"|null)/g;
    let pair;
    const columns = [];
    const renames = {};
    while ((pair = pairRe.exec(dictBody)) !== null) {
      const original = pair[1].replace(/\\"/g, '"');
      const renamed = pair[2] ? pair[2].replace(/\\"/g, '"') : null;
      columns.push(original);
      if (renamed) renames[original] = renamed;
    }
    result.selectedColumns = columns;
    result.fieldRenames = renames;
    result.isTransposed = true;
    return result;
  }

  const headerArrayMatch = argsStr.match(/header\s*=\s*\[([\s\S]*?)\]/);
  if (headerArrayMatch) {
    result.selectedColumns = parseStringArray(headerArrayMatch[1]);
    return result;
  }

  const headerDictMatch = argsStr.match(/header\s*=\s*\{([\s\S]*?)\}/);
  if (headerDictMatch) {
    const dictBody = headerDictMatch[1];
    const pairRe = /"((?:\\.|[^"\\])*)"\s*:\s*(?:"((?:\\.|[^"\\])*)"|null)/g;
    let pair;
    const columns = [];
    const renames = {};
    while ((pair = pairRe.exec(dictBody)) !== null) {
      const original = pair[1].replace(/\\"/g, '"');
      const renamed = pair[2] ? pair[2].replace(/\\"/g, '"') : null;
      columns.push(original);
      if (renamed) renames[original] = renamed;
    }
    result.selectedColumns = columns;
    result.fieldRenames = renames;
  }

  return result;
}

export function parseFileSourceFromCode(code, variableNameHint = null) {
  const found = findReadAssignment(code, variableNameHint);
  if (!found) return null;
  const parsed = parseReadCallArgs(found.argsStr);
  return {
    variableName: found.variableName,
    exportGlobal: found.exportGlobal,
    ...parsed,
  };
}

export function buildSmbLibPath(shareName, smbSharePath) {
  const share = String(shareName || '').replace(/^\/+|\/+$/g, '');
  const rel = String(smbSharePath || '').replace(/^\/+/, '');
  if (!share) return rel ? `lib:///${rel}` : 'lib://';
  return rel ? `lib://${share}/${rel}` : `lib://${share}`;
}

export function resolveFilePathForSettings(settings) {
  if (settings.fileDeliveryMode === 'smb') {
    const share = settings.smbShareName || settings.smbShare || '';
    const rel = settings.smbSharePath || settings.sourcePath || '';
    return buildSmbLibPath(share, rel);
  }
  return settings.selectedFile?.name || settings.sourcePath || '';
}

export function resolveSourcePathForSettings(settings) {
  if (settings?.sourceType === 'folder') {
    if (settings.fileDeliveryMode === 'smb') {
      const share = settings.smbShareName || settings.smbShare || '';
      const rel = settings.smbSharePath || settings.selectedFolder?.smbPath || '';
      return buildSmbLibPath(share, rel);
    }
    return settings.selectedFolder?.name || settings.sourcePath || '';
  }
  if (settings?.sourceType === 'archive') {
    if (settings.fileDeliveryMode === 'smb') {
      const share = settings.smbShareName || settings.smbShare || '';
      const rel = settings.smbSharePath || settings.selectedArchive?.smbPath || '';
      return buildSmbLibPath(share, rel);
    }
    return settings.selectedArchive?.archiveFileName
      || settings.selectedArchive?.name
      || settings.sourcePath
      || '';
  }
  return resolveFilePathForSettings(settings);
}

export function generateDefaultFolderSourceCode(settings) {
  const folderName = settings.sourceType === 'archive'
    ? (settings.selectedArchive?.name || 'Архив')
    : (settings.selectedFolder?.name || 'Папка');
  const pathExpr = settings.fileDeliveryMode === 'smb'
    ? `path("${escapeString(resolveSourcePathForSettings(settings))}")`
    : 'path(".")';
  return `print("Файлы в папке ${folderName}:")
files = list_files(${pathExpr})
for file in files do
    print("  -", file)
    if file.is_file do
        print("    Размер:", file.size, "байт")
    endif
next file

print("\\nВсего файлов:", len(files))`;
}

export function buildReadCallParams(settings, fileColumns = []) {
  const pathValue = resolveFilePathForSettings(settings);
  const isSmb = settings.fileDeliveryMode === 'smb' || pathValue.startsWith('lib://');
  const fileName = settings.selectedFile?.name || settings.sourcePath || '';
  const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';
  const params = [];

  params.push(`path("${escapeString(pathValue)}")`);

  let headerRow = 0;
  if (settings.excelHeaderRow !== undefined && settings.excelHeaderRow !== null && settings.excelHeaderRow !== '') {
    const headerRowNum = parseInt(settings.excelHeaderRow, 10);
    if (!Number.isNaN(headerRowNum) && headerRowNum > 0) {
      headerRow = headerRowNum - 1;
    }
  }
  params.push(`header_row=${headerRow}`);

  if (!isSmb && (fileExtension === 'xlsx' || fileExtension === 'xls') && settings.excelSheet) {
    params.push(`sheet_name="${escapeString(settings.excelSheet)}"`);
  }

  const selectedColumns = settings.selectedColumns || fileColumns;
  if (selectedColumns?.length) {
    const fieldRenames = settings.fieldRenames || {};
    const hasRenames = Object.keys(fieldRenames).some((key) => fieldRenames[key]);
    const isTransposed = !!settings.isTransposed;
    const headerParam = isTransposed ? 'headerT' : 'header';

    if (hasRenames) {
      const headerDict = selectedColumns
        .map((col) => {
          const renamed = fieldRenames[col];
          if (renamed) return `"${escapeString(col)}": "${escapeString(renamed)}"`;
          return `"${escapeString(col)}": null`;
        })
        .join(', ');
      params.push(`${headerParam}={${headerDict}}`);
    } else {
      const headerArray = selectedColumns.map((col) => `"${escapeString(col)}"`).join(', ');
      params.push(`${headerParam}=[${headerArray}]`);
    }
  }

  return params;
}

export function resolveDataCodeVariableName(settings) {
  const fileName = settings?.selectedFile?.name || settings?.sourcePath || '';
  const autoName = tableVariableNameFromFileName(fileName);
  const custom = settings?.dataCodeVariableName?.trim();
  if (!custom) return autoName;

  const sanitized = sanitizeIdentifier(custom, autoName);
  if (sanitized !== autoName) return sanitized;
  return autoName;
}

export function buildFileSourceAssignmentLine(settings, fileColumns = [], variableName = null) {
  const varName = variableName || resolveDataCodeVariableName(settings);
  const params = buildReadCallParams(settings, fileColumns);
  const globalPrefix = settings.exportGlobal ? 'global ' : '';
  return `${globalPrefix}${varName} = read(${params.join(', ')})`;
}

export function generateDefaultFileSourceCode(settings, fileColumns = []) {
  const fileName = settings.selectedFile?.name || settings.sourcePath || '';
  if (!fileName) return '';
  const variableName = resolveDataCodeVariableName(settings);
  const assignment = buildFileSourceAssignmentLine(settings, fileColumns, variableName);
  return `${assignment}\nprint("${variableName}: ", table_info(${variableName}))`;
}

export function renameIdentifierInCode(code, oldName, newName) {
  if (!oldName || !newName || oldName === newName) return code;
  const re = new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRegex(oldName)}(?![\\p{L}\\p{N}_])`, 'gu');
  return String(code).replace(re, newName);
}

/**
 * Patch only the file-source read() assignment; keep the rest of DataCode intact.
 */
export function patchFileSourceInCode(code, settings, fileColumns = [], options = {}) {
  const fileName = settings.selectedFile?.name || settings.sourcePath || '';
  const previousVariableName = options.previousVariableName || settings.dataCodeVariableName || null;

  let resultCode = code || '';
  const found = findReadAssignment(resultCode, previousVariableName);
  const parsedFromCode = found ? parseReadCallArgs(found.argsStr) : null;
  const effectiveSettings = {
    ...settings,
    exportGlobal: settings.exportGlobal ?? found?.exportGlobal ?? false,
    isTransposed: settings.isTransposed ?? parsedFromCode?.isTransposed ?? false,
  };
  const newVariableName = resolveDataCodeVariableName(settings);
  const assignmentLine = buildFileSourceAssignmentLine(effectiveSettings, fileColumns, newVariableName);

  if (found) {
    const before = resultCode.slice(0, found.start);
    const after = resultCode.slice(found.end);
    resultCode = `${before}${assignmentLine}${after}`;
    if (found.variableName !== newVariableName) {
      resultCode = renameIdentifierInCode(resultCode, found.variableName, newVariableName);
    }
  } else if (!resultCode.trim()) {
    resultCode = generateDefaultFileSourceCode(settings, fileColumns);
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

export function settingsUpdatesFromParsedRead(parsed, existingFileColumns = [], currentSettings = null) {
  if (!parsed) return null;
  const updates = {};

  if (parsed.variableName) {
    const fileName = currentSettings?.selectedFile?.name
      || currentSettings?.sourcePath
      || parsed.fileName
      || '';
    const autoName = tableVariableNameFromFileName(fileName);
    const custom = currentSettings?.dataCodeVariableName?.trim();
    const shouldApply = !custom || custom === autoName || custom === parsed.variableName;
    if (shouldApply) {
      updates.dataCodeVariableName = parsed.variableName === autoName ? '' : parsed.variableName;
    }
  }
  updates.exportGlobal = !!parsed.exportGlobal;
  if (parsed.fileName) {
    if (parsed.fileName.startsWith('lib://')) {
      updates.fileDeliveryMode = 'smb';
      updates.sourcePath = parsed.fileName;
      const libMatch = parsed.fileName.match(/^lib:\/\/([^/]+)\/(.*)$/);
      if (libMatch) {
        updates.smbShareName = libMatch[1];
        updates.smbSharePath = libMatch[2];
      }
    } else {
      updates.sourcePath = parsed.fileName;
      updates.fileDeliveryMode = 'local';
    }
  }

  if (parsed.selectedColumns?.length) {
    updates.selectedColumns = parsed.selectedColumns;
    updates.fileColumns = existingFileColumns.length >= parsed.selectedColumns.length
      ? existingFileColumns
      : parsed.selectedColumns;
  }

  if (parsed.fieldRenames && Object.keys(parsed.fieldRenames).length) {
    updates.fieldRenames = parsed.fieldRenames;
  } else if (parsed.selectedColumns?.length) {
    updates.fieldRenames = {};
  }

  if (parsed.headerRow !== undefined && parsed.headerRow !== null && !Number.isNaN(parsed.headerRow)) {
    updates.excelHeaderRow = parsed.headerRow + 1;
  }

  if (parsed.sheetName) updates.excelSheet = parsed.sheetName;

  updates.isTransposed = !!parsed.isTransposed;

  return Object.keys(updates).length ? updates : null;
}
