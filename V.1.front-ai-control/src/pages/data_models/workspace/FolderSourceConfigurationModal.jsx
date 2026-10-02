import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import styles from './FolderSourceConfigurationModal.module.css';
import { IconFile, IconFolder, IconTable } from './WidgetPanelIcons';
import { resolveFolderEntryAsFile } from './interactive/folderFileResolver.js';
import {
  analyzeFolderStructure,
  buildFolderInventoryFingerprint,
  resolveCachedStructure,
  stripStructureForCache,
} from './interactive/folderStructureUtils.js';
import {
  ensureFolderConfig,
  createEmptyExtractor,
  defaultDiscovery,
  EXTRACTOR_SOURCES,
  EXTRACTOR_METHODS,
  FOLDER_CONFIG_VERSION,
} from './interactive/folderConfigSchema.js';
import {
  buildFolderGroups,
  discoverFiles,
  applyExtractors,
  listAttributeNames,
  previewAttributes,
} from './interactive/folderAttributeEngine.js';
import { filterInventoryFiles } from './interactive/folderFilterUtils.js';
import { detectGroupSchema } from './interactive/folderSchemaDetection.js';

const STEP_LABELS = [
  'Поиск файлов',
  'Извлечение',
  'Группировка',
  'Схема',
  'Результат',
];

const SOURCE_LABELS = {
  filename: 'Имя файла',
  path: 'Полный путь',
  folder: 'Имя папки',
  extension: 'Расширение',
  size: 'Размер',
  modified: 'Дата изменения',
  hash: 'Хэш',
};

const METHOD_LABELS = {
  regex: 'Regex',
  split: 'Split',
  template: 'Шаблон',
  folder_index: 'Индекс папки',
  auto: 'Автоматически',
};

const MERGE_STRATEGY_OPTIONS = [
  {
    value: 'append',
    label: 'Склеивание (append)',
    description:
      'Строки из всех файлов группы добавляются друг за другом в одну таблицу. Подходит, когда столбцы и структура файлов совпадают.',
  },
  {
    value: 'union',
    label: 'Объединение столбцов (union)',
    description:
      'Файлы могут иметь разные наборы столбцов — в таблице будут все уникальные поля, отсутствующие значения останутся пустыми.',
  },
];

