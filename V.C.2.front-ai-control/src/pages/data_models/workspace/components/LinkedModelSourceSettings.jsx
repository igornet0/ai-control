import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../../context/AuthContext';
import { dataModelService } from '../../../../services/dataModelService';
import styles from '../PropertiesPanel.module.css';
import DataCodeOpenButton from './DataCodeOpenButton.jsx';
import { normalizeLinkedTables, safeDcpTableAlias } from '../interactive/linkedModelDataCodeSync.js';

function modelLabel(model, { shared = false } = {}) {
  if (!model) return '';
  const name = model.name || `Модель ${model.id}`;
  if (model.is_public) return `${name} · опубликована`;
  if (shared) return `${name} · доступна вам`;
  return name;
}

function schemaTables(schema) {
  return (schema?.tables || []).filter((t) => t && t.name && !t.skipped && !String(t.name).startsWith('sqlite_'));
}

const LinkedModelSourceSettings = ({
  modelId,
  settings,
  onFieldChange,
  onSettingsChange,
  onOpenDataCodeEditor,
  codeModified = false,
  onRegenerateCode,
}) => {
  const { user } = useAuth();
  const currentUserId = user?.id ?? null;
  const [personal, setPersonal] = useState([]);
  const [shared, setShared] = useState([]);
  const [published, setPublished] = useState([]);
  const [listError, setListError] = useState(null);
  const [listLoading, setListLoading] = useState(false);
  const [schema, setSchema] = useState(null);
  const [schemaError, setSchemaError] = useState(null);
  const [schemaLoading, setSchemaLoading] = useState(false);

  const sourceModelId = settings.sourceModelId != null && settings.sourceModelId !== ''
    ? Number(settings.sourceModelId)
    : null;
  const selected = normalizeLinkedTables(settings);
  const selectedNames = useMemo(() => new Set(selected.map((t) => t.name)), [selected]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setListLoading(true);
      setListError(null);
      try {
        const [mineRes, publicRes] = await Promise.all([
          dataModelService.getDataModels(),
          dataModelService.getPublicDataModels().catch(() => ({ data_models: [] })),
        ]);
        if (cancelled) return;
        const currentId = Number(modelId);
        const mineAll = (mineRes?.data_models || []).filter((m) => Number(m.id) !== currentId);
        const publicAll = (publicRes?.data_models || []).filter((m) => Number(m.id) !== currentId);
        const owned = currentUserId != null
          ? mineAll.filter((m) => Number(m.owner_id) === Number(currentUserId))
          : mineAll.filter((m) => !m.is_public);
        const ownedIds = new Set(owned.map((m) => Number(m.id)));
        const publishedOnly = publicAll.filter((m) => !ownedIds.has(Number(m.id)));
        const publishedIds = new Set(publishedOnly.map((m) => Number(m.id)));
        const sharedOnly = mineAll.filter((m) => {
          const id = Number(m.id);
          return !ownedIds.has(id) && !publishedIds.has(id);
        });
        setPersonal(owned);
        setShared(sharedOnly);
        setPublished(publishedOnly);
      } catch (err) {
        if (!cancelled) setListError(err?.message || 'Не удалось загрузить список моделей');
      } finally {
        if (!cancelled) setListLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [modelId, currentUserId]);

  const loadSchema = useCallback(async (id) => {
    if (!id) {
      setSchema(null);
      setSchemaError(null);
      return;
    }
    setSchemaLoading(true);
    setSchemaError(null);
    try {
      const data = await dataModelService.getModelSqliteSchema(id, null, {
        includeRowCount: true,
      });
      setSchema(data);
    } catch (err) {
      const status = err?.response?.status;
      setSchema(null);
      setSchemaError(
        status === 404
          ? 'У выбранной модели нет скомпилированной SQLite. Сначала скомпилируйте её.'
          : (err?.response?.data?.detail || err?.message || 'Не удалось прочитать схему модели'),
      );
    } finally {
      setSchemaLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSchema(sourceModelId);
  }, [sourceModelId, loadSchema]);

  const applySettings = (next) => {
    onSettingsChange(next);
    window.setTimeout(() => {
      onRegenerateCode?.();
    }, 0);
  };

  const handleModelChange = (rawId) => {
    const nextId = rawId ? Number(rawId) : null;
    const all = [...personal, ...shared, ...published];
    const found = all.find((m) => Number(m.id) === nextId);
    applySettings({
      ...settings,
      sourceModelId: nextId,
      sourceModelName: found?.name || '',
      sourceModelIsPublic: Boolean(found?.is_public),
      selectedTables: [],
      name: found?.name ? `Модель: ${found.name}` : (settings.name || 'Модель данных'),
    });
  };

  const toggleTable = (table) => {
    const name = table.name;
    const columns = (table.columns || []).map((c) => c.name || c).filter(Boolean);
    const exists = selected.find((t) => t.name === name);
    const nextTables = exists
      ? selected.filter((t) => t.name !== name)
      : [...selected, { name, alias: safeDcpTableAlias(name, name), columns }];
    applySettings({
      ...settings,
      selectedTables: nextTables,
    });
  };

  const selectAll = () => {
    const tables = schemaTables(schema).map((table) => ({
      name: table.name,
      alias: safeDcpTableAlias(table.name, table.name),
      columns: (table.columns || []).map((c) => c.name || c).filter(Boolean),
    }));
    applySettings({ ...settings, selectedTables: tables });
  };

  const clearAll = () => {
    applySettings({ ...settings, selectedTables: [] });
  };

  const tables = schemaTables(schema);

  return (
    <div className={styles.settingsContent}>
      <h3 className={styles.sectionTitle}>Модель данных</h3>
      <p className={styles.filterHint}>
        Подключите скомпилированные таблицы из другой модели. Компиляция текущей модели
        не требует этого виджета — он только импортирует чужие таблицы как <code>source_table</code>.
      </p>

      <div className={styles.fieldGroup}>
        <label className={styles.label}>Название</label>
        <input
          type="text"
          className={styles.input}
          value={settings.name || ''}
          onChange={(e) => onFieldChange('name', e.target.value)}
          placeholder="Модель данных"
        />
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.label}>Исходная модель</label>
        <select
          className={styles.select}
          value={sourceModelId || ''}
          onChange={(e) => handleModelChange(e.target.value)}
          disabled={listLoading}
        >
          <option value="">— Выберите модель —</option>
          {personal.length > 0 && (
            <optgroup label="Личные">
              {personal.map((m) => (
                <option key={`p-${m.id}`} value={m.id}>{modelLabel(m)}</option>
              ))}
            </optgroup>
          )}
          {shared.length > 0 && (
            <optgroup label="Доступные мне">
              {shared.map((m) => (
                <option key={`s-${m.id}`} value={m.id}>{modelLabel(m, { shared: true })}</option>
              ))}
            </optgroup>
          )}
          {published.length > 0 && (
            <optgroup label="Опубликованные">
              {published.map((m) => (
                <option key={`pub-${m.id}`} value={m.id}>{modelLabel(m)}</option>
              ))}
            </optgroup>
          )}
        </select>
        {listLoading && <div className={styles.filterHint}>Загрузка списка моделей…</div>}
        {listError && <div className={styles.errorText}>{listError}</div>}
      </div>

      {sourceModelId ? (
        <div className={styles.fieldGroup}>
          <label className={styles.label}>Таблицы</label>
          {schemaLoading && <div className={styles.filterHint}>Чтение схемы…</div>}
          {schemaError && <div className={styles.errorText}>{schemaError}</div>}
          {!schemaLoading && !schemaError && tables.length === 0 && (
            <div className={styles.filterHint}>В скомпилированной БД нет таблиц.</div>
          )}
          {tables.length > 0 && (
            <>
              <div className={styles.linkedTableActions}>
                <button type="button" className={styles.addButton} onClick={selectAll}>Выбрать все</button>
                <button type="button" className={styles.addButton} onClick={clearAll}>Снять все</button>
              </div>
              <div className={styles.fieldsList}>
                {tables.map((table) => (
                  <label key={table.name} className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={selectedNames.has(table.name)}
                      onChange={() => toggleTable(table)}
                    />
                    <span>
                      {table.name}
                      {safeDcpTableAlias(table.name, table.name) !== table.name
                        ? ` → ${safeDcpTableAlias(table.name, table.name)}`
                        : ''}
                      {table.row_count != null ? ` · ${table.row_count}` : ''}
                    </span>
                  </label>
                ))}
              </div>
              {selected.some((t) => t.name === 'assets') && (
                <div className={styles.filterHint}>
                  Таблица <code>assets</code> в DCP занята вложениями, поэтому импортируется как{' '}
                  <code>linked_assets</code>.
                </div>
              )}
            </>
          )}
        </div>
      ) : null}

      <div className={styles.fieldGroup}>
        <DataCodeOpenButton
          onClick={() => onOpenDataCodeEditor?.()}
          modified={codeModified}
          onRegenerate={onRegenerateCode}
        />
      </div>
    </div>
  );
};

export default LinkedModelSourceSettings;
