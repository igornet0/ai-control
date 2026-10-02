import React, { useEffect, useRef, useState } from 'react';
import { DocumentTextIcon } from '@heroicons/react/24/outline';
import api from '../../../../services/api';
import styles from '../PropertiesPanel.module.css';
import DataCodeOpenButton from './DataCodeOpenButton.jsx';

/**
 * Settings panel for DataBridge data-source widgets.
 */
export default function DataBridgeSourceSettings({
  settings,
  onFieldChange,
  onSettingsChange,
  onOpenDataCodeEditor,
  codeModified = false,
  onRegenerateCode,
}) {
  const [entities, setEntities] = useState([]);
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const lastLoadedEntityRef = useRef('');

  const entity = settings?.databridgeEntity || '';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get('/api/databridge/entities');
        if (!cancelled) {
          setEntities(res.data?.entities || []);
        }
      } catch (err) {
        if (!cancelled) {
          const detail = err?.response?.data?.detail;
          setError(
            (typeof detail === 'object' && detail?.message)
            || (typeof detail === 'string' ? detail : null)
            || 'DataBridge недоступен. Включите сущности в админ-панели.',
          );
          setEntities([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!entity) {
      setFields([]);
      lastLoadedEntityRef.current = '';
      return undefined;
    }
    if (lastLoadedEntityRef.current === entity && fields.length) {
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get(`/api/databridge/entities/${entity}/schema`);
        if (cancelled) return;
        const nextFields = (res.data?.fields || []).map((f) => f.name);
        const tableName = res.data?.table_name;
        setFields(nextFields);
        lastLoadedEntityRef.current = entity;
        const selected = settings.selectedColumns?.length
          ? settings.selectedColumns.filter((c) => nextFields.includes(c))
          : nextFields;
        onSettingsChange?.({
          ...settings,
          sourceType: 'databridge',
          databridgeEntity: entity,
          tableName: tableName || settings.tableName,
          fileColumns: nextFields,
          selectedColumns: selected.length ? selected : nextFields,
          name: settings.name && settings.name !== 'Источник данных'
            ? settings.name
            : (res.data?.label || entity),
        });
      } catch (err) {
        if (!cancelled) {
          setFields([]);
          const detail = err?.response?.data?.detail;
          setError(
            (typeof detail === 'object' && detail?.message)
            || 'Не удалось загрузить схему entity',
          );
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity]);

  const toggleColumn = (col) => {
    const current = settings.selectedColumns?.length
      ? settings.selectedColumns
      : fields;
    const next = current.includes(col)
      ? current.filter((c) => c !== col)
      : [...current, col];
    onSettingsChange?.({
      ...settings,
      sourceType: 'databridge',
      selectedColumns: next,
      fileColumns: fields,
    });
  };

  return (
    <div>
      <div className={styles.fieldGroup}>
        <label className={styles.label}>Entity DataBridge</label>
        {loading && (
          <div style={{ fontSize: '0.8rem', color: '#9CA3AF' }}>
            Загрузка доступных сущностей…
          </div>
        )}
        {error && (
          <div style={{ fontSize: '0.8rem', color: '#F87171' }}>{String(error)}</div>
        )}
        {!loading && !error && entities.length === 0 && (
          <div style={{ fontSize: '0.8rem', color: '#9CA3AF', marginBottom: '0.5rem' }}>
            Нет доступных сущностей DataBridge. Включите их в админ-панели
            или запросите доступ у администратора.
          </div>
        )}
        <select
          className={styles.select}
          value={entity}
          onChange={(e) => onFieldChange('databridgeEntity', e.target.value)}
        >
          <option value="">— Выберите entity —</option>
          {entities.map((item) => (
            <option key={item.name} value={item.name}>
              {item.label || item.name}
            </option>
          ))}
        </select>
      </div>

      {entity && fields.length > 0 && (
        <div className={styles.fieldGroup}>
          <label className={styles.label}>Поля (projection)</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {fields.map((col) => {
              const checked = (settings.selectedColumns?.length
                ? settings.selectedColumns
                : fields).includes(col);
              return (
                <label
                  key={col}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.85rem',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleColumn(col)}
                  />
                  <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{col}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      <div className={styles.fieldGroup} style={{ marginTop: '0.75rem' }}>
        <DataCodeOpenButton
          onClick={() => onOpenDataCodeEditor?.()}
          modified={codeModified}
          onRegenerate={onRegenerateCode}
        />
      </div>
    </div>
  );
}
