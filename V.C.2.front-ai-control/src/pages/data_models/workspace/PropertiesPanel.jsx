import React, { useState, useEffect, useRef, useCallback } from 'react';
import { eventBus } from './core/EventBus.js';
import { widgetIdsEqual } from './widgetIdUtils.js';
import { syncConnectionFieldsFromUpstream } from './connectionSettingsUtils.js';
import FileSelectorModal from './FileSelectorModal.jsx';
import SmbFileBrowserModal from './SmbFileBrowserModal.jsx';
import FolderSourceConfigurationModal from './FolderSourceConfigurationModal.jsx';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { dataModelService } from '../../../services/dataModelService';
import InteractiveDataSource from './interactive/InteractiveDataSource.jsx';
import { generateDataCodeFromConfig, ensureInteractiveDataInputMerge } from './interactive/dataCodeSync.js';
import {
  generateDefaultFileSourceCode,
  parseFileSourceFromCode,
  patchFileSourceInCode,
  settingsUpdatesFromParsedRead,
  buildSmbLibPath,
  findReadAssignment,
  resolveFilePathForSettings,
  resolveSourcePathForSettings,
  generateDefaultFolderSourceCode,
} from './interactive/fileSourceDataCodeSync.js';
import { generateFolderSourceCode } from './interactive/folderDataCodeSync.js';
import {
  generateDefaultApiSourceCode,
  findSourceTableAssignment,
  patchApiSourceInCode,
  resolveApiDataCodeVariableName,
} from './interactive/apiSourceDataCodeSync.js';
import {
  DB_TYPE_DEFAULTS,
  generateDefaultDatabaseSourceCode,
  normalizeDatabaseSettings,
  patchDatabaseSourceInCode,
  resolveDatabaseDataCodeVariableName,
} from './interactive/databaseSourceDataCodeSync.js';
import {
  buildDefaultSeparateFilterVariableName,
  generateFilterDataCode,
  patchFilterDataCodeInCode,
  resolveFilterOutputVariableName,
  resolveUpstreamDataCodeVariable,
} from './interactive/filterDataCodeSync.js';
import {
  generateTransformDataCode,
  patchTransformDataCodeInCode,
} from './interactive/transformDataCodeSync.js';
import TransformSettingsPanel from './TransformSettingsPanel.jsx';
import {
  generateAggregateDataCode,
  patchAggregateDataCodeInCode,
} from './interactive/aggregateDataCodeSync.js';
import AggregateSettingsPanel from './AggregateSettingsPanel.jsx';
import JoinSettingsPanel from './JoinSettingsPanel.jsx';
import RelationshipSettingsPanel from './RelationshipSettingsPanel.jsx';
import { resolveIncomingAvailableFields, getSourceTables } from './interactive/incomingFieldsUtils.js';
import { loadUpstreamFieldsAsync } from './upstreamFieldsLoader.js';
import FieldNameInput from './components/FieldNameInput.jsx';
import { buildFormulaTemplates } from './formulaTemplates.js';
import {
  FORMULA_VARIABLE_FUNCS,
  buildFormulaVariableTemplates,
  createFormulaVariable,
} from './interactive/formulaVariables.js';
import { isFolderConfigV2, stripFolderConfigForPersist } from './interactive/folderConfigSchema.js';
import {
  beginFileParseActivity,
  endFileParseActivity,
  getSmbShareNameFromConnection,
  normalizeWidgetSettingsForDelivery,
} from './compileFileUtils.js';
import { connectionService } from '../../../services/connectionService';
import { createDefaultInteractiveConfig, sanitizeIdentifier, tableVariableNameFromFileName } from './interactive/schema.js';
import { resolveColumnsFromRawRows } from './interactive/fileTransposeUtils.js';
import { loadFileRawRows } from './interactive/fileRawRowsLoader.js';
import { scanSmbFolder } from './interactive/smbFolderScanner.js';
import { buildStructureCache } from './interactive/folderStructureUtils.js';
import { unpackArchive, isArchiveFileName } from './interactive/archiveUtils.js';
import {
  getFolderSessionStructureCache,
  setFolderSessionStructureCache,
} from './interactive/folderStructureSessionCache.js';
import { ensureWidgetInDatabase, parseDbWidgetId, saveWidgetToDatabase } from './widgetDbSync.js';
import { PencilIcon } from '@heroicons/react/24/outline';
import DataCodeOpenButton from './components/DataCodeOpenButton.jsx';
import LinkedModelSourceSettings from './components/LinkedModelSourceSettings.jsx';
import { normalizeLinkedTables } from './interactive/linkedModelDataCodeSync.js';
import {
  checkWidgetCodeModified,
  regenerateWidgetDataCode,
} from './widgetDataCodeState.js';
import { widgetHasDataCode, widgetIdKey } from './widgetGraphOrder.js';
import styles from './PropertiesPanel.module.css';
import { IconArchive, IconFile, IconFolder } from './WidgetPanelIcons';
import ApiIngestSourceSettings from './components/ApiIngestSourceSettings.jsx';
import DatabaseSourceSettings from './components/DatabaseSourceSettings.jsx';
import JsonSourceSettings from './components/JsonSourceSettings.jsx';
import DataBridgeSourceSettings from './components/DataBridgeSourceSettings.jsx';
import {
  generateDefaultJsonSourceCode,
  patchJsonSourceInCode,
  findSourceTableAssignment as findJsonSourceTableAssignment,
  parseJsonTextToTable,
} from './interactive/jsonSourceDataCodeSync.js';
import {
  generateDefaultDatabridgeSourceCode,
  patchDatabridgeSourceInCode,
} from './interactive/databridgeDataCodeSync.js';
import {
  generateRelationshipDataCode,
  patchRelationshipDataCodeInCode,
} from './interactive/relationshipDataCodeSync.js';
import { collectRelationshipTableSources } from './interactive/relationshipSources.js';
import { defaultTableName as defaultJsonTableName } from './apiIngestSourceUtils.js';

// Форматирование размера файла
const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

function buildFolderModalData(settings) {
  if (!settings) return null;
  if (settings.sourceType === 'folder' && settings.selectedFolder) {
    return {
      ...settings.selectedFolder,
      smbConnectionId: settings.fileDeliveryMode === 'smb' ? settings.smbConnectionId : null,
      isSmb: settings.fileDeliveryMode === 'smb',
    };
  }
  if (settings.sourceType === 'archive' && settings.selectedArchive) {
    return {
      ...settings.selectedArchive,
      smbConnectionId: settings.fileDeliveryMode === 'smb' ? settings.smbConnectionId : null,
      isSmb: settings.fileDeliveryMode === 'smb',
      isArchive: true,
      archiveFile: settings.selectedArchive.file,
    };
  }
  return null;
}

function getFolderLikeContainer(settings) {
  if (!settings) return null;
  if (settings.sourceType === 'archive') return settings.selectedArchive;
  if (settings.sourceType === 'folder') return settings.selectedFolder;
  return null;
}

function withFolderLikeContainer(settings, container) {
  if (settings.sourceType === 'archive') {
    return { ...settings, selectedArchive: container };
  }
  return { ...settings, selectedFolder: container };
}

function getSmbBrowserMode(settings) {
  if (settings.sourceType === 'folder') return 'folder';
  if (settings.sourceType === 'archive') return 'archive';
  return 'file';
}

/**
 * PropertiesPanel - Панель свойств для редактирования настроек выбранного виджета
 */
