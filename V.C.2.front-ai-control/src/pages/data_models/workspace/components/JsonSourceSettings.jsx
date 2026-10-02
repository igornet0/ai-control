import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DocumentTextIcon } from '@heroicons/react/24/outline';
import {
  ensureJsonTableName,
  parseJsonTextToTable,
} from '../interactive/jsonSourceDataCodeSync.js';
import { defaultTableName, sanitizeTableName } from '../apiIngestSourceUtils.js';
import styles from '../PropertiesPanel.module.css';
import DataCodeOpenButton from './DataCodeOpenButton.jsx';

const SOURCE_OPTIONS = [
  { value: 'local', label: 'Локальный файл' },
  { value: 'smb', label: 'SMB' },
  { value: 'url', label: 'URL' },
  { value: 'inline', label: 'Встроенный JSON' },
];

const JsonSourceSettings = ({
  settings,
  selectedWidget,
  smbConnections = [],
  onFieldChange,
  onSettingsChange,
  onOpenDataCodeEditor,
  onOpenSmbBrowser,
  codeModified = false,
  onRegenerateCode,
}) => {
  const fileInputRef = useRef(null);
  const [parseError, setParseError] = useState(null);
  const [urlLoading, setUrlLoading] = useState(false);

  const jsonSourceType = settings.jsonSourceType || 'local';
  const tableName = sanitizeTableName(
    settings.tableName || ensureJsonTableName(settings, selectedWidget),
  );
  const fileColumns = settings.fileColumns || [];
  const selectedColumns = settings.selectedColumns?.length
    ? settings.selectedColumns
    : fileColumns;
  const previewRows = settings.previewRows || [];

  useEffect(() => {
    if (!settings.tableName && selectedWidget) {
      const next = defaultTableName(selectedWidget);
      if (next) onFieldChange('tableName', next);
    }
  }, [settings.tableName, selectedWidget, onFieldChange]);

  const applyParsedTable = (parsed, extra = {}) => {
    if (parsed.error) {
      setParseError(parsed.error);
      return;
    }
    setParseError(null);
    const cols = parsed.columns || [];
    onSettingsChange({
      ...settings,
      ...extra,
      fileColumns: cols,
      selectedColumns: cols,
      previewRows: parsed.rows || [],
      tableName: sanitizeTableName(settings.tableName || ensureJsonTableName(settings, selectedWidget)),
      exportGlobal: settings.exportGlobal !== false,
    });
  };

  const handleSourceTypeChange = (value) => {
    onSettingsChange({
      ...settings,
      jsonSourceType: value,
      fileDeliveryMode: value === 'smb' ? 'smb' : value === 'local' ? 'local' : settings.fileDeliveryMode,
      selectedFile: value === 'local' ? settings.selectedFile : null,
      jsonData: value === 'inline' ? (settings.jsonData || '') : settings.jsonData,
      sourcePath: value === 'url' ? (settings.sourcePath || '') : settings.sourcePath,
      fileColumns: [],
      selectedColumns: [],
      previewRows: [],
    });
    setParseError(null);
  };

  const handleLocalFile = async (file) => {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseJsonTextToTable(text);
      applyParsedTable(parsed, {
        jsonSourceType: 'local',
        fileDeliveryMode: 'local',
        selectedFile: {
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified,
          file,
        },
        sourcePath: file.name,
      });
    } catch (err) {
      setParseError(err.message || 'Не удалось прочитать файл');
    }
  };

  const handleInlineBlur = () => {
    if (jsonSourceType !== 'inline') return;
    const parsed = parseJsonTextToTable(settings.jsonData || '');
    applyParsedTable(parsed, { jsonSourceType: 'inline' });
  };

  const handleFetchUrl = async () => {
    const url = (settings.sourcePath || '').trim();
    if (!url) {
      setParseError('Укажите URL');
      return;
    }
    setUrlLoading(true);
    setParseError(null);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const parsed = parseJsonTextToTable(text);
      applyParsedTable(parsed, {
        jsonSourceType: 'url',
        sourcePath: url,
      });
    } catch (err) {
      setParseError(
        `Не удалось загрузить URL (возможно CORS). Колонки можно задать вручную; при компиляции backend скачает JSON. ${err.message || ''}`,
      );
    } finally {
      setUrlLoading(false);
    }
  };

  const toggleColumn = (column) => {
    const current = settings.selectedColumns || fileColumns;
    const next = current.includes(column)
      ? current.filter((c) => c !== column)
      : [...current, column];
    onFieldChange('selectedColumns', next);
  };

  const canOpenDataCode = Boolean(tableName && (selectedColumns.length || fileColumns.length));

  const selectedFileLabel = useMemo(() => {
    if (settings.selectedFile?.name) return settings.selectedFile.name;
    if (settings.sourcePath && jsonSourceType === 'local') return settings.sourcePath;
    return null;
  }, [settings.selectedFile, settings.sourcePath, jsonSourceType]);

  return (
    <div className={styles.databaseSettings}>
      <div className={styles.fieldGroup}>
        <label className={styles.label}>Способ загрузки</label>
        <select
          className={styles.select}
          value={jsonSourceType}
          onChange={(e) => handleSourceTypeChange(e.target.value)}
        >
          {SOURCE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.label}>Имя таблицы (source_table)</label>
        <input
          type="text"
          className={styles.input}
          value={settings.tableName || tableName}
          onChange={(e) => onFieldChange('tableName', e.target.value)}
          onBlur={(e) => onFieldChange('tableName', sanitizeTableName(e.target.value))}
          placeholder={defaultTableName(selectedWidget)}
        />
        <div className={styles.infoText}>
          В DataCode: source_table(&quot;{tableName}&quot;, …) — таблица попадёт в DCP при компиляции
        </div>
      </div>

      {jsonSourceType === 'local' && (
        <div className={styles.fieldGroup}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleLocalFile(file);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            className={styles.browseButton}
            onClick={() => fileInputRef.current?.click()}
          >
            Выбрать JSON файл
          </button>
          {selectedFileLabel ? (
            <div className={styles.infoText}>
              Файл: {selectedFileLabel}
              {!settings.selectedFile?.file && (
                <span> — при повторном входе загрузите файл снова (хранится только в кеше сессии)</span>
              )}
            </div>
          ) : (
            <div className={styles.infoText}>
              Локальный файл не сохраняется на сервере — нужен повторный выбор при компиляции
            </div>
          )}
        </div>
      )}

      {jsonSourceType === 'smb' && (
        <>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>SMB-подключение</label>
            <select
              className={styles.select}
              value={settings.smbConnectionId || ''}
              onChange={(e) => onFieldChange(
                'smbConnectionId',
                e.target.value ? Number(e.target.value) : null,
              )}
            >
              <option value="">— Выберите —</option>
              {smbConnections.map((c) => (
                <option key={c.id} value={c.id}>{c.name || `SMB #${c.id}`}</option>
              ))}
            </select>
          </div>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Путь к JSON</label>
            <div className={styles.apiKeyRow}>
              <input
                type="text"
                className={styles.input}
                value={settings.smbSharePath || ''}
                onChange={(e) => onFieldChange('smbSharePath', e.target.value)}
                placeholder="folder/data.json"
              />
              <button
                type="button"
                className={styles.browseButton}
                onClick={() => onOpenSmbBrowser?.()}
                disabled={!settings.smbConnectionId}
              >
                Обзор
              </button>
            </div>
            <div className={styles.infoText}>
              При компиляции backend скачает файл с SMB и положит таблицу в DCP
            </div>
          </div>
        </>
      )}

      {jsonSourceType === 'url' && (
        <div className={styles.fieldGroup}>
          <label className={styles.label}>URL JSON</label>
          <div className={styles.apiKeyRow}>
            <input
              type="text"
              className={styles.input}
              value={settings.sourcePath || ''}
              onChange={(e) => onFieldChange('sourcePath', e.target.value)}
              placeholder="https://example.com/data.json"
            />
            <button
              type="button"
              className={styles.browseButton}
              onClick={() => void handleFetchUrl()}
              disabled={urlLoading}
            >
              {urlLoading ? 'Загрузка…' : 'Превью'}
            </button>
          </div>
          <div className={styles.infoText}>
            При компиляции backend скачает JSON по URL
          </div>
        </div>
      )}

      {jsonSourceType === 'inline' && (
        <div className={styles.fieldGroup}>
          <label className={styles.label}>JSON</label>
          <textarea
            className={styles.textarea}
            value={settings.jsonData || ''}
            onChange={(e) => onFieldChange('jsonData', e.target.value)}
            onBlur={handleInlineBlur}
            placeholder='[{"id": 1, "name": "Alice"}]'
            rows={8}
          />
        </div>
      )}

      {parseError && (
        <p className={styles.errorText}>{parseError}</p>
      )}

      {fileColumns.length > 0 && (
        <div className={styles.fieldGroup}>
          <label className={styles.label}>Поля</label>
          <div className={styles.fieldsList}>
            {fileColumns.map((column) => (
              <label key={column} className={styles.fieldCheckbox}>
                <input
                  type="checkbox"
                  checked={selectedColumns.includes(column)}
                  onChange={() => toggleColumn(column)}
                />
                <span className={styles.fieldName}>{column}</span>
              </label>
            ))}
          </div>
          <div className={styles.infoText}>
            Выбрано: {selectedColumns.length} из {fileColumns.length}
          </div>
        </div>
      )}

      {previewRows.length > 0 && (
        <div className={styles.fieldGroup}>
          <label className={styles.label}>Превью</label>
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
                {previewRows.slice(0, 10).map((row, idx) => (
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
      </div>

      <div className={styles.fieldGroup}>
        <DataCodeOpenButton
          onClick={() => onOpenDataCodeEditor?.()}
          disabled={!canOpenDataCode}
          modified={codeModified}
          onRegenerate={onRegenerateCode}
          title={canOpenDataCode
            ? 'Открыть DataCode с source_table(...)'
            : 'Сначала укажите таблицу и колонки'}
        />
      </div>
    </div>
  );
};

export default JsonSourceSettings;