function formatFileSize(bytes) {
  if (!bytes) return '';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Math.round((bytes / k ** i) * 100) / 100} ${sizes[i]}`;
}

const FolderSourceConfigurationModal = ({
  isOpen,
  onClose,
  folderData,
  existingConfig,
  sessionStructureCache,
  onStructureCacheUpdate,
  onDraftSave,
  onSave,
}) => {
  const smbConnectionId = folderData?.smbConnectionId ?? null;
  const rootName = folderData?.name || '';

  const resolveFileForEntry = useCallback(
    (fileInfo) => resolveFolderEntryAsFile(fileInfo, smbConnectionId),
    [smbConnectionId],
  );

  const [currentStep, setCurrentStep] = useState(1);
  const [maxReachedStep, setMaxReachedStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [loadedFromCache, setLoadedFromCache] = useState(false);
  const [folderStructure, setFolderStructure] = useState(null);

  const [configName, setConfigName] = useState('Источник данных');
  const [discovery, setDiscovery] = useState({
    recursive: true,
    fileNameFilter: '*.csv;*.xlsx',
    includeCSV: true,
    includeXLSX: true,
  });
  const [extractors, setExtractors] = useState([]);
  const [groupingKeys, setGroupingKeys] = useState([]);
  const [tableTemplate, setTableTemplate] = useState('{source}');
  const [mergeStrategy, setMergeStrategy] = useState('append');
  const [groups, setGroups] = useState([]);
  const [expandedSchemaGroup, setExpandedSchemaGroup] = useState(null);
  const skipExtractorsPersistRef = useRef(true);
  const extractorsPersistTimerRef = useRef(null);

  const inventory = useMemo(
    () => folderData?.files || folderStructure?.files?.map((f) => ({
      ...f,
      relativePath: f.path,
    })) || [],
    [folderData, folderStructure],
  );

  const discoveredFiles = useMemo(
    () => discoverFiles(inventory, discovery, rootName),
    [inventory, discovery, rootName],
  );

  const enrichedFiles = useMemo(
    () => applyExtractors(discoveredFiles, extractors, rootName),
    [discoveredFiles, extractors, rootName],
  );

  const attributeNames = useMemo(() => listAttributeNames(extractors), [extractors]);

  const applyV2Config = (cfg) => {
    setConfigName(cfg.name || folderData?.name || 'Источник данных');
    setDiscovery({ ...defaultDiscovery(), ...(cfg.discovery || {}) });
    setExtractors(cfg.extractors?.length ? cfg.extractors.map((e) => ({ ...createEmptyExtractor(), ...e })) : []);
    setGroupingKeys(cfg.grouping?.keys || []);
    setTableTemplate(cfg.tableNaming?.template || '{source}');
    setMergeStrategy(cfg.merge?.strategy || 'append');
    setGroups(cfg.groups || []);
    if (cfg.wizardStep >= 1 && cfg.wizardStep <= 5) {
      setCurrentStep(cfg.wizardStep);
      setMaxReachedStep(cfg.wizardStep);
    }
    if (cfg.wizardStep === 4 && cfg.groups?.length) {
      setExpandedSchemaGroup(cfg.groups[0].tableName);
    }
  };

  const restoreStructureFromCache = () => {
    const cache = existingConfig?.structureCache
      || folderData?.structureCache
      || sessionStructureCache;
    return resolveCachedStructure(folderData, cache);
  };

  const persistStructureCache = (structure) => {
    if (!structure || !onStructureCacheUpdate) return;
    onStructureCacheUpdate({
      fingerprint: buildFolderInventoryFingerprint(folderData),
      structure: stripStructureForCache(structure),
    });
  };

  const refreshFolderStructure = async () => {
    setLoading(true);
    setLoadedFromCache(false);
    try {
      const structure = analyzeFolderStructure(folderData);
      setFolderStructure(structure);
      persistStructureCache(structure);
    } catch (error) {
      console.error(error);
      alert(`Ошибка при обновлении структуры: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const initializeFromFolderData = async () => {
    setLoading(true);
    skipExtractorsPersistRef.current = true;
    try {
      const cfg = ensureFolderConfig(existingConfig, folderData);
      applyV2Config(cfg);

      const cached = restoreStructureFromCache();
      if (cached) {
        setLoadedFromCache(true);
        setFolderStructure(cached);
      } else {
        const structure = analyzeFolderStructure(folderData);
        setFolderStructure(structure);
        persistStructureCache(structure);
      }
    } catch (error) {
      console.error(error);
      alert(`Ошибка инициализации: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !folderData) return;
    initializeFromFolderData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const buildFullConfig = () => {
    const partial = buildPartialConfig();
    const builtGroups = groups.length ? groups : buildFolderGroups(partial, inventory, rootName);
    const structureCache = folderStructure
      ? {
        fingerprint: buildFolderInventoryFingerprint(folderData),
        structure: stripStructureForCache(folderStructure),
      }
      : undefined;

    return {
      version: FOLDER_CONFIG_VERSION,
      name: configName,
      sourceType: 'folder',
      folderData,
      structureCache,
      discovery,
      extractors,
      grouping: { keys: groupingKeys },
      tableNaming: { template: tableTemplate },
      merge: { strategy: mergeStrategy },
      groups: builtGroups,
      wizardStep: currentStep,
    };
  };

  const persistDraft = (options = {}) => {
    if (!onDraftSave) return;
    onDraftSave(buildFullConfig(), options);
  };

  useEffect(() => {
    if (!isOpen || loading || currentStep !== 2) return undefined;
    if (skipExtractorsPersistRef.current) {
      skipExtractorsPersistRef.current = false;
      return undefined;
    }
    if (extractorsPersistTimerRef.current) {
      clearTimeout(extractorsPersistTimerRef.current);
    }
    extractorsPersistTimerRef.current = setTimeout(() => {
      persistDraft({ flushToDatabase: true });
    }, 500);
    return () => {
      if (extractorsPersistTimerRef.current) {
        clearTimeout(extractorsPersistTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extractors, isOpen, loading, currentStep]);

  const handleClose = () => {
    if (extractorsPersistTimerRef.current) {
      clearTimeout(extractorsPersistTimerRef.current);
      extractorsPersistTimerRef.current = null;
    }
    persistDraft({ flushToDatabase: true });
    onClose();
  };

  const buildPartialConfig = () => ({
    version: FOLDER_CONFIG_VERSION,
    name: configName,
    folderData,
    discovery,
    extractors,
    grouping: { keys: groupingKeys },
    tableNaming: { template: tableTemplate },
    merge: { strategy: mergeStrategy },
    groups,
  });

  const recomputeGroups = () => {
    const partial = buildPartialConfig();
    const built = buildFolderGroups(partial, inventory, rootName);
    const prevByName = new Map(groups.map((g) => [g.tableName, g]));
    return built.map((g) => ({
      ...g,
      schema: prevByName.get(g.tableName)?.schema || g.schema,
    }));
  };

  const detectSchemasForGroups = async (groupList, options = {}) => {
    setSchemaLoading(true);
    try {
      const next = [];
      for (const group of groupList) {
        const schema = await detectGroupSchema(
          group.files || [],
          resolveFileForEntry,
          group.schema || {},
          { sampleSize: options.sampleSize ?? 3 },
        );
        next.push({ ...group, schema });
      }
      setGroups(next);
      return next;
    } catch (error) {
      console.error('Schema detection failed:', error);
      return groupList;
    } finally {
      setSchemaLoading(false);
    }
  };

  const flushExtractorsPersistTimer = () => {
    if (extractorsPersistTimerRef.current) {
      clearTimeout(extractorsPersistTimerRef.current);
      extractorsPersistTimerRef.current = null;
    }
  };

  const advanceToStep = (targetStep, options = {}) => {
    const { skipPersist = false } = options;
    if (targetStep < 1 || targetStep > 5 || targetStep === currentStep) return false;

    if (currentStep === 2) {
      flushExtractorsPersistTimer();
    }

    if (targetStep >= 4 && currentStep <= 3) {
      const built = recomputeGroups();
      setGroups(built);
      if (targetStep === 4) {
        setExpandedSchemaGroup(built[0]?.tableName ?? null);
        void detectSchemasForGroups(built, { sampleSize: 3 });
      }
    } else if (targetStep === 5 && currentStep < 5) {
      const built = recomputeGroups();
      setGroups((prev) => {
        const prevByName = new Map(prev.map((g) => [g.tableName, g]));
        return built.map((g) => ({
          ...g,
          schema: prevByName.get(g.tableName)?.schema || g.schema,
        }));
      });
    }

    setCurrentStep(targetStep);
    setMaxReachedStep((prev) => Math.max(prev, targetStep));
    if (!skipPersist) {
      persistDraft({ flushToDatabase: true });
    }
    return true;
  };

  const handleGoToStep = (targetStep) => {
    if (targetStep > maxReachedStep) return;
    advanceToStep(targetStep);
  };

  const handleNext = async () => {
    if (currentStep === 1 && discoveredFiles.length === 0) {
      alert('Не найдено файлов по заданным фильтрам');
      return;
    }
    if (currentStep === 3) {
      advanceToStep(4);
      return;
    }
    advanceToStep(Math.min(currentStep + 1, 5));
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      advanceToStep(currentStep - 1);
    }
  };

  const handleSave = () => {
    onSave?.(buildFullConfig());
  };

  const updateExtractor = (index, patch) => {
    setExtractors((prev) => prev.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  };

  const addExtractor = () => {
    setExtractors((prev) => [...prev, createEmptyExtractor(`attr_${prev.length + 1}`)]);
  };

  const removeExtractor = (index) => {
    setExtractors((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleGroupingKey = (key) => {
    setGroupingKeys((prev) =>
      (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const TreeNode = ({ node, level = 0 }) => {
    const [expanded, setExpanded] = useState(level < 2);
    const nodeFiles = node.files
      ? filterInventoryFiles(
        node.files.map((f) => ({ ...f, name: f.name })),
        discovery,
      )
      : [];
    const hasChildren = node.children?.length > 0;
    const hasFiles = nodeFiles.length > 0;

    return (
      <div className={styles.treeNode}>
        <div
          className={styles.treeNodeHeader}
          style={{ paddingLeft: `${level * 1.5}rem` }}
          onClick={() => (hasChildren || hasFiles) && setExpanded(!expanded)}
        >
          <span className={styles.treeExpandIcon}>{expanded ? '▼' : '▶'}</span>
          <span className={styles.treeNodeIcon}>{node.type === 'folder' ? <IconFolder /> : <IconFile />}</span>
          <span className={styles.treeNodeName}>{node.name}</span>
        </div>
        {expanded && (
          <div className={styles.treeNodeContent}>
            {node.children?.map((child, i) => (
              <TreeNode key={`${child.path}-${i}`} node={child} level={level + 1} />
            ))}
            {nodeFiles.map((file, i) => (
              <div key={`${file.path}-${i}`} className={styles.treeFile} style={{ paddingLeft: `${(level + 1) * 1.5}rem` }}>
                <IconTable />
                <span>{file.name}</span>
                {file.size ? <span className={styles.treeFileSize}>{formatFileSize(file.size)}</span> : null}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderStep1 = () => (
    <div className={styles.stepContent}>
      <h3 className={styles.stepTitle}>Шаг 1: Поиск файлов</h3>
      {folderData?.isSmb && (
        <div className={styles.infoText} style={{ marginBottom: '0.75rem' }}>
          {loadedFromCache
            ? 'Структура из кэша. Обновите, если файлы на шаре изменились.'
            : 'Структура построена по сканированию SMB-папки.'}
          {' '}
          <button type="button" onClick={refreshFolderStructure} disabled={loading} style={{ background: 'none', border: 'none', color: 'var(--accent-color, #3b82f6)', cursor: 'pointer', textDecoration: 'underline' }}>
            Обновить структуру
          </button>
        </div>
      )}
      {folderStructure?.tree && (
        <div className={styles.folderTree}>
          <div className={styles.treeHeader}>
            <IconFolder />
            <span>{folderStructure.root}</span>
            <span className={styles.filesCount}>Найдено: {discoveredFiles.length}</span>
          </div>
          <TreeNode node={folderStructure.tree} />
        </div>
      )}
      <label className={styles.checkboxLabel}>
        <input
          type="checkbox"
          checked={discovery.recursive !== false}
          onChange={(e) => setDiscovery((d) => ({ ...d, recursive: e.target.checked }))}
        />
        Рекурсивно
      </label>
      <label className={styles.checkboxLabel}>
        <input
          type="checkbox"
          checked={discovery.includeCSV !== false}
          onChange={(e) => setDiscovery((d) => ({ ...d, includeCSV: e.target.checked }))}
        />
        CSV
      </label>
      <label className={styles.checkboxLabel}>
        <input
          type="checkbox"
          checked={discovery.includeXLSX !== false}
          onChange={(e) => setDiscovery((d) => ({ ...d, includeXLSX: e.target.checked }))}
        />
        XLSX
      </label>
      <div className={styles.filterGroup}>
        <label className={styles.label}>Фильтр (*.csv;*.xlsx)</label>
        <input
          className={styles.input}
          value={discovery.fileNameFilter || ''}
          onChange={(e) => setDiscovery((d) => ({ ...d, fileNameFilter: e.target.value }))}
          placeholder="*.csv;*.xlsx"
        />
      </div>
      <div className={styles.infoText}>
        <strong>Файлы ({discoveredFiles.length}):</strong>
        <ul style={{ maxHeight: 120, overflow: 'auto', margin: '0.5rem 0' }}>
          {discoveredFiles.slice(0, 20).map((f) => (
            <li key={f.path || f.name}><code>{f.path || f.name}</code></li>
          ))}
          {discoveredFiles.length > 20 && <li>…ещё {discoveredFiles.length - 20}</li>}
        </ul>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className={styles.stepContent}>
      <h3 className={styles.stepTitle}>Шаг 2: Извлечение атрибутов</h3>
      <p className={styles.stepDescription}>Задайте правила извлечения. Имена полей определяете вы.</p>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
        <thead>
          <tr>
            <th>Имя</th>
            <th>Источник</th>
            <th>Метод</th>
            <th>Параметры</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {extractors.map((ext, i) => (
            <tr key={i}>
              <td>
                <input
                  className={styles.input}
                  value={ext.name}
                  onChange={(e) => updateExtractor(i, { name: e.target.value })}
                />
              </td>
              <td>
                <select
                  className={styles.select}
                  value={ext.source}
                  onChange={(e) => updateExtractor(i, { source: e.target.value })}
                >
                  {EXTRACTOR_SOURCES.map((s) => (
                    <option key={s} value={s}>{SOURCE_LABELS[s] || s}</option>
                  ))}
                </select>
              </td>
              <td>
                <select
                  className={styles.select}
                  value={ext.method}
                  onChange={(e) => updateExtractor(i, { method: e.target.value })}
                >
                  {EXTRACTOR_METHODS.map((m) => (
                    <option key={m} value={m}>{METHOD_LABELS[m] || m}</option>
                  ))}
                </select>
              </td>
              <td>
                {ext.method === 'regex' && (
                  <input
                    className={styles.input}
                    placeholder="pattern"
                    value={ext.pattern || ''}
                    onChange={(e) => updateExtractor(i, { pattern: e.target.value })}
                  />
                )}
                {ext.method === 'split' && (
                  <>
                    <input
                      className={styles.input}
                      placeholder="delimiter"
                      value={ext.delimiter || '_'}
                      onChange={(e) => updateExtractor(i, { delimiter: e.target.value })}
                      style={{ width: 60 }}
                    />
                    <input
                      className={styles.input}
                      type="number"
                      placeholder="index"
                      value={ext.index ?? 0}
                      onChange={(e) => updateExtractor(i, { index: parseInt(e.target.value, 10) || 0 })}
                      style={{ width: 50, marginLeft: 4 }}
                    />
                  </>
                )}
                {ext.method === 'template' && (
                  <input
                    className={styles.input}
                    placeholder="{0}_{1}"
                    value={ext.template || ext.pattern || ''}
                    onChange={(e) => updateExtractor(i, { template: e.target.value })}
                  />
                )}
                {ext.method === 'folder_index' && (
                  <input
                    className={styles.input}
                    type="number"
                    value={ext.index ?? 0}
                    onChange={(e) => updateExtractor(i, { index: parseInt(e.target.value, 10) || 0 })}
                    style={{ width: 60 }}
                  />
                )}
              </td>
              <td>
                <button type="button" onClick={() => removeExtractor(i)}>✕</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className={styles.nextButton} onClick={addExtractor} style={{ marginTop: '0.75rem' }}>
        + Добавить правило
      </button>
      <div className={styles.infoText} style={{ marginTop: '1rem' }}>
        <strong>Превью атрибутов:</strong>
        <table style={{ width: '100%', marginTop: '0.5rem', fontSize: '0.8rem' }}>
          <thead>
            <tr>
              <th>Путь</th>
              {attributeNames.map((n) => <th key={n}>{n}</th>)}
            </tr>
          </thead>
          <tbody>
            {previewAttributes(enrichedFiles, 8).map((row) => (
              <tr key={row.path}>
                <td><code>{row.path}</code></td>
                {attributeNames.map((n) => <td key={n}>{row.attributes[n] ?? '—'}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderStep3 = () => {
    const previewGroups = recomputeGroups();
    return (
      <div className={styles.stepContent}>
        <h3 className={styles.stepTitle}>Шаг 3: Группировка и имена таблиц</h3>
        <p className={styles.stepDescription}>Пустой набор ключей — одна таблица на все файлы.</p>
        <div className={styles.settingsGroup}>
          {attributeNames.length === 0 && (
            <div className={styles.infoText}>Добавьте правила извлечения на шаге 2 или оставьте одну таблицу.</div>
          )}
          {attributeNames.map((key) => (
            <label key={key} className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={groupingKeys.includes(key)}
                onChange={() => toggleGroupingKey(key)}
              />
              {key}
            </label>
          ))}
        </div>
        <div className={styles.filterGroup}>
          <label className={styles.label}>Шаблон имени таблицы</label>
          <input
            className={styles.input}
            value={tableTemplate}
            onChange={(e) => setTableTemplate(e.target.value)}
            placeholder="{type}_{region}"
          />
          <div className={styles.filterHint}>Подстановка: {'{имя_атрибута}'}, {'{source}'} — имя источника</div>
        </div>
        <div className={styles.filterGroup}>
          <label className={styles.label}>Способ объединения файлов</label>
          <div className={styles.radioGroup}>
            {MERGE_STRATEGY_OPTIONS.map((option) => (
              <label key={option.value} className={styles.radioItem}>
                <input
                  type="radio"
                  name="mergeStrategy"
                  value={option.value}
                  checked={mergeStrategy === option.value}
                  onChange={(e) => setMergeStrategy(e.target.value)}
                />
                <div className={styles.radioContent}>
                  <div className={styles.radioTitle}>{option.label}</div>
                  <div className={styles.radioDescription}>{option.description}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
        <div className={styles.groupsPreview}>
          <div className={styles.groupsPreviewHeader}>
            <h4 className={styles.groupsPreviewTitle}>Превью групп</h4>
            <div className={styles.groupsPreviewStats}>
              <span className={styles.groupsPreviewBadge}>
                {previewGroups.length} {previewGroups.length === 1 ? 'таблица' : previewGroups.length < 5 ? 'таблицы' : 'таблиц'}
              </span>
              <span className={styles.groupsPreviewBadge}>
                {previewGroups.reduce((sum, g) => sum + (g.files?.length || 0), 0)} файлов
              </span>
            </div>
          </div>
          {previewGroups.length === 0 ? (
            <div className={styles.groupsPreviewEmpty}>Группы не сформированы</div>
          ) : (
            <div className={styles.groupsPreviewGrid}>
              {previewGroups.map((g) => {
                const keyEntries = Object.entries(g.key || {}).filter(([, v]) => v != null && v !== '');
                return (
                  <div key={g.tableName} className={styles.groupPreviewCard}>
                    <div className={styles.groupPreviewCardTop}>
                      <span className={styles.groupPreviewName}>{g.tableName}</span>
                      <span className={styles.groupPreviewCount} title="Файлов в группе">
                        {g.files?.length || 0}
                      </span>
                    </div>
                    {keyEntries.length > 0 && (
                      <div className={styles.groupPreviewKeys}>
                        {keyEntries.map(([k, v]) => (
                          <span key={k} className={styles.groupPreviewKey}>
                            {k}: <span>{v}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  const fieldTypeClass = (type) => {
    if (type === 'date' || type === 'datetime') return styles.schemaFieldTypeDate;
    if (type === 'int') return styles.schemaFieldTypeInt;
    if (type === 'number' || type === 'float') return styles.schemaFieldTypeNumber;
    return '';
  };

  const renderStep4 = () => {
    const totalFields = groups.reduce((sum, g) => sum + (g.schema?.fields?.length || 0), 0);
    const totalFiles = groups.reduce((sum, g) => sum + (g.files?.length || 0), 0);

    return (
      <div className={`${styles.stepContent} ${styles.stepContentSchema}`}>
        <h3 className={styles.stepTitle}>Шаг 4: Схема по группам</h3>
        <p className={styles.stepDescription}>
          Схема определяется по образцу файлов в каждой группе. Настройте строку заголовка Excel при необходимости.
        </p>

        {schemaLoading && (
          <div className={styles.loading}>
            <div className={styles.spinner} />
            <span>Определение схемы по образцу файлов…</span>
          </div>
        )}

        {!schemaLoading && groups.length === 0 && (
          <div className={styles.groupsPreviewEmpty}>Нет групп. Вернитесь на шаг 3 и настройте группировку.</div>
        )}

        {!schemaLoading && groups.length > 0 && (
          <div className={styles.schemaStepPanel}>
            <div className={styles.schemaStepSummary}>
              <p className={styles.schemaStepSummaryTitle}>Сводка по схемам</p>
              <div className={styles.groupsPreviewStats}>
                <span className={styles.groupsPreviewBadge}>{groups.length} таблиц</span>
                <span className={styles.groupsPreviewBadge}>{totalFiles} файлов</span>
                <span className={styles.groupsPreviewBadge}>{totalFields} полей</span>
              </div>
            </div>

            <div className={styles.schemaGroupList}>
              {groups.map((group) => {
                const fields = group.schema?.fields || [];
                const sampleFiles = (group.files || []).slice(0, 3);
                const isExpanded = expandedSchemaGroup === group.tableName;
                return (
                  <div
                    key={group.tableName}
                    className={`${styles.schemaGroupCard} ${isExpanded ? styles.schemaGroupCardExpanded : ''}`}
                  >
                    <button
                      type="button"
                      className={styles.schemaGroupSummary}
                      aria-expanded={isExpanded}
                      onClick={() => setExpandedSchemaGroup(isExpanded ? null : group.tableName)}
                    >
                      <span className={styles.schemaGroupName}>{group.tableName}</span>
                      <div className={styles.schemaGroupMeta}>
                        <span className={styles.schemaGroupFileCount}>
                          {group.files?.length || 0} файлов
                        </span>
                        <span className={styles.schemaGroupFieldCount}>
                          {fields.length} полей
                        </span>
                      </div>
                    </button>

                    {isExpanded && (
                    <div className={styles.schemaGroupBody}>
                      {(group.schema?.headerWarnings || []).map((warning) => (
                        <div key={warning} className={styles.schemaWarning}>
                          {warning}
                        </div>
                      ))}

                      <div className={styles.schemaGroupToolbar}>
                        <div className={styles.schemaHeaderRowControl}>
                          <label className={styles.label}>Строка заголовка Excel</label>
                          <input
                            className={styles.input}
                            type="number"
                            min={1}
                            value={group.schema?.excelHeaderRow ?? 1}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10) || 1;
                              setGroups((prev) => prev.map((g) =>
                                g.tableName === group.tableName
                                  ? { ...g, schema: { ...g.schema, excelHeaderRow: val } }
                                  : g));
                            }}
                          />
                        </div>
                      </div>

                      <div className={styles.schemaFieldsPanel}>
                        {fields.length === 0 ? (
                          <div className={styles.schemaFieldsEmpty}>
                            Поля не определены. Проверьте доступность файлов в группе.
                          </div>
                        ) : (
                          <>
                            <div className={styles.schemaFieldsHeader}>
                              <span>Поле</span>
                              <span>Тип</span>
                            </div>
                            <div className={styles.schemaFieldsList}>
                              {fields.map((f) => (
                                <div key={f.name} className={styles.schemaFieldRow}>
                                  <span className={styles.schemaFieldName}>{f.name}</span>
                                  <span className={`${styles.schemaFieldType} ${fieldTypeClass(f.type)}`}>
                                    {f.type}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>

                      {sampleFiles.length > 0 && (
                        <div className={styles.schemaFilesHint}>
                          Файлы:{' '}
                          {sampleFiles.map((f, i) => (
                            <span key={f.path || f.name}>
                              {i > 0 ? ', ' : ''}
                              <code>{f.path || f.name}</code>
                            </span>
                          ))}
                          {(group.files?.length || 0) > sampleFiles.length && (
                            <span> …ещё {(group.files?.length || 0) - sampleFiles.length}</span>
                          )}
                        </div>
                      )}
                    </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderStep5 = () => {
    const totalFields = groups.reduce((sum, g) => sum + (g.schema?.fields?.length || 0), 0);
    const totalFiles = groups.reduce((sum, g) => sum + (g.files?.length || 0), 0);
    const mergeLabel = MERGE_STRATEGY_OPTIONS.find((o) => o.value === mergeStrategy)?.label
      || mergeStrategy;

    return (
      <div className={`${styles.stepContent} ${styles.stepContentResult}`}>
        <h3 className={styles.stepTitle}>Шаг 5: Результат</h3>
        <p className={styles.stepDescription}>
          Проверьте итоговую конфигурацию перед сохранением. Будет создано {groups.length}{' '}
          {groups.length === 1 ? 'таблица' : groups.length < 5 ? 'таблицы' : 'таблиц'} DataCode.
        </p>

        <div className={styles.resultStepPanel}>
          <div className={styles.resultSourceCard}>
            <label className={styles.label}>Имя источника</label>
            <input
              className={styles.input}
              value={configName}
              onChange={(e) => setConfigName(e.target.value)}
              placeholder="Источник данных"
            />
          </div>

          {groups.length === 0 ? (
            <div className={styles.resultEmpty}>
              Нет сформированных групп. Вернитесь на шаг 3 и настройте группировку.
            </div>
          ) : (
            <>
              <div className={styles.resultStepSummary}>
                <p className={styles.resultStepSummaryTitle}>Итоговая конфигурация</p>
                <div className={styles.groupsPreviewStats}>
                  <span className={styles.groupsPreviewBadge}>{groups.length} таблиц</span>
                  <span className={styles.groupsPreviewBadge}>{totalFiles} файлов</span>
                  <span className={styles.groupsPreviewBadge}>{totalFields} полей</span>
                  <span className={styles.groupsPreviewBadge}>{mergeLabel}</span>
                </div>
              </div>

              <div className={styles.resultGroupList}>
                {groups.map((group) => {
                  const fields = group.schema?.fields || [];
                  const files = group.files || [];
                  const keyEntries = Object.entries(group.key || {}).filter(([, v]) => v != null && v !== '');
                  const visibleFiles = files.slice(0, 8);

                  return (
                    <div key={group.tableName} className={styles.resultGroupCard}>
                      <div className={styles.resultGroupHeader}>
                        <span className={styles.resultGroupName}>{group.tableName}</span>
                        <div className={styles.resultGroupMeta}>
                          <span className={styles.schemaGroupFileCount}>
                            {files.length} файлов
                          </span>
                          <span className={styles.schemaGroupFieldCount}>
                            {fields.length} полей
                          </span>
                        </div>
                      </div>

                      {keyEntries.length > 0 && (
                        <div className={styles.resultGroupKeys}>
                          {keyEntries.map(([k, v]) => (
                            <span key={k} className={styles.resultGroupKey}>
                              {k}: <span>{v}</span>
                            </span>
                          ))}
                        </div>
                      )}

                      <div className={styles.resultSectionLabel}>Файлы</div>
                      <div className={styles.resultFilesList}>
                        {visibleFiles.map((f) => (
                          <div key={f.path || f.name} className={styles.resultFileItem}>
                            <IconFile />
                            <code>{f.path || f.name}</code>
                          </div>
                        ))}
                        {files.length > visibleFiles.length && (
                          <div className={styles.resultFileItem}>
                            …ещё {files.length - visibleFiles.length} файлов
                          </div>
                        )}
                      </div>

                      <div className={styles.resultSectionLabel}>Поля</div>
                      <div className={styles.schemaFieldsPanel}>
                        {fields.length === 0 ? (
                          <div className={styles.schemaFieldsEmpty}>Поля не определены</div>
                        ) : (
                          <>
                            <div className={styles.schemaFieldsHeader}>
                              <span>Поле</span>
                              <span>Тип</span>
                            </div>
                            <div className={`${styles.schemaFieldsList} ${styles.resultFieldsCompact}`}>
                              {fields.map((f) => (
                                <div key={f.name} className={styles.schemaFieldRow}>
                                  <span className={styles.schemaFieldName}>{f.name}</span>
                                  <span className={`${styles.schemaFieldType} ${fieldTypeClass(f.type)}`}>
                                    {f.type}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={handleClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Настройка источника «Папка»</h2>
          <button className={styles.closeButton} onClick={handleClose}>×</button>
        </div>

        <div className={styles.modalBody}>
          {loading ? (
            <div className={styles.loading}>
              <div className={styles.spinner} />
              <span>Загрузка…</span>
            </div>
          ) : (
            <>
              <div className={styles.stepsIndicator}>
                {STEP_LABELS.map((label, i) => {
                  const step = i + 1;
                  const isActive = step === currentStep;
                  const isCompleted = step < currentStep;
                  const isClickable = step <= maxReachedStep && !isActive;
                  return (
                    <button
                      key={step}
                      type="button"
                      className={`${styles.stepIndicator} ${
                        isActive ? styles.active : isCompleted ? styles.completed : ''
                      } ${isClickable ? styles.stepIndicatorClickable : ''}`}
                      onClick={isClickable ? () => handleGoToStep(step) : undefined}
                      disabled={!isClickable}
                      aria-current={isActive ? 'step' : undefined}
                    >
                      <div className={styles.stepNumber}>{step}</div>
                      <div className={styles.stepLabel}>{label}</div>
                    </button>
                  );
                })}
              </div>
              {currentStep === 1 && renderStep1()}
              {currentStep === 2 && renderStep2()}
              {currentStep === 3 && renderStep3()}
              {currentStep === 4 && renderStep4()}
              {currentStep === 5 && renderStep5()}
            </>
          )}
        </div>

        {!loading && (
          <div className={styles.modalFooter}>
            <button className={styles.cancelButton} onClick={handleClose}>Закрыть</button>
            {currentStep > 1 && (
              <button className={styles.previousButton} onClick={handlePrevious}>Назад</button>
            )}
            {currentStep < 5 ? (
              <button className={styles.nextButton} onClick={handleNext}>Далее</button>
            ) : (
              <button className={styles.saveButton} onClick={handleSave}>Сохранить</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FolderSourceConfigurationModal;
