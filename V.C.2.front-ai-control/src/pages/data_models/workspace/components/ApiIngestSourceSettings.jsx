import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ClipboardDocumentIcon,
  CheckIcon,
  ChevronDownIcon,
  KeyIcon,
  PlusIcon,
  ArrowPathIcon,
  DocumentTextIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { apiKeyService } from '../../../../services/apiKeyService';
import { dataModelService } from '../../../../services/dataModelService';
import { postModelSqliteQuery } from '../../../../services/dashboardQueryService';
import { CreateApiKeyModal } from '../../components/ApiKeysManager.jsx';
import { ensureWidgetInDatabase, saveWidgetToDatabase } from '../widgetDbSync.js';
import {
  APPEND_ROW_ID_COLUMN,
  buildCurlExamples,
  buildDeveloperDocsUrl,
  buildIngestUrl,
  columnsFromPreviewRows,
  defaultTableName,
  deployStatusLabel,
  deployStatusTone,
  ensureAppendRowIdColumn,
  getTableIngestStatus,
  sanitizeTableName,
} from '../apiIngestSourceUtils.js';
import styles from '../PropertiesPanel.module.css';
import DataCodeOpenButton from './DataCodeOpenButton.jsx';

const POLL_INTERVAL_MS = 2000;
const PREVIEW_LIMIT = 20;

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('ru-RU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const CopyButton = ({ text, label = 'Копировать' }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };
  return (
    <button type="button" className={styles.apiCopyButton} onClick={handleCopy}>
      {copied ? (
        <>
          <CheckIcon style={{ width: '0.875rem', height: '0.875rem' }} />
          Скопировано
        </>
      ) : (
        <>
          <ClipboardDocumentIcon style={{ width: '0.875rem', height: '0.875rem' }} />
          {label}
        </>
      )}
    </button>
  );
};

function parseUpsertKeys(value) {
  if (Array.isArray(value)) {
    return value.map((k) => String(k).trim()).filter(Boolean);
  }
  if (typeof value !== 'string') return [];
  return value
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
}

function upsertKeysFromKeyMeta(key) {
  const meta = key?.meta_data;
  if (!meta || typeof meta !== 'object') return [];
  return parseUpsertKeys(meta.upsert_keys);
}

function modeFromKeyMeta(key) {
  const mode = key?.meta_data?.mode;
  return mode === 'stream' || mode === 'snapshot' || mode === 'append' ? mode : null;
}

function filterIngestKeys(keys, modelId) {
  return (Array.isArray(keys) ? keys : []).filter(
    (k) => k.scope_type === 'model'
      && k.access_level === 'ingest'
      && k.is_active
      && Number(k.data_model_id) === Number(modelId),
  );
}

