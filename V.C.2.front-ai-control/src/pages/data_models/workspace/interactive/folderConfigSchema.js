/**
 * Folder source configuration schema v2 and v1 migration.
 */

export const FOLDER_CONFIG_VERSION = 2;

export const EXTRACTOR_SOURCES = [
  'filename',
  'path',
  'folder',
  'extension',
  'size',
  'modified',
  'hash',
];

export const EXTRACTOR_METHODS = [
  'regex',
  'split',
  'template',
  'folder_index',
  'auto',
];

export const MERGE_STRATEGIES = ['append', 'union'];

export function defaultDiscovery() {
  return {
    recursive: true,
    fileNameFilter: '*.csv;*.xlsx',
    includeCSV: true,
    includeXLSX: true,
  };
}

export function defaultGrouping() {
  return { keys: [] };
}

export function defaultTableNaming() {
  return { template: '{source}' };
}

export function defaultMerge() {
  return { strategy: 'append' };
}

export function defaultGroupSchema() {
  return {
    excelHeaderRow: 1,
    fields: [],
    perFile: {},
    groupSync: true,
    headerWarnings: [],
  };
}

export function createEmptyExtractor(name = 'attr') {
  return {
    name,
    source: 'filename',
    method: 'regex',
    pattern: '',
    delimiter: '_',
    index: 0,
    group: 1,
    template: '',
  };
}

export function isFolderConfigV2(config) {
  return config?.version === FOLDER_CONFIG_VERSION;
}

export function normalizeFolderConfigV2(config = {}) {
  const discovery = { ...defaultDiscovery(), ...(config.discovery || {}) };
  return {
    version: FOLDER_CONFIG_VERSION,
    name: config.name || 'Источник данных',
    sourceType: 'folder',
    folderData: config.folderData || null,
    structureCache: config.structureCache || null,
    discovery,
    extractors: Array.isArray(config.extractors) ? config.extractors.map((e) => ({ ...createEmptyExtractor(), ...e })) : [],
    grouping: { ...defaultGrouping(), ...(config.grouping || {}) },
    tableNaming: { ...defaultTableNaming(), ...(config.tableNaming || {}) },
    merge: { ...defaultMerge(), ...(config.merge || {}) },
    groups: Array.isArray(config.groups) ? config.groups : [],
    wizardStep: typeof config.wizardStep === 'number' ? config.wizardStep : 1,
  };
}

/**
 * Migrate legacy folderConfig (v1) to v2.
 */
export function migrateFolderConfigV1(config, folderData = null) {
  if (!config) {
    return normalizeFolderConfigV2({
      folderData,
      name: folderData?.name || 'Источник данных',
    });
  }
  if (isFolderConfigV2(config)) {
    return normalizeFolderConfigV2(config);
  }

  const settings = config.settings || {};
  const extractors = [];
  const autoFieldNames = new Set(settings.autoFields || []);

  if (autoFieldNames.has('year')) {
    extractors.push({
      name: 'year',
      source: 'path',
      method: 'regex',
      pattern: '([0-9]{4})',
      group: 1,
    });
  }
  if (autoFieldNames.has('month')) {
    extractors.push({
      name: 'month',
      source: 'path',
      method: 'regex',
      pattern: '/([0-9]{1,2})/',
      group: 1,
    });
  }
  if (autoFieldNames.has('file_name')) {
    extractors.push({
      name: 'file_name',
      source: 'filename',
      method: 'auto',
    });
  }
  if (autoFieldNames.has('folder_name')) {
    extractors.push({
      name: 'folder_name',
      source: 'folder',
      method: 'folder_index',
      index: 0,
    });
  }

  let grouping = defaultGrouping();
  let tableNaming = defaultTableNaming();

  const agg = settings.aggregationType || 'merge';
  if (agg === 'separate') {
    if (!extractors.some((e) => e.name === 'file_stem')) {
      extractors.push({
        name: 'file_stem',
        source: 'filename',
        method: 'regex',
        pattern: '^(.*?)(?:\\.[^.]+)?$',
        group: 1,
      });
    }
    grouping = { keys: ['file_stem'] };
    tableNaming = { template: '{file_stem}' };
  } else if (agg === 'group_by_level') {
    if (!extractors.some((e) => e.name === 'level_1')) {
      extractors.push({ name: 'level_1', source: 'folder', method: 'folder_index', index: 0 });
    }
    if (!extractors.some((e) => e.name === 'level_2')) {
      extractors.push({ name: 'level_2', source: 'folder', method: 'folder_index', index: 1 });
    }
    grouping = { keys: ['level_1', 'level_2'] };
    tableNaming = { template: '{level_1}_{level_2}' };
  }

  const fields = settings.fields || [];
  const detectedFields = fields.filter((f) => !autoFieldNames.has(f.name));

  return normalizeFolderConfigV2({
    name: config.name || folderData?.name || 'Источник данных',
    folderData: config.folderData || folderData,
    structureCache: config.structureCache || null,
    discovery: {
      ...defaultDiscovery(),
      fileNameFilter: settings.fileNameFilter || '*.csv;*.xlsx',
      includeCSV: settings.includeCSV !== false,
      includeXLSX: settings.includeXLSX !== false,
    },
    extractors,
    grouping,
    tableNaming,
    merge: defaultMerge(),
    groups: [],
    _legacyFields: detectedFields,
    _legacyExcelHeaderRow: settings.excelHeaderRow ?? 1,
  });
}

export function ensureFolderConfig(config, folderData = null) {
  if (!config) return migrateFolderConfigV1(null, folderData);
  if (isFolderConfigV2(config)) return normalizeFolderConfigV2(config);
  return migrateFolderConfigV1(config, folderData);
}

/** Убирает эфемерные поля перед сохранением в widget.settings / БД. */
export function stripFolderConfigForPersist(config) {
  if (!config || typeof config !== 'object') return config;
  const { folderData: _folderData, ...rest } = config;
  return rest;
}
