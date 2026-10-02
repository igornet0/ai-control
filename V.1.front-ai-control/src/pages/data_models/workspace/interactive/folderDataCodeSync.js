/**
 * DataCode generation for folder sources (v2 config with groups).
 */

import { sanitizeIdentifier } from './schema.js';
import { buildSmbLibPath } from './fileSourceDataCodeSync.js';
import { ensureFolderConfig } from './folderConfigSchema.js';
import { buildFolderGroups } from './folderAttributeEngine.js';

function escapeString(s) {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

function getFolderLikeContainer(widgetSettings) {
  if (widgetSettings?.sourceType === 'archive') {
    return widgetSettings.selectedArchive;
  }
  return widgetSettings.selectedFolder;
}

function filePathForRead(file, widgetSettings) {
  const isSmb = widgetSettings.sourceType !== 'archive' && widgetSettings.fileDeliveryMode === 'smb';
  if (isSmb) {
    const share = widgetSettings.smbShareName || widgetSettings.smbShare || '';
    const rel = file.smbPath || file.path || file.relativePath || file.name || '';
    return buildSmbLibPath(share, rel);
  }
  return file.path || file.relativePath || file.name || '';
}

function buildReadParamsForFolderFile(file, groupSchema, widgetSettings) {
  const pathValue = filePathForRead(file, widgetSettings);
  const perFile = groupSchema?.perFile || {};
  const fileKey = file.path || file.relativePath || file.smbPath || file.name || '';
  const perFileCfg = perFile[fileKey] || {};

  const params = [`path("${escapeString(pathValue)}")`];

  const headerRowNum = parseInt(
    perFileCfg.headerRow ?? groupSchema?.excelHeaderRow ?? 1,
    10,
  );
  const headerRow = !Number.isNaN(headerRowNum) && headerRowNum > 0 ? headerRowNum - 1 : 0;
  params.push(`header_row=${headerRow}`);

  const isSmb = widgetSettings.fileDeliveryMode === 'smb';
  const ext = (file.name || fileKey).split('.').pop()?.toLowerCase() || '';
  const sheet = perFileCfg.sheet || groupSchema?.excelSheet;
  if (!isSmb && (ext === 'xlsx' || ext === 'xls') && sheet) {
    params.push(`sheet_name="${escapeString(sheet)}"`);
  }

  const fields = groupSchema?.fields || [];
  if (fields.length) {
    const headerArray = fields.map((f) => `"${escapeString(f.name)}"`).join(', ');
    params.push(`header=[${headerArray}]`);
  }

  return params;
}

function buildReadLine(file, groupSchema, widgetSettings) {
  const params = buildReadParamsForFolderFile(file, groupSchema, widgetSettings);
  return `read(${params.join(', ')})`;
}

function buildGroupAssignment(tableName, files, groupSchema, widgetSettings, exportGlobal) {
  const prefix = exportGlobal ? 'global ' : '';
  if (!files?.length) {
    return `${prefix}${tableName} = table()`;
  }
  if (files.length === 1) {
    return `${prefix}${tableName} = ${buildReadLine(files[0], groupSchema, widgetSettings)}`;
  }
  const reads = files.map((f) => `    ${buildReadLine(f, groupSchema, widgetSettings)}`).join(',\n');
  return `${prefix}${tableName} = append([\n${reads}\n])`;
}

export function generateFolderSourceCode(widgetSettings, folderConfigInput, options = {}) {
  const container = getFolderLikeContainer(widgetSettings);
  const folderConfig = ensureFolderConfig(folderConfigInput, container);
  const inventory = container?.files || [];
  const rootName = container?.name || folderConfig.name || '';

  let groups = folderConfig.groups;
  if (!groups?.length) {
    groups = buildFolderGroups(folderConfig, inventory, rootName);
  }

  if (!groups?.length) {
    return generateFolderSourceCodeFallback(widgetSettings);
  }

  const exportGlobal = options.exportGlobal ?? widgetSettings.exportGlobal ?? true;
  const lines = [];

  for (const group of groups) {
    const tableName = sanitizeIdentifier(group.tableName, 'dataset');
    const assignment = buildGroupAssignment(
      tableName,
      group.files || [],
      group.schema || {},
      widgetSettings,
      exportGlobal,
    );
    lines.push(assignment);
    lines.push(`print("${tableName}: ", table_info(${tableName}))`);
    lines.push('');
  }

  return lines.join('\n').trim();
}

export function generateFolderSourceCodeFallback(widgetSettings) {
  const container = getFolderLikeContainer(widgetSettings);
  const folderName = container?.name || (widgetSettings.sourceType === 'archive' ? 'Архив' : 'Папка');
  const isSmb = widgetSettings.fileDeliveryMode === 'smb';
  const pathExpr = isSmb
    ? `path("${escapeString(buildSmbLibPath(
      widgetSettings.smbShareName || '',
      widgetSettings.smbSharePath || container?.smbPath || '',
    ))}")`
    : 'path(".")';
  const label = widgetSettings.sourceType === 'archive' ? 'архиве' : 'папке';
  return `print("Файлы в ${label} ${folderName}:")
files = list_files(${pathExpr})
for file in files do
    print("  -", file)
next file`;
}

export function syncFolderDataCode(widgetSettings, folderConfig) {
  return generateFolderSourceCode(widgetSettings, folderConfig);
}

export function patchFolderSourceInCode(code, widgetSettings, folderConfig) {
  const generated = generateFolderSourceCode(widgetSettings, folderConfig);
  if (!code?.trim()) return generated;
  return generated;
}