const ApiIngestSourceSettings = ({
  modelId,
  settings,
  selectedWidget,
  engineRef,
  onFieldChange,
  onSettingsChange,
  onOpenDataCodeEditor,
  codeModified = false,
  onRegenerateCode,
}) => {
  const [apiKeys, setApiKeys] = useState([]);
  const [devInfo, setDevInfo] = useState(null);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [configuring, setConfiguring] = useState(false);
  const [configError, setConfigError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [setupExpanded, setSetupExpanded] = useState(true);
  const [polling, setPolling] = useState(false);
  const [upsertKeysDraft, setUpsertKeysDraft] = useState('');
  const [resetting, setResetting] = useState(false);
  const lastIngestRef = useRef(settings.lastIngestAt || null);
  const lastDeployStatusRef = useRef(settings.deployStatus || null);
  const pollInitialSyncRef = useRef(false);
  const widgetReadyRef = useRef(false);
  const settingsRef = useRef(settings);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    const keys = parseUpsertKeys(settings.upsertKeys);
    setUpsertKeysDraft(keys.join(', '));
  }, [settings.upsertKeys, settings.apiKeyId]);

  // Collapse setup link once ingest data is present; expand again after reset.
  useEffect(() => {
    const cols = settings.fileColumns || [];
    const rows = settings.previewRows || [];
    const ready = cols.length > 0 && ((settings.lastRowCount > 0) || rows.length > 0);
    setSetupExpanded(!ready);
  }, [settings.fileColumns, settings.previewRows, settings.lastRowCount]);

  const ingestKeys = useMemo(
    () => filterIngestKeys(apiKeys, modelId),
    [apiKeys, modelId],
  );

  const selectedKey = useMemo(
    () => ingestKeys.find((k) => Number(k.id) === Number(settings.apiKeyId)) || null,
    [ingestKeys, settings.apiKeyId],
  );

  const tableName = sanitizeTableName(settings.tableName || '');
  const ingestMode = settings.apiIngestMode || 'snapshot';
  const upsertKeys = parseUpsertKeys(settings.upsertKeys);
  const devBase = devInfo?.base_url || 'http://127.0.0.1:8002';
  const ingestUrl = tableName ? buildIngestUrl(devBase, tableName) : '';
  const docsUrl = buildDeveloperDocsUrl(devInfo);
  const curlExamples = ingestUrl ? buildCurlExamples(ingestUrl, ingestMode) : null;

  const fetchKeysAndDevInfo = useCallback(async () => {
    if (!modelId) return [];
    const [keys, info] = await Promise.all([
      apiKeyService.listApiKeys(modelId),
      apiKeyService.getDeveloperApiInfo().catch(() => null),
    ]);
    const list = Array.isArray(keys) ? keys : [];
    setApiKeys(list);
    setDevInfo(info);
    return list;
  }, [modelId]);

  const loadKeys = useCallback(async () => {
    if (!modelId) return [];
    setLoadingKeys(true);
    try {
      return await fetchKeysAndDevInfo();
    } catch (err) {
      console.warn('[ApiIngestSourceSettings] Failed to load API keys:', err);
      return [];
    } finally {
      setLoadingKeys(false);
    }
  }, [modelId, fetchKeysAndDevInfo]);

  const fetchPreview = useCallback(async (safeTable) => {
    if (!modelId || !safeTable) return null;
    try {
      const result = await postModelSqliteQuery(modelId, {
        mode: 'select',
        base_table: safeTable,
        limit: PREVIEW_LIMIT,
      });
      const rows = Array.isArray(result?.rows) ? result.rows : [];
      const columns = columnsFromPreviewRows(rows);
      return { rows, columns };
    } catch (err) {
      console.warn('[ApiIngestSourceSettings] preview query failed:', err);
      return null;
    }
  }, [modelId]);

  const applyIngestUpdate = useCallback(async (ingestStatus) => {
    const current = settingsRef.current;
    const safeTable = sanitizeTableName(current.tableName || '');
    if (!safeTable) return;
    const deployStatus = ingestStatus?.deploy_status || null;
    const shouldLoadPreview = deployStatus === 'deployed'
      || (ingestStatus?.last_ingest_at && ingestStatus.last_ingest_at !== current.lastIngestAt);
    const preview = shouldLoadPreview ? await fetchPreview(safeTable) : null;
    const rawCols = (
      Array.isArray(ingestStatus?.source_columns) && ingestStatus.source_columns.length
        ? ingestStatus.source_columns
        : Array.isArray(ingestStatus?.columns)
          ? ingestStatus.columns
          : []
    );
    // Prefer API ingest schema columns — never overwrite with compiled latest.db rename.
    const columns = rawCols.filter((c) => typeof c === 'string' && c);
    const patch = {
      lastIngestAt: ingestStatus?.last_ingest_at || current.lastIngestAt || null,
      lastRowCount: ingestStatus?.last_row_count ?? current.lastRowCount ?? null,
      deployStatus,
      deployError: deployStatus === 'failed' ? (ingestStatus?.deploy_error || null) : null,
      lastRequestId: ingestStatus?.last_request_id ?? current.lastRequestId ?? null,
    };
    if (columns.length) {
      const mode = current.apiIngestMode || 'snapshot';
      const nextFileColumns = ensureAppendRowIdColumn(columns, mode);
      patch.fileColumns = nextFileColumns;
      const retained = current.selectedColumns?.length
        ? current.selectedColumns.filter((c) => nextFileColumns.includes(c))
        : nextFileColumns;
      patch.selectedColumns = ensureAppendRowIdColumn(
        retained.length ? retained : nextFileColumns,
        mode,
      );
    }
    if (preview?.rows?.length) {
      patch.previewRows = preview.rows;
    }
    onSettingsChange({ ...current, ...patch });
  }, [fetchPreview, onSettingsChange]);

  const reconcileSelectedKey = useCallback((keysList) => {
    const current = settingsRef.current;
    const filtered = filterIngestKeys(keysList, modelId);
    const selectedId = current.apiKeyId;
    if (!selectedId) return { next: current, changed: false };

    const match = filtered.find((k) => Number(k.id) === Number(selectedId));
    if (!match) {
      return {
        next: {
          ...current,
          apiKeyId: null,
          apiKeyName: null,
          apiKeyPrefix: null,
        },
        changed: true,
      };
    }

    if (match.name === current.apiKeyName && match.key_prefix === current.apiKeyPrefix) {
      return { next: current, changed: false };
    }

    return {
      next: {
        ...current,
        apiKeyName: match.name,
        apiKeyPrefix: match.key_prefix,
      },
      changed: true,
    };
  }, [modelId]);

  const syncIngestStatus = useCallback(async (safeTable) => {
    if (!modelId || !safeTable) return false;
    try {
      const model = await dataModelService.getDataModel(modelId);
      const status = getTableIngestStatus(model.processing_config, safeTable);
      const lastAt = status?.last_ingest_at || null;
      const deployStatus = status?.deploy_status || null;
      pollInitialSyncRef.current = true;
      lastIngestRef.current = lastAt;
      lastDeployStatusRef.current = deployStatus;
      await applyIngestUpdate(status);
      return true;
    } catch (err) {
      console.warn('[ApiIngestSourceSettings] sync ingest status failed:', err);
      return false;
    }
  }, [modelId, applyIngestUpdate]);

  const handleRefresh = useCallback(async () => {
    if (!modelId) return;
    setLoadingKeys(true);
    try {
      const list = await fetchKeysAndDevInfo();
      const { next, changed } = reconcileSelectedKey(list);
      if (changed) {
        settingsRef.current = next;
      }

      const safeTable = sanitizeTableName(next.tableName || '');
      if (safeTable) {
        const synced = await syncIngestStatus(safeTable);
        if (!synced && changed) {
          onSettingsChange(next);
        }
        return;
      }

      if (changed) {
        onSettingsChange(next);
      }
    } catch (err) {
      console.warn('[ApiIngestSourceSettings] refresh failed:', err);
    } finally {
      setLoadingKeys(false);
    }
  }, [modelId, fetchKeysAndDevInfo, reconcileSelectedKey, syncIngestStatus, onSettingsChange]);

  const configureIngest = useCallback(async (key, table, mode, keys = []) => {
    if (!modelId || !key || !table) return false;
    setConfiguring(true);
    setConfigError(null);
    try {
      const safeTable = sanitizeTableName(table);
      const normalizedKeys = parseUpsertKeys(keys);
      if (mode === 'stream' && normalizedKeys.length === 0) {
        setConfigError('Для stream укажите upsert key (колонки через запятую)');
        return false;
      }

      const payload = { mode };
      if (mode === 'stream') {
        payload.upsert_keys = normalizedKeys;
      } else {
        payload.upsert_keys = [];
      }
      await apiKeyService.configureIngestTable(modelId, safeTable, payload);

      const ingestConfig = mode === 'stream'
        ? { mode: 'stream', upsert_keys: normalizedKeys }
        : mode === 'append'
          ? { mode: 'append' }
          : { mode: 'snapshot' };
      await apiKeyService.updateApiKey(key.id, { ingest_config: ingestConfig });

      if (Array.isArray(key.allowed_tables) && key.allowed_tables.length > 0) {
        if (!key.allowed_tables.includes(safeTable)) {
          await apiKeyService.updateApiKey(key.id, {
            allowed_tables: [...key.allowed_tables, safeTable],
          });
        }
      }
      await loadKeys();

      // Drop stale stream deploy banner from the panel immediately.
      const current = settingsRef.current;
      onSettingsChange({
        ...current,
        apiIngestMode: mode,
        upsertKeys: mode === 'stream' ? normalizedKeys : [],
        deployError: null,
        deployStatus:
          current.deployStatus === 'failed' && current.lastIngestAt
            ? 'deployed'
            : current.deployStatus,
      });
      return true;
    } catch (err) {
      const detail = err.response?.data?.detail;
      setConfigError(typeof detail === 'string' ? detail : 'Не удалось настроить ingest');
      console.warn('[ApiIngestSourceSettings] configureIngest failed:', err);
      return false;
    } finally {
      setConfiguring(false);
    }
  }, [modelId, loadKeys, onSettingsChange]);

  useEffect(() => {
    loadKeys();
  }, [loadKeys]);

  useEffect(() => {
    lastIngestRef.current = settings.lastIngestAt || null;
    lastDeployStatusRef.current = settings.deployStatus || null;
  }, [settings.lastIngestAt, settings.deployStatus]);

  useEffect(() => {
    if (!modelId || !selectedWidget) return undefined;
    let cancelled = false;

    const ensureWidget = async () => {
      try {
        await ensureWidgetInDatabase(modelId, selectedWidget, engineRef);
        if (cancelled) return;
        widgetReadyRef.current = true;
        if (!settingsRef.current.tableName) {
          const nextTable = defaultTableName(selectedWidget);
          if (nextTable) {
            onFieldChange('tableName', nextTable);
          }
        }
      } catch (err) {
        console.warn('[ApiIngestSourceSettings] ensureWidget failed:', err);
      }
    };

    ensureWidget();
    return () => {
      cancelled = true;
    };
  }, [modelId, selectedWidget, engineRef, onFieldChange]);

  useEffect(() => {
    if (!modelId || !tableName || !settings.lastIngestAt) return undefined;
    if ((settings.previewRows || []).length > 0) return undefined;
    let cancelled = false;

    const loadExisting = async () => {
      const preview = await fetchPreview(tableName);
      if (cancelled || !preview?.columns?.length) return;
      const mode = settingsRef.current.apiIngestMode || 'snapshot';
      const nextFileColumns = ensureAppendRowIdColumn(preview.columns, mode);
      const retained = settingsRef.current.selectedColumns?.length
        ? settingsRef.current.selectedColumns.filter((c) => nextFileColumns.includes(c))
        : nextFileColumns;
      onSettingsChange({
        ...settingsRef.current,
        fileColumns: nextFileColumns,
        selectedColumns: ensureAppendRowIdColumn(
          retained.length ? retained : nextFileColumns,
          mode,
        ),
        previewRows: preview.rows,
      });
    };

    loadExisting();
    return () => {
      cancelled = true;
    };
  }, [modelId, tableName, settings.lastIngestAt, settings.previewRows, fetchPreview, onSettingsChange]);

  useEffect(() => {
    if (!modelId || !settings.apiKeyId || !tableName) return undefined;

    let cancelled = false;
    setPolling(true);

    const tick = async () => {
      if (cancelled) return;
      try {
        const model = await dataModelService.getDataModel(modelId);
        const status = getTableIngestStatus(model.processing_config, tableName);
        const lastAt = status?.last_ingest_at || null;
        const deployStatus = status?.deploy_status || null;
        const isInitialSync = !pollInitialSyncRef.current;
        const statusChanged = isInitialSync
          || (lastAt && lastAt !== lastIngestRef.current)
          || deployStatus !== lastDeployStatusRef.current;
        if (statusChanged) {
          pollInitialSyncRef.current = true;
          lastIngestRef.current = lastAt;
          lastDeployStatusRef.current = deployStatus;
          await applyIngestUpdate(status);
        }
      } catch (err) {
        console.warn('[ApiIngestSourceSettings] poll failed:', err);
      }
    };

    tick();
    const id = window.setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      setPolling(false);
    };
  }, [modelId, settings.apiKeyId, tableName, applyIngestUpdate]);

  const handleKeySelect = async (e) => {
    const keyId = Number(e.target.value);
    if (!keyId) {
      onFieldChange('apiKeyId', null);
      return;
    }
    const key = ingestKeys.find((k) => Number(k.id) === keyId);
    if (!key) return;
    const nextMode = settings.apiIngestMode || modeFromKeyMeta(key) || 'snapshot';
    const nextKeys = parseUpsertKeys(settings.upsertKeys).length
      ? parseUpsertKeys(settings.upsertKeys)
      : upsertKeysFromKeyMeta(key);
    onSettingsChange({
      ...settings,
      apiKeyId: key.id,
      apiKeyName: key.name,
      apiKeyPrefix: key.key_prefix,
      apiIngestMode: nextMode,
      upsertKeys: nextKeys,
    });
    await configureIngest(
      key,
      tableName || defaultTableName(selectedWidget),
      nextMode,
      nextKeys,
    );
  };

  const handleTableNameBlur = async () => {
    const safe = sanitizeTableName(settings.tableName || '');
    if (safe !== settings.tableName) {
      onFieldChange('tableName', safe);
    }
    if (selectedKey && safe) {
      await configureIngest(selectedKey, safe, ingestMode, upsertKeys);
    }
  };

  const handleModeChange = async (e) => {
    const mode = e.target.value;
    let nextKeys = upsertKeys;
    if (mode === 'stream' && nextKeys.length === 0) {
      const cols = settings.selectedColumns?.length
        ? settings.selectedColumns
        : (settings.fileColumns || []);
      nextKeys = cols.length ? [cols[0]] : [];
    }
    const nextFileColumns = ensureAppendRowIdColumn(settings.fileColumns || [], mode);
    const nextSelected = ensureAppendRowIdColumn(
      settings.selectedColumns?.length ? settings.selectedColumns : nextFileColumns,
      mode,
    );
    onSettingsChange({
      ...settings,
      apiIngestMode: mode,
      upsertKeys: mode === 'stream' ? nextKeys : [],
      fileColumns: nextFileColumns,
      selectedColumns: nextSelected,
    });
    if (selectedKey && tableName) {
      await configureIngest(selectedKey, tableName, mode, nextKeys);
    }
  };

  const handleUpsertKeysBlur = async () => {
    const nextKeys = parseUpsertKeys(upsertKeysDraft);
    setUpsertKeysDraft(nextKeys.join(', '));
    onFieldChange('upsertKeys', nextKeys);
    if (ingestMode !== 'stream' || !selectedKey || !tableName) return;
    await configureIngest(selectedKey, tableName, 'stream', nextKeys);
  };

  const handleKeyCreated = async (created) => {
    await loadKeys();
    const nextMode = settings.apiIngestMode || modeFromKeyMeta(created) || 'snapshot';
    const nextKeys = parseUpsertKeys(settings.upsertKeys).length
      ? parseUpsertKeys(settings.upsertKeys)
      : upsertKeysFromKeyMeta(created);
    onSettingsChange({
      ...settings,
      apiKeyId: created.id,
      apiKeyName: created.name,
      apiKeyPrefix: created.key_prefix,
      apiIngestMode: nextMode,
      upsertKeys: nextKeys,
    });
    await configureIngest(
      created,
      tableName || defaultTableName(selectedWidget),
      nextMode,
      nextKeys,
    );
  };

  const handleResetData = async () => {
    if (!modelId || !tableName) return;
    const ok = window.confirm(
      `Сбросить данные API для таблицы «${tableName}»?\n\n`
      + 'Будут удалены ingest-история, запись в Persistent Store и таблица в latest.db. '
      + 'Ключ и режим ingest сохранятся.',
    );
    if (!ok) return;
    setResetting(true);
    setConfigError(null);
    try {
      await apiKeyService.resetIngestTable(modelId, tableName);
      const cleared = {
        ...settingsRef.current,
        fileColumns: [],
        selectedColumns: [],
        previewRows: [],
        lastIngestAt: null,
        lastRowCount: null,
        deployStatus: null,
        deployError: null,
        lastRequestId: null,
      };
      onSettingsChange(cleared);
      lastIngestRef.current = null;
      lastDeployStatusRef.current = null;
      pollInitialSyncRef.current = false;

      // Persist cleared ingest preview/status into data_model_widgets immediately.
      if (selectedWidget) {
        try {
          selectedWidget.settings = { ...selectedWidget.settings, ...cleared };
          await saveWidgetToDatabase(modelId, selectedWidget, engineRef);
        } catch (saveErr) {
          console.warn('[ApiIngestSourceSettings] widget DB save after reset failed:', saveErr);
        }
      }
    } catch (err) {
      const detail = err.response?.data?.detail;
      setConfigError(typeof detail === 'string' ? detail : 'Не удалось сбросить данные API');
      console.warn('[ApiIngestSourceSettings] reset failed:', err);
    } finally {
      setResetting(false);
    }
  };

  const fileColumns = ensureAppendRowIdColumn(
    settings.fileColumns || [],
    ingestMode,
  );
  const selectedColumns = ensureAppendRowIdColumn(
    settings.selectedColumns?.length ? settings.selectedColumns : fileColumns,
    ingestMode,
  );
  const previewRows = settings.previewRows || [];
  const deployStatus = settings.deployStatus || null;
  const deployTone = deployStatusTone(deployStatus);
  const hasData = settings.lastRowCount > 0
    || deployStatus === 'deployed'
    || deployStatus === 'stored'
    || (fileColumns.length > 0 && previewRows.length > 0);
  const statusClassName = {
    ok: styles.apiStatusOk,
    pending: styles.apiStatusPending,
    error: styles.apiStatusError,
    waiting: styles.apiStatusWaiting,
  }[deployTone] || styles.apiStatusWaiting;

  const toggleColumn = (column) => {
    if (ingestMode === 'append' && column === APPEND_ROW_ID_COLUMN) return;
    const current = ensureAppendRowIdColumn(
      settings.selectedColumns || fileColumns,
      ingestMode,
    );
    const next = current.includes(column)
      ? current.filter((c) => c !== column)
      : [...current, column];
    onFieldChange('selectedColumns', ensureAppendRowIdColumn(next, ingestMode));
  };

  return (
    <div className={styles.apiSettings}>
      <div className={styles.fieldGroup}>
        <label className={styles.label}>API-ключ</label>
        <div className={styles.apiKeyRow}>
          <select
            className={styles.select}
            value={settings.apiKeyId || ''}
            onChange={handleKeySelect}
            disabled={loadingKeys || configuring}
          >
            <option value="">— Выберите ключ —</option>
            {ingestKeys.map((key) => (
              <option key={key.id} value={key.id}>
                {key.name} ({key.key_prefix}…)
              </option>
            ))}
          </select>
          <button
            type="button"
            className={`${styles.iconButton}${loadingKeys ? ` ${styles.iconButtonSpinning}` : ''}`}
            onClick={handleRefresh}
            disabled={loadingKeys}
            title="Обновить ключи и статус ingest"
          >
            <ArrowPathIcon style={{ width: '1rem', height: '1rem' }} />
          </button>
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => setShowCreateModal(true)}
            title="Создать ключ"
          >
            <PlusIcon style={{ width: '1rem', height: '1rem' }} />
          </button>
        </div>
        {!loadingKeys && ingestKeys.length === 0 && (
          <p className={styles.infoText}>
            Нет активных ключей с правами ingest. Создайте ключ для этой модели.
          </p>
        )}
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.label}>Имя таблицы</label>
        <input
          type="text"
          className={styles.input}
          value={settings.tableName || ''}
          onChange={(e) => onFieldChange('tableName', e.target.value)}
          onBlur={handleTableNameBlur}
          placeholder={defaultTableName(selectedWidget)}
        />
        <div className={styles.infoText}>
          Имя таблицы в SQLite и в URL ingest для разработчика
        </div>
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.label}>Режим ingest</label>
        <select
          className={styles.select}
          value={ingestMode}
          onChange={handleModeChange}
          disabled={!settings.apiKeyId || configuring}
        >
          <option value="snapshot">snapshot — полная замена</option>
          <option value="stream">stream — delta upsert</option>
          <option value="append">append — история (новая строка)</option>
        </select>
        <div className={styles.infoText}>
          {ingestMode === 'append'
            ? 'Каждый POST добавляет строки; в SQLite появится служебная колонка row_id'
            : 'Режим сохраняется и для таблицы, и для выбранного API-ключа'}
        </div>
      </div>

      {ingestMode === 'stream' && (
        <div className={styles.fieldGroup}>
          <label className={styles.label}>Upsert keys</label>
          <input
            type="text"
            className={styles.input}
            value={upsertKeysDraft}
            onChange={(e) => setUpsertKeysDraft(e.target.value)}
            onBlur={handleUpsertKeysBlur}
            placeholder="например: A или id, code"
            disabled={!settings.apiKeyId || configuring}
          />
          <div className={styles.infoText}>
            Колонки уникального ключа через запятую — должны быть в данных ingest
          </div>
        </div>
      )}

      {configError && (
        <p className={styles.errorText}>{configError}</p>
      )}

      {settings.apiKeyId && tableName && ingestUrl && (
        <div className={styles.apiSetupBlock}>
          <button
            type="button"
            className={styles.apiSetupHeader}
            onClick={() => setSetupExpanded((open) => !open)}
            aria-expanded={setupExpanded}
          >
            <ChevronDownIcon
              style={{ width: '1rem', height: '1rem' }}
              className={setupExpanded ? styles.apiSetupChevron : styles.apiSetupChevronCollapsed}
            />
            <KeyIcon style={{ width: '1rem', height: '1rem' }} />
            <span>Ссылка для настройки</span>
          </button>
          {setupExpanded && (
            <>
              <div className={styles.apiSetupUrlRow}>
                <code className={styles.apiSetupUrl}>{ingestUrl}</code>
                <CopyButton text={ingestUrl} />
              </div>
              <p className={styles.infoText}>
                Передайте разработчику URL и API-ключ (
                {selectedKey?.key_prefix || settings.apiKeyPrefix}
                …). Полный ключ показывается только при создании.
                {' '}
                <a href={docsUrl} target="_blank" rel="noreferrer" className={styles.docsLink}>
                  Документация Developer API
                </a>
                . Запрос принимается сразу (ответ с <code>request_id</code>), запись в SQLite выполняется
                асинхронно через очередь деплоя.
              </p>

              <details className={styles.apiCurlDetails}>
                <summary>Пример CSV (curl)</summary>
                <pre className={styles.apiCurlPre}>{curlExamples?.csv}</pre>
                <CopyButton text={curlExamples?.csv || ''} label="Копировать curl" />
              </details>

              <details className={styles.apiCurlDetails}>
                <summary>Пример JSON — строки (curl)</summary>
                <pre className={styles.apiCurlPre}>{curlExamples?.json}</pre>
                <CopyButton text={curlExamples?.json || ''} label="Копировать curl" />
              </details>

              <details className={styles.apiCurlDetails}>
                <summary>Пример JSON — макет колонок для init (curl)</summary>
                <pre className={styles.apiCurlPre}>{curlExamples?.columnar}</pre>
                <CopyButton text={curlExamples?.columnar || ''} label="Копировать curl" />
              </details>
            </>
          )}
        </div>
      )}

      <div className={styles.apiStatusBlock}>
        <span className={statusClassName}>
          {deployStatusLabel(deployStatus)}
        </span>
        {settings.deployError && (
          <span className={styles.apiStatusError}>{settings.deployError}</span>
        )}
        {settings.lastRequestId != null && (
          <span className={styles.infoText}>
            Последний request_id: {settings.lastRequestId}
          </span>
        )}
        {hasData ? (
          <>
            <span className={styles.apiStatusOk}>
              Получено {settings.lastRowCount ?? previewRows.length} строк, {fileColumns.length} колонок
            </span>
            {settings.lastIngestAt && (
              <span className={styles.infoText}>
                Обновлено: {formatDate(settings.lastIngestAt)}
              </span>
            )}
          </>
        ) : deployStatus === 'failed' ? null : (
          <span className={styles.apiStatusWaiting}>
            {polling && settings.apiKeyId
              ? (deployStatus === 'pending'
                ? 'Данные приняты, выполняется деплой в latest.db…'
                : 'Ожидание данных от разработчика…')
              : 'Выберите ключ и отправьте данные по ссылке'}
          </span>
        )}
        {hasData && (
          <button
            type="button"
            className={styles.apiResetButton}
            onClick={handleResetData}
            disabled={!tableName || resetting || configuring}
            title="Удалить ingest-данные и таблицу в latest.db"
          >
            <TrashIcon style={{ width: '1rem', height: '1rem' }} />
            <span>{resetting ? 'Сброс…' : 'Сбросить данные API'}</span>
          </button>
        )}
      </div>

      {fileColumns.length > 0 && (
        <div className={styles.fieldGroup}>
          <label className={styles.label}>Поля</label>
          <div className={styles.fieldsList}>
            {fileColumns.map((column) => {
              const locked = ingestMode === 'append' && column === APPEND_ROW_ID_COLUMN;
              return (
              <label key={column} className={styles.fieldCheckbox}>
                <input
                  type="checkbox"
                  checked={selectedColumns.includes(column)}
                  disabled={locked}
                  onChange={() => toggleColumn(column)}
                  title={locked ? 'Служебная колонка append — обязательна для схемы' : undefined}
                />
                <span className={styles.fieldName}>
                  {column}
                  {locked ? ' (служебная)' : ''}
                </span>
              </label>
              );
            })}
          </div>
          <div className={styles.infoText}>
            Выбрано: {selectedColumns.length} из {fileColumns.length}
          </div>
        </div>
      )}

      {previewRows.length > 0 && (
        <div className={styles.fieldGroup}>
          <label className={styles.label}>Превью данных</label>
          <div className={styles.apiPreviewTableWrap}>
            <table className={styles.apiPreviewTable}>
              <thead>
                <tr>
                  {fileColumns.map((col) => (
                    <th key={col}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.slice(0, PREVIEW_LIMIT).map((row, idx) => (
                  <tr key={idx}>
                    {fileColumns.map((col) => (
                      <td key={col}>{row[col] != null ? String(row[col]) : ''}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className={styles.fieldGroup}>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={settings.exportGlobal !== false}
            onChange={(e) => onFieldChange('exportGlobal', e.target.checked)}
          />
          <span>Экспортировать (global)</span>
        </label>
        <div className={styles.infoText}>
          Добавляет global к переменной source_table(...) в DataCode — нужно для сборки latest.db
        </div>
      </div>

      <div className={styles.fieldGroup}>
        <DataCodeOpenButton
          onClick={() => onOpenDataCodeEditor?.()}
          disabled={!tableName}
          modified={codeModified}
          onRegenerate={onRegenerateCode}
          title={tableName
            ? 'Открыть редактор DataCode с source_table(...)'
            : 'Сначала укажите имя таблицы'}
        />
      </div>

      {showCreateModal && (
        <CreateApiKeyModal
          modelId={modelId}
          onClose={() => setShowCreateModal(false)}
          onCreated={handleKeyCreated}
        />
      )}
    </div>
  );
};

export default ApiIngestSourceSettings;
