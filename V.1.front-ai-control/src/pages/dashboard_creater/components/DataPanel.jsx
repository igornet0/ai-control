import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  getDashboardSchema,
  invalidateDashboardSchema,
  DATA_FIELD_DRAG_MIME,
} from '../../../services/dashboardSqliteSchemaService';
import { applyDataFieldToWidget } from '../../../services/dashboardFilterUtils.js';
import { eventBus } from '../src/core/EventBus.js';
import DataPanelVariablesModal from './DataPanelVariablesModal.jsx';

const DEBOUNCE_MS = 150;

function VariablesIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 6h10" />
      <path d="M4 12h7" />
      <path d="M4 18h10" />
      <path d="M17 4v6" />
      <path d="M20 7h-6" />
      <circle cx="17" cy="17" r="3" />
    </svg>
  );
}

function safeDomId(raw) {
  return String(raw || '').replace(/[^a-zA-Z0-9_-]/g, '_');
}

/**
 * Панель «Данные»: модели → таблицы → поля, поиск, drag на виджет.
 */
export default function DataPanel({
  dashboardId,
  enabled = true,
  coarsePointer = false,
  canEdit = true,
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tables, setTables] = useState([]);
  const [fields, setFields] = useState([]);
  const [modelsMeta, setModelsMeta] = useState([]);
  const [searchInput, setSearchInput] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [expandedModelIds, setExpandedModelIds] = useState(() => new Set());
  const [expandedTableIds, setExpandedTableIds] = useState(() => new Set());
  const [modelsInitialized, setModelsInitialized] = useState(false);
  const [pendingBind, setPendingBind] = useState(null);
  const [varsOpen, setVarsOpen] = useState(false);
  const pendingBindRef = useRef(null);
  pendingBindRef.current = pendingBind;

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(searchInput), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setModelsInitialized(false);
    setExpandedModelIds(new Set());
    setExpandedTableIds(new Set());
  }, [dashboardId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!enabled || !dashboardId) {
        setLoading(false);
        setTables([]);
        setFields([]);
        setModelsMeta([]);
        setError(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        invalidateDashboardSchema(dashboardId);
        const { tables: t, fields: f, models: m } = await getDashboardSchema(dashboardId);
        if (!cancelled) {
          setTables(t);
          setFields(f);
          setModelsMeta(Array.isArray(m) ? m : []);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || 'Не удалось загрузить схему');
          setTables([]);
          setFields([]);
          setModelsMeta([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dashboardId, enabled]);

  const visibleFields = useMemo(() => {
    const q = (searchDebounced || '').trim().toLowerCase();
    if (!q) return fields;
    return fields.filter((field) => {
      return (
        (field.name || '').toLowerCase().includes(q) ||
        (field.tableName || '').toLowerCase().includes(q) ||
        (field.modelName || '').toLowerCase().includes(q)
      );
    });
  }, [fields, searchDebounced]);

  const modelGroups = useMemo(() => {
    const byTable = new Map();
    for (const field of visibleFields) {
      const id = field.tableId || `${field.modelId}::${field.tableName}`;
      if (!byTable.has(id)) {
        const meta = tables.find((t) => t.id === id);
        byTable.set(id, {
          tableId: id,
          tableName: field.tableName || meta?.tableName || 'Таблица',
          modelId: field.modelId ?? meta?.modelId ?? '',
          modelName: field.modelName || meta?.modelName || 'Модель',
          fields: [],
        });
      }
      byTable.get(id).fields.push(field);
    }
    for (const table of tables) {
      if (byTable.has(table.id)) continue;
      const q = (searchDebounced || '').trim().toLowerCase();
      if (q) {
        const hay = `${table.modelName || ''} ${table.tableName || ''}`.toLowerCase();
        if (!hay.includes(q)) continue;
      }
      byTable.set(table.id, {
        tableId: table.id,
        tableName: table.tableName || 'Таблица',
        modelId: table.modelId ?? '',
        modelName: table.modelName || 'Модель',
        fields: [],
      });
    }
    const tableOrder = new Map(tables.map((t, i) => [t.id, i]));
    const byModel = new Map();
    const seedModel = (modelId, modelName, extra = {}) => {
      const modelKey = String(modelId || modelName || 'model');
      if (!byModel.has(modelKey)) {
        byModel.set(modelKey, {
          modelId: modelKey,
          modelName: modelName || 'Модель',
          tables: [],
          schemaOk: extra.schemaOk,
          schemaError: extra.schemaError || null,
        });
      }
      return byModel.get(modelKey);
    };
    for (const meta of modelsMeta) {
      seedModel(meta.id, meta.name, {
        schemaOk: meta.schemaOk,
        schemaError: meta.schemaError,
      });
    }
    for (const table of byTable.values()) {
      const group = seedModel(table.modelId, table.modelName);
      group.tables.push(table);
    }
    const modelOrder = new Map();
    modelsMeta.forEach((m, i) => {
      const key = String(m.id ?? m.name ?? '');
      if (key && !modelOrder.has(key)) modelOrder.set(key, i);
    });
    tables.forEach((t, i) => {
      const key = String(t.modelId ?? t.modelName ?? '');
      if (!modelOrder.has(key)) modelOrder.set(key, modelsMeta.length + i);
    });
    const models = [...byModel.values()].sort(
      (a, b) => (modelOrder.get(a.modelId) ?? 1e9) - (modelOrder.get(b.modelId) ?? 1e9),
    );
    models.forEach((m) => {
      m.tables.sort((a, b) => (tableOrder.get(a.tableId) ?? 1e9) - (tableOrder.get(b.tableId) ?? 1e9));
      m.fieldCount = m.tables.reduce((n, t) => n + t.fields.length, 0);
    });
    return models;
  }, [visibleFields, tables, modelsMeta, searchDebounced]);

  useEffect(() => {
    if (modelsInitialized || !modelGroups.length) return;
    setExpandedModelIds(new Set(modelGroups.map((m) => m.modelId)));
    setModelsInitialized(true);
  }, [modelGroups, modelsInitialized]);

  const searchActive = Boolean((searchDebounced || '').trim());

  const isModelExpanded = useCallback(
    (modelId) => {
      if (searchActive) return true;
      return expandedModelIds.has(modelId);
    },
    [expandedModelIds, searchActive],
  );

  const isTableExpanded = useCallback(
    (tableId) => {
      if (searchActive) return true;
      return expandedTableIds.has(tableId);
    },
    [expandedTableIds, searchActive],
  );

  const toggleModel = useCallback((modelId) => {
    setExpandedModelIds((prev) => {
      const next = new Set(prev);
      if (next.has(modelId)) next.delete(modelId);
      else next.add(modelId);
      return next;
    });
  }, []);

  const toggleTable = useCallback((tableId) => {
    setExpandedTableIds((prev) => {
      const next = new Set(prev);
      if (next.has(tableId)) next.delete(tableId);
      else next.add(tableId);
      return next;
    });
  }, []);

  const tableDragJustEndedRef = useRef(false);

  const onDragStart = useCallback((field, e) => {
    const payload = {
      modelId: field.modelId,
      tableName: field.tableName,
      fieldName: field.name,
      type: field.type,
    };
    try {
      e.dataTransfer.setData(DATA_FIELD_DRAG_MIME, JSON.stringify(payload));
      e.dataTransfer.setData('text/plain', `${field.tableName}.${field.name}`);
      e.dataTransfer.effectAllowed = 'copy';
    } catch {
      /* ignore */
    }
    e.currentTarget.classList.add('data-field-item--dragging');
  }, []);

  const onDragEnd = useCallback((e) => {
    e.currentTarget.classList.remove('data-field-item--dragging');
  }, []);

  const tablePayload = useCallback((group) => ({
    kind: 'table',
    modelId: group.modelId,
    tableName: group.tableName,
    fields: (group.fields || []).map((f) => ({
      name: f.name,
      type: f.type,
    })),
  }), []);

  const onTableDragStart = useCallback((group, e) => {
    if (!group?.fields?.length) {
      e.preventDefault();
      return;
    }
    const payload = tablePayload(group);
    try {
      e.dataTransfer.setData(DATA_FIELD_DRAG_MIME, JSON.stringify(payload));
      e.dataTransfer.setData('text/plain', group.tableName);
      e.dataTransfer.effectAllowed = 'copy';
    } catch {
      /* ignore */
    }
    tableDragJustEndedRef.current = true;
    e.currentTarget.classList.add('data-field-group__toggle--dragging');
  }, [tablePayload]);

  const onTableDragEnd = useCallback((e) => {
    e.currentTarget.classList.remove('data-field-group__toggle--dragging');
    // Suppress the click that follows a drag so expand/collapse does not toggle.
    window.setTimeout(() => {
      tableDragJustEndedRef.current = false;
    }, 0);
  }, []);

  const onTableToggleClick = useCallback((tableId, e) => {
    if (tableDragJustEndedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      tableDragJustEndedRef.current = false;
      return;
    }
    toggleTable(tableId);
  }, [toggleTable]);

  const fieldPayload = useCallback((field) => ({
    modelId: field.modelId,
    tableName: field.tableName,
    fieldName: field.name,
    type: field.type,
  }), []);

  const bindPayloadToWidget = useCallback((payload, widget) => {
    if (!payload || !widget) return false;
    const engine = typeof window !== 'undefined' ? window.engine : null;
    if (engine?.mode === 'viewer') return false;
    const kind = applyDataFieldToWidget(widget, payload);
    if (kind === 'ignored') return false;
    if (typeof widget.update === 'function') {
      widget.update();
    }
    engine?.saveSnapshot?.();
    eventBus.emit('widget:data-binding-updated', { widget });
    if (kind === 'filter') {
      eventBus.emit('dashboard:filters-changed', { source: 'tap-bind' });
    } else {
      eventBus.emit('widget:styles-changed', { widget });
    }
    return true;
  }, []);

  const onFieldTap = useCallback((field) => {
    const payload = fieldPayload(field);
    const engine = typeof window !== 'undefined' ? window.engine : null;
    const selected = engine?.widgetManager?.getSelectedWidgets?.()?.[0];
    if (selected) {
      bindPayloadToWidget(payload, selected);
      setPendingBind(null);
      return;
    }
    setPendingBind(payload);
  }, [bindPayloadToWidget, fieldPayload]);

  const onTableTap = useCallback((group) => {
    if (!group?.fields?.length) return;
    const payload = tablePayload(group);
    const engine = typeof window !== 'undefined' ? window.engine : null;
    const selected = engine?.widgetManager?.getSelectedWidgets?.()?.[0];
    if (selected?.type === 'table') {
      bindPayloadToWidget(payload, selected);
      setPendingBind(null);
      return;
    }
    // Keep expand/collapse for coarse pointer when no table widget selected.
    toggleTable(group.tableId);
  }, [bindPayloadToWidget, tablePayload, toggleTable]);

  useEffect(() => {
    if (!coarsePointer) {
      setPendingBind(null);
      return undefined;
    }
    const onSelected = ({ widget }) => {
      const pending = pendingBindRef.current;
      if (!pending || !widget) return;
      bindPayloadToWidget(pending, widget);
      setPendingBind(null);
    };
    return eventBus.on('widget:selected', onSelected);
  }, [coarsePointer, bindPayloadToWidget]);

  const engine = typeof window !== 'undefined' ? window.engine : null;

  const variablesFooter = (
    <>
      <div className="data-panel__footer">
        <button
          type="button"
          className="data-panel__vars-btn"
          onClick={() => setVarsOpen(true)}
          disabled={!dashboardId}
        >
          <VariablesIcon />
          <span>Переменные</span>
        </button>
      </div>
      <DataPanelVariablesModal
        open={varsOpen}
        onClose={() => setVarsOpen(false)}
        dashboardId={dashboardId}
        engine={engine}
        canEdit={canEdit}
      />
    </>
  );

  if (!dashboardId) {
    return (
      <div className="data-panel data-panel--empty">
        <p className="data-panel__hint">Нет идентификатора дашборда.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="data-panel data-panel--loading data-panel--with-footer">
        <p className="data-panel__hint">Загрузка схемы…</p>
        {variablesFooter}
      </div>
    );
  }

  if (error) {
    return (
      <div className="data-panel data-panel--empty data-panel--with-footer">
        <p className="data-panel__hint data-panel__hint--error">{error}</p>
        {variablesFooter}
      </div>
    );
  }

  if (tables.length === 0 && fields.length === 0 && modelsMeta.length === 0) {
    return (
      <div className="data-panel data-panel--empty data-panel--with-footer">
        <p className="data-panel__hint">
          Нет данных SQLite для этого дашборда. Привяжите модель данных и выполните сборку, чтобы
          появился файл <code>latest.db</code>.
        </p>
        <Link className="data-panel__link" to={`/dashboard/${dashboardId}`}>
          Открыть настройки дашборда
        </Link>
        {variablesFooter}
      </div>
    );
  }

  return (
    <div className="data-panel data-panel--with-footer">
      <label className="data-panel__label" htmlFor="data-panel-search">
        Поиск
      </label>
      <input
        id="data-panel-search"
        type="search"
        className="data-panel__search"
        placeholder="Модель, таблица или поле…"
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        autoComplete="off"
      />

      {coarsePointer && (
        <p className="data-panel__bind-hint">
          {pendingBind
            ? `Поле «${pendingBind.fieldName}» выбрано — нажмите на виджет, чтобы привязать.`
            : 'Нажмите поле, затем виджет на холсте, чтобы привязать данные.'}
        </p>
      )}

      <div className="data-field-list" role="list">
        {modelGroups.length === 0 ? (
          <p className="data-panel__hint">Нет полей по текущим фильтрам.</p>
        ) : (
          modelGroups.map((model) => {
            const modelExpanded = isModelExpanded(model.modelId);
            const modelPanelId = `data-model-group-${safeDomId(model.modelId)}`;
            return (
              <div
                key={model.modelId}
                className={`data-field-model${modelExpanded ? ' is-expanded' : ''}`}
              >
                <button
                  type="button"
                  className="data-field-model__toggle"
                  aria-expanded={modelExpanded}
                  aria-controls={modelPanelId}
                  onClick={() => toggleModel(model.modelId)}
                  title={model.modelName}
                >
                  <span className="data-field-group__chevron" aria-hidden="true">
                    {modelExpanded ? '▼' : '▶'}
                  </span>
                  <span className="data-field-model__name">{model.modelName}</span>
                  <span className="data-field-group__count">{model.tables.length}</span>
                </button>
                <div id={modelPanelId} className="data-field-model__body" hidden={!modelExpanded}>
                  {model.schemaError && (
                    <p className="data-panel__hint data-panel__hint--error">{model.schemaError}</p>
                  )}
                  {model.tables.map((group) => {
                    const expanded = isTableExpanded(group.tableId);
                    const panelId = `data-field-group-${safeDomId(group.tableId)}`;
                    return (
                      <div
                        key={group.tableId}
                        className={`data-field-group${expanded ? ' is-expanded' : ''}`}
                      >
                        <button
                          type="button"
                          className="data-field-group__toggle"
                          aria-expanded={expanded}
                          aria-controls={panelId}
                          draggable={!coarsePointer && group.fields.length > 0}
                          onDragStart={
                            coarsePointer || !group.fields.length
                              ? undefined
                              : (e) => onTableDragStart(group, e)
                          }
                          onDragEnd={coarsePointer ? undefined : onTableDragEnd}
                          onClick={
                            coarsePointer
                              ? () => onTableTap(group)
                              : (e) => onTableToggleClick(group.tableId, e)
                          }
                          title={
                            group.fields.length
                              ? `${group.tableName} — перетащите на виджет «Таблица»`
                              : group.tableName
                          }
                        >
                          <span className="data-field-group__chevron" aria-hidden="true">
                            {expanded ? '▼' : '▶'}
                          </span>
                          <span className="data-field-group__name">{group.tableName}</span>
                          <span className="data-field-group__count">{group.fields.length}</span>
                        </button>
                        <div
                          id={panelId}
                          className="data-field-group__body"
                          role="group"
                          hidden={!expanded}
                        >
                          {group.fields.map((field) => {
                            const isPending =
                              pendingBind &&
                              pendingBind.modelId === field.modelId &&
                              pendingBind.tableName === field.tableName &&
                              pendingBind.fieldName === field.name;
                            return (
                            <div
                              key={field.id}
                              className={`data-field-item${isPending ? ' data-field-item--pending' : ''}`}
                              role="listitem"
                              draggable={!coarsePointer}
                              onDragStart={coarsePointer ? undefined : (e) => onDragStart(field, e)}
                              onDragEnd={coarsePointer ? undefined : onDragEnd}
                              onClick={coarsePointer ? () => onFieldTap(field) : undefined}
                            >
                              <span className="data-field-item__name" title={field.name}>
                                {field.name}
                              </span>
                              <span
                                className="data-field-item__type"
                                data-type={field.type}
                                title={field.sqliteType ? `SQLite: ${field.sqliteType}` : undefined}
                              >
                                {field.type}
                              </span>
                            </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
      {variablesFooter}
    </div>
  );
}
