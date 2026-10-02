/**
 * Folder attribute extraction, grouping, and table naming engine.
 */

import { sanitizeIdentifier } from './schema.js';
import { filterInventoryFiles } from './folderFilterUtils.js';
import { defaultGroupSchema } from './folderConfigSchema.js';

function normalizePath(p) {
  return String(p || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
}

function filePathKey(file) {
  return file.smbPath || file.path || file.relativePath || file.name || '';
}

function folderPartsFromPath(path, rootName = '') {
  const normalized = normalizePath(path);
  let parts = normalized.split('/').filter(Boolean);
  if (parts.length > 0 && rootName && parts[0] === rootName) {
    parts = parts.slice(1);
  }
  if (parts.length > 1) return parts.slice(0, -1);
  return [];
}

function basename(path) {
  const p = normalizePath(path);
  const parts = p.split('/').filter(Boolean);
  return parts[parts.length - 1] || p;
}

function stem(name) {
  const n = basename(name);
  const dot = n.lastIndexOf('.');
  return dot > 0 ? n.slice(0, dot) : n;
}

function extension(name) {
  const n = basename(name);
  const dot = n.lastIndexOf('.');
  return dot > 0 ? n.slice(dot + 1).toLowerCase() : '';
}

function sourceText(file, source, rootName) {
  const path = filePathKey(file) || file.path || file.relativePath || file.name || '';
  switch (source) {
    case 'filename':
      return basename(path);
    case 'path':
      return normalizePath(path);
    case 'folder': {
      const parts = file.folderParts ?? folderPartsFromPath(path, rootName);
      return parts.join('/');
    }
    case 'extension':
      return extension(file.name || path);
    case 'size':
      return file.size != null ? String(file.size) : '';
    case 'modified':
      if (file.lastModified) return new Date(file.lastModified).toISOString();
      if (file.modified) return String(file.modified);
      return '';
    case 'hash':
      return file.hash || '';
    default:
      return '';
  }
}

function applyRegex(text, pattern, group = 1) {
  if (!pattern) return null;
  try {
    const re = new RegExp(pattern);
    const m = re.exec(text);
    if (!m) return null;
    if (group != null && m[group] != null) return m[group];
    return m[0] ?? null;
  } catch {
    return null;
  }
}

function applySplit(text, delimiter, index = 0) {
  if (!delimiter) return null;
  const parts = text.split(delimiter);
  if (index < 0 || index >= parts.length) return null;
  return parts[index];
}

/**
 * Template: literal with {0},{1} split parts or {name} placeholders from split by _
 * Pattern like "{type}_{region}" on filename stem uses named segments from split by _
 * For template method: pattern uses {token} replaced from split parts by position in pattern
 * Simpler: pattern "sales_{region}" with tokens matching split indices via {0},{1}
 */
function applyTemplate(text, template, delimiter = '_') {
  if (!template) return text;
  const parts = text.split(delimiter);
  return template.replace(/\{(\d+)\}/g, (_, idx) => {
    const i = parseInt(idx, 10);
    return parts[i] ?? '';
  }).replace(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, (_, name) => {
    const idx = parseInt(name, 10);
    if (!Number.isNaN(idx)) return parts[idx] ?? '';
    return `{${name}}`;
  });
}

function applyFolderIndex(file, index, rootName) {
  const parts = file.folderParts ?? folderPartsFromPath(filePathKey(file), rootName);
  if (index < 0 || index >= parts.length) return null;
  return parts[index];
}

function applyAutoSource(file, source) {
  const path = filePathKey(file);
  switch (source) {
    case 'filename':
      return basename(path);
    case 'extension':
      return extension(file.name || path);
    case 'size':
      return file.size != null ? String(file.size) : null;
    case 'modified':
      if (file.lastModified) return new Date(file.lastModified).toISOString();
      return file.modified != null ? String(file.modified) : null;
    case 'hash':
      return file.hash || null;
    default:
      return null;
  }
}

export function applyExtractor(file, extractor, rootName = '') {
  const { source, method } = extractor;
  const text = sourceText(file, source, rootName);

  if (method === 'auto') {
    return applyAutoSource(file, source);
  }

  if (source === 'folder' && method === 'folder_index') {
    return applyFolderIndex(file, extractor.index ?? 0, rootName);
  }

  if (method === 'regex') {
    return applyRegex(text, extractor.pattern, extractor.group ?? 1);
  }

  if (method === 'split') {
    return applySplit(text, extractor.delimiter ?? '_', extractor.index ?? 0);
  }

  if (method === 'template') {
    return applyTemplate(text, extractor.template || extractor.pattern, extractor.delimiter ?? '_');
  }

  return null;
}

export function discoverFiles(inventory, discovery = {}, rootName = '') {
  const files = filterInventoryFiles(inventory, discovery);
  return files.map((file) => {
    const path = filePathKey(file);
    return {
      ...file,
      path: file.path || file.relativePath || path,
      relativePath: file.relativePath || file.path || path,
      extension: extension(file.name || path),
      folderParts: folderPartsFromPath(path, rootName),
    };
  });
}

export function applyExtractors(files, extractors = [], rootName = '') {
  return files.map((file) => {
    const attributes = {};
    for (const extractor of extractors) {
      if (!extractor?.name) continue;
      const value = applyExtractor(file, extractor, rootName);
      attributes[extractor.name] = value != null && value !== '' ? String(value) : null;
    }
    return {
      ...file,
      attributes,
    };
  });
}

function groupKeyFromAttributes(attributes, keys) {
  if (!keys?.length) return '__default__';
  return keys.map((k) => attributes[k] ?? '_').join('\0');
}

export function groupFiles(enrichedFiles, grouping = {}) {
  const keys = grouping.keys || [];
  const map = new Map();

  for (const file of enrichedFiles) {
    const gk = groupKeyFromAttributes(file.attributes || {}, keys);
    if (!map.has(gk)) {
      const keyObj = {};
      if (keys.length) {
        for (const k of keys) {
          keyObj[k] = file.attributes?.[k] ?? null;
        }
      }
      map.set(gk, { key: keyObj, files: [] });
    }
    map.get(gk).files.push(file);
  }

  return Array.from(map.values());
}

export function resolveTableName(template, key, attributes, fallback = 'dataset') {
  let result = template || '{source}';
  const attrs = { ...attributes, ...key };

  result = result.replace(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, (_, name) => {
    if (name === 'source') return fallback;
    const val = attrs[name];
    return val != null && val !== '' ? String(val) : '_';
  });

  return sanitizeIdentifier(result.replace(/\s+/g, '_'), fallback);
}

export function assignTableNames(rawGroups, tableNaming = {}, sourceName = 'dataset') {
  const used = new Map();
  return rawGroups.map((group) => {
    const attrs = group.files[0]?.attributes || {};
    let baseName = resolveTableName(
      tableNaming.template || '{source}',
      group.key,
      attrs,
      sanitizeIdentifier(sourceName, 'dataset'),
    );

    const count = used.get(baseName) || 0;
    used.set(baseName, count + 1);
    if (count > 0) baseName = `${baseName}_${count + 1}`;

    return {
      ...group,
      tableName: baseName,
    };
  });
}

export function groupFilesByHeaders(fileFields) {
  const groups = [];
  const processed = new Set();

  for (let i = 0; i < fileFields.length; i += 1) {
    if (processed.has(i)) continue;

    const currentFile = fileFields[i];
    const currentHeadersSet = new Set(
      (currentFile.headers || []).map((h) => h.toLowerCase().trim()).filter(Boolean),
    );

    const group = {
      id: groups.length,
      files: [currentFile],
      commonHeaders: Array.from(currentHeadersSet),
      headerRow: currentFile.headerRow ?? 1,
    };

    processed.add(i);

    for (let j = i + 1; j < fileFields.length; j += 1) {
      if (processed.has(j)) continue;
      const otherFile = fileFields[j];
      const otherHeadersSet = new Set(
        (otherFile.headers || []).map((h) => h.toLowerCase().trim()).filter(Boolean),
      );
      const setsMatch = currentHeadersSet.size === otherHeadersSet.size
        && Array.from(currentHeadersSet).every((h) => otherHeadersSet.has(h));
      if (setsMatch) {
        group.files.push(otherFile);
        processed.add(j);
      }
    }

    groups.push(group);
  }

  return groups;
}

/**
 * Attach default schema placeholders to materialized groups.
 */
export function buildGroupSchemas(namedGroups, existingGroups = []) {
  const existingByTable = new Map((existingGroups || []).map((g) => [g.tableName, g]));

  return namedGroups.map((group) => {
    const prev = existingByTable.get(group.tableName);
    const schema = prev?.schema
      ? { ...defaultGroupSchema(), ...prev.schema }
      : { ...defaultGroupSchema() };

    const headerSubgroups = prev?.schema?.headerSubgroups || [];

    return {
      tableName: group.tableName,
      key: group.key,
      files: group.files.map((f) => ({
        name: f.name,
        path: f.path || f.relativePath,
        smbPath: f.smbPath,
        size: f.size,
        isSmb: f.isSmb,
        extension: f.extension,
        attributes: f.attributes,
      })),
      schema: {
        ...schema,
        headerSubgroups,
        headerWarnings: headerSubgroups.length > 1
          ? ['Файлы в группе имеют разные наборы заголовков']
          : [],
      },
    };
  });
}

/**
 * Full pipeline: discover → extract → group → name → schema shell.
 */
export function buildFolderGroups(config, inventory, rootName = '') {
  const discovered = discoverFiles(inventory, config.discovery, rootName);
  const enriched = applyExtractors(discovered, config.extractors, rootName);
  const grouped = groupFiles(enriched, config.grouping);
  const named = assignTableNames(grouped, config.tableNaming, config.name || rootName);
  return buildGroupSchemas(named, config.groups);
}

export function listAttributeNames(extractors = []) {
  return extractors.map((e) => e.name).filter(Boolean);
}

export function previewAttributes(enrichedFiles, limit = 5) {
  return enrichedFiles.slice(0, limit).map((f) => ({
    path: f.path || f.relativePath || f.name,
    attributes: f.attributes || {},
  }));
}