const PropertiesPanel = ({
  engineRef,
  modelId,
  onOpenDataCodeEditor,
  dataCodeStatusRefreshKey = 0,
}) => {
  const [selectedWidget, setSelectedWidget] = useState(null);
  const [settings, setSettings] = useState({});
  const [isFileSelectorOpen, setIsFileSelectorOpen] = useState(false);
  const [isSmbBrowserOpen, setIsSmbBrowserOpen] = useState(false);
  const [isFolderConfigOpen, setIsFolderConfigOpen] = useState(false);
  const [folderConfigFolderData, setFolderConfigFolderData] = useState(null);
  const [selectedWidgetCodeModified, setSelectedWidgetCodeModified] = useState(false);
  const saveCodeTimeoutRef = React.useRef(null);
  const interactiveSaveTimeoutRef = React.useRef(null);
  const [interactiveSavedCode, setInteractiveSavedCode] = useState('');
  const selectedWidgetRef = useRef(selectedWidget);
  const settingsRef = useRef(settings);
  const interactiveSavedCodeRef = useRef(interactiveSavedCode);
  const fileSourceSavedCodeRef = useRef('');
  const folderSourceSavedCodeRef = useRef('');
  const filterSourceSavedCodeRef = useRef('');
  const transformSourceSavedCodeRef = useRef('');
  const aggregateSourceSavedCodeRef = useRef('');
  const relationshipSourceSavedCodeRef = useRef('');
  const fileDataCodeSyncTimeoutRef = useRef(null);
  const filterDataCodeSyncTimeoutRef = useRef(null);
  const transformDataCodeSyncTimeoutRef = useRef(null);
  const aggregateDataCodeSyncTimeoutRef = useRef(null);
  const relationshipDataCodeSyncTimeoutRef = useRef(null);
  const isApplyingCodeToSettingsRef = useRef(false);
  const fileColumnsRef = useRef([]);
  const fileRawRowsRef = useRef([]);

  const FILE_CODE_SYNC_FIELDS = new Set([
    'selectedColumns',
    'fieldRenames',
    'excelHeaderRow',
    'excelSheet',
    'sourcePath',
    'isTransposed',
    'fileDeliveryMode',
    'smbConnectionId',
    'smbSharePath',
    'smbShareName',
    'exportGlobal',
  ]);
  const API_CODE_SYNC_FIELDS = new Set([
    'selectedColumns',
    'fieldRenames',
    'tableName',
    'fileColumns',
    'exportGlobal',
    'dataCodeVariableName',
  ]);
  const DB_CODE_SYNC_FIELDS = new Set([
    'dbType',
    'dbConnectionMode',
    'dbUrl',
    'connectionString',
    'dbHost',
    'dbPort',
    'database',
    'dbUsername',
    'dbPassword',
    'dbSchema',
    'dbPath',
    'dbCollection',
    'dbTable',
    'query',
    'dbTimeout',
    'exportGlobal',
    'dataCodeVariableName',
    'name',
  ]);
  const JSON_CODE_SYNC_FIELDS = new Set([
    'selectedColumns',
    'fieldRenames',
    'tableName',
    'fileColumns',
    'exportGlobal',
    'dataCodeVariableName',
    'jsonSourceType',
    'jsonData',
    'sourcePath',
  ]);
  const FILTER_CODE_SYNC_FIELDS = new Set([
    'filterConditions',
    'filterGroups',
    'filterLogic',
    'filterSeparateOutput',
    'dataCodeVariableName',
    'exportGlobal',
    'name',
  ]);
  const TRANSFORM_CODE_SYNC_FIELDS = new Set([
    'transformOperations',
    'transformSeparateOutput',
    'dataCodeVariableName',
    'exportGlobal',
    'name',
  ]);
  const AGGREGATE_CODE_SYNC_FIELDS = new Set([
    'aggregateGroupBy',
    'aggregateMetrics',
    'aggregateSeparateOutput',
    'dataCodeVariableName',
    'exportGlobal',
    'name',
  ]);
  const RELATIONSHIP_CODE_SYNC_FIELDS = new Set([
    'pk',
    'foreignKeys',
    'left',
    'right',
    'junction',
    'fromField',
    'toField',
    'relationshipType',
    'name',
    'description',
  ]);
  const [smbConnections, setSmbConnections] = useState([]);

  useEffect(() => {
    selectedWidgetRef.current = selectedWidget;
  }, [selectedWidget]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    interactiveSavedCodeRef.current = interactiveSavedCode;
  }, [interactiveSavedCode]);
  const [connections, setConnections] = useState([]);
  const [upstreamFieldsRevision, setUpstreamFieldsRevision] = useState(0);
  const [resolvedIncomingFields, setResolvedIncomingFields] = useState([]);
  const connectionsRef = useRef(connections);
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const archiveInputRef = useRef(null);
  
  // Состояния для настройки файлов
  const [fileColumns, setFileColumns] = useState([]);
  const [excelSheets, setExcelSheets] = useState([]);
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Состояние для редактирования названий полей
  const [editingField, setEditingField] = useState(null);
  const [editingFieldValue, setEditingFieldValue] = useState('');

  useEffect(() => {
    fileColumnsRef.current = fileColumns;
  }, [fileColumns]);

  const cacheRawRowsAndApplyTranspose = useCallback((rows, widgetSettings) => {
    if (!rows?.length) return;
    fileRawRowsRef.current = rows;
    if (!widgetSettings?.isTransposed) return;

    const columns = resolveColumnsFromRawRows(
      rows,
      widgetSettings.excelHeaderRow || 1,
      true,
    );
    if (!columns.length) return;

    setFileColumns(columns);
    setSettings((prev) => {
      const next = {
        ...prev,
        selectedColumns: columns,
        fileColumns: columns,
      };
      settingsRef.current = next;
      return next;
    });
    if (selectedWidgetRef.current) {
      selectedWidgetRef.current.settings = {
        ...selectedWidgetRef.current.settings,
        selectedColumns: columns,
        fileColumns: columns,
      };
    }
  }, []);

  useEffect(() => {
    if (!isParsingFile) return undefined;
    beginFileParseActivity();
    return () => endFileParseActivity();
  }, [isParsingFile]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await connectionService.getConnections(0, 200, 'smb', true);
        if (!cancelled) setSmbConnections(Array.isArray(list) ? list : list?.items || []);
      } catch {
        if (!cancelled) setSmbConnections([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    connectionsRef.current = connections;
  }, [connections]);

  // Обновление списка соединений
  const updateConnections = (widget) => {
    if (!widget || !engineRef.current) {
      setConnections([]);
      return;
    }

    // Получаем актуальный виджет из движка, чтобы убедиться, что у нас свежие данные
    const currentWidget = engineRef.current.widgetManager.getWidget(widget.id);
    if (!currentWidget) {
      setConnections([]);
      return;
    }

    const widgetConnections = currentWidget.connections || [];
    const connectionsWithInfo = widgetConnections.map(conn => {
      const fromWidget = engineRef.current.widgetManager.getWidget(conn.from);
      const toWidget = engineRef.current.widgetManager.getWidget(conn.to);

      if (fromWidget && widgetIdsEqual(conn.to, currentWidget.id)) {
        syncConnectionFieldsFromUpstream(
          engineRef.current.widgetManager,
          conn.id,
          fromWidget,
        );
      }

      const liveConn = currentWidget.connections.find((c) => c.id === conn.id) || conn;
      
      return {
        ...liveConn,
        fromWidget: fromWidget,
        toWidget: toWidget,
        fromName: fromWidget?.settings?.name || `Виджет ${liveConn.from}`,
        toName: toWidget?.settings?.name || `Виджет ${liveConn.to}`,
        isOutgoing: widgetIdsEqual(liveConn.from, currentWidget.id),
        isIncoming: widgetIdsEqual(liveConn.to, currentWidget.id)
      };
    });

    setConnections(connectionsWithInfo);
  };

  useEffect(() => {
    let cancelled = false;
    const widget = selectedWidgetRef.current;
    const firstIncoming = (connectionsRef.current || []).find((conn) => conn.isIncoming);
    const widgetManager = engineRef.current?.widgetManager;

    if (
      !widget
      || !firstIncoming
      || !widgetManager
      || (widget.type !== 'processing-block' && widget.type !== 'formula')
    ) {
      setResolvedIncomingFields([]);
      return undefined;
    }

    const immediate = resolveIncomingAvailableFields(firstIncoming, widgetManager);
    if (immediate.length) {
      setResolvedIncomingFields(immediate);
      return undefined;
    }

    if (!modelId) {
      setResolvedIncomingFields([]);
      return undefined;
    }

    loadUpstreamFieldsAsync({
      incomingConnection: firstIncoming,
      widgetManager,
      modelId,
    }).then((fields) => {
      if (cancelled) return;
      setResolvedIncomingFields(fields);
      if (fields.length && widget) {
        updateConnections(widget);
        setUpstreamFieldsRevision((value) => value + 1);
      }
    }).catch(() => {
      if (!cancelled) setResolvedIncomingFields([]);
    });

    return () => {
      cancelled = true;
    };
  }, [
    connections,
    selectedWidget?.id,
    selectedWidget?.type,
    modelId,
    upstreamFieldsRevision,
  ]);

  const resolveAvailableFieldsForIncoming = useCallback((incomingConnection) => {
    if (resolvedIncomingFields.length) return resolvedIncomingFields;
    return resolveIncomingAvailableFields(
      incomingConnection,
      engineRef.current?.widgetManager,
    );
  }, [resolvedIncomingFields]);

  const handleIncomingLinkedTableChange = (connectionId, tableAlias) => {
    const manager = engineRef.current?.widgetManager;
    if (!manager || !connectionId) return;
    const alias = String(tableAlias || '').trim();
    manager.updateConnectionSettings(connectionId, {
      selectedTable: alias,
      inputVariable: alias,
    });
    // Немедленно пересчитать поля для выбранной таблицы
    setResolvedIncomingFields([]);
    setUpstreamFieldsRevision((value) => value + 1);
    const widget = selectedWidgetRef.current;
    if (widget) updateConnections(widget);
  };

  useEffect(() => {
    // Подписка на события выбора виджета
    const unsubscribeSelected = eventBus.on('widget:selected', ({ widget }) => {
      setSelectedWidget(widget);
      const raw = { ...widget?.settings } || {};
      setSettings(
        raw.sourceType === 'database' ? normalizeDatabaseSettings(raw) : raw,
      );
      updateConnections(widget);
    });

    const unsubscribeDeselected = eventBus.on('widget:deselected-all', () => {
      setSelectedWidget(null);
      setSettings({});
      setConnections([]);
    });

    // Подписка на события соединений
    const unsubscribeConnectionAdded = eventBus.on('connection:added', () => {
      const widget = selectedWidgetRef.current;
      if (widget) {
        setTimeout(() => {
          updateConnections(widget);
          setUpstreamFieldsRevision((value) => value + 1);
        }, 100);
      }
    });

    const unsubscribeConnectionsLoaded = eventBus.on('connections:loaded', () => {
      const widget = selectedWidgetRef.current;
      if (widget) {
        setTimeout(() => {
          updateConnections(widget);
          setUpstreamFieldsRevision((value) => value + 1);
        }, 150);
      }
    });

    const unsubscribeConnectionDeleted = eventBus.on('connection:deleted', () => {
      const widget = selectedWidgetRef.current;
      if (widget) {
        setTimeout(() => {
          updateConnections(widget);
        }, 100);
      }
    });

    const unsubscribeConnectionSettingsChanged = eventBus.on('connection:settings:changed', () => {
      const widget = selectedWidgetRef.current;
      if (widget) {
        setTimeout(() => {
          updateConnections(widget);
          setUpstreamFieldsRevision((value) => value + 1);
        }, 100);
      }
    });

    const unsubscribeWidgetSettingsChanged = eventBus.on('widget:settings:changed', ({ widget: changedWidget }) => {
      const widget = selectedWidgetRef.current;
      if (!widget || !changedWidget || !engineRef.current) return;

      const isProcessingWidget = widget.type === 'processing-block' || widget.type === 'formula';
      if (!isProcessingWidget) return;

      const affectsIncoming = (widget.connections || []).some(
        (conn) => widgetIdsEqual(conn.to, widget.id) && widgetIdsEqual(conn.from, changedWidget.id),
      );
      if (!affectsIncoming) return;

      (widget.connections || []).forEach((conn) => {
        if (!widgetIdsEqual(conn.to, widget.id) || !widgetIdsEqual(conn.from, changedWidget.id)) {
          return;
        }
        syncConnectionFieldsFromUpstream(
          engineRef.current.widgetManager,
          conn.id,
          changedWidget,
        );
      });

      setTimeout(() => {
        updateConnections(widget);
        setUpstreamFieldsRevision((value) => value + 1);
      }, 0);
    });

    return () => {
      unsubscribeSelected();
      unsubscribeDeselected();
      unsubscribeConnectionAdded();
      unsubscribeConnectionsLoaded();
      unsubscribeConnectionDeleted();
      unsubscribeConnectionSettingsChanged();
      unsubscribeWidgetSettingsChanged();
    };
  }, []);

  // Синхронизация настроек при изменении выбранного виджета
  useEffect(() => {
    if (selectedWidget) {
      const raw = { ...selectedWidget.settings };
      const widgetSettings = raw.sourceType === 'database'
        ? normalizeDatabaseSettings(raw)
        : raw;
      setSettings(widgetSettings);
      updateConnections(selectedWidget);
      
      if (widgetSettings?.sourceType === 'file') {
        const columns = widgetSettings.fileColumns || widgetSettings.selectedColumns || [];
        const sheets = widgetSettings.excelSheets || [];
        if (columns.length) setFileColumns(columns);
        else setFileColumns([]);
        if (sheets.length) setExcelSheets(sheets);
        else setExcelSheets([]);

        const selectedFile = widgetSettings.selectedFile;
        const file = selectedFile?.file;
        const fileName = selectedFile?.name || widgetSettings.sourcePath || '';
        const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';
        const hasFileObject = file && file instanceof File;

        if (hasFileObject && (fileExtension === 'csv' || fileExtension === 'xlsx' || fileExtension === 'xls')) {
          const currentFileName = file.name;
          const lastParsedFileName = widgetSettings.lastParsedFileName;
          if (currentFileName === lastParsedFileName && columns.length > 0) {
            setIsParsingFile(false);
            void loadFileRawRows(widgetSettings, {
              modelId,
              connectionService,
              dataModelService,
            }).then((rows) => {
              cacheRawRowsAndApplyTranspose(rows, widgetSettings);
            }).catch(console.error);
            return;
          }
          setIsParsingFile(true);
          (async () => {
            try {
              if (fileExtension === 'csv') {
                const parsed = await parseCSVFile(file, {
                  headerRowNum: widgetSettings.excelHeaderRow || 1,
                  isTransposed: !!widgetSettings.isTransposed,
                });
                setFileColumns(parsed.columns);
                if (selectedWidget) {
                  selectedWidget.settings = {
                    ...selectedWidget.settings,
                    lastParsedFileName: currentFileName,
                    fileColumns: parsed.columns,
                    selectedColumns: parsed.columns,
                    fieldRenames: {},
                  };
                }
              } else {
                const headerRow = widgetSettings.excelHeaderRow || 1;
                const sheetName = widgetSettings.excelSheet || null;
                const excelData = await parseExcelFile(
                  file,
                  sheetName,
                  headerRow,
                  !!widgetSettings.isTransposed,
                );
                setExcelSheets(excelData.sheets);
                setFileColumns(excelData.columns);
                if (selectedWidget) {
                  selectedWidget.settings = {
                    ...selectedWidget.settings,
                    lastParsedFileName: currentFileName,
                    excelSheets: excelData.sheets,
                    fileColumns: excelData.columns,
                    selectedColumns: excelData.columns,
                    fieldRenames: {},
                  };
                }
              }
            } catch (error) {
              console.error('[PropertiesPanel] Ошибка парсинга файла:', error);
              setFileColumns([]);
              setExcelSheets([]);
            } finally {
              setIsParsingFile(false);
            }
          })();
        } else if (
          widgetSettings?.sourceType === 'file'
          && columns.length > 0
          && (widgetSettings.selectedFile?.name || widgetSettings.sourcePath)
        ) {
          setIsParsingFile(false);
          void loadFileRawRows(widgetSettings, {
            modelId,
            connectionService,
            dataModelService,
          }).then((rows) => {
            cacheRawRowsAndApplyTranspose(rows, widgetSettings);
          }).catch(console.error);
        } else {
          setIsParsingFile(false);
        }
      } else {
        setFileColumns([]);
        setExcelSheets([]);
      }
    } else {
      setFileColumns([]);
      setExcelSheets([]);
    }
  }, [selectedWidget]);

  // Отслеживаем изменения selectedFile в настройках виджета (только sync UI, без восстановления stale columns)
  useEffect(() => {
    if (!selectedWidget?.settings) return;

    const widgetSettings = { ...selectedWidget.settings };
    const widgetFileName = widgetSettings.selectedFile?.name || widgetSettings.sourcePath || '';
    const currentFileName = settings.selectedFile?.name || settings.sourcePath || '';

    if (widgetFileName !== currentFileName || widgetSettings.sourceType !== settings.sourceType) {
      setSettings(widgetSettings);

      const parsedForSameFile =
        widgetSettings.lastParsedFileName
        && widgetFileName
        && widgetSettings.lastParsedFileName === widgetFileName;

      if (parsedForSameFile) {
        const cols = widgetSettings.fileColumns || widgetSettings.selectedColumns || [];
        if (cols.length) setFileColumns(cols);
        if (widgetSettings.excelSheets?.length) setExcelSheets(widgetSettings.excelSheets);
      } else if (widgetFileName !== currentFileName) {
        setFileColumns([]);
        setExcelSheets([]);
      }
    }
  }, [selectedWidget?.settings?.selectedFile?.name, selectedWidget?.settings?.sourceType, selectedWidget?.settings?.lastParsedFileName]);

  // Отслеживаем изменения selectedFile для принудительного обновления UI
  useEffect(() => {
          }, [settings.selectedFile, fileColumns, excelSheets, isParsingFile]);

  // Функция для загрузки файла из БД — deprecated (файлы только локально при компиляции)

  const getWidgetId = (widget) => parseDbWidgetId(widget);

  const handleFolderStructureCacheUpdate = useCallback((cache) => {
    if (!cache?.fingerprint) return;
    const widget = selectedWidgetRef.current;
    const current = settingsRef.current;
    const container = getFolderLikeContainer(current);
    if (!container) return;

    setFolderSessionStructureCache(getWidgetId(widget), container, cache);

    const nextContainer = {
      ...container,
      structureCache: cache,
      inventoryFingerprint: cache.fingerprint,
    };
    const next = withFolderLikeContainer(current, nextContainer);
    if (current.folderConfig) {
      next.folderConfig = {
        ...current.folderConfig,
        structureCache: cache,
      };
    }
    settingsRef.current = next;
    setSettings(next);
    setFolderConfigFolderData(buildFolderModalData(next));
    if (widget) {
      const widgetPatch = current.sourceType === 'archive'
        ? { selectedArchive: nextContainer }
        : { selectedFolder: nextContainer };
      widget.settings = {
        ...widget.settings,
        ...widgetPatch,
        ...(next.folderConfig ? { folderConfig: next.folderConfig } : {}),
      };
      widget.render();
      eventBus.emit('widget:settings:changed', { widget });
    }
  }, []);

  const saveInteractiveCode = useCallback((codeText, widgetIdOverride = null, immediate = false) => {
    if (!modelId || !codeText?.trim()) return;
    const code_data = {
      tabs: [{ name: 'Вкладка 1', content: codeText }],
      activeTab: 0,
    };

    const persist = async () => {
      let widgetId = widgetIdOverride ?? getWidgetId(selectedWidgetRef.current);
      if (!widgetId && selectedWidgetRef.current) {
        try {
          widgetId = await ensureWidgetInDatabase(
            modelId,
            selectedWidgetRef.current,
            engineRef,
          );
        } catch (err) {
          console.warn('[PropertiesPanel] Could not ensure widget in DB before code save:', err);
          return;
        }
      }
      if (!widgetId) return;

      dataModelService.saveModelCode(modelId, code_data, false, widgetId).catch((err) => {
        console.warn('[PropertiesPanel] Interactive DataCode save failed:', err);
      });
      interactiveSaveTimeoutRef.current = null;
    };

    if (interactiveSaveTimeoutRef.current) {
      clearTimeout(interactiveSaveTimeoutRef.current);
      interactiveSaveTimeoutRef.current = null;
    }

    if (immediate) {
      void persist();
    } else {
      interactiveSaveTimeoutRef.current = setTimeout(() => {
        void persist();
      }, 500);
    }
  }, [modelId, engineRef]);

  const applyCodeToFileSettings = useCallback((code, existingFileColumns = []) => {
    const parsed = parseFileSourceFromCode(
      code,
      settingsRef.current?.dataCodeVariableName,
    );
    const updates = settingsUpdatesFromParsedRead(parsed, existingFileColumns, settingsRef.current);
    if (!updates) return null;

    if (updates.sourcePath) {
      updates.selectedFile = {
        ...(settingsRef.current?.selectedFile || {}),
        name: updates.sourcePath,
      };
    }

    isApplyingCodeToSettingsRef.current = true;
    setSettings((prev) => {
      const next = { ...prev, ...updates };
      settingsRef.current = next;
      const widget = selectedWidgetRef.current;
      if (widget) {
        widget.settings = { ...widget.settings, ...updates };
        widget.render();
        eventBus.emit('widget:settings:changed', { widget });
      }
      return next;
    });

    if (updates.fileColumns?.length) {
      setFileColumns(updates.fileColumns);
    } else if (updates.selectedColumns?.length) {
      setFileColumns((prev) => (
        prev.length >= updates.selectedColumns.length ? prev : updates.selectedColumns
      ));
    }

    isApplyingCodeToSettingsRef.current = false;
    return updates;
  }, []);

  // DataCode sync disabled: code changes only via editor or «Перегенерировать».
  const syncFileDataCode = useCallback(async () => null, []);
  const queueFileDataCodeSync = useCallback(() => {}, []);
  const syncApiDataCode = useCallback(async () => null, []);
  const queueApiDataCodeSync = useCallback(() => {}, []);
  const syncDatabridgeDataCode = useCallback(async () => null, []);
  const queueDatabridgeDataCodeSync = useCallback(() => {}, []);
  const syncDatabaseDataCode = useCallback(async () => null, []);
  const queueDatabaseDataCodeSync = useCallback(() => {}, []);
  const syncJsonDataCode = useCallback(async () => null, []);
  const queueJsonDataCodeSync = useCallback(() => {}, []);

  const getFilterCodegenContext = useCallback((widgetId, connectionsList) => {
    const incoming = (connectionsList || []).filter((c) => c.isIncoming);
    const first = incoming[0];
    const codegenOptions = {
      widgetId,
      connections: connectionsList,
      widgetManager: engineRef.current?.widgetManager,
    };
    if (!first?.from || !engineRef.current) {
      return { inputVariable: 'data', connection: first || null, ...codegenOptions };
    }
    const source = engineRef.current.widgetManager.getWidget(first.from);
    const inputVariable = resolveUpstreamDataCodeVariable(
      source,
      first.settings || {},
      codegenOptions,
    );
    return { inputVariable, connection: first, sourceWidget: source, ...codegenOptions };
  }, []);

  const syncFilterDataCode = useCallback(async () => null, []);
  const queueFilterDataCodeSync = useCallback(() => {}, []);
  const syncTransformDataCode = useCallback(async () => null, []);
  const queueTransformDataCodeSync = useCallback(() => {}, []);
  const syncAggregateDataCode = useCallback(async () => null, []);
  const queueAggregateDataCodeSync = useCallback(() => {}, []);
  const syncRelationshipDataCode = useCallback(async () => null, []);
  const queueRelationshipDataCodeSync = useCallback(() => {}, []);

  const getInteractiveGeneratedCode = useCallback((configOverride = null) => {
    const s = settingsRef.current;
    const config = configOverride || s.interactiveConfig || createDefaultInteractiveConfig('table');
    return generateDataCodeFromConfig(config).code || '';
  }, []);

  const handleInteractiveConfigChange = useCallback((patch) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      const widget = selectedWidgetRef.current;
      if (widget) {
        widget.settings = { ...widget.settings, ...next };
        widget.render();
        eventBus.emit('widget:settings:changed', { widget });
      }
      settingsRef.current = next;
      return next;
    });
  }, []);

  /**
   * Генерация DataCode по снимку настроек (для явной перегенерации / превью).
   * Имя файла в path() должно совпадать с original_filename, который уходит в движок при компиляции.
   */
  const generateDataCodeFromSettings = (s, cols) => {
    if (s.blockType === 'filter') {
      const widget = selectedWidgetRef.current;
      const ctx = getFilterCodegenContext(widget?.id, connectionsRef.current);
      const saved = filterSourceSavedCodeRef.current;
      if (saved?.trim()) {
        return patchFilterDataCodeInCode(saved, s, ctx).code;
      }
      return generateFilterDataCode(s, ctx);
    }

    if (s.blockType === 'transform') {
      const widget = selectedWidgetRef.current;
      const ctx = getFilterCodegenContext(widget?.id, connectionsRef.current);
      const saved = transformSourceSavedCodeRef.current;
      if (saved?.trim()) {
        return patchTransformDataCodeInCode(saved, s, ctx).code;
      }
      return generateTransformDataCode(s, ctx);
    }

    if (s.blockType === 'aggregate') {
      const widget = selectedWidgetRef.current;
      const ctx = getFilterCodegenContext(widget?.id, connectionsRef.current);
      const saved = aggregateSourceSavedCodeRef.current;
      if (saved?.trim()) {
        return patchAggregateDataCodeInCode(saved, s, ctx).code;
      }
      return generateAggregateDataCode(s, ctx);
    }

    if (s.sourceType === 'interactive') {
      if (interactiveSavedCodeRef.current?.trim()) {
        return ensureInteractiveDataInputMerge(interactiveSavedCodeRef.current).code;
      }
      const config = s.interactiveConfig || createDefaultInteractiveConfig('table');
      const { code } = generateDataCodeFromConfig(config, { mergeDataInputSource: true });
      return code;
    }

    if (
      (s.sourceType === 'folder' && s.selectedFolder)
      || (s.sourceType === 'archive' && s.selectedArchive)
    ) {
      if (s.folderConfig && isFolderConfigV2(s.folderConfig)) {
        return generateFolderSourceCode(s, s.folderConfig);
      }
      const saved = folderSourceSavedCodeRef.current;
      if (saved?.trim()) return saved;
      return generateDefaultFolderSourceCode(s);
    }

    if (s.sourceType === 'api') {
      const apiCols = (cols && cols.length)
        ? cols
        : (s.fileColumns || s.selectedColumns || []);
      const existingApiCode = fileSourceSavedCodeRef.current;
      if (existingApiCode?.trim()) {
        return patchApiSourceInCode(existingApiCode, s, apiCols).code;
      }
      return generateDefaultApiSourceCode(s, apiCols);
    }

    if (s.sourceType === 'databridge') {
      const bridgeCols = (cols && cols.length)
        ? cols
        : (s.selectedColumns || s.fileColumns || []);
      const existingBridgeCode = fileSourceSavedCodeRef.current;
      if (existingBridgeCode?.trim()) {
        return patchDatabridgeSourceInCode(existingBridgeCode, s, bridgeCols).code;
      }
      return generateDefaultDatabridgeSourceCode(s, bridgeCols);
    }

    if (s.sourceType === 'database') {
      const existingDbCode = fileSourceSavedCodeRef.current;
      if (existingDbCode?.trim()) {
        return patchDatabaseSourceInCode(existingDbCode, s).code;
      }
      return generateDefaultDatabaseSourceCode(s);
    }

    if (s.sourceType === 'json') {
      const jsonCols = (cols && cols.length)
        ? cols
        : (s.fileColumns || s.selectedColumns || []);
      const existingJsonCode = fileSourceSavedCodeRef.current;
      if (existingJsonCode?.trim()) {
        return patchJsonSourceInCode(existingJsonCode, s, jsonCols).code;
      }
      return generateDefaultJsonSourceCode(s, jsonCols);
    }

    const fileName = s.selectedFile?.name || s.sourcePath || '';
    if (!fileName) return '';

    const existingCode = fileSourceSavedCodeRef.current;
    if (existingCode?.trim()) {
      return patchFileSourceInCode(existingCode, s, cols).code;
    }

    return generateDefaultFileSourceCode(s, cols);
  };

  const generateDataCode = () => generateDataCodeFromSettings(settings, fileColumns);

  // Обновление настроек виджета
  const updateWidgetSettings = (newSettings) => {
    const widget = selectedWidgetRef.current;
    if (!widget) return;

    widget.settings = { ...widget.settings, ...newSettings };
    widget.render();

    // Обновляем список соединений, так как имена виджетов могли измениться
    updateConnections(widget);

    if (engineRef.current) {
      eventBus.emit('widget:settings:changed', { widget });
    }
  };

  // Загрузка сохранённого DataCode для интерактивного источника
  useEffect(() => {
    if (selectedWidget?.settings?.sourceType !== 'interactive' || !modelId) {
      setInteractiveSavedCode('');
      return undefined;
    }
    const widgetId = getWidgetId(selectedWidget);
    let cancelled = false;
    (async () => {
      try {
        const codeResponse = await dataModelService.getModelCode(modelId, widgetId ?? undefined);
        const content = codeResponse?.code_data?.tabs?.[0]?.content || '';
        if (!cancelled) setInteractiveSavedCode(content);
      } catch (e) {
        if (!cancelled) setInteractiveSavedCode('');
      }
    })();
    return () => { cancelled = true; };
  }, [selectedWidget?.id, selectedWidget?.settings?.sourceType, modelId]);

  useEffect(() => {
    if (selectedWidget?.settings?.sourceType !== 'file' || !modelId) {
      fileSourceSavedCodeRef.current = '';
      fileRawRowsRef.current = [];
      return undefined;
    }
    const widgetId = getWidgetId(selectedWidget);
    let cancelled = false;
    (async () => {
      try {
        const codeResponse = await dataModelService.getModelCode(modelId, widgetId ?? undefined);
        const content = codeResponse?.code_data?.tabs?.[0]?.content || '';
        if (cancelled) return;
        fileSourceSavedCodeRef.current = content;
        if (content.trim()) {
          applyCodeToFileSettings(content, selectedWidget.settings?.fileColumns || fileColumnsRef.current);
        }
      } catch {
        if (!cancelled) fileSourceSavedCodeRef.current = '';
      }
    })();
    return () => { cancelled = true; };
  }, [selectedWidget?.id, selectedWidget?.settings?.sourceType, modelId, applyCodeToFileSettings]);

  useEffect(() => {
    if (
      (selectedWidget?.settings?.sourceType !== 'folder'
        && selectedWidget?.settings?.sourceType !== 'archive')
      || !modelId
    ) {
      folderSourceSavedCodeRef.current = '';
      return undefined;
    }
    const widgetId = getWidgetId(selectedWidget);
    let cancelled = false;
    (async () => {
      try {
        const codeResponse = await dataModelService.getModelCode(modelId, widgetId ?? undefined);
        const content = codeResponse?.code_data?.tabs?.[0]?.content || '';
        if (!cancelled) folderSourceSavedCodeRef.current = content;
      } catch {
        if (!cancelled) folderSourceSavedCodeRef.current = '';
      }
    })();
    return () => { cancelled = true; };
  }, [selectedWidget?.id, selectedWidget?.settings?.sourceType, modelId]);

  useEffect(() => {
    const isFilter = selectedWidget?.type === 'processing-block'
      && selectedWidget?.settings?.blockType === 'filter';
    if (!isFilter || !modelId) {
      filterSourceSavedCodeRef.current = '';
      return undefined;
    }
    const widgetId = getWidgetId(selectedWidget);
    let cancelled = false;
    (async () => {
      try {
        const codeResponse = await dataModelService.getModelCode(modelId, widgetId ?? undefined);
        const content = codeResponse?.code_data?.tabs?.[0]?.content || '';
        if (!cancelled) filterSourceSavedCodeRef.current = content;
      } catch {
        if (!cancelled) filterSourceSavedCodeRef.current = '';
      }
    })();
    return () => { cancelled = true; };
  }, [selectedWidget?.id, selectedWidget?.settings?.blockType, selectedWidget?.type, modelId]);

  useEffect(() => {
    const isTransform = selectedWidget?.type === 'processing-block'
      && selectedWidget?.settings?.blockType === 'transform';
    if (!isTransform || !modelId) {
      transformSourceSavedCodeRef.current = '';
      return undefined;
    }
    const widgetId = getWidgetId(selectedWidget);
    let cancelled = false;
    (async () => {
      try {
        const codeResponse = await dataModelService.getModelCode(modelId, widgetId ?? undefined);
        const content = codeResponse?.code_data?.tabs?.[0]?.content || '';
        if (!cancelled) transformSourceSavedCodeRef.current = content;
      } catch {
        if (!cancelled) transformSourceSavedCodeRef.current = '';
      }
    })();
    return () => { cancelled = true; };
  }, [selectedWidget?.id, selectedWidget?.settings?.blockType, selectedWidget?.type, modelId]);

  useEffect(() => {
    const isAggregate = selectedWidget?.type === 'processing-block'
      && selectedWidget?.settings?.blockType === 'aggregate';
    if (!isAggregate || !modelId) {
      aggregateSourceSavedCodeRef.current = '';
      return undefined;
    }
    const widgetId = getWidgetId(selectedWidget);
    let cancelled = false;
    (async () => {
      try {
        const codeResponse = await dataModelService.getModelCode(modelId, widgetId ?? undefined);
        const content = codeResponse?.code_data?.tabs?.[0]?.content || '';
        if (!cancelled) aggregateSourceSavedCodeRef.current = content;
      } catch {
        if (!cancelled) aggregateSourceSavedCodeRef.current = '';
      }
    })();
    return () => { cancelled = true; };
  }, [selectedWidget?.id, selectedWidget?.settings?.blockType, selectedWidget?.type, modelId]);

  useEffect(() => {
    if (selectedWidget?.type !== 'relationship' || !modelId) {
      relationshipSourceSavedCodeRef.current = '';
      return undefined;
    }
    const widgetId = getWidgetId(selectedWidget);
    let cancelled = false;
    (async () => {
      try {
        const codeResponse = await dataModelService.getModelCode(modelId, widgetId ?? undefined);
        const content = codeResponse?.code_data?.tabs?.[0]?.content || '';
        if (!cancelled) relationshipSourceSavedCodeRef.current = content;
      } catch {
        if (!cancelled) relationshipSourceSavedCodeRef.current = '';
      }
    })();
    return () => { cancelled = true; };
  }, [selectedWidget?.id, selectedWidget?.type, modelId]);

  // Auto DataCode sync on connection / settings changes is disabled.

  const saveFolderDataCode = useCallback(async (codeText, widgetIdOverride = null) => {
    if (!modelId || !codeText?.trim()) return;
    const code_data = {
      tabs: [{ name: 'Вкладка 1', content: codeText }],
      activeTab: 0,
    };
    let widgetId = widgetIdOverride ?? getWidgetId(selectedWidgetRef.current);
    if (!widgetId && selectedWidgetRef.current) {
      try {
        widgetId = await ensureWidgetInDatabase(modelId, selectedWidgetRef.current, engineRef);
      } catch (err) {
        console.warn('[PropertiesPanel] Could not ensure widget in DB before folder code save:', err);
        return;
      }
    }
    if (!widgetId) return;
    folderSourceSavedCodeRef.current = codeText;
    dataModelService.saveModelCode(modelId, code_data, false, widgetId).catch((err) => {
      console.warn('[PropertiesPanel] Folder DataCode save failed:', err);
    });
  }, [modelId, engineRef]);

  const persistFolderConfig = useCallback(async (config, { generateCode = false, flushToDatabase = false } = {}) => {
    if (!config) return;
    const widget = selectedWidgetRef.current;
    const folderConfig = stripFolderConfigForPersist(config);
    const nextSettings = {
      ...settingsRef.current,
      folderConfig,
    };
    if (config.structureCache) {
      const container = getFolderLikeContainer(nextSettings);
      if (container) {
        const nextContainer = {
          ...container,
          structureCache: config.structureCache,
          inventoryFingerprint: config.structureCache.fingerprint,
        };
        Object.assign(nextSettings, withFolderLikeContainer(nextSettings, nextContainer));
        setFolderSessionStructureCache(
          getWidgetId(widget),
          nextContainer,
          config.structureCache,
        );
      }
    }
    settingsRef.current = nextSettings;
    setSettings(nextSettings);
    if (widget) {
      widget.settings = { ...widget.settings, ...nextSettings };
      widget.render();
      eventBus.emit('widget:settings:changed', { widget });
    }
    if (flushToDatabase && modelId && widget) {
      try {
        await saveWidgetToDatabase(modelId, widget, engineRef);
      } catch (err) {
        console.warn('[PropertiesPanel] Folder config DB save failed:', err);
      }
    }
    if (generateCode) {
      const code = generateFolderSourceCode(nextSettings, folderConfig);
      if (code?.trim()) {
        saveFolderDataCode(code);
      }
    }
  }, [modelId, engineRef, saveFolderDataCode]);

  const refreshSelectedWidgetCodeModified = useCallback(async () => {
    const widget = selectedWidgetRef.current;
    if (!widget || !widgetHasDataCode(widget)) {
      setSelectedWidgetCodeModified(false);
      return;
    }
    const modified = await checkWidgetCodeModified(
      modelId,
      widget,
      engineRef.current?.widgetManager,
    );
    setSelectedWidgetCodeModified(modified);
  }, [modelId, engineRef]);

  useEffect(() => {
    void refreshSelectedWidgetCodeModified();
  }, [selectedWidget, settings, dataCodeStatusRefreshKey, refreshSelectedWidgetCodeModified]);

  const handleRegenerateWidgetCode = useCallback(async () => {
    const widget = selectedWidgetRef.current;
    if (!widget || !modelId) return;
    try {
      const content = await regenerateWidgetDataCode(
        modelId,
        widget,
        engineRef.current?.widgetManager,
      );
      filterSourceSavedCodeRef.current = content || '';
      transformSourceSavedCodeRef.current = content || '';
      aggregateSourceSavedCodeRef.current = content || '';
      relationshipSourceSavedCodeRef.current = content || '';
      fileSourceSavedCodeRef.current = content || '';
      folderSourceSavedCodeRef.current = content || '';
      interactiveSavedCodeRef.current = content || '';
      setInteractiveSavedCode(content || '');
      setSelectedWidgetCodeModified(false);
      eventBus.emit('widget:datacode:regenerated', { widgetId: getWidgetId(widget) });
    } catch (err) {
      console.warn('[PropertiesPanel] Regenerate DataCode failed:', err);
    }
  }, [modelId, engineRef]);

  const openDataCodeEditor = useCallback((latestInteractiveCode = null) => {
    const selected = selectedWidgetRef.current;
    const runtimeOverrides = {};
    const overrideCode = typeof latestInteractiveCode === 'string' ? latestInteractiveCode : null;
    if (overrideCode && selected) {
      const selectedId = getWidgetId(selected) ?? selected.id;
      if (selectedId != null) {
        runtimeOverrides[widgetIdKey(selectedId)] = overrideCode;
      }
    }

    onOpenDataCodeEditor?.({
      selectedWidgetId: selected?.id ?? null,
      runtimeOverrides: Object.keys(runtimeOverrides).length ? runtimeOverrides : null,
    });
  }, [onOpenDataCodeEditor]);

  // Обработка изменения поля
  const handleFieldChange = (field, value) => {
        const base = settingsRef.current && typeof settingsRef.current === 'object'
      ? settingsRef.current
      : settings;
    let newSettings = { ...base, [field]: value };
    if (field === 'fileDeliveryMode') {
      if (value === 'local') {
        newSettings.smbSharePath = '';
        if (newSettings.sourceType === 'folder') {
          newSettings.selectedFolder = null;
          newSettings.sourcePath = '';
        } else if (newSettings.sourceType === 'archive') {
          newSettings.selectedArchive = null;
          newSettings.sourcePath = '';
          newSettings.folderConfig = null;
        } else if (newSettings.sourceType === 'file') {
          newSettings.selectedFile = null;
          newSettings.sourcePath = '';
        }
      } else if (value === 'smb') {
        if (newSettings.sourceType === 'folder') {
          newSettings.selectedFolder = null;
          newSettings.sourcePath = '';
        } else if (newSettings.sourceType === 'archive') {
          newSettings.selectedArchive = null;
          newSettings.sourcePath = '';
          newSettings.folderConfig = null;
        } else if (newSettings.sourceType === 'file') {
          newSettings.selectedFile = null;
          newSettings.sourcePath = '';
        }
      }
    }
    if (
      (field === 'sourceType' && value === 'folder' && !newSettings.fileDeliveryMode)
      || (field === 'sourceType' && value === 'archive' && !newSettings.fileDeliveryMode)
    ) {
      newSettings.fileDeliveryMode = 'local';
    }
    if (field === 'sourceType' && value === 'interactive' && !newSettings.interactiveConfig) {
      newSettings = {
        ...newSettings,
        interactiveConfig: createDefaultInteractiveConfig('table'),
      };
    }
    if (field === 'sourceType' && value === 'api' && newSettings.exportGlobal === undefined) {
      newSettings.exportGlobal = true;
    }
    if (field === 'sourceType' && value === 'database') {
      const defaults = DB_TYPE_DEFAULTS[newSettings.dbType || 'postgresql']
        || DB_TYPE_DEFAULTS.postgresql;
      const migrated = normalizeDatabaseSettings({
        ...newSettings,
        dbConnectionMode: newSettings.dbConnectionMode || 'fields',
        dbHost: newSettings.dbHost || 'localhost',
        dbPort: newSettings.dbPort ?? defaults.port,
        exportGlobal: newSettings.exportGlobal !== false,
      });
      newSettings = { ...newSettings, ...migrated };
    }
    if (field === 'sourceType' && value === 'json') {
      newSettings = {
        ...newSettings,
        jsonSourceType: newSettings.jsonSourceType || 'local',
        fileDeliveryMode: newSettings.jsonSourceType === 'smb' ? 'smb' : 'local',
        tableName: newSettings.tableName || defaultJsonTableName(selectedWidgetRef.current),
        exportGlobal: newSettings.exportGlobal !== false,
        fileColumns: newSettings.fileColumns || [],
        selectedColumns: newSettings.selectedColumns || [],
      };
    }
    if (field === 'filterSeparateOutput' && !value) {
      newSettings.exportGlobal = false;
    }
    if (field === 'transformSeparateOutput' && !value) {
      newSettings.exportGlobal = false;
    }
    if (field === 'aggregateSeparateOutput' && !value) {
      newSettings.exportGlobal = false;
    }
        settingsRef.current = newSettings;
    setSettings(newSettings);
    updateWidgetSettings(newSettings);
    // DataCode is not auto-generated on settings / sourceType changes.

    // Принудительно обновляем состояние виджета, если это selectedFile
    if (field === 'selectedFile' && selectedWidget) {
      selectedWidget.settings = { ...selectedWidget.settings, [field]: value };
      selectedWidget.render();
    }
  };

  // Функция для начала редактирования поля
  const handleDataCodeVariableNameBlur = (rawValue) => {
    const currentSettings = settingsRef.current;
    const fileName = currentSettings.selectedFile?.name || currentSettings.sourcePath || '';
    const defaultName = tableVariableNameFromFileName(fileName);
    const sanitized = sanitizeIdentifier(rawValue.trim(), defaultName);
    const nextValue = sanitized === defaultName ? '' : sanitized;

    const newSettings = { ...currentSettings, dataCodeVariableName: nextValue };
    settingsRef.current = newSettings;
    setSettings(newSettings);
    updateWidgetSettings(newSettings);
  };

  const startEditingField = (originalName) => {
    const fieldRenames = settings.fieldRenames || {};
    setEditingField(originalName);
    setEditingFieldValue(fieldRenames[originalName] || originalName);
  };

  // Функция для сохранения переименования поля
  const saveFieldRename = (originalName) => {
    if (!editingFieldValue.trim()) {
      // Если имя пустое, отменяем редактирование
      setEditingField(null);
      return;
    }

    const fieldRenames = settings.fieldRenames || {};
    const newRenames = { ...fieldRenames };
    
    if (editingFieldValue.trim() === originalName) {
      // Если имя не изменилось, удаляем из переименований
      delete newRenames[originalName];
    } else {
      // Сохраняем новое имя
      newRenames[originalName] = editingFieldValue.trim();
    }

    handleFieldChange('fieldRenames', newRenames);
    setEditingField(null);
    setEditingFieldValue('');
  };

  // Функция для отмены редактирования
  const cancelEditingField = () => {
    setEditingField(null);
    setEditingFieldValue('');
  };

  // Функция для получения отображаемого имени поля
  const getDisplayFieldName = (originalName) => {
    const fieldRenames = settings.fieldRenames || {};
    return fieldRenames[originalName] || originalName;
  };

  const fetchSmbShareName = useCallback(async (connectionId) => {
    if (!connectionId) return '';
    try {
      const full = await connectionService.getConnection(connectionId);
      return getSmbShareNameFromConnection(full);
    } catch (err) {
      console.warn('[PropertiesPanel] Could not load SMB connection config:', err);
      const conn = smbConnections.find((c) => String(c.id) === String(connectionId));
      return getSmbShareNameFromConnection(conn);
    }
  }, [smbConnections]);

  const applySmbShareNameToSettings = useCallback((baseSettings, shareName) => {
    const next = normalizeWidgetSettingsForDelivery({
      ...baseSettings,
      smbShareName: shareName,
    });
    settingsRef.current = next;
    setSettings(next);
    const widget = selectedWidgetRef.current;
    if (widget) {
      widget.settings = { ...widget.settings, ...next };
      widget.render();
      eventBus.emit('widget:settings:changed', { widget });
    }
    if (shareName && next.smbSharePath && next.sourceType === 'file') {
      queueFileDataCodeSync(next, fileColumnsRef.current);
    }
    if (shareName && next.smbSharePath && next.sourceType === 'json') {
      queueJsonDataCodeSync(next, next.fileColumns || fileColumnsRef.current || []);
    }
    return next;
  }, [queueFileDataCodeSync, queueJsonDataCodeSync]);

  useEffect(() => {
    if (settings.fileDeliveryMode !== 'smb' || !settings.smbConnectionId) return undefined;
    if (settings.smbShareName?.trim()) return undefined;

    let cancelled = false;
    (async () => {
      const shareName = await fetchSmbShareName(settings.smbConnectionId);
      if (!shareName || cancelled) return;
      applySmbShareNameToSettings(settingsRef.current, shareName);
    })();

    return () => { cancelled = true; };
  }, [
    selectedWidget?.id,
    settings.fileDeliveryMode,
    settings.smbConnectionId,
    settings.smbShareName,
    fetchSmbShareName,
    applySmbShareNameToSettings,
  ]);

  const handleSmbConnectionChange = async (connectionId) => {
    const id = connectionId ? Number(connectionId) : null;
    const shareName = id ? await fetchSmbShareName(id) : '';
    const patches = {
      smbConnectionId: id,
      smbShareName: shareName,
      smbSharePath: '',
      sourcePath: '',
      selectedFile: null,
      selectedFolder: null,
      selectedArchive: null,
      folderConfig: null,
      selectedColumns: [],
      fileColumns: [],
      fieldRenames: {},
      excelSheets: [],
      excelSheet: null,
      lastParsedFileName: null,
      dataCodeVariableName: '',
    };
    setSettings((prev) => {
      const next = normalizeWidgetSettingsForDelivery({ ...prev, ...patches });
      settingsRef.current = next;
      if (selectedWidget) {
        selectedWidget.settings = next;
        selectedWidget.render();
        eventBus.emit('widget:settings:changed', { widget: selectedWidget });
      }
      queueFileDataCodeSync(next, []);
      return next;
    });
    setFileColumns([]);
    setExcelSheets([]);
  };

  const handleSmbSharePathChange = (pathValue) => {
    const shareName = settings.smbShareName || '';
    const libPath = buildSmbLibPath(shareName, pathValue);
    const entryName = settings.sourceType === 'folder'
      ? (pathValue.split('/').filter(Boolean).pop() || 'Папка')
      : settings.sourceType === 'archive'
        ? (pathValue.split('/').filter(Boolean).pop() || 'Архив')
        : '';
    const base = {
      ...settings,
      smbSharePath: pathValue,
      sourcePath: libPath || pathValue,
    };
    if (settings.sourceType === 'folder') {
      base.selectedFolder = {
        ...(settings.selectedFolder || {}),
        name: entryName,
        smbPath: pathValue,
        isSmb: true,
      };
    } else if (settings.sourceType === 'archive') {
      base.selectedArchive = {
        ...(settings.selectedArchive || {}),
        name: entryName.replace(/\.(zip|rar|7z)$/i, '') || 'Архив',
        archiveFileName: entryName,
        smbPath: pathValue,
        isSmb: true,
      };
    }
    const next = normalizeWidgetSettingsForDelivery(base);
    setSettings(next);
    settingsRef.current = next;
    updateWidgetSettings(next);
    if (next.sourceType === 'file') {
      queueFileDataCodeSync(next, fileColumnsRef.current);
    }
  };

  const openSmbBrowser = () => {
    if (!settings.smbConnectionId) {
      alert('Сначала выберите SMB-подключение');
      return;
    }
    setIsSmbBrowserOpen(true);
  };

  const countSmbFolderFiles = async (connectionId, folderPath) => {
    if (!connectionId || folderPath == null) {
      return { files: [], fileCount: 0, dataFilesCount: 0 };
    }
    try {
      return await scanSmbFolder(
        connectionId,
        folderPath,
        (id, path) => connectionService.browseConnection(id, path),
      );
    } catch (err) {
      console.warn('[PropertiesPanel] SMB folder scan failed:', err);
      return { files: [], fileCount: 0, dataFilesCount: 0 };
    }
  };

  const applySmbFolderScan = async (folderPath, folderName, shareName, baseSettings) => {
    setIsParsingFile(true);
    try {
      const connectionId = baseSettings.smbConnectionId;
      const scan = await countSmbFolderFiles(connectionId, folderPath);
      const libPath = buildSmbLibPath(shareName, folderPath);
      const structureCache = buildStructureCache({
        name: folderName,
        isSmb: true,
        smbPath: folderPath,
        files: scan.files,
        fileCount: scan.fileCount,
        dataFilesCount: scan.dataFilesCount,
      });
      const selectedFolder = {
        name: folderName,
        smbPath: folderPath,
        isSmb: true,
        files: scan.files,
        fileCount: scan.fileCount,
        dataFilesCount: scan.dataFilesCount,
        structureCache,
        inventoryFingerprint: structureCache.fingerprint,
      };
      const newSettings = normalizeWidgetSettingsForDelivery({
        ...baseSettings,
        sourceType: 'folder',
        fileDeliveryMode: 'smb',
        smbShareName: shareName,
        smbSharePath: folderPath,
        sourcePath: libPath,
        selectedFolder,
        folderConfig: baseSettings.folderConfig ?? null,
      });

      const widget = selectedWidgetRef.current;
      if (widget) {
        setFolderSessionStructureCache(parseDbWidgetId(widget), selectedFolder, structureCache);
        widget.settings = newSettings;
        widget.render();
        eventBus.emit('widget:settings:changed', { widget });
      }
      settingsRef.current = newSettings;
      setSettings(newSettings);
      return newSettings;
    } finally {
      setIsParsingFile(false);
    }
  };

  const applySmbArchiveSelect = async (archivePath, archiveName, shareName, baseSettings, archiveFile) => {
    setIsParsingFile(true);
    try {
      let file = archiveFile;
      if (!(file instanceof File)) {
        const connectionId = baseSettings.smbConnectionId;
        const result = await connectionService.readConnectionFile(connectionId, archivePath);
        if (!result?.success) {
          throw new Error(result?.error || 'Не удалось скачать архив');
        }
        const binary = atob(result.content_base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) {
          bytes[i] = binary.charCodeAt(i);
        }
        file = new File([bytes], result.name || archiveName, {
          type: result.mime_type || 'application/zip',
          lastModified: Date.now(),
        });
      }

      const unpacked = await unpackArchive(file, archiveName);
      const libPath = buildSmbLibPath(shareName, archivePath);
      const archivePayload = {
        name: unpacked.name,
        archiveFileName: archiveName,
        size: file.size || 0,
        file,
        files: unpacked.files,
        fileCount: unpacked.fileCount,
        dataFilesCount: unpacked.dataFilesCount,
        smbPath: archivePath,
        isSmb: true,
      };
      const structureCache = buildStructureCache(archivePayload);
      const selectedArchive = {
        ...archivePayload,
        structureCache,
        inventoryFingerprint: structureCache.fingerprint,
      };
      const newSettings = normalizeWidgetSettingsForDelivery({
        ...baseSettings,
        sourceType: 'archive',
        fileDeliveryMode: 'smb',
        smbShareName: shareName,
        smbSharePath: archivePath,
        sourcePath: libPath,
        selectedArchive,
        folderConfig: baseSettings.folderConfig ?? null,
      });

      const widget = selectedWidgetRef.current;
      if (widget) {
        setFolderSessionStructureCache(parseDbWidgetId(widget), selectedArchive, structureCache);
        widget.settings = newSettings;
        widget.render();
        eventBus.emit('widget:settings:changed', { widget });
      }
      settingsRef.current = newSettings;
      setSettings(newSettings);
      return newSettings;
    } finally {
      setIsParsingFile(false);
    }
  };

  const openFolderConfiguration = async () => {
    let current = settingsRef.current;
    if (
      current.sourceType === 'folder'
      && current.fileDeliveryMode === 'smb'
      && current.smbConnectionId
      && current.smbSharePath
      && !current.selectedFolder?.files?.length
    ) {
      let shareName = current.smbShareName || '';
      if (!shareName) {
        shareName = await fetchSmbShareName(current.smbConnectionId);
      }
      const folderName = current.selectedFolder?.name
        || current.smbSharePath.split('/').filter(Boolean).pop()
        || 'Папка';
      await applySmbFolderScan(
        current.smbSharePath,
        folderName,
        shareName,
        current,
      );
      current = settingsRef.current;
    }
    if (
      current.sourceType === 'archive'
      && current.fileDeliveryMode === 'smb'
      && current.smbConnectionId
      && current.smbSharePath
      && !current.selectedArchive?.files?.length
    ) {
      let shareName = current.smbShareName || '';
      if (!shareName) {
        shareName = await fetchSmbShareName(current.smbConnectionId);
      }
      const archiveName = current.selectedArchive?.archiveFileName
        || current.smbSharePath.split('/').filter(Boolean).pop()
        || 'archive.zip';
      await applySmbArchiveSelect(
        current.smbSharePath,
        archiveName,
        shareName,
        current,
        current.selectedArchive?.file,
      );
      current = settingsRef.current;
    }
    setFolderConfigFolderData(buildFolderModalData(current));
    setIsFolderConfigOpen(true);
  };

  const handleSmbFolderSelect = async ({ path, name }) => {
    if (!selectedWidget || path == null) return;

    let shareName = settings.smbShareName || '';
    if (!shareName && settings.smbConnectionId) {
      shareName = await fetchSmbShareName(settings.smbConnectionId);
    }
    const folderName = name || path.split('/').filter(Boolean).pop() || 'Папка';
    const currentSettings = selectedWidget.settings || {};

    await applySmbFolderScan(path, folderName, shareName, {
      ...currentSettings,
      smbConnectionId: currentSettings.smbConnectionId,
      folderConfig: null,
    });
  };

  const handleSmbFileSelect = async ({ path, name, size, file }) => {
    if (!selectedWidget || !file) return;

    const currentSettings = selectedWidget.settings || {};
    if (currentSettings.sourceType === 'json' || currentSettings.jsonSourceType === 'smb') {
      let shareName = settings.smbShareName || '';
      if (!shareName && settings.smbConnectionId) {
        shareName = await fetchSmbShareName(settings.smbConnectionId);
      }
      const fileName = name || file.name || path.split('/').filter(Boolean).pop() || 'data.json';
      try {
        const text = await file.text();
        const parsed = parseJsonTextToTable(text);
        if (parsed.error) {
          alert(parsed.error);
          return;
        }
        const cols = parsed.columns || [];
        const newSettings = {
          ...currentSettings,
          sourceType: 'json',
          jsonSourceType: 'smb',
          fileDeliveryMode: 'smb',
          smbConnectionId: currentSettings.smbConnectionId,
          smbShareName: shareName,
          smbSharePath: path,
          sourcePath: path,
          selectedFile: {
            name: fileName,
            size: size || file.size || 0,
            type: file.type || 'application/json',
            lastModified: file.lastModified || Date.now(),
            file,
            smbPath: path,
          },
          fileColumns: cols,
          selectedColumns: cols,
          previewRows: parsed.rows || [],
          tableName: currentSettings.tableName || defaultJsonTableName(selectedWidget),
          exportGlobal: currentSettings.exportGlobal !== false,
        };
        selectedWidget.settings = newSettings;
        selectedWidget.render();
        setSettings(newSettings);
        settingsRef.current = newSettings;
        fileColumnsRef.current = cols;
        setFileColumns(cols);
        eventBus.emit('widget:settings:changed', { widget: selectedWidget });
        queueJsonDataCodeSync(newSettings, cols);
      } catch (err) {
        alert(err.message || 'Не удалось прочитать JSON с SMB');
      }
      return;
    }

    if (currentSettings.sourceType === 'archive') {
      let shareName = settings.smbShareName || '';
      if (!shareName && settings.smbConnectionId) {
        shareName = await fetchSmbShareName(settings.smbConnectionId);
      }
      const archiveName = name || path.split('/').filter(Boolean).pop() || file.name || 'archive.zip';
      if (!isArchiveFileName(archiveName)) {
        alert('Выберите архив в формате ZIP, RAR или 7Z');
        return;
      }
      await applySmbArchiveSelect(path, archiveName, shareName, {
        ...currentSettings,
        smbConnectionId: currentSettings.smbConnectionId,
        folderConfig: null,
      }, file);
      return;
    }

    let shareName = settings.smbShareName || '';
    if (!shareName && settings.smbConnectionId) {
      shareName = await fetchSmbShareName(settings.smbConnectionId);
    }
    const libPath = buildSmbLibPath(shareName, path);
    const fileInfo = {
      name: name || file.name,
      size: size || file.size || 0,
      type: file.type || '',
      lastModified: file.lastModified || Date.now(),
      file,
      smbPath: path,
    };

    const newSettings = normalizeWidgetSettingsForDelivery({
      ...currentSettings,
      sourceType: 'file',
      fileDeliveryMode: 'smb',
      smbConnectionId: currentSettings.smbConnectionId,
      smbShareName: shareName,
      smbSharePath: path,
      sourcePath: libPath,
      selectedFile: fileInfo,
      selectedColumns: [],
      fileColumns: [],
      fieldRenames: {},
      excelSheets: [],
      excelSheet: null,
      lastParsedFileName: null,
      dataCodeVariableName: '',
    });

    selectedWidget.settings = newSettings;
    selectedWidget.render();
    setSettings(newSettings);
    settingsRef.current = newSettings;
    eventBus.emit('widget:settings:changed', { widget: selectedWidget });

    setIsParsingFile(true);
    setFileColumns([]);
    setExcelSheets([]);

    try {
      const fileName = fileInfo.name;
      const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';

      if (fileExtension === 'csv') {
        const parsed = await parseCSVFile(file, {
          headerRowNum: currentSettings.excelHeaderRow || 1,
          isTransposed: !!currentSettings.isTransposed,
        });
        const columns = parsed.columns;
        setFileColumns(columns);
        const updatedSettings = {
          ...newSettings,
          selectedColumns: columns,
          fileColumns: columns,
          fieldRenames: {},
          lastParsedFileName: fileName,
        };
        selectedWidget.settings = updatedSettings;
        selectedWidget.render();
        setSettings(updatedSettings);
        settingsRef.current = updatedSettings;
        queueFileDataCodeSync(updatedSettings, columns);
      } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        const headerRow = currentSettings.excelHeaderRow || 1;
        const excelData = await parseExcelFile(
          file,
          null,
          headerRow,
          !!currentSettings.isTransposed,
        );
        setExcelSheets(excelData.sheets);
        setFileColumns(excelData.columns);
        const updatedSettings = {
          ...newSettings,
          excelSheet: excelData.sheets[0] || null,
          excelSheets: excelData.sheets,
          selectedColumns: excelData.columns,
          fileColumns: excelData.columns,
          fieldRenames: {},
          excelHeaderRow: 1,
          lastParsedFileName: fileName,
        };
        selectedWidget.settings = updatedSettings;
        selectedWidget.render();
        setSettings(updatedSettings);
        settingsRef.current = updatedSettings;
        queueFileDataCodeSync(updatedSettings, excelData.columns);
      } else {
        alert('Поддерживаются только файлы CSV и Excel');
      }

      eventBus.emit('widget:settings:changed', { widget: selectedWidget });
    } catch (error) {
      console.error('[PropertiesPanel] Ошибка парсинга SMB файла:', error);
      alert(`Ошибка при обработке файла "${fileInfo.name}": ${error.message}`);
      setFileColumns([]);
      setExcelSheets([]);
    } finally {
      setIsParsingFile(false);
    }
  };

  if (!selectedWidget) {
    return (
      <div className={styles.propertiesPanel}>
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>⚙️</div>
          <div className={styles.emptyText}>Выберите виджет для редактирования</div>
        </div>
      </div>
    );
  }

  // Рендеринг списка соединений
  const renderConnections = () => {
    if (!connections || connections.length === 0) {
      return null;
    }

    const outgoingConnections = connections.filter(c => c.isOutgoing);
    const incomingConnections = connections.filter(c => c.isIncoming);

    return (
      <div className={styles.connectionsSection}>
        <h3 className={styles.sectionTitle}>Соединения</h3>
        <p className={styles.filterSubHint}>
          Правый клик по линии на канвасе удаляет соединение.
        </p>
        
        {outgoingConnections.length > 0 && (
          <div className={styles.connectionGroup}>
            <div className={styles.connectionGroupTitle}>Исходящие</div>
            <div className={styles.connectionList}>
              {outgoingConnections.map(conn => (
                <div
                  key={conn.id}
                  className={styles.connectionItem}
                >
                  <div className={styles.connectionIcon}>→</div>
                  <div className={styles.connectionInfo}>
                    <div className={styles.connectionName}>{conn.toName}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {incomingConnections.length > 0 && (
          <div className={styles.connectionGroup}>
            <div className={styles.connectionGroupTitle}>Входящие</div>
            <div className={styles.connectionList}>
              {incomingConnections.map((conn) => {
                const linkedTables = conn.fromWidget?.type === 'data-model'
                  ? normalizeLinkedTables(conn.fromWidget.settings)
                  : [];
                const sourceTables = conn.fromWidget?.type === 'data-source'
                  ? getSourceTables(conn.fromWidget.settings || {})
                  : [];
                const allSelectableTables = linkedTables.length ? linkedTables : sourceTables;
                const selectedTable = conn.settings?.selectedTable
                  || conn.settings?.inputVariable
                  || '';
                const allowAllTables = selectedWidget.type === 'relationship'
                  || (selectedWidget.type === 'processing-block' && selectedWidget.settings?.blockType === 'join');
                return (
                  <div
                    key={conn.id}
                    className={`${styles.connectionItem} ${allSelectableTables.length ? styles.connectionItemStacked : ''}`}
                  >
                    <div className={styles.connectionItemHeader}>
                      <div className={styles.connectionIcon}>←</div>
                      <div className={styles.connectionInfo}>
                        <div className={styles.connectionName}>{conn.fromName}</div>
                        {selectedTable ? (
                          <div className={styles.connectionType}>{selectedTable}</div>
                        ) : null}
                      </div>
                    </div>
                    {allSelectableTables.length > 0 && (
                      <div className={styles.connectionTablePick}>
                        <label className={styles.label}>
                          {linkedTables.length ? 'Таблица модели' : 'Таблица источника'}
                        </label>
                        <select
                          className={styles.select}
                          value={selectedTable}
                          onChange={(e) => handleIncomingLinkedTableChange(conn.id, e.target.value)}
                        >
                          <option value="">
                            {allowAllTables ? 'Все таблицы' : 'Выберите таблицу'}
                          </option>
                          {allSelectableTables.map((table) => (
                            <option key={table.alias} value={table.alias}>
                              {table.alias !== table.name
                                ? `${table.name} → ${table.alias}`
                                : table.name}
                            </option>
                          ))}
                        </select>
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

  // Рендеринг настроек в зависимости от типа виджета
  const renderWidgetSettings = () => {
    void upstreamFieldsRevision;
    if (selectedWidget.type === 'data-source') {
      return (
        <div className={styles.settingsContent}>
          <h3 className={styles.sectionTitle}>Настройки источника данных</h3>
          
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Название</label>
            <input
              type="text"
              className={styles.input}
              value={settings.name || ''}
              onChange={(e) => handleFieldChange('name', e.target.value)}
              placeholder="Введите название"
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Тип источника</label>
            <select
              className={styles.select}
              value={settings.sourceType || 'file'}
              onChange={(e) => handleFieldChange('sourceType', e.target.value)}
            >
              <option value="file">Файл</option>
              <option value="folder">Папка</option>
              <option value="archive">Архив</option>
              <option value="api">API</option>
              <option value="database">База данных</option>
              <option value="json">JSON</option>
              <option value="databridge">DataBridge</option>
              <option value="interactive">Интерактивный</option>
            </select>
          </div>

          {(settings.sourceType === 'file' || settings.sourceType === 'folder' || settings.sourceType === 'archive') && (
            <>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Способ получения данных</label>
                <select
                  className={styles.select}
                  value={settings.fileDeliveryMode || 'local'}
                  onChange={(e) => handleFieldChange('fileDeliveryMode', e.target.value)}
                >
                  <option value="local">
                    {settings.sourceType === 'folder'
                      ? 'Локальная папка'
                      : settings.sourceType === 'archive'
                        ? 'Локальный архив'
                        : 'Локальный файл'}
                  </option>
                  <option value="smb">SMB (рабочая папка)</option>
                </select>
                <div className={styles.infoText}>
                  {settings.sourceType === 'folder'
                    ? 'Локальные папки выбираются на компьютере; SMB — путь к папке на сетевой шаре.'
                    : settings.sourceType === 'archive'
                      ? 'Локальные архивы выбираются на компьютере; SMB — путь к архиву на сетевой шаре.'
                      : 'Файлы не сохраняются на сервере. Локальные — выбираются перед компиляцией; SMB — читаются напрямую с шары.'}
                </div>
              </div>
              {settings.fileDeliveryMode === 'smb' && (
                <>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>SMB-подключение</label>
                    <select
                      className={styles.select}
                      value={settings.smbConnectionId ?? ''}
                      onChange={(e) => { void handleSmbConnectionChange(e.target.value); }}
                    >
                      <option value="">Выберите подключение</option>
                      {smbConnections.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>
                      {settings.sourceType === 'folder'
                        ? 'Путь к папке на шаре'
                        : settings.sourceType === 'archive'
                          ? 'Путь к архиву на шаре'
                          : 'Путь на шаре'}
                    </label>
                    <div className={styles.sourceSelector}>
                      <input
                        type="text"
                        className={styles.input}
                        value={settings.smbSharePath || ''}
                        onChange={(e) => handleSmbSharePathChange(e.target.value)}
                        placeholder={
                          settings.sourceType === 'folder'
                            ? 'data/reports'
                            : settings.sourceType === 'archive'
                              ? 'data/archive.zip'
                              : 'reports/sample.csv'
                        }
                      />
                      <button
                        type="button"
                        className={styles.browseButton}
                        onClick={openSmbBrowser}
                        disabled={!settings.smbConnectionId}
                        title={
                          settings.sourceType === 'folder'
                            ? 'Выбрать папку на SMB-шаре'
                            : settings.sourceType === 'archive'
                              ? 'Выбрать архив на SMB-шаре'
                              : 'Просмотреть папки и файлы на шаре'
                        }
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                          {settings.sourceType === 'archive' ? <IconArchive /> : <IconFolder />}
                        </span>
                      </button>
                    </div>
                    <div className={styles.infoText}>
                      {settings.sourceType === 'folder'
                        ? 'Укажите путь к папке на шаре или выберите её через обзор.'
                        : settings.sourceType === 'archive'
                          ? 'Укажите путь к архиву на шаре или выберите его через обзор.'
                          : 'Нажмите кнопку обзора, чтобы выбрать файл на SMB-шаре, или укажите путь вручную.'}
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Источник данных</label>
            {(settings.sourceType === 'file' || settings.sourceType === 'folder' || settings.sourceType === 'archive') && (
              <div className={styles.sourceSelector}>
                <input
                  type="text"
                  className={styles.input}
                  value={
                    (settings.sourceType === 'file'
                      || settings.sourceType === 'folder'
                      || settings.sourceType === 'archive')
                    && settings.fileDeliveryMode === 'smb'
                      ? (resolveSourcePathForSettings(settings) || settings.sourcePath || '')
                      : (settings.sourcePath || '')
                  }
                  onChange={(e) => handleFieldChange('sourcePath', e.target.value)}
                  readOnly={
                    (settings.sourceType === 'file'
                      || settings.sourceType === 'folder'
                      || settings.sourceType === 'archive')
                    && settings.fileDeliveryMode === 'smb'
                  }
                  placeholder={
                    settings.sourceType === 'folder'
                      ? (settings.fileDeliveryMode === 'smb' ? 'lib://Share/data' : 'Выберите папку с файлами')
                      : settings.sourceType === 'archive'
                        ? (settings.fileDeliveryMode === 'smb' ? 'lib://Share/archive.zip' : 'Выберите архив')
                        : settings.fileDeliveryMode === 'smb'
                          ? 'lib://Share/path/file.csv'
                          : 'Имя файла (например: sample.csv)'
                  }
                />
                {settings.sourceType === 'file' && (settings.fileDeliveryMode || 'local') === 'local' && (
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={async (e) => {
                      const file = e.target.files[0];
                      if (file) {
                                                await handleFileSelect({
                          name: file.name,
                          size: file.size,
                          type: file.type,
                          lastModified: file.lastModified,
                          file: file
                        }, { type: 'file' });
                        // Сбрасываем input, чтобы можно было выбрать тот же файл снова
                        e.target.value = '';
                      }
                    }}
                    style={{ display: 'none' }}
                  />
                )}
                {settings.sourceType === 'folder' && (settings.fileDeliveryMode || 'local') === 'local' && (
                  <input
                    ref={folderInputRef}
                    type="file"
                    webkitdirectory=""
                    directory=""
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files);
                      if (files.length === 0) return;
                      const firstFile = files[0];
                      const folderPath = firstFile.webkitRelativePath.split('/')[0] || 'Папка';
                      const folderData = {
                        name: folderPath,
                        files: files,
                        fileCount: files.length,
                        dataFiles: files.filter(f => {
                          const name = f.name.toLowerCase();
                          return name.endsWith('.csv') || name.endsWith('.xlsx') || name.endsWith('.xls');
                        })
                      };
                      handleFileSelect(folderData, { 
                        type: 'folder',
                        folderName: folderPath,
                        totalFiles: files.length,
                        dataFilesCount: folderData.dataFiles.length
                      });
                    }}
                    style={{ display: 'none' }}
                  />
                )}
                {settings.sourceType === 'archive' && (settings.fileDeliveryMode || 'local') === 'local' && (
                  <input
                    ref={archiveInputRef}
                    type="file"
                    accept=".zip,.rar,.7z"
                    onChange={async (e) => {
                      const file = e.target.files[0];
                      if (file) {
                        await handleFileSelect({
                          name: file.name,
                          size: file.size,
                          type: file.type,
                          lastModified: file.lastModified,
                          file,
                        }, {
                          type: 'archive',
                          archiveName: file.name,
                          archiveSize: file.size,
                        });
                        e.target.value = '';
                      }
                    }}
                    style={{ display: 'none' }}
                  />
                )}
                <button
                  className={styles.browseButton}
                  onClick={() => {
                    if (settings.sourceType === 'file') {
                      if ((settings.fileDeliveryMode || 'local') === 'local') {
                        fileInputRef.current?.click();
                      } else if (settings.fileDeliveryMode === 'smb') {
                        openSmbBrowser();
                      }
                    } else if (settings.sourceType === 'folder') {
                      if ((settings.fileDeliveryMode || 'local') === 'local') {
                        folderInputRef.current?.click();
                      } else {
                        openSmbBrowser();
                      }
                    } else if (settings.sourceType === 'archive') {
                      if ((settings.fileDeliveryMode || 'local') === 'local') {
                        archiveInputRef.current?.click();
                      } else {
                        openSmbBrowser();
                      }
                    } else {
                      // Для других случаев открываем модальное окно
                      setIsFileSelectorOpen(true);
                    }
                  }}
                  title={
                    settings.sourceType === 'folder'
                      ? ((settings.fileDeliveryMode || 'local') === 'smb' ? 'Выбрать папку на SMB' : 'Выбрать папку')
                      : settings.sourceType === 'archive'
                        ? ((settings.fileDeliveryMode || 'local') === 'smb' ? 'Выбрать архив на SMB' : 'Выбрать архив')
                        : 'Выбрать файл'
                  }
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    {settings.sourceType === 'archive' ? <IconArchive /> : settings.sourceType === 'file' ? <IconFile /> : <IconFolder />}
                  </span>
                </button>
              </div>
            )}
            
            {settings.sourceType === 'file' && settings.selectedFile && (
              <>
                <div className={styles.fileInfo}>
                  <span className={styles.infoLabel}>Файл:</span>
                  <span className={styles.infoValue}>{settings.selectedFile.name}</span>
                  <span className={styles.infoSize}>({formatFileSize(settings.selectedFile.size)})</span>
                </div>
                
                {/* Настройки файла */}
                {isParsingFile && (
                  <div className={styles.loadingInfo}>
                    <span>Парсинг файла...</span>
                  </div>
                )}
                
                {/* Индикатор загрузки файла на сервер */}
                {isUploadingFile && (
                  <div className={styles.loadingInfo}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <span>Загрузка файла на сервер...</span>
                      <div style={{ width: '100%', backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
                        <div 
                          style={{ 
                            width: `${uploadProgress}%`, 
                            height: '100%', 
                            backgroundColor: '#3b82f6', 
                            transition: 'width 0.3s ease',
                            borderRadius: '4px'
                          }}
                        />
                      </div>
                      <span style={{ fontSize: '0.875rem', opacity: 0.8 }}>{uploadProgress}%</span>
                    </div>
                  </div>
                )}
                
                {/* Информация о загруженном файле */}
                {/* {settings.uploadedFile && !isUploadingFile && (
                  <div className={styles.loadingInfo} style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
                    <span style={{ color: '#22c55e' }}>✓ Файл загружен на сервер</span>
                    <span style={{ fontSize: '0.875rem', opacity: 0.8, marginTop: '4px' }}>
                      {settings.uploadedFile.original_filename || settings.uploadedFile.filename}
                    </span>
                  </div>
                )} */}
                
                {/* Показываем настройки если файл выбран */}
                {settings.selectedFile && (
                  <div className={styles.fileSettings}>
                    <h4 className={styles.subsectionTitle}>Настройки файла</h4>

                    <div className={styles.fieldGroup}>
                      <label className={styles.label} htmlFor="data-code-variable-name">
                        Имя таблицы (переменная)
                      </label>
                      <input
                        id="data-code-variable-name"
                        type="text"
                        className={styles.input}
                        value={
                          settings.dataCodeVariableName !== undefined
                          && settings.dataCodeVariableName !== null
                          && settings.dataCodeVariableName !== ''
                            ? settings.dataCodeVariableName
                            : tableVariableNameFromFileName(
                              settings.selectedFile?.name || settings.sourcePath || '',
                            )
                        }
                        onChange={(e) => {
                          const value = e.target.value;
                          const next = { ...settingsRef.current, dataCodeVariableName: value };
                          settingsRef.current = next;
                          setSettings(next);
                        }}
                        onBlur={(e) => handleDataCodeVariableNameBlur(e.target.value)}
                        placeholder="sample_table"
                      />
                      <div className={styles.infoText}>
                        Имя переменной в DataCode для загруженной таблицы
                      </div>
                    </div>

                    
                    {/* Настройки для Excel */}
                    {excelSheets.length > 0 && (
                      <>
                        <div className={styles.fieldGroup}>
                          <label className={styles.label}>Лист Excel</label>
                          <select
                            className={styles.select}
                            value={settings.excelSheet || excelSheets[0] || ''}
                            onChange={(e) => {
                              const newSheet = e.target.value;
                              handleFieldChange('excelSheet', newSheet);
                              // При смене листа нужно перепарсить файл
                              if (settings.selectedFile?.file) {
                                const headerRow = settings.excelHeaderRow || 1;
                                parseExcelFile(
                                  settings.selectedFile.file,
                                  newSheet,
                                  headerRow,
                                  !!settings.isTransposed,
                                ).then(excelData => {
                                  const columns = applyFileColumnsFromRaw(
                                    excelData.rawRows,
                                    { ...settings, excelSheet: newSheet },
                                  );
                                  setFileColumns(columns);
                                  handleFieldChange('selectedColumns', columns);
                                }).catch(console.error);
                              }
                            }}
                          >
                            {excelSheets.map(sheet => (
                              <option key={sheet} value={sheet}>{sheet}</option>
                            ))}
                          </select>
                        </div>
                        
                        <div className={styles.fieldGroup}>
                          <label className={styles.label}>Строка заголовка</label>
                          <input
                            type="number"
                            className={styles.input}
                            min="1"
                            value={settings.excelHeaderRow === '' || settings.excelHeaderRow === undefined || settings.excelHeaderRow === null ? '' : (settings.excelHeaderRow || 1)}
                            onChange={(e) => {
                              const inputValue = e.target.value;
                              
                              // Обновляем только локальное состояние во время ввода
                              // Это предотвращает перерисовку виджета и потерю фокуса
                              const newSettings = { ...settings };
                              
                              if (inputValue === '') {
                                newSettings.excelHeaderRow = '';
                              } else {
                                const headerRow = parseInt(inputValue, 10);
                                if (!isNaN(headerRow) && headerRow > 0) {
                                  newSettings.excelHeaderRow = headerRow;
                                } else {
                                  // Сохраняем как есть (может быть неполным числом во время ввода)
                                  newSettings.excelHeaderRow = inputValue;
                                }
                              }
                              
                              // Обновляем только локальное состояние, не вызывая handleFieldChange
                              setSettings(newSettings);
                            }}
                            onBlur={(e) => {
                              // При потере фокуса валидируем и сохраняем значение
                              const inputValue = e.target.value.trim();
                              const headerRow = parseInt(inputValue, 10);
                              
                              // Устанавливаем валидное значение (минимум 1)
                              const validHeaderRow = (inputValue === '' || isNaN(headerRow) || headerRow < 1) ? 1 : headerRow;
                              
                              // Теперь вызываем handleFieldChange для сохранения в виджете
                              handleFieldChange('excelHeaderRow', validHeaderRow);
                              
                              // Перепарсим файл с валидным значением
                              if (settings.selectedFile?.file && settings.excelSheet) {
                                parseExcelFile(
                                  settings.selectedFile.file,
                                  settings.excelSheet,
                                  validHeaderRow,
                                  !!settings.isTransposed,
                                ).then(excelData => {
                                  const columns = applyFileColumnsFromRaw(
                                    excelData.rawRows,
                                    { ...settings, excelHeaderRow: validHeaderRow },
                                  );
                                  setFileColumns(columns);
                                  handleFieldChange('selectedColumns', columns);
                                }).catch(console.error);
                              }
                            }}
                            placeholder="Номер строки с заголовками"
                          />
                        </div>
                        
                        <div className={styles.fieldGroup}>
                          <label className={styles.checkboxLabel}>
                            <input
                              type="checkbox"
                              checked={settings.isTransposed || false}
                              onChange={(e) => { void handleTransposeChange(e.target.checked); }}
                            />
                            <span>Повернуть таблицу (транспонировать)</span>
                          </label>
                          <div className={styles.infoText}>
                            При транспонировании строки становятся колонками, а колонки — строками. Поля и DataCode обновятся автоматически.
                          </div>
                        </div>
                      </>
                    )}

                    {(excelSheets.length === 0 && fileColumns.length > 0) && (
                      <div className={styles.fieldGroup}>
                        <label className={styles.checkboxLabel}>
                          <input
                            type="checkbox"
                            checked={settings.isTransposed || false}
                            onChange={(e) => { void handleTransposeChange(e.target.checked); }}
                          />
                          <span>Повернуть таблицу (транспонировать)</span>
                        </label>
                        <div className={styles.infoText}>
                          При транспонировании строки становятся колонками, а колонки — строками. Поля и DataCode обновятся автоматически.
                        </div>
                      </div>
                    )}
                    
                    {/* Настройки для CSV и Excel - выбор полей */}
                    {fileColumns.length > 0 ? (
                      <div className={styles.fieldGroup}>
                        <label className={styles.label}>Выбор полей</label>
                        <div className={styles.fieldsList}>
                          {fileColumns.map((column, index) => {
                            const selectedColumns = settings.selectedColumns || fileColumns;
                            const isSelected = selectedColumns.includes(column);
                            const isEditing = editingField === column;
                            const displayName = getDisplayFieldName(column);
                            
                            const toggleFieldSelection = () => {
                              const currentSelected = settings.selectedColumns || fileColumns;
                              if (isSelected) {
                                handleFieldChange('selectedColumns', currentSelected.filter(c => c !== column));
                              } else {
                                handleFieldChange('selectedColumns', [...currentSelected, column]);
                              }
                            };

                            return (
                              <div 
                                key={index} 
                                className={styles.fieldCheckbox}
                                onClick={(e) => {
                                  // Не переключаем, если клик был на кнопке редактирования или на поле ввода
                                  if (e.target.closest(`.${styles.editFieldButton}`) || 
                                      e.target.closest(`.${styles.fieldEditInput}`) ||
                                      e.target.type === 'checkbox') {
                                    return;
                                  }
                                  // Не переключаем, если поле в режиме редактирования
                                  if (isEditing) {
                                    return;
                                  }
                                  toggleFieldSelection();
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    const currentSelected = settings.selectedColumns || fileColumns;
                                    if (e.target.checked) {
                                      handleFieldChange('selectedColumns', [...currentSelected, column]);
                                    } else {
                                      handleFieldChange('selectedColumns', currentSelected.filter(c => c !== column));
                                    }
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                />
                                {isEditing ? (
                                  <div className={styles.fieldEditContainer}>
                                    <input
                                      type="text"
                                      className={styles.fieldEditInput}
                                      value={editingFieldValue}
                                      onChange={(e) => setEditingFieldValue(e.target.value)}
                                      onBlur={() => saveFieldRename(column)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          saveFieldRename(column);
                                        } else if (e.key === 'Escape') {
                                          cancelEditingField();
                                        }
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                      autoFocus
                                    />
                                  </div>
                                ) : (
                                  <span className={styles.fieldName}>{displayName}</span>
                                )}
                                {!isEditing && (
                                  <button
                                    className={styles.editFieldButton}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      startEditingField(column);
                                    }}
                                    title="Переименовать поле"
                                  >
                                    <PencilIcon className={styles.editFieldIcon} />
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        <div className={styles.infoText}>
                          Выбрано: {(settings.selectedColumns || fileColumns).length} из {fileColumns.length}
                        </div>
                      </div>
                    ) : (
                      <div className={styles.fieldGroup}>
                        <div className={styles.infoText}>
                          {(() => {
                            const fileName = settings.selectedFile?.name || '';
                            const fileExtension = fileName.split('.').pop().toLowerCase();
                            if (fileExtension === 'csv' || fileExtension === 'xlsx' || fileExtension === 'xls') {
                              return 'Загрузка колонок файла... Если колонки не появились, попробуйте перезагрузить файл.';
                            }
                            return 'Настройки доступны только для CSV и Excel файлов.';
                          })()}
                        </div>
                      </div>
                    )}
                    
                    <div className={styles.fieldGroup}>
                      <label className={styles.checkboxLabel}>
                        <input
                          type="checkbox"
                          checked={settings.exportGlobal || false}
                          onChange={(e) => handleFieldChange('exportGlobal', e.target.checked)}
                        />
                        <span>Экспортировать</span>
                      </label>
                      <div className={styles.infoText}>
                        Добавляет global к переменной read() в DataCode
                      </div>
                    </div>

                    <div className={styles.fieldGroup}>
                      <DataCodeOpenButton
                        onClick={openDataCodeEditor}
                        modified={selectedWidgetCodeModified}
                        onRegenerate={handleRegenerateWidgetCode}
                      />
                    </div>
                  </div>
                )}
              </>
            )}
            
            {settings.sourceType === 'folder' && settings.selectedFolder && (
              <>
                <div className={styles.fileInfo}>
                  <span className={styles.infoLabel}>Папка:</span>
                  <span className={styles.infoValue}>{settings.selectedFolder.name}</span>
                  {settings.fileDeliveryMode === 'smb' && settings.smbSharePath && (
                    <span className={styles.infoSize}> · {settings.smbSharePath}</span>
                  )}
                  <span className={styles.infoSize}>
                    ({settings.selectedFolder.dataFilesCount || 0} файлов данных из {settings.selectedFolder.fileCount || 0} всего)
                    {isParsingFile ? ' — сканирование…' : ''}
                  </span>
                </div>
                <button
                  className={styles.configureButton}
                  onClick={openFolderConfiguration}
                  disabled={isParsingFile}
                  title="Настроить конфигурацию загрузки файлов"
                >
                  {isParsingFile ? 'Сканирование папки…' : '⚙️ Настроить конфигурацию'}
                </button>
                <div className={styles.fieldGroup} style={{ marginTop: '0.75rem' }}>
                  <DataCodeOpenButton
                    onClick={openDataCodeEditor}
                    modified={selectedWidgetCodeModified}
                    onRegenerate={handleRegenerateWidgetCode}
                  />
                </div>
              </>
            )}
            
            {settings.sourceType === 'archive' && settings.selectedArchive && (
              <>
                <div className={styles.fileInfo}>
                  <span className={styles.infoLabel}>Архив:</span>
                  <span className={styles.infoValue}>
                    {settings.selectedArchive.archiveFileName || settings.selectedArchive.name}
                  </span>
                  {settings.fileDeliveryMode === 'smb' && settings.smbSharePath && (
                    <span className={styles.infoSize}> · {settings.smbSharePath}</span>
                  )}
                  <span className={styles.infoSize}>
                    ({settings.selectedArchive.dataFilesCount || 0} файлов данных из {settings.selectedArchive.fileCount || 0} всего)
                    {isParsingFile ? ' — распаковка…' : ''}
                  </span>
                  {settings.selectedArchive.size ? (
                    <span className={styles.infoSize}> · {formatFileSize(settings.selectedArchive.size)}</span>
                  ) : null}
                </div>
                <button
                  className={styles.configureButton}
                  onClick={openFolderConfiguration}
                  disabled={isParsingFile}
                  title="Настроить конфигурацию загрузки файлов"
                >
                  {isParsingFile ? 'Распаковка архива…' : '⚙️ Настроить конфигурацию'}
                </button>
                <div className={styles.fieldGroup} style={{ marginTop: '0.75rem' }}>
                  <DataCodeOpenButton
                    onClick={openDataCodeEditor}
                    modified={selectedWidgetCodeModified}
                    onRegenerate={handleRegenerateWidgetCode}
                  />
                </div>
              </>
            )}
            
            {settings.sourceType === 'api' && (
              <ApiIngestSourceSettings
                modelId={modelId}
                settings={settings}
                selectedWidget={selectedWidget}
                engineRef={engineRef}
                onFieldChange={handleFieldChange}
                onSettingsChange={(newSettings) => {
                  setSettings(newSettings);
                  settingsRef.current = newSettings;
                  updateWidgetSettings(newSettings);
                  if (
                    newSettings.sourceType === 'api'
                    && (newSettings.fileColumns?.length || newSettings.selectedColumns?.length)
                    && !isApplyingCodeToSettingsRef.current
                  ) {
                    fileColumnsRef.current = newSettings.fileColumns || newSettings.selectedColumns || [];
                    queueApiDataCodeSync(
                      newSettings,
                      newSettings.fileColumns || newSettings.selectedColumns || [],
                    );
                  }
                }}
                onOpenDataCodeEditor={openDataCodeEditor}
                codeModified={selectedWidgetCodeModified}
                onRegenerateCode={handleRegenerateWidgetCode}
              />
            )}

            {settings.sourceType === 'databridge' && (
              <DataBridgeSourceSettings
                settings={settings}
                onFieldChange={handleFieldChange}
                onSettingsChange={(newSettings) => {
                  setSettings(newSettings);
                  settingsRef.current = newSettings;
                  updateWidgetSettings(newSettings);
                  if (
                    newSettings.sourceType === 'databridge'
                    && newSettings.databridgeEntity
                    && !isApplyingCodeToSettingsRef.current
                  ) {
                    const cols = newSettings.selectedColumns || newSettings.fileColumns || [];
                    fileColumnsRef.current = cols;
                    queueDatabridgeDataCodeSync(newSettings, cols);
                  }
                }}
                onOpenDataCodeEditor={openDataCodeEditor}
                codeModified={selectedWidgetCodeModified}
                onRegenerateCode={handleRegenerateWidgetCode}
              />
            )}
            
            {settings.sourceType === 'database' && (
              <DatabaseSourceSettings
                settings={settings}
                onFieldChange={handleFieldChange}
                onSettingsChange={(newSettings) => {
                  const next = normalizeDatabaseSettings(newSettings);
                  setSettings(next);
                  settingsRef.current = next;
                  updateWidgetSettings(next);
                  if (!isApplyingCodeToSettingsRef.current) {
                    queueDatabaseDataCodeSync(next);
                  }
                }}
                onOpenDataCodeEditor={openDataCodeEditor}
                codeModified={selectedWidgetCodeModified}
                onRegenerateCode={handleRegenerateWidgetCode}
              />
            )}
            
            {settings.sourceType === 'json' && (
              <JsonSourceSettings
                settings={settings}
                selectedWidget={selectedWidget}
                smbConnections={smbConnections}
                onFieldChange={handleFieldChange}
                onSettingsChange={(newSettings) => {
                  setSettings(newSettings);
                  settingsRef.current = newSettings;
                  updateWidgetSettings(newSettings);
                  if (newSettings.fileColumns?.length) {
                    fileColumnsRef.current = newSettings.fileColumns;
                    setFileColumns(newSettings.fileColumns);
                  }
                  if (!isApplyingCodeToSettingsRef.current) {
                    queueJsonDataCodeSync(
                      newSettings,
                      newSettings.fileColumns || newSettings.selectedColumns || [],
                    );
                  }
                }}
                onOpenDataCodeEditor={openDataCodeEditor}
                codeModified={selectedWidgetCodeModified}
                onRegenerateCode={handleRegenerateWidgetCode}
                onOpenSmbBrowser={() => {
                  // Reuse SMB browser; mark source as json+smb before open
                  if (settings.jsonSourceType !== 'smb') {
                    handleFieldChange('jsonSourceType', 'smb');
                    handleFieldChange('fileDeliveryMode', 'smb');
                  }
                  openSmbBrowser();
                }}
              />
            )}

            {settings.sourceType === 'interactive' && (
              <InteractiveDataSource
                key={`interactive-${selectedWidget?.id}`}
                settings={settings}
                modelId={modelId}
                widgetId={getWidgetId(selectedWidget)}
                savedCode={interactiveSavedCode}
                onConfigChange={handleInteractiveConfigChange}
                onOpenDataCodeEditor={openDataCodeEditor}
                codeModified={selectedWidgetCodeModified}
                onRegenerateCode={handleRegenerateWidgetCode}
              />
            )}
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Описание</label>
            <textarea
              className={styles.textarea}
              value={settings.description || ''}
              onChange={(e) => handleFieldChange('description', e.target.value)}
              placeholder="Описание источника данных"
              rows={3}
            />
          </div>
        </div>
      );
    }

    // Настройки виджета «Модель данных» — импорт таблиц из другой модели
    if (selectedWidget.type === 'data-model') {
      return (
        <LinkedModelSourceSettings
          modelId={modelId}
          settings={settings}
          onFieldChange={handleFieldChange}
          onSettingsChange={(newSettings) => {
            setSettings(newSettings);
            settingsRef.current = newSettings;
            updateWidgetSettings(newSettings);
          }}
          onOpenDataCodeEditor={openDataCodeEditor}
          codeModified={selectedWidgetCodeModified}
          onRegenerateCode={handleRegenerateWidgetCode}
        />
      );
    }

    // Настройки для FormulaWidget
    if (selectedWidget.type === 'formula') {
      const incomingForFormula = connections.filter((c) => c.isIncoming);
      const hasIncomingLink = incomingForFormula.length > 0;
      const linkedSources = [];
      const seenSourceIds = new Set();
      for (const conn of incomingForFormula) {
        const sourceId = conn.from;
        if (sourceId == null || seenSourceIds.has(String(sourceId))) continue;
        seenSourceIds.add(String(sourceId));
        linkedSources.push({
          id: sourceId,
          name: conn.fromName
            || conn.fromWidget?.settings?.name
            || `Виджет ${sourceId}`,
          connection: conn,
        });
      }

      const selectedSourceId = settings.inputSourceId != null
        && linkedSources.some((s) => String(s.id) === String(settings.inputSourceId))
        ? settings.inputSourceId
        : (linkedSources[0]?.id ?? null);

      const selectedIncoming = linkedSources.find(
        (s) => String(s.id) === String(selectedSourceId),
      )?.connection || incomingForFormula[0] || null;

      const availableFields = selectedIncoming
        ? resolveAvailableFieldsForIncoming(selectedIncoming)
        : [];

      const formulaTemplates = buildFormulaTemplates(availableFields);
      const formulaCodegenCtx = getFilterCodegenContext(selectedWidget?.id, connections);
      const formulaInputVar = formulaCodegenCtx.inputVariable || 'data';
      const variableTemplates = buildFormulaVariableTemplates(availableFields, formulaInputVar);

      const updateExpression = (index, patch) => {
        const newExpressions = [...(settings.expressions || [])];
        newExpressions[index] = { ...newExpressions[index], ...patch };
        handleFieldChange('expressions', newExpressions);
      };

      const applyFormulaTemplate = (template) => {
        if (!template) return;
        const nextExpr = {
          name: template.name || '',
          expression: template.expression || '',
        };
        const current = [...(settings.expressions || [])];
        const emptyIdx = current.findIndex(
          (expr) => !String(expr?.name || '').trim() && !String(expr?.expression || '').trim(),
        );
        if (emptyIdx >= 0) {
          current[emptyIdx] = nextExpr;
        } else {
          current.push(nextExpr);
        }
        handleFieldChange('expressions', current);
      };

      const updateVariable = (index, patch) => {
        const next = [...(settings.variables || [])];
        next[index] = { ...next[index], ...patch };
        handleFieldChange('variables', next);
      };

      const applyVariableTemplate = (template) => {
        if (!template?.variable) return;
        const nextVar = createFormulaVariable(template.variable);
        handleFieldChange('variables', [...(settings.variables || []), nextVar]);
      };

      return (
        <div className={styles.settingsContent}>
          <h3 className={styles.sectionTitle}>Настройки виджета формул</h3>
          
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Название</label>
            <input
              type="text"
              className={styles.input}
              value={settings.name || ''}
              onChange={(e) => handleFieldChange('name', e.target.value)}
              placeholder="Введите название"
            />
          </div>

          {hasIncomingLink && (
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Входной источник данных</label>
            <select
              className={styles.select}
              value={selectedSourceId != null ? String(selectedSourceId) : ''}
              onChange={(e) => {
                const sourceId = e.target.value || null;
                handleFieldChange('inputSourceId', sourceId);
                const incoming = linkedSources.find(
                  (s) => String(s.id) === String(sourceId),
                )?.connection;
                if (incoming) {
                  const fields = resolveAvailableFieldsForIncoming(incoming);
                  handleFieldChange('availableFields', fields);
                } else {
                  handleFieldChange('availableFields', []);
                }
              }}
            >
              {linkedSources.length > 1 && (
                <option value="">-- Выберите источник данных --</option>
              )}
              {linkedSources.map((source) => (
                <option key={String(source.id)} value={String(source.id)}>
                  {source.name}
                </option>
              ))}
            </select>
          </div>
          )}

          {availableFields.length > 0 && (
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Доступные поля</label>
              <div className={styles.fieldsList}>
                {availableFields.map((field, index) => {
                  const fieldName = typeof field === 'string' ? field : field.name;
                  return (
                    <div key={index} className={styles.fieldTag}>
                      {fieldName}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Шаблоны формул</label>
            <p className={styles.filterSubHint}>
              Нажмите шаблон — подставится имя поля и выражение
              {availableFields.length
                ? ' по полям связанного источника.'
                : ' (примеры; после связи с источником подставятся реальные поля).'}
            </p>
            <div className={styles.formulaTemplates}>
              {formulaTemplates.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  className={styles.formulaTemplateChip}
                  title={tpl.hint}
                  onClick={() => applyFormulaTemplate(tpl)}
                >
                  <span className={styles.formulaTemplateLabel}>{tpl.label}</span>
                  <span className={styles.formulaTemplateHint}>{tpl.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Формулы</label>
            <p className={styles.filterSubHint}>
              Новое имя — новая колонка; имя из источника — перезапись этой колонки.
            </p>
            <div className={styles.expressionsList}>
              {settings.expressions && settings.expressions.length > 0 ? (
                settings.expressions.map((expr, index) => (
                  <div key={index} className={styles.expressionItem}>
                    <FieldNameInput
                      availableFields={availableFields}
                      allowCustom
                      className={styles.expressionName}
                      value={expr.name || ''}
                      onChange={(next) => updateExpression(index, { name: next })}
                      placeholder="Имя поля"
                    />
                    <span className={styles.equalsSign}>=</span>
                    <input
                      type="text"
                      className={styles.expressionFormula}
                      value={expr.expression || ''}
                      onChange={(e) => updateExpression(index, { expression: e.target.value })}
                      placeholder="Формула (например: amount * 1.2)"
                    />
                    <button
                      className={styles.removeButton}
                      onClick={() => {
                        const newExpressions = settings.expressions.filter((_, i) => i !== index);
                        handleFieldChange('expressions', newExpressions);
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))
              ) : (
                <div className={styles.emptyState}>Нет формул. Выберите шаблон выше или добавьте формулу.</div>
              )}
            </div>
            <button
              className={styles.addButton}
              onClick={() => {
                const newExpressions = [...(settings.expressions || []), { name: '', expression: '' }];
                handleFieldChange('expressions', newExpressions);
              }}
            >
              + Добавить формулу
            </button>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Переменные (global → SQLite)</label>
            <p className={styles.filterSubHint}>
              Переменные с <code>global</code> попадают в сборку latest.db как обычные переменные DataCode.
              Таблица входа: <code>{formulaInputVar}</code>
            </p>
            <div className={styles.formulaTemplates}>
              {variableTemplates.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  className={styles.formulaTemplateChip}
                  title={tpl.hint}
                  onClick={() => applyVariableTemplate(tpl)}
                >
                  <span className={styles.formulaTemplateLabel}>{tpl.label}</span>
                  <span className={styles.formulaTemplateHint}>{tpl.hint}</span>
                </button>
              ))}
            </div>
            <div className={styles.expressionsList} style={{ marginTop: '0.75rem' }}>
              {(settings.variables || []).length > 0 ? (
                (settings.variables || []).map((variable, index) => (
                  <div key={variable.id || index} className={styles.variableItem}>
                    <div className={styles.variableRow}>
                      <input
                        type="text"
                        className={styles.expressionName}
                        value={variable.name || ''}
                        onChange={(e) => updateVariable(index, { name: e.target.value })}
                        placeholder="имя"
                        title="Имя переменной"
                      />
                      <select
                        className={styles.select}
                        style={{ flex: '0 0 140px' }}
                        value={variable.kind || 'aggregate'}
                        onChange={(e) => updateVariable(index, { kind: e.target.value })}
                      >
                        <option value="aggregate">Агрегация</option>
                        <option value="literal">Своё значение</option>
                        <option value="expression">Выражение</option>
                      </select>
                      <label className={styles.checkboxLabel} style={{ flexShrink: 0 }}>
                        <input
                          type="checkbox"
                          checked={variable.exportGlobal !== false}
                          onChange={(e) => updateVariable(index, { exportGlobal: e.target.checked })}
                        />
                        <span>global</span>
                      </label>
                      <button
                        type="button"
                        className={styles.removeButton}
                        onClick={() => {
                          handleFieldChange(
                            'variables',
                            (settings.variables || []).filter((_, i) => i !== index),
                          );
                        }}
                      >
                        ×
                      </button>
                    </div>
                    {(variable.kind || 'aggregate') === 'aggregate' && (
                      <div className={styles.variableRow}>
                        <select
                          className={styles.select}
                          style={{ flex: '0 0 150px' }}
                          value={variable.func || 'sum'}
                          onChange={(e) => updateVariable(index, { func: e.target.value })}
                        >
                          {FORMULA_VARIABLE_FUNCS.map((fn) => (
                            <option key={fn.value} value={fn.value}>{fn.label}</option>
                          ))}
                        </select>
                        <FieldNameInput
                          availableFields={availableFields}
                          allowCustom
                          className={styles.expressionFormula}
                          value={variable.field || ''}
                          onChange={(next) => updateVariable(index, { field: next })}
                          placeholder="Поле таблицы"
                        />
                      </div>
                    )}
                    {variable.kind === 'literal' && (
                      <div className={styles.variableRow}>
                        <input
                          type="text"
                          className={styles.expressionFormula}
                          value={variable.value ?? ''}
                          onChange={(e) => updateVariable(index, { value: e.target.value })}
                          placeholder='Число, текст или true/false/null'
                        />
                      </div>
                    )}
                    {variable.kind === 'expression' && (
                      <div className={styles.variableRow}>
                        <input
                          type="text"
                          className={styles.expressionFormula}
                          value={variable.expression || ''}
                          onChange={(e) => updateVariable(index, { expression: e.target.value })}
                          placeholder={`например: sum(${formulaInputVar}["amount"]) * 1.2`}
                        />
                      </div>
                    )}
                    <p className={styles.formulaVariablePreview}>
                      {(variable.exportGlobal !== false ? 'global ' : '')
                        + (variable.name || 'name')
                        + ' = …'}
                    </p>
                  </div>
                ))
              ) : (
                <div className={styles.emptyState}>
                  Нет переменных. Выберите шаблон выше или добавьте вручную.
                </div>
              )}
            </div>
            <button
              type="button"
              className={styles.addButton}
              onClick={() => {
                handleFieldChange('variables', [
                  ...(settings.variables || []),
                  createFormulaVariable({
                    kind: 'aggregate',
                    func: 'sum',
                    field: availableFields[0] || '',
                    name: '',
                  }),
                ]);
              }}
            >
              + Добавить переменную
            </button>
          </div>

          <div className={styles.fieldGroup}>
            <DataCodeOpenButton
              onClick={openDataCodeEditor}
              modified={selectedWidgetCodeModified}
              onRegenerate={handleRegenerateWidgetCode}
            />
          </div>
        </div>
      );
    }

    // Настройки виджета «Фильтр» (processing-block, blockType: filter)
    if (selectedWidget.type === 'processing-block' && settings.blockType === 'filter') {
      const filterConditions = settings.filterConditions || [];
      const filterGroups = settings.filterGroups || [];
      const filterLogic = settings.filterLogic || 'and';

      const incomingForFilter = connections.filter(c => c.isIncoming);
      const firstIncoming = incomingForFilter[0];
      const availableFields = resolveAvailableFieldsForIncoming(firstIncoming);
      const inputSourceName = firstIncoming?.fromName || null;

      const FILTER_OPERATORS = [
        { value: 'eq', label: '=' },
        { value: 'ne', label: '!=' },
        { value: 'gt', label: '>' },
        { value: 'lt', label: '<' },
        { value: 'gte', label: '>=' },
        { value: 'lte', label: '<=' },
        { value: 'contains', label: 'содержит' },
        { value: 'startsWith', label: 'начинается с' },
        { value: 'endsWith', label: 'заканчивается на' },
        { value: 'between', label: 'между' },
        { value: 'in', label: 'IN (список)' },
        { value: 'notIn', label: 'NOT IN (список)' },
      ];

      const updateFilterConditions = (next) => {
        handleFieldChange('filterConditions', next);
      };
      const updateFilterGroups = (next) => {
        handleFieldChange('filterGroups', next);
      };

      const filterCodegenCtx = getFilterCodegenContext(selectedWidget?.id, connections);
      const filterWidgetDbId = getWidgetId(selectedWidget);
      const filterSeparateOutput = settings.filterSeparateOutput || false;
      const filterDefaultSeparateName = buildDefaultSeparateFilterVariableName(
        filterCodegenCtx.inputVariable,
        filterWidgetDbId,
      );
      const filterOutputName = resolveFilterOutputVariableName(
        settings,
        filterCodegenCtx.inputVariable,
        { widgetId: filterWidgetDbId },
      );

      return (
        <div className={styles.settingsContent}>
          <h3 className={styles.sectionTitle}>Фильтр</h3>
          <p className={styles.filterHint}>Ограничивает поток данных по условиям. Вход: dataset по связи; выбранные поля и условия. Выход: тот же dataset (та же структура), только отфильтрованные строки.</p>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Название</label>
            <input
              type="text"
              className={styles.input}
              value={settings.name || ''}
              onChange={(e) => handleFieldChange('name', e.target.value)}
              placeholder="Например: Фильтр по региону"
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={filterSeparateOutput}
                onChange={(e) => handleFieldChange('filterSeparateOutput', e.target.checked)}
              />
              <span>Сохранить в отдельную переменную</span>
            </label>
            <p className={styles.filterSubHint}>
              По умолчанию результат записывается в ту же таблицу:{' '}
              <code>{filterCodegenCtx.inputVariable} = {filterCodegenCtx.inputVariable}[…]</code>
            </p>
          </div>

          {filterSeparateOutput ? (
            <>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Переменная DataCode</label>
                <input
                  type="text"
                  className={styles.input}
                  value={settings.dataCodeVariableName ?? ''}
                  onChange={(e) => handleFieldChange('dataCodeVariableName', e.target.value)}
                  placeholder={filterDefaultSeparateName}
                />
                <p className={styles.filterSubHint}>
                  Вход: <code>{filterCodegenCtx.inputVariable}</code>
                  {' → '}
                  выход: <code>{filterOutputName}</code>
                </p>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={settings.exportGlobal || false}
                    onChange={(e) => handleFieldChange('exportGlobal', e.target.checked)}
                  />
                  <span>Экспортировать (global)</span>
                </label>
              </div>
            </>
          ) : (
            <p className={styles.filterSubHint}>
              Выход: <code>{filterOutputName}</code>
            </p>
          )}

          {inputSourceName ? (
            <p className={styles.filterSourceLabel}>Вход: <span className={styles.filterSourceName}>{inputSourceName}</span></p>
          ) : (
            <p className={styles.filterSubHint}>Входной dataset задаётся связью: подключите к фильтру выход источника данных или другого виджета.</p>
          )}
          {inputSourceName && availableFields.length === 0 && (
            <p className={styles.filterSubHint}>
              {firstIncoming?.fromWidget?.type === 'data-model'
                ? 'Во входящем соединении выберите таблицу связанной модели — после этого здесь появятся её поля.'
                : `Колонки источника пока не определены. Загрузите файл в «${inputSourceName}» или укажите имя поля вручную ниже.`}
            </p>
          )}

          {firstIncoming ? (
            <>
              {availableFields.length > 0 ? (
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Поля для условий (структура входа)</label>
                  <div className={styles.fieldsList}>
                    {availableFields.map((f, i) => (
                      <span key={i} className={styles.fieldTag}>{f}</span>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Логика между условиями</label>
                <select
                  className={styles.select}
                  value={filterLogic}
                  onChange={(e) => handleFieldChange('filterLogic', e.target.value)}
                >
                  <option value="and">AND (все условия)</option>
                  <option value="or">OR (любое условие)</option>
                </select>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label}>Условия фильтрации</label>
                <div className={styles.filterConditionsList}>
                  {filterConditions.map((cond, idx) => (
                    <div key={cond.id || idx} className={styles.filterConditionRow}>
                      <FieldNameInput
                        availableFields={availableFields}
                        className={styles.filterFieldSelect}
                        value={cond.field || ''}
                        onChange={(field) => {
                          const next = [...filterConditions];
                          next[idx] = { ...next[idx], field };
                          updateFilterConditions(next);
                        }}
                      />
                      <select
                        className={styles.filterOpSelect}
                        value={cond.operator || 'eq'}
                        onChange={(e) => {
                          const next = [...filterConditions];
                          next[idx] = { ...next[idx], operator: e.target.value };
                          updateFilterConditions(next);
                        }}
                      >
                        {FILTER_OPERATORS.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
                      </select>
                      {cond.operator === 'between' ? (
                        <>
                          <input
                            type="text"
                            className={styles.filterValueInput}
                            placeholder="мин"
                            value={cond.value ?? ''}
                            onChange={(e) => {
                              const next = [...filterConditions];
                              next[idx] = { ...next[idx], value: e.target.value };
                              updateFilterConditions(next);
                            }}
                          />
                          <input
                            type="text"
                            className={styles.filterValueInput}
                            placeholder="макс"
                            value={cond.value2 ?? ''}
                            onChange={(e) => {
                              const next = [...filterConditions];
                              next[idx] = { ...next[idx], value2: e.target.value };
                              updateFilterConditions(next);
                            }}
                          />
                        </>
                      ) : (
                        <input
                          type="text"
                          className={styles.filterValueInput}
                          placeholder={cond.operator === 'in' ? 'a,b,c' : 'значение'}
                          value={cond.value ?? ''}
                          onChange={(e) => {
                            const next = [...filterConditions];
                            next[idx] = { ...next[idx], value: e.target.value };
                            updateFilterConditions(next);
                          }}
                        />
                      )}
                      <button
                        type="button"
                        className={styles.removeButton}
                        onClick={() => updateFilterConditions(filterConditions.filter((_, i) => i !== idx))}
                        title="Удалить условие"
                      >×</button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className={styles.addButton}
                  onClick={() => updateFilterConditions([...filterConditions, { id: `c_${Date.now()}`, field: availableFields[0] || '', operator: 'eq', value: '' }])}
                >
                  + Добавить условие
                </button>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label}>Группы AND/OR</label>
                <p className={styles.filterSubHint}>Вложенные группы условий (например: (A и B) или (C и D)).</p>
                {filterGroups.map((grp, gidx) => (
                  <div key={grp.id || gidx} className={styles.filterGroupBox}>
                    <select
                      className={styles.select}
                      value={grp.logic || 'and'}
                      onChange={(e) => {
                        const next = [...filterGroups];
                        next[gidx] = { ...next[gidx], logic: e.target.value };
                        updateFilterGroups(next);
                      }}
                    >
                      <option value="and">AND</option>
                      <option value="or">OR</option>
                    </select>
                    <span className={styles.filterGroupLabel}>в группе</span>
                    {(grp.conditions || []).map((c, cidx) => (
                      <div key={c.id || cidx} className={styles.filterConditionRow}>
                        <FieldNameInput
                          availableFields={availableFields}
                          className={styles.filterFieldSelect}
                          value={c.field || ''}
                          onChange={(field) => {
                            const next = [...filterGroups];
                            next[gidx].conditions = next[gidx].conditions || [];
                            next[gidx].conditions[cidx] = { ...next[gidx].conditions[cidx], field };
                            updateFilterGroups(next);
                          }}
                        />
                        <select className={styles.filterOpSelect} value={c.operator || 'eq'} onChange={(e) => {
                          const next = [...filterGroups];
                          next[gidx].conditions = next[gidx].conditions || [];
                          next[gidx].conditions[cidx] = { ...next[gidx].conditions[cidx], operator: e.target.value };
                          updateFilterGroups(next);
                        }}>
                          {FILTER_OPERATORS.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
                        </select>
                        <input type="text" className={styles.filterValueInput} placeholder="значение" value={c.value ?? ''} onChange={(e) => {
                          const next = [...filterGroups];
                          next[gidx].conditions = next[gidx].conditions || [];
                          next[gidx].conditions[cidx] = { ...next[gidx].conditions[cidx], value: e.target.value };
                          updateFilterGroups(next);
                        }} />
                        <button type="button" className={styles.removeButton} onClick={() => {
                          const next = [...filterGroups];
                          next[gidx].conditions = (next[gidx].conditions || []).filter((_, i) => i !== cidx);
                          updateFilterGroups(next);
                        }}>×</button>
                      </div>
                    ))}
                    <button type="button" className={styles.addButton} onClick={() => {
                      const next = [...filterGroups];
                      next[gidx].conditions = [...(next[gidx].conditions || []), { id: `cg_${Date.now()}`, field: availableFields[0] || '', operator: 'eq', value: '' }];
                      updateFilterGroups(next);
                    }}>+ В условии группы</button>
                    <button type="button" className={styles.removeButton} onClick={() => updateFilterGroups(filterGroups.filter((_, i) => i !== gidx))}>x</button>
                  </div>
                ))}
                <button type="button" className={styles.addButton} onClick={() => updateFilterGroups([...filterGroups, { id: `g_${Date.now()}`, logic: 'and', conditions: [] }])}>
                  + Добавить группу AND/OR
                </button>
              </div>
            </>
          ) : (
            <p className={styles.filterSubHint}>Подключите к фильтру выход источника данных по связи — появятся поля для условий.</p>
          )}

          <div className={styles.filterDatacodeFooter}>
            <DataCodeOpenButton
              onClick={openDataCodeEditor}
              modified={selectedWidgetCodeModified}
              onRegenerate={handleRegenerateWidgetCode}
            />
          </div>
        </div>
      );
    }

    // Настройки виджета «Трансформация» (processing-block, blockType: transform)
    if (selectedWidget.type === 'processing-block' && settings.blockType === 'transform') {
      const firstIncoming = connections.find((c) => c.isIncoming);
      const availableFields = resolveAvailableFieldsForIncoming(firstIncoming);
      const inputSourceName = firstIncoming?.fromName || null;

      return (
        <TransformSettingsPanel
          settings={settings}
          availableFields={availableFields}
          inputSourceName={inputSourceName}
          transformCodegenCtx={getFilterCodegenContext(selectedWidget?.id, connections)}
          widgetDbId={getWidgetId(selectedWidget)}
          onFieldChange={handleFieldChange}
          onOpenDataCode={openDataCodeEditor}
          codeModified={selectedWidgetCodeModified}
          onRegenerateCode={handleRegenerateWidgetCode}
          emptyFieldsHint={firstIncoming?.fromWidget?.type === 'data-model'
            ? 'Во входящем соединении выберите таблицу связанной модели — после этого здесь появятся её поля.'
            : null}
        />
      );
    }

    // Настройки виджета «Объединение» (processing-block, blockType: join)
    if (selectedWidget.type === 'processing-block' && settings.blockType === 'join') {
      return (
        <JoinSettingsPanel
          settings={settings}
          joinWidget={selectedWidget}
          widgetManager={engineRef.current?.widgetManager || null}
          widgetDbId={getWidgetId(selectedWidget)}
          onFieldChange={handleFieldChange}
          onOpenDataCode={openDataCodeEditor}
          codeModified={selectedWidgetCodeModified}
          onRegenerateCode={handleRegenerateWidgetCode}
        />
      );
    }

    // Настройки виджета «Агрегация» (processing-block, blockType: aggregate)
    if (selectedWidget.type === 'processing-block' && settings.blockType === 'aggregate') {
      const firstIncoming = connections.find((c) => c.isIncoming);
      const availableFields = resolveAvailableFieldsForIncoming(firstIncoming);
      const inputSourceName = firstIncoming?.fromName || null;

      return (
        <AggregateSettingsPanel
          settings={settings}
          availableFields={availableFields}
          inputSourceName={inputSourceName}
          aggregateCodegenCtx={getFilterCodegenContext(selectedWidget?.id, connections)}
          widgetDbId={getWidgetId(selectedWidget)}
          onFieldChange={handleFieldChange}
          onOpenDataCode={openDataCodeEditor}
          codeModified={selectedWidgetCodeModified}
          onRegenerateCode={handleRegenerateWidgetCode}
          emptyFieldsHint={firstIncoming?.fromWidget?.type === 'data-model'
            ? 'Во входящем соединении выберите таблицу связанной модели — после этого здесь появятся её поля.'
            : null}
        />
      );
    }

    // Настройки виджета «Связь»
    if (selectedWidget.type === 'relationship') {
      return (
        <RelationshipSettingsPanel
          settings={settings}
          relationshipWidget={selectedWidget}
          widgetManager={engineRef.current?.widgetManager || null}
          onFieldChange={handleFieldChange}
          onOpenDataCode={openDataCodeEditor}
          codeModified={selectedWidgetCodeModified}
          onRegenerateCode={handleRegenerateWidgetCode}
        />
      );
    }

    // Настройки для других типов виджетов
    return (
      <div className={styles.settingsContent}>
        <h3 className={styles.sectionTitle}>Настройки виджета</h3>
        <div className={styles.fieldGroup}>
          <label className={styles.label}>Название</label>
          <input
            type="text"
            className={styles.input}
            value={settings.name || ''}
            onChange={(e) => handleFieldChange('name', e.target.value)}
            placeholder="Введите название"
          />
        </div>
      </div>
    );
  };

  // Парсинг CSV файла для получения колонок
  const parseCSVFile = (file, options = {}) => {
    const { headerRowNum = 1, isTransposed = false } = options;
    return new Promise((resolve, reject) => {
            if (!file) {
        reject(new Error('Файл не передан'));
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target.result;
                    Papa.parse(text, {
            header: false,
            skipEmptyLines: true,
            complete: (results) => {
                            if (results.errors.length > 0) {
                console.warn('[PropertiesPanel] CSV parse errors:', results.errors);
              }
              const rawRows = results.data || [];
              const columns = resolveColumnsFromRawRows(rawRows, headerRowNum, isTransposed);
                            fileRawRowsRef.current = rawRows;
              resolve({ columns, rawRows });
            },
            error: (error) => {
              console.error('[PropertiesPanel] CSV parse error:', error);
              reject(error);
            }
          });
        } catch (err) {
          console.error('[PropertiesPanel] Error in CSV parsing:', err);
          reject(err);
        }
      };
      reader.onerror = (error) => {
        console.error('[PropertiesPanel] FileReader error:', error);
        reject(new Error('Ошибка чтения файла'));
      };
      reader.readAsText(file);
    });
  };

  const applyFileColumnsFromRaw = (rawRows, settingsSnapshot, transposeOverride = null) => {
    if (!rawRows?.length) return [];
    fileRawRowsRef.current = rawRows;
    const headerRow = settingsSnapshot.excelHeaderRow || 1;
    const isTransposed = transposeOverride ?? !!settingsSnapshot.isTransposed;
    return resolveColumnsFromRawRows(rawRows, headerRow, isTransposed);
  };

  const handleTransposeChange = async (checked) => {
    const currentSettings = settingsRef.current;
    let rawRows = fileRawRowsRef.current;

    if (!rawRows?.length) {
      setIsParsingFile(true);
      try {
        rawRows = await loadFileRawRows(currentSettings, {
          modelId,
          connectionService,
          dataModelService,
        });
        if (rawRows?.length) {
          fileRawRowsRef.current = rawRows;
        }
      } catch (err) {
        console.error('[PropertiesPanel] Failed to load raw rows for transpose:', err);
      } finally {
        setIsParsingFile(false);
      }
    }

    let nextSettings = { ...currentSettings, isTransposed: checked };

    if (checked) {
      if (!nextSettings.originalFileColumns?.length) {
        nextSettings.originalFileColumns = fileColumnsRef.current.length
          ? [...fileColumnsRef.current]
          : [...(currentSettings.selectedColumns || currentSettings.fileColumns || [])];
      }
      if (rawRows?.length) {
        const columns = applyFileColumnsFromRaw(rawRows, nextSettings, true);
        if (columns.length) {
          setFileColumns(columns);
          nextSettings.selectedColumns = columns;
          nextSettings.fileColumns = columns;
          nextSettings.fieldRenames = {};
        }
      } else {
        console.warn('[PropertiesPanel] Transpose: no raw rows available');
      }
    } else if (nextSettings.originalFileColumns?.length) {
      const columns = [...nextSettings.originalFileColumns];
      setFileColumns(columns);
      nextSettings.selectedColumns = columns;
      nextSettings.fileColumns = columns;
      nextSettings.fieldRenames = {};
    } else if (rawRows?.length) {
      const columns = applyFileColumnsFromRaw(rawRows, nextSettings, false);
      if (columns.length) {
        setFileColumns(columns);
        nextSettings.selectedColumns = columns;
        nextSettings.fileColumns = columns;
        nextSettings.fieldRenames = {};
      }
    }

    settingsRef.current = nextSettings;
    setSettings(nextSettings);
    updateWidgetSettings(nextSettings);
    queueFileDataCodeSync(nextSettings, nextSettings.selectedColumns || fileColumnsRef.current);
  };

  // Парсинг Excel файла для получения листов и колонок
  const parseExcelFile = (file, sheetName = null, headerRowNum = 1, isTransposed = false) => {
    return new Promise((resolve, reject) => {
      // Проверяем, что файл доступен
      if (!file || !(file instanceof File)) {
        reject(new Error('Файл не передан или имеет неверный формат'));
        return;
      }

      // Проверяем размер файла (если слишком большой, может быть проблема)
      if (file.size === 0) {
        reject(new Error('Файл пуст'));
        return;
      }

      
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
                    
          if (!e.target.result) {
            reject(new Error('Результат чтения файла пуст'));
            return;
          }

          const data = new Uint8Array(e.target.result);
                    
          const workbook = XLSX.read(data, { 
            type: 'array',
            cellDates: true,
            cellNF: false,
            cellText: false
          });
          
          const sheetNames = workbook.SheetNames;
                    
          if (!sheetNames || sheetNames.length === 0) {
            reject(new Error('В файле не найдено листов'));
            return;
          }
          
          // Используем указанный лист или первый лист
          const targetSheetName = sheetName || sheetNames[0];
          const worksheet = workbook.Sheets[targetSheetName];
          if (!worksheet) {
            reject(new Error(`Лист "${targetSheetName}" не найден`));
            return;
          }
          
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                    
          const columns = resolveColumnsFromRawRows(jsonData, headerRowNum, isTransposed);
          fileRawRowsRef.current = jsonData;
          
                    
          resolve({
            sheets: sheetNames,
            columns,
            rawRows: jsonData,
            workbook,
          });
        } catch (err) {
          console.error('[PropertiesPanel] parseExcelFile: Error parsing workbook:', err);
          reject(new Error(`Ошибка парсинга Excel файла: ${err.message}`));
        }
      };
      
      reader.onerror = (error) => {
        console.error('[PropertiesPanel] parseExcelFile: FileReader error:', error);
        console.error('[PropertiesPanel] parseExcelFile: FileReader error details:', {
          error: error.target?.error,
          readyState: error.target?.readyState,
          fileName: file.name,
          fileSize: file.size
        });
        reject(new Error(`Ошибка чтения файла: ${error.target?.error?.message || 'Неизвестная ошибка'}`));
      };
      
      reader.onabort = () => {
        console.error('[PropertiesPanel] parseExcelFile: FileReader aborted');
        reject(new Error('Чтение файла было прервано'));
      };
      
      try {
        reader.readAsArrayBuffer(file);
      } catch (err) {
        console.error('[PropertiesPanel] parseExcelFile: Error starting FileReader:', err);
        reject(new Error(`Не удалось начать чтение файла: ${err.message}`));
      }
    });
  };

  const persistLocalFileCodeAndMetadata = async (file, widgetSettings) => {
    if (!modelId || !selectedWidget || !file) return;

    try {
      await ensureWidgetInDatabase(modelId, selectedWidget, engineRef);
    } catch (error) {
      console.warn('[PropertiesPanel] Could not ensure widget in DB:', error);
    }

    const fileName = file.name;
    const updatedSettings = normalizeWidgetSettingsForDelivery({
      ...widgetSettings,
      sourcePath: fileName,
      sourceType: 'file',
      fileDeliveryMode: 'local',
      selectedFile: {
        ...(widgetSettings.selectedFile || {}),
        name: fileName,
        size: file.size,
        type: file.type || '',
        lastModified: file.lastModified || Date.now(),
        file,
      },
    });

    selectedWidget.settings = updatedSettings;
    selectedWidget.render();
    setSettings(updatedSettings);
    settingsRef.current = updatedSettings;
    eventBus.emit('widget:settings:changed', { widget: selectedWidget });
    // DataCode is not auto-generated on file pick — use editor or «Перегенерировать».
  };

  // Обработка выбора файла/папки/архива
  const handleFileSelect = async (data, metadata = {}) => {
        
    if (!selectedWidget) {
      console.warn('[PropertiesPanel] No widget selected, cannot handle file select');
      return;
    }
    
    if (metadata.type === 'folder') {
      const folderName = metadata.folderName || data.name || 'Папка';
      const folderPayload = {
        name: folderName,
        files: data.files || [],
        fileCount: metadata.totalFiles || 0,
        dataFilesCount: metadata.dataFilesCount || 0,
      };
      const structureCache = buildStructureCache(folderPayload);
      const selectedFolder = {
        ...folderPayload,
        structureCache,
        inventoryFingerprint: structureCache.fingerprint,
      };
      const newSettings = normalizeWidgetSettingsForDelivery({
        ...settingsRef.current,
        sourcePath: folderName,
        sourceType: 'folder',
        fileDeliveryMode: 'local',
        selectedFolder,
      });
      setFolderSessionStructureCache(getWidgetId(selectedWidgetRef.current), selectedFolder, structureCache);
      settingsRef.current = newSettings;
      setSettings(newSettings);
      updateWidgetSettings(newSettings);
    } else if (metadata.type === 'archive') {
      const archiveFile = data instanceof File ? data : (data.file || data);
      const archiveName = metadata.archiveName || archiveFile.name || 'Архив';
      setIsParsingFile(true);
      try {
        const unpacked = await unpackArchive(archiveFile, archiveName);
        const archivePayload = {
          name: unpacked.name,
          archiveFileName: archiveName,
          size: metadata.archiveSize || archiveFile.size || 0,
          file: archiveFile,
          files: unpacked.files,
          fileCount: unpacked.fileCount,
          dataFilesCount: unpacked.dataFilesCount,
        };
        const structureCache = buildStructureCache(archivePayload);
        const selectedArchive = {
          ...archivePayload,
          structureCache,
          inventoryFingerprint: structureCache.fingerprint,
        };
        const newSettings = normalizeWidgetSettingsForDelivery({
          ...settingsRef.current,
          sourcePath: archiveName,
          sourceType: 'archive',
          fileDeliveryMode: 'local',
          selectedArchive,
          folderConfig: null,
        });
        const widget = selectedWidgetRef.current;
        if (widget) {
          setFolderSessionStructureCache(getWidgetId(widget), selectedArchive, structureCache);
        }
        settingsRef.current = newSettings;
        setSettings(newSettings);
        updateWidgetSettings(newSettings);
      } catch (error) {
        console.error('[PropertiesPanel] Ошибка распаковки архива:', error);
        alert(`Ошибка при открытии архива: ${error.message}`);
      } finally {
        setIsParsingFile(false);
      }
    } else {
      // Обработка выбора обычного файла
      // data может быть File объектом напрямую (из FileSelectorModal) или объектом с полями (из input)
      const file = data instanceof File ? data : (data.file || data);
      
      if (!file || !(file instanceof File)) {
        console.error('[PropertiesPanel] File object is missing or invalid!', { data, file, isFile: file instanceof File });
        alert('Ошибка: файл не выбран или имеет неверный формат');
        return;
      }
      
      const fileName = file.name || data.name || 'Файл';
            
      // Проверяем, что файл доступен для чтения
      if (file.size === 0) {
        alert('Файл пуст. Выберите другой файл.');
        return;
      }
      
      // Проверяем размер файла (если слишком большой, может быть проблема)
      const maxFileSize = 50 * 1024 * 1024; // 50 MB
      if (file.size > maxFileSize) {
        const confirmContinue = confirm(`Файл очень большой (${(file.size / 1024 / 1024).toFixed(2)} MB). Продолжить загрузку?`);
        if (!confirmContinue) {
          return;
        }
      }
      
      const fileInfo = {
        name: fileName,
        size: file.size || 0,
        type: file.type || '',
        lastModified: file.lastModified || Date.now(),
        file: file // Сохраняем сам файл для дальнейшего использования
      };
      
            
      // Обновляем состояние виджета синхронно, сбрасываем колонки прошлого файла
      const currentSettings = selectedWidget.settings || {};
      const newSettings = { 
        ...currentSettings, 
        selectedFile: fileInfo, 
        sourcePath: fileName, 
        sourceType: 'file',
        fileDeliveryMode: 'local',
        selectedColumns: [],
        fileColumns: [],
        fieldRenames: {},
        excelSheets: [],
        excelSheet: null,
        lastParsedFileName: null,
        dataCodeVariableName: '',
      };
      
      // Обновляем виджет напрямую
      selectedWidget.settings = newSettings;
      selectedWidget.render();
      
      // Обновляем локальное состояние
      setSettings(newSettings);
            
      // Парсим файл для получения настроек
      setIsParsingFile(true);
      setFileColumns([]);
      setExcelSheets([]);
      
      try {
        const fileExtension = fileName.split('.').pop().toLowerCase();
                
        // Небольшая задержка, чтобы убедиться, что файл полностью доступен
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (fileExtension === 'csv') {
                    const parsed = await parseCSVFile(file, {
            headerRowNum: currentSettings.excelHeaderRow || 1,
            isTransposed: !!currentSettings.isTransposed,
          });
          const columns = parsed.columns;
                    setFileColumns(columns);
          
          // Обновляем настройки с колонками
          const updatedSettings = {
            ...newSettings,
            selectedColumns: columns,
            fileColumns: columns,
            fieldRenames: {},
            lastParsedFileName: fileName,
          };
          selectedWidget.settings = updatedSettings;
          selectedWidget.render();
          setSettings(updatedSettings);
          
          if (modelId) {
            await persistLocalFileCodeAndMetadata(file, updatedSettings);
          } else {
            queueFileDataCodeSync(updatedSettings, columns);
          }
          
          // Сохраняем изменения через движок
          if (engineRef.current) {
            eventBus.emit('widget:settings:changed', { widget: selectedWidget });
          }
        } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
                    const headerRow = currentSettings.excelHeaderRow || 1;
          
          // Проверяем, что файл все еще доступен
          if (!file || file.size === 0) {
            throw new Error('Файл стал недоступен для чтения');
          }
          
          const excelData = await parseExcelFile(
          file,
          null,
          headerRow,
          !!currentSettings.isTransposed,
        );
                    setExcelSheets(excelData.sheets);
          setFileColumns(excelData.columns);
          
          // Обновляем настройки с листами и колонками
          const updatedSettings = {
            ...newSettings,
            excelSheet: excelData.sheets[0] || null,
            selectedColumns: excelData.columns,
            fileColumns: excelData.columns,
            fieldRenames: {},
            excelHeaderRow: 1,
            lastParsedFileName: fileName,
            excelSheets: excelData.sheets,
          };
          selectedWidget.settings = updatedSettings;
          selectedWidget.render();
          setSettings(updatedSettings);
          
          if (modelId) {
            await persistLocalFileCodeAndMetadata(file, updatedSettings);
          } else {
            queueFileDataCodeSync(updatedSettings, excelData.columns);
          }
          
          // Сохраняем изменения через движок
          if (engineRef.current) {
            eventBus.emit('widget:settings:changed', { widget: selectedWidget });
          }
        } else {
                    // Загружаем файл на сервер даже для неподдерживаемых типов, если modelId доступен
          if (modelId) {
            await persistLocalFileCodeAndMetadata(file, newSettings);
          }
          // Сохраняем изменения даже для неподдерживаемых типов файлов
          if (engineRef.current) {
            eventBus.emit('widget:settings:changed', { widget: selectedWidget });
          }
        }
      } catch (error) {
        console.error('[PropertiesPanel] Ошибка парсинга файла:', error);
        console.error('[PropertiesPanel] Error details:', {
          error: error.message,
          stack: error.stack,
          fileName: fileName,
          fileSize: file.size,
          fileType: file.type
        });
        alert(`Ошибка при обработке файла "${fileName}": ${error.message}\n\nПопробуйте выбрать файл снова или проверьте, что файл не поврежден.`);
        // Очищаем состояние при ошибке
        setFileColumns([]);
        setExcelSheets([]);
      } finally {
        setIsParsingFile(false);
              }
    }
  };

  return (
    <>
      <div className={styles.propertiesPanel}>
        <div className={styles.panelHeader}>
          <h3 className={styles.panelTitle}>Свойства</h3>
          <div className={styles.widgetType}>{selectedWidget.type}</div>
        </div>
        <div className={styles.propertiesPanelScroll}>
          {renderConnections()}
          {renderWidgetSettings()}
        </div>
        <div className={styles.panelFooterHint}>
          Двойное нажатие ПКМ по виджету удаляет его
        </div>
      </div>

      <FileSelectorModal
        isOpen={isFileSelectorOpen}
        onClose={() => setIsFileSelectorOpen(false)}
        onFileSelect={(data, metadata) => {
                    handleFileSelect(data, metadata);
        }}
      />

      <SmbFileBrowserModal
        isOpen={isSmbBrowserOpen}
        onClose={() => setIsSmbBrowserOpen(false)}
        connectionId={settings.smbConnectionId}
        connectionName={smbConnections.find((c) => String(c.id) === String(settings.smbConnectionId))?.name}
        shareName={settings.smbShareName}
        mode={getSmbBrowserMode(settings)}
        onFileSelect={handleSmbFileSelect}
        onFolderSelect={handleSmbFolderSelect}
      />

      <FolderSourceConfigurationModal
        isOpen={isFolderConfigOpen}
        onClose={() => setIsFolderConfigOpen(false)}
        folderData={folderConfigFolderData}
        existingConfig={settingsRef.current.folderConfig || settings.folderConfig}
        sessionStructureCache={
          folderConfigFolderData
            ? getFolderSessionStructureCache(getWidgetId(selectedWidget), folderConfigFolderData)
            : null
        }
        onStructureCacheUpdate={handleFolderStructureCacheUpdate}
        onDraftSave={(config, options) => persistFolderConfig(config, options)}
        onSave={(config) => {
          persistFolderConfig(config, { generateCode: false });
          setIsFolderConfigOpen(false);
        }}
      />

    </>
  );
};

export default PropertiesPanel;

