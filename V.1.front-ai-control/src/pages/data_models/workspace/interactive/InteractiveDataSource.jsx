import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import {
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import TableEditor from './TableEditor.jsx';
import VariableEditor from './VariableEditor.jsx';
import {
  TABLE_TEMPLATES,
  createDefaultInteractiveConfig,
  createField,
  generateMockRows,
  normalizeInteractiveConfig,
  parsePastedTable,
} from './schema.js';
import {
  generateDataCodeFromConfig,
  parseDataCodeToConfig,
  validateConfigTypes,
} from './dataCodeSync.js';
import { useInteractiveHistory } from './useInteractiveHistory.js';
import styles from './InteractiveDataSource.module.css';
import DataCodeOpenButton from '../components/DataCodeOpenButton.jsx';

export default function InteractiveDataSource({
  settings,
  modelId,
  widgetId,
  savedCode = '',
  onConfigChange,
  onOpenDataCodeEditor,
  codeModified = false,
  onRegenerateCode,
}) {
  const initialConfig = useMemo(() => {
    if (settings.interactiveConfig) {
      return normalizeInteractiveConfig(settings.interactiveConfig);
    }
    const parsed = parseDataCodeToConfig(savedCode);
    return parsed ? normalizeInteractiveConfig(parsed) : createDefaultInteractiveConfig('table');
  }, [settings.interactiveConfig, savedCode]);

  const {
    state: config,
    pushState: setConfig,
    replaceState,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useInteractiveHistory(initialConfig);

  const fileInputRef = useRef(null);
  const syncedRef = useRef(false);
  const codeLoadedRef = useRef(false);
  const onConfigChangeRef = useRef(onConfigChange);
  const onOpenDataCodeEditorRef = useRef(onOpenDataCodeEditor);

  useEffect(() => {
    onConfigChangeRef.current = onConfigChange;
  }, [onConfigChange]);

  useEffect(() => {
    onOpenDataCodeEditorRef.current = onOpenDataCodeEditor;
  }, [onOpenDataCodeEditor]);

  useEffect(() => {
    if (!savedCode?.trim() || codeLoadedRef.current || settings.interactiveConfig) return;
    const parsed = parseDataCodeToConfig(savedCode);
    if (parsed) {
      replaceState(normalizeInteractiveConfig(parsed));
      codeLoadedRef.current = true;
    }
  }, [savedCode, settings.interactiveConfig, replaceState]);

  const { errors: genErrors } = useMemo(
    () => generateDataCodeFromConfig(config),
    [config]
  );
  const typeWarnings = useMemo(() => validateConfigTypes(config), [config]);
  const allErrors = [...genErrors];

  useEffect(() => {
    if (syncedRef.current) {
      onConfigChangeRef.current?.({ interactiveConfig: config });
    } else {
      syncedRef.current = true;
    }
  }, [config]);

  useEffect(() => {
    const handler = (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        redo();
      } else if (e.key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  const setKind = (kind) => {
    setConfig(createDefaultInteractiveConfig(kind));
  };

  const applyTemplate = (key) => {
    const tpl = TABLE_TEMPLATES[key];
    if (!tpl) return;
    setConfig({
      kind: 'table',
      table: {
        name: tpl.name,
        fields: tpl.fields.map((f) => createField(f)),
        rows: tpl.rows.map((r) => [...r]),
      },
    });
  };

  const handleImportFile = useCallback(
    async (file) => {
      if (!file || config.kind !== 'table') return;
      const ext = file.name.split('.').pop()?.toLowerCase();

      if (ext === 'csv') {
        Papa.parse(file, {
          complete: (result) => {
            const data = result.data.filter((row) => row.some((c) => c !== ''));
            if (data.length === 0) return;
            const headers = data[0].map((h, i) => String(h || `col_${i + 1}`).trim());
            const rows = data.slice(1);
            const fields = headers.map((name) => createField({ name, type: 'string' }));
            setConfig((prev) => ({
              ...prev,
              kind: 'table',
              table: {
                ...prev.table,
                name: prev.table?.name || 'imported_table',
                fields,
                rows: rows.map((r) => {
                  const row = [...r];
                  while (row.length < fields.length) row.push('');
                  return row.slice(0, fields.length);
                }),
              },
            }));
          },
        });
        return;
      }

      if (ext === 'xlsx' || ext === 'xls') {
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        if (!data.length) return;
        const headers = data[0].map((h, i) => String(h || `col_${i + 1}`).trim());
        const fields = headers.map((name) => createField({ name, type: 'string' }));
        const rows = data.slice(1);
        setConfig((prev) => ({
          ...prev,
          kind: 'table',
          table: {
            ...prev.table,
            name: prev.table?.name || 'imported_table',
            fields,
            rows: rows.map((r) => {
              const row = [...r];
              while (row.length < fields.length) row.push('');
              return row.slice(0, fields.length);
            }),
          },
        }));
      }
    },
    [config.kind, setConfig]
  );

  const handlePasteImport = () => {
    if (config.kind !== 'table') return;
    const text = window.prompt('Вставьте данные (CSV или TSV):');
    if (!text?.trim()) return;
    const lines = text.trim().split(/\r?\n/);
    const headers = lines[0].includes('\t')
      ? lines[0].split('\t')
      : lines[0].split(',');
    const fields = headers.map((h, i) =>
      createField({ name: String(h || `col_${i + 1}`).trim(), type: 'string' })
    );
    const rows = parsePastedTable(lines.slice(1).join('\n') || text, fields.length);
    setConfig((prev) => ({
      ...prev,
      table: { ...prev.table, fields, rows },
    }));
  };

  const generateMock = () => {
    if (config.kind !== 'table') return;
    const rows = generateMockRows(config.table.fields, 8);
    setConfig((prev) => ({
      ...prev,
      table: { ...prev.table, rows },
    }));
  };

  return (
    <div className={styles.interactiveRoot}>
      <div className={styles.toolbar}>
        <div className={styles.kindToggle}>
          <button
            type="button"
            className={config.kind === 'table' ? styles.kindBtnActive : styles.kindBtn}
            onClick={() => setKind('table')}
          >
            Таблица
          </button>
          <button
            type="button"
            className={config.kind === 'variable' ? styles.kindBtnActive : styles.kindBtn}
            onClick={() => setKind('variable')}
          >
            Переменная
          </button>
        </div>
        <div className={styles.toolbarActions}>
          <button type="button" className={styles.ghostBtn} onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
            <ArrowUturnLeftIcon className={styles.iconSm} />
          </button>
          <button type="button" className={styles.ghostBtn} onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">
            <ArrowUturnRightIcon className={styles.iconSm} />
          </button>
        </div>
      </div>

      {config.kind === 'table' && (
        <div className={styles.templateRow}>
          <span className={styles.templateLabel}>Шаблоны:</span>
          {Object.entries(TABLE_TEMPLATES).map(([key, tpl]) => (
            <button key={key} type="button" className={styles.templateBtn} onClick={() => applyTemplate(key)}>
              {tpl.label}
            </button>
          ))}
        </div>
      )}

      {config.kind === 'table' && (
        <div className={styles.importRow}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImportFile(f);
              e.target.value = '';
            }}
          />
          <button type="button" className={styles.ghostBtn} onClick={() => fileInputRef.current?.click()}>
            Импорт CSV/XLSX
          </button>
          <button type="button" className={styles.ghostBtn} onClick={handlePasteImport}>
            Из текста
          </button>
          <button type="button" className={styles.ghostBtn} onClick={generateMock}>
            <SparklesIcon className={styles.iconSm} /> Mock данные
          </button>
        </div>
      )}

      <div className={styles.editorArea}>
        {config.kind === 'table' ? (
          <TableEditor
            table={config.table}
            onChange={(table) => setConfig((prev) => ({ ...prev, table }))}
            modelId={modelId}
          />
        ) : (
          <VariableEditor
            variable={config.variable}
            onChange={(patch) =>
              setConfig((prev) => ({
                ...prev,
                variable: { ...prev.variable, ...patch },
              }))
            }
          />
        )}
      </div>

      {(allErrors.length > 0 || typeWarnings.length > 0) && (
        <div className={styles.validationList}>
          {allErrors.map((msg, i) => (
            <div key={`e-${i}`} className={styles.validationError}>{msg}</div>
          ))}
          {typeWarnings.map((msg, i) => (
            <div key={`w-${i}`} className={styles.validationWarning}>{msg}</div>
          ))}
        </div>
      )}

      <div className={styles.datacodeRow}>
        <DataCodeOpenButton
          onClick={() => onOpenDataCodeEditorRef.current?.()}
          modified={codeModified}
          onRegenerate={onRegenerateCode}
        />
      </div>

      {modelId && widgetId && (
        <div className={styles.autosaveHint}>
          DataCode меняется только вручную в редакторе или кнопкой «Перегенерировать»
        </div>
      )}
    </div>
  );
}
