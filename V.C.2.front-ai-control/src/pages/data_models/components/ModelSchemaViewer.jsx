import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownTrayIcon,
  ArrowLeftIcon,
  ArrowPathIcon,
  KeyIcon,
  LinkIcon,
  TableCellsIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { dataModelService } from '../../../services/dataModelService';
import { apiKeyService } from '../../../services/apiKeyService';
import {
  DATACODE_VARIABLES_TABLE,
  normalizeVariableRow,
} from '../../../services/dashboardModelVariables';
import ModelTableDataPanel from './ModelTableDataPanel';
import { downloadModelTableCsv } from './modelTableCsvExport';
import styles from './ModelSchemaViewer.module.css';

const HIDDEN_SYSTEM_TABLES = new Set(['_datacode_variables']);
const CARD_WIDTH = 240;
const HEADER_HEIGHT = 40;
const FIELD_HEIGHT = 30;
const H_GAP = 96;
const V_GAP = 64;
const MAX_VISIBLE_FIELDS = 40;
const LAYOUT_STORAGE_PREFIX = 'aic-schema-viewer-layout:v3:';

const SCHEMA_LAYERS = [
  { id: 'all', label: 'Все' },
  { id: 'compiled', label: 'Compiled' },
  { id: 'api', label: 'API' },
  { id: 'data_input', label: 'DataInput' },
  { id: 'variables', label: 'Variables' },
];

const LAYER_BADGE = {
  compiled: { label: 'Compiled', className: 'layerBadgeCompiled', headerColor: '#93c5fd' },
  api: { label: 'API', className: 'layerBadgeApi', headerColor: '#60a5fa' },
  data_input: { label: 'DataInput', className: 'layerBadgeInput', headerColor: '#34d399' },
};

const LAYER_ZONE_ORDER = ['compiled', 'api', 'data_input'];
const LAYER_ZONE_LABELS = {
  compiled: 'Compiled',
  api: 'API',
  data_input: 'DataInput',
};

function tableLayer(table) {
  return table?.layer || 'compiled';
}

function tableNodeKey(table) {
  if (!table) return '';
  return `${tableLayer(table)}:${table.name}`;
}

function tableDisplayTitle(table) {
  if (!table) return '';
  const layer = tableLayer(table);
  const badge = LAYER_BADGE[layer];
  if (!badge || layer === 'compiled') return table.name;
  return `${badge.label} · ${table.name}`;
}

function headerColorForTable(table) {
  const badge = LAYER_BADGE[tableLayer(table)];
  return badge?.headerColor || '#93c5fd';
}

function ModelSchemaVariablesPanel({ variables, loading, error, onRetry }) {
  if (loading) {
    return (
      <div className={styles.stateBox}>
        <div className={styles.spinner} />
        <div>Загрузка переменных…</div>
      </div>
    );
  }
  if (error) {
    return (
      <div className={styles.stateBox}>
        <TableCellsIcon style={{ width: '2.5rem', height: '2.5rem' }} />
        <div>{error}</div>
        <button type="button" className={styles.toolBtn} onClick={onRetry}>
          Повторить
        </button>
      </div>
    );
  }
  if (!variables.length) {
    return (
      <div className={styles.stateBox}>
        <TableCellsIcon style={{ width: '2.5rem', height: '2.5rem' }} />
        <div>Нет переменных. Скомпилируйте модель, чтобы заполнить _datacode_variables.</div>
      </div>
    );
  }
  return (
    <div className={styles.varsWrap}>
      <div className={styles.varsHint}>
        Каталог глобальных переменных после компиляции. Table — таблицы модели; скаляры
        (Number, String, Bool) доступны в формулах дашборда как @имя.
      </div>
      <div className={styles.varsTableWrap}>
        <table className={styles.fieldsTable}>
          <thead>
            <tr>
              <th>Имя</th>
              <th>Тип</th>
              <th>Значение</th>
              <th>Создана</th>
            </tr>
          </thead>
          <tbody>
            {variables.map((v) => (
              <tr key={v.name}>
                <td className={styles.varsName}>{v.name}</td>
                <td>
                  <span
                    className={`${styles.typeBadge}${
                      String(v.type).toLowerCase() === 'table' ? ` ${styles.varsTypeTable}` : ''
                    }`}
                  >
                    {v.type || '—'}
                  </span>
                </td>
                <td className={styles.varsValue}>{v.rawValue || '—'}</td>
                <td className={styles.varsMuted}>{v.createdAt || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function layoutStorageKey(modelId) {
  return `${LAYOUT_STORAGE_PREFIX}${modelId}`;
}

function loadSavedPositions(modelId) {
  if (modelId == null) return {};
  try {
    const raw = localStorage.getItem(layoutStorageKey(modelId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out = {};
    for (const [name, pos] of Object.entries(parsed)) {
      if (!pos || typeof pos !== 'object') continue;
      const x = Number(pos.x);
      const y = Number(pos.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      out[name] = { x, y };
    }
    return out;
  } catch {
    return {};
  }
}

function savePositions(modelId, positions) {
  if (modelId == null) return;
  try {
    const payload = {};
    for (const [name, pos] of Object.entries(positions || {})) {
      if (!pos) continue;
      payload[name] = { x: Math.round(pos.x), y: Math.round(pos.y) };
    }
    localStorage.setItem(layoutStorageKey(modelId), JSON.stringify(payload));
  } catch {
    // ignore quota / private mode
  }
}

function clearSavedPositions(modelId) {
  if (modelId == null) return;
  try {
    localStorage.removeItem(layoutStorageKey(modelId));
  } catch {
    // ignore
  }
}

const HEADER_COLORS = [
  '#fbbf24',
  '#93c5fd',
  '#86efac',
  '#f9a8d4',
  '#c4b5fd',
  '#fdba74',
  '#67e8f9',
  '#fca5a5',
];

function isHiddenTable(name) {
  if (!name) return true;
  if (HIDDEN_SYSTEM_TABLES.has(name)) return true;
  return String(name).startsWith('_datacode');
}

function KeyGlyph({ className }) {
  return <KeyIcon className={className} aria-hidden />;
}

/**
 * Normalize field-level relations from SQLite FKs, canvas joinKeys, and relationship widgets.
 * @returns {Array<{ id: string, fromTable: string, fromColumn: string, toTable: string, toColumn: string, source: string }>}
 */
function collectFieldRelations(tables, relationships, widgets) {
  // Relations bind physical compiled tables only (not API / DataInput schema cards).
  const tablesForRels = (tables || []).filter((t) => tableLayer(t) === 'compiled');
  const tableNames = new Set(tablesForRels.map((t) => t.name));
  const columnsByTable = {};
  for (const t of tablesForRels) {
    columnsByTable[t.name] = new Set((t.columns || []).map((c) => c.name));
  }

  const hasCol = (table, col) => {
    if (!tableNames.has(table)) return false;
    if (!col) return false;
    const set = columnsByTable[table];
    return !set || set.size === 0 || set.has(col);
  };

  const seen = new Set();
  const out = [];

  const pushRel = (fromTable, fromColumn, toTable, toColumn, source) => {
    if (!fromTable || !toTable || !fromColumn || !toColumn) return;
    if (fromTable === toTable && fromColumn === toColumn) return;
    if (!hasCol(fromTable, fromColumn) || !hasCol(toTable, toColumn)) return;
    const forward = `${fromTable}.${fromColumn}->${toTable}.${toColumn}`;
    const reverse = `${toTable}.${toColumn}->${fromTable}.${fromColumn}`;
    if (seen.has(forward) || seen.has(reverse)) return;
    seen.add(forward);
    out.push({
      id: forward,
      fromTable,
      fromColumn,
      toTable,
      toColumn,
      source,
    });
  };

  /** Modern relationship widget: pk (1) + foreignKeys (N) — same as relate(PK, FK…). */
  const pushPkForeignKeys = (settings, source) => {
    if (!settings || typeof settings !== 'object') return false;
    const pk = settings.pk && typeof settings.pk === 'object' ? settings.pk : null;
    const foreignKeys = settings.foreignKeys || settings.foreign_keys;
    if (!pk || !Array.isArray(foreignKeys) || !foreignKeys.length) return false;
    const parent =
      pk.tableVariable || pk.table || pk.tableName || pk.fromTable || null;
    const parentCol = pk.column || pk.field || null;
    for (const fk of foreignKeys) {
      if (!fk || typeof fk !== 'object') continue;
      const child =
        fk.tableVariable || fk.table || fk.tableName || fk.fromTable || null;
      const childCol = fk.column || fk.field || null;
      // child.FK → parent.PK
      pushRel(child, childCol, parent, parentCol, source);
    }
    return true;
  };

  for (const table of tablesForRels) {
    for (const fk of table.foreign_keys || []) {
      // SQLite: child.from_column → parent.to_column
      pushRel(
        table.name,
        fk.from_column,
        fk.referenced_table,
        fk.to_column,
        'fk'
      );
    }
  }

  const relMap = relationships && typeof relationships === 'object' ? relationships : {};
  for (const [relId, rel] of Object.entries(relMap)) {
    if (!rel || typeof rel !== 'object') continue;
    const settings = rel.settings && typeof rel.settings === 'object' ? rel.settings : rel;
    if (pushPkForeignKeys(settings, `pkfk:${relId}`)) continue;

    const fromTable = settings.fromTable || settings.source_table || rel.fromTable;
    const toTable = settings.toTable || settings.target_table || rel.toTable;
    const joinKeys = Array.isArray(settings.joinKeys)
      ? settings.joinKeys
      : Array.isArray(rel.joinKeys)
        ? rel.joinKeys
        : null;

    if (joinKeys && joinKeys.length) {
      for (const jk of joinKeys) {
        if (!jk || typeof jk !== 'object') continue;
        pushRel(
          fromTable,
          jk.from || jk.fromColumn || jk.source_field || jk.sourceField,
          toTable,
          jk.to || jk.toColumn || jk.target_field || jk.targetField,
          'joinKeys'
        );
      }
      continue;
    }

    // Classic model-to-model relationship shape
    if (rel.source_field && rel.target_field && (fromTable || toTable)) {
      pushRel(
        fromTable || String(rel.source_model_id || ''),
        rel.source_field,
        toTable || String(rel.target_model_id || ''),
        rel.target_field,
        'model'
      );
    }

    // Loose selected field pairs on connection
    if (settings.fromField && settings.toField && fromTable && toTable) {
      pushRel(fromTable, settings.fromField, toTable, settings.toField, `conn:${relId}`);
    }
  }

  for (const widget of widgets || []) {
    const type = widget.widget_type || widget.type;
    if (type !== 'relationship') continue;
    const settings = widget.widget_config?.settings || widget.settings || {};
    if (pushPkForeignKeys(settings, 'widget')) continue;

    const fromTable = settings.fromTable || settings.sourceTable;
    const toTable = settings.toTable || settings.targetTable;
    const fromField = settings.fromField || settings.sourceField;
    const toField = settings.toField || settings.targetField;
    const joinKeys = Array.isArray(settings.joinKeys) ? settings.joinKeys : null;
    if (joinKeys) {
      for (const jk of joinKeys) {
        pushRel(
          fromTable || jk.fromTable,
          jk.from || jk.fromColumn || jk.fromField,
          toTable || jk.toTable,
          jk.to || jk.toColumn || jk.toField,
          'widget'
        );
      }
    } else if (fromTable && toTable && fromField && toField) {
      pushRel(fromTable, fromField, toTable, toField, 'widget');
    }
  }

  return out;
}

function layoutTablesByLayerZones(tables) {
  const positions = {};
  const zoneGap = H_GAP + 48;
  const zoneWidth = CARD_WIDTH + zoneGap;

  LAYER_ZONE_ORDER.forEach((layer, zoneIdx) => {
    const zoneTables = tables
      .filter((t) => tableLayer(t) === layer)
      .slice()
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    let y = 72;
    zoneTables.forEach((table) => {
      const fieldCount = Math.min((table.columns || []).length, MAX_VISIBLE_FIELDS);
      const height = HEADER_HEIGHT + fieldCount * FIELD_HEIGHT + 4;
      positions[tableNodeKey(table)] = {
        x: 48 + zoneIdx * zoneWidth,
        y,
      };
      y += height + V_GAP;
    });
  });

  return positions;
}

function layoutTables(tables, relations) {
  if (!tables.length) return {};

  const layersPresent = new Set(tables.map((t) => tableLayer(t)));
  if (layersPresent.size > 1) {
    return layoutTablesByLayerZones(tables);
  }

  const keyOf = (t) => tableNodeKey(t);
  const nameToCompiledKeys = new Map();
  for (const t of tables) {
    if (tableLayer(t) !== 'compiled') continue;
    if (!nameToCompiledKeys.has(t.name)) nameToCompiledKeys.set(t.name, []);
    nameToCompiledKeys.get(t.name).push(keyOf(t));
  }

  const childrenOf = new Map();
  const parentsOf = new Map();
  for (const t of tables) {
    const k = keyOf(t);
    childrenOf.set(k, []);
    parentsOf.set(k, new Set());
  }
  for (const rel of relations || []) {
    const fromKeys = nameToCompiledKeys.get(rel.fromTable) || [];
    const toKeys = nameToCompiledKeys.get(rel.toTable) || [];
    for (const fromKey of fromKeys) {
      for (const toKey of toKeys) {
        childrenOf.get(toKey)?.push(fromKey);
        parentsOf.get(fromKey)?.add(toKey);
      }
    }
  }

  const roots = tables
    .filter((t) => (parentsOf.get(keyOf(t))?.size || 0) === 0)
    .map((t) => keyOf(t));
  const start = roots.length ? roots : [keyOf(tables[0])];

  const depth = new Map();
  const queue = [...start];
  for (const n of start) depth.set(n, 0);
  while (queue.length) {
    const cur = queue.shift();
    const d = depth.get(cur) || 0;
    for (const child of childrenOf.get(cur) || []) {
      if (!depth.has(child) || depth.get(child) < d + 1) {
        depth.set(child, d + 1);
        queue.push(child);
      }
    }
  }
  for (const t of tables) {
    const k = keyOf(t);
    if (!depth.has(k)) depth.set(k, 0);
  }

  const byDepth = new Map();
  for (const t of tables) {
    const k = keyOf(t);
    const d = depth.get(k) || 0;
    if (!byDepth.has(d)) byDepth.set(d, []);
    byDepth.get(d).push(t);
  }

  const positions = {};
  const depths = [...byDepth.keys()].sort((a, b) => a - b);
  depths.forEach((d) => {
    const col = byDepth.get(d);
    col.sort((a, b) => a.name.localeCompare(b.name));
    let y = 40;
    col.forEach((table, idx) => {
      const fieldCount = Math.min((table.columns || []).length, MAX_VISIBLE_FIELDS);
      const height = HEADER_HEIGHT + fieldCount * FIELD_HEIGHT + 4;
      positions[keyOf(table)] = {
        x: 48 + d * (CARD_WIDTH + H_GAP),
        y: idx === 0 ? 40 : y,
      };
      y = (idx === 0 ? 40 : y) + height + V_GAP;
    });
  });

  return positions;
}

function visibleColumns(table, linkedColumns) {
  const all = table.columns || [];
  if (all.length <= MAX_VISIBLE_FIELDS) return all;
  const linked = linkedColumns instanceof Set ? linkedColumns : new Set();
  const prioritized = [];
  const rest = [];
  for (const col of all) {
    if (col.pk || linked.has(col.name)) prioritized.push(col);
    else rest.push(col);
  }
  const merged = [...prioritized, ...rest];
  return merged.slice(0, MAX_VISIBLE_FIELDS);
}

function fieldSideAnchor(nodeKey, fieldName, positions, columns, preferRight) {
  const pos = positions[nodeKey];
  if (!pos) return null;
  const cols = columns || [];
  const idx = cols.findIndex((c) => c.name === fieldName);
  const y =
    idx >= 0
      ? pos.y + HEADER_HEIGHT + idx * FIELD_HEIGHT + FIELD_HEIGHT / 2
      : pos.y + HEADER_HEIGHT / 2;
  const x = preferRight ? pos.x + CARD_WIDTH : pos.x;
  return { x, y, side: preferRight ? 'right' : 'left' };
}

function buildEdgePaths(relations, positions, columnsByTable, tables = []) {
  const compiledKeyByName = new Map();
  for (const t of tables || []) {
    if (tableLayer(t) !== 'compiled') continue;
    compiledKeyByName.set(t.name, tableNodeKey(t));
  }
  return (relations || []).map((rel) => {
    const fromKey = compiledKeyByName.get(rel.fromTable) || `compiled:${rel.fromTable}`;
    const toKey = compiledKeyByName.get(rel.toTable) || `compiled:${rel.toTable}`;
    const fromPos = positions[fromKey];
    const toPos = positions[toKey];
    if (!fromPos || !toPos) return null;

    const fromRight = fromPos.x <= toPos.x;
    const from = fieldSideAnchor(
      fromKey,
      rel.fromColumn,
      positions,
      columnsByTable[fromKey],
      fromRight
    );
    const to = fieldSideAnchor(
      toKey,
      rel.toColumn,
      positions,
      columnsByTable[toKey],
      !fromRight
    );
    if (!from || !to) return null;

    const dx = Math.max(48, Math.abs(to.x - from.x) * 0.45);
    const c1x = fromRight ? from.x + dx : from.x - dx;
    const c2x = fromRight ? to.x - dx : to.x + dx;
    const path = `M ${from.x} ${from.y} C ${c1x} ${from.y}, ${c2x} ${to.y}, ${to.x} ${to.y}`;

    return {
      ...rel,
      path,
      x1: from.x,
      y1: from.y,
      x2: to.x,
      y2: to.y,
    };
  }).filter(Boolean);
}

/**
 * Full-canvas schema viewer: tables, fields, field-level links, table detail with row editor.
 */
const ModelSchemaViewer = ({ modelId, modelName, relationships = {}, open, onClose, canEdit = true }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tables, setTables] = useState([]);
  const [widgets, setWidgets] = useState([]);
  const [executionId, setExecutionId] = useState(null);
  const [layerFilter, setLayerFilter] = useState('all');
  const [selectedNodeKey, setSelectedNodeKey] = useState(null);
  const [selectedRelationId, setSelectedRelationId] = useState(null);
  const [detailTab, setDetailTab] = useState('fields');
  const [pan, setPan] = useState({ x: 40, y: 40 });
  const [zoom, setZoom] = useState(1);
  const [panning, setPanning] = useState(false);
  const [customPositions, setCustomPositions] = useState({});
  const [draggingTable, setDraggingTable] = useState(null);
  const [csvDownloading, setCsvDownloading] = useState(false);
  const [schemaActionBusy, setSchemaActionBusy] = useState(false);
  const [variables, setVariables] = useState([]);
  const [variablesError, setVariablesError] = useState(null);
  const dragRef = useRef(null);
  const tableDragRef = useRef(null);
  const canvasWrapRef = useRef(null);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  useEffect(() => {
    if (!open || modelId == null) return;
    setCustomPositions(loadSavedPositions(modelId));
  }, [open, modelId]);

  const loadSchema = useCallback(async () => {
    if (!modelId) return;
    setLoading(true);
    setError(null);
    try {
      const [schema, widgetsRes, varsRes] = await Promise.all([
        dataModelService.getModelSqliteSchema(modelId, null, {
          layers: ['compiled', 'api', 'data_input'],
        }),
        dataModelService.getDataModelWidgets(modelId).catch(() => []),
        dataModelService
          .getModelTableRows(modelId, DATACODE_VARIABLES_TABLE, {
            limit: 500,
            offset: 0,
            includeSource: false,
          })
          .catch((err) => {
            const status = err?.response?.status;
            if (status === 404) return { rows: [], _error: null };
            return {
              rows: [],
              _error: err?.response?.data?.detail || err?.message || 'Не удалось загрузить переменные',
            };
          }),
      ]);
      const list = (schema.tables || [])
        .filter((t) => !t.skipped && !isHiddenTable(t.name))
        .map((t) => ({ ...t, layer: t.layer || 'compiled' }));
      const widgetList = Array.isArray(widgetsRes)
        ? widgetsRes
        : widgetsRes?.widgets || [];
      const varRows = Array.isArray(varsRes?.rows) ? varsRes.rows : [];
      setTables(list);
      setWidgets(widgetList);
      setVariables(
        varRows
          .map((row) => normalizeVariableRow(row))
          .filter((v) => v.name)
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
      setVariablesError(varsRes?._error || null);
      setExecutionId(schema.execution_id || null);
      setSelectedNodeKey(null);
      setSelectedRelationId(null);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 404) {
        setError('Скомпилированная база модели не найдена. Сначала выполните компиляцию модели.');
      } else {
        setError(err?.response?.data?.detail || err?.message || 'Не удалось загрузить схему');
      }
      setTables([]);
      setWidgets([]);
      setVariables([]);
      setVariablesError(err?.response?.data?.detail || err?.message || null);
    } finally {
      setLoading(false);
    }
  }, [modelId]);

  useEffect(() => {
    if (!open) return undefined;
    loadSchema();
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, loadSchema, onClose]);

  const visibleTables = useMemo(() => {
    if (layerFilter === 'all') return tables;
    return tables.filter((t) => tableLayer(t) === layerFilter);
  }, [tables, layerFilter]);

  const relations = useMemo(
    () => collectFieldRelations(visibleTables, relationships, widgets),
    [visibleTables, relationships, widgets]
  );

  const linkedColumnsByTable = useMemo(() => {
    const map = {};
    for (const t of visibleTables) map[tableNodeKey(t)] = new Set();
    for (const rel of relations) {
      for (const t of visibleTables) {
        if (tableLayer(t) !== 'compiled') continue;
        if (t.name === rel.fromTable) map[tableNodeKey(t)]?.add(rel.fromColumn);
        if (t.name === rel.toTable) map[tableNodeKey(t)]?.add(rel.toColumn);
      }
    }
    for (const t of visibleTables) {
      const key = tableNodeKey(t);
      for (const fk of t.foreign_keys || []) {
        map[key]?.add(fk.from_column);
      }
      for (const col of t.columns || []) {
        if (col.pk) map[key]?.add(col.name);
      }
    }
    return map;
  }, [visibleTables, relations]);

  const columnsByTable = useMemo(() => {
    const map = {};
    for (const t of visibleTables) {
      map[tableNodeKey(t)] = visibleColumns(t, linkedColumnsByTable[tableNodeKey(t)]);
    }
    return map;
  }, [visibleTables, linkedColumnsByTable]);

  const autoPositions = useMemo(
    () => layoutTables(visibleTables, relations),
    [visibleTables, relations]
  );

  const positions = useMemo(() => {
    const merged = { ...autoPositions };
    for (const [name, pos] of Object.entries(customPositions || {})) {
      if (merged[name] && pos) merged[name] = pos;
    }
    for (const table of visibleTables) {
      const key = tableNodeKey(table);
      if (customPositions[key]) {
        merged[key] = customPositions[key];
      }
    }
    return merged;
  }, [autoPositions, customPositions, visibleTables]);

  const edges = useMemo(
    () => buildEdgePaths(relations, positions, columnsByTable, visibleTables),
    [relations, positions, columnsByTable, visibleTables]
  );

  const canvasSize = useMemo(() => {
    let maxX = 960;
    let maxY = 640;
    for (const table of visibleTables) {
      const key = tableNodeKey(table);
      const pos = positions[key];
      if (!pos) continue;
      const fieldCount = (columnsByTable[key] || []).length;
      const height = HEADER_HEIGHT + fieldCount * FIELD_HEIGHT + 4;
      maxX = Math.max(maxX, pos.x + CARD_WIDTH + 160);
      maxY = Math.max(maxY, pos.y + height + 160);
    }
    return { width: maxX, height: maxY };
  }, [visibleTables, positions, columnsByTable]);

  const selected = visibleTables.find((t) => tableNodeKey(t) === selectedNodeKey) || null;
  const selectedTable = selected?.name || null;

  const tableRelations = useMemo(() => {
    if (!selected || tableLayer(selected) !== 'compiled') return [];
    return relations.filter(
      (r) => r.fromTable === selected.name || r.toTable === selected.name
    );
  }, [relations, selected]);

  const showLayerZones = useMemo(() => {
    if (layerFilter !== 'all') return false;
    const layers = new Set(visibleTables.map((t) => tableLayer(t)));
    return layers.size > 1;
  }, [layerFilter, visibleTables]);

  const layerZoneMeta = useMemo(() => {
    if (!showLayerZones) return [];
    const zoneGap = H_GAP + 48;
    const zoneWidth = CARD_WIDTH + zoneGap;
    return LAYER_ZONE_ORDER
      .filter((layer) => visibleTables.some((t) => tableLayer(t) === layer))
      .map((layer) => ({
        id: layer,
        label: LAYER_ZONE_LABELS[layer] || layer,
        x: 48 + LAYER_ZONE_ORDER.indexOf(layer) * zoneWidth,
      }));
  }, [showLayerZones, visibleTables]);

  const onRowCountChange = useCallback((table, count) => {
    setTables((prev) =>
      prev.map((t) => (
        t.name === table
          ? { ...t, row_count: count }
          : t
      )),
    );
  }, []);

  const onDownloadCsv = useCallback(async () => {
    if (!canEdit || !modelId || !selectedTable || csvDownloading) return;
    setCsvDownloading(true);
    try {
      await downloadModelTableCsv(modelId, selectedTable);
    } catch (err) {
      window.alert(
        err?.response?.data?.detail || err?.message || 'Не удалось скачать CSV',
      );
    } finally {
      setCsvDownloading(false);
    }
  }, [canEdit, modelId, selectedTable, csvDownloading]);

  const removeTableFromLocalState = useCallback((layer, tableName) => {
    const key = `${layer}:${tableName}`;
    setTables((prev) => prev.filter((t) => !(tableLayer(t) === layer && t.name === tableName)));
    setSelectedNodeKey((cur) => (cur === key ? null : cur));
    setCustomPositions((prev) => {
      if (!prev || !prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      savePositions(modelId, next);
      return next;
    });
  }, [modelId]);

  const onResetApiSource = useCallback(async () => {
    if (!canEdit || !modelId || !selected || tableLayer(selected) !== 'api') return;
    const tableName = selected.name;
    const ok = window.confirm(
      `Удалить API-источник «${tableName}» из схемы?\n\n`
      + 'Будут удалены: история ingest, registry, запись в конфиге модели и таблица в SQLite. '
      + 'Действие необратимо.',
    );
    if (!ok) return;
    setSchemaActionBusy(true);
    try {
      await apiKeyService.resetIngestTable(modelId, tableName, { purgeSchema: true });
      removeTableFromLocalState('api', tableName);
      // Compiled card for the same physical table is also gone after SQLite drop.
      removeTableFromLocalState('compiled', tableName);
      await loadSchema();
    } catch (err) {
      window.alert(
        err?.response?.data?.detail || err?.message || 'Не удалось удалить API-источник',
      );
    } finally {
      setSchemaActionBusy(false);
    }
  }, [canEdit, modelId, selected, loadSchema, removeTableFromLocalState]);

  const onRemoveDataInputSource = useCallback(async () => {
    if (!canEdit || !modelId || !selected || tableLayer(selected) !== 'data_input') return;
    const tableName = selected.name;
    const ok = window.confirm(
      `Убрать «${tableName}» из слоя DataInput?\n\n`
      + 'Виджеты ввода на дашбордах будут отвязаны от этой модели/таблицы. '
      + 'Данные в слое Compiled сохранятся.',
    );
    if (!ok) return;
    setSchemaActionBusy(true);
    try {
      await dataModelService.deleteDataInputSchemaTable(modelId, tableName);
      removeTableFromLocalState('data_input', tableName);
      await loadSchema();
    } catch (err) {
      window.alert(
        err?.response?.data?.detail || err?.message || 'Не удалось удалить DataInput из схемы',
      );
    } finally {
      setSchemaActionBusy(false);
    }
  }, [canEdit, modelId, selected, loadSchema, removeTableFromLocalState]);

  const skipCardClickRef = useRef(false);

  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    if (tableDragRef.current) return;
    if (e.target.closest?.(`.${styles.tableCard}`)) return;
    if (e.target.closest?.('path') || e.target.closest?.('circle')) return;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
    setPanning(true);
    setSelectedRelationId(null);
  };

  const onPointerMove = (e) => {
    if (tableDragRef.current) return;
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPan({ x: dragRef.current.panX + dx, y: dragRef.current.panY + dy });
  };

  const finishTableDrag = useCallback(() => {
    const drag = tableDragRef.current;
    if (!drag) return;
    tableDragRef.current = null;
    setDraggingTable(null);
    setCustomPositions((prev) => {
      savePositions(modelId, prev);
      return prev;
    });
    if (drag.moved) {
      skipCardClickRef.current = true;
    }
  }, [modelId]);

  const endPan = () => {
    if (tableDragRef.current) return;
    dragRef.current = null;
    setPanning(false);
  };

  const onTableHeaderPointerDown = (e, nodeKey, currentPos) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const pos = currentPos || { x: 40, y: 40 };
    tableDragRef.current = {
      tableName: nodeKey,
      startX: e.clientX,
      startY: e.clientY,
      originX: pos.x,
      originY: pos.y,
      moved: false,
    };
    setDraggingTable(nodeKey);
    setSelectedNodeKey(nodeKey);
    setSelectedRelationId(null);
  };

  useEffect(() => {
    if (!draggingTable) return undefined;
    const onMove = (e) => {
      const drag = tableDragRef.current;
      if (!drag) return;
      const z = zoomRef.current || 1;
      const dx = (e.clientX - drag.startX) / z;
      const dy = (e.clientY - drag.startY) / z;
      drag.moved = Math.abs(dx) > 2 || Math.abs(dy) > 2 || drag.moved;
      const next = {
        x: Math.max(0, drag.originX + dx),
        y: Math.max(0, drag.originY + dy),
      };
      setCustomPositions((prev) => ({ ...prev, [drag.tableName]: next }));
    };
    const onUp = () => finishTableDrag();
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [draggingTable, finishTableDrag]);

  useEffect(() => {
    const el = canvasWrapRef.current;
    if (!el || !open) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.08 : 0.08;
      setZoom((z) => Math.min(1.8, Math.max(0.45, z + delta)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [open]);

  const fitView = () => {
    setPan({ x: 40, y: 40 });
    setZoom(1);
  };

  const resetLayout = () => {
    clearSavedPositions(modelId);
    setCustomPositions({});
    setPan({ x: 40, y: 40 });
    setZoom(1);
  };

  if (!open) return null;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Схема данных модели">
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <button type="button" className={styles.toolBtn} onClick={onClose}>
            <ArrowLeftIcon style={{ width: '1rem', height: '1rem' }} />
            Назад
          </button>
          <h2 className={styles.toolbarTitle}>Данные{modelName ? `: ${modelName}` : ''}</h2>
          <span className={styles.toolbarMeta}>
            {layerFilter === 'variables'
              ? `${variables.length} перем.`
              : `${visibleTables.length} табл. · ${relations.length} связей`}
            {executionId ? ` · ${executionId}` : ''}
          </span>
          <div className={styles.layerFilter} role="tablist" aria-label="Слой схемы">
            {SCHEMA_LAYERS.map((layer) => (
              <button
                key={layer.id}
                type="button"
                role="tab"
                aria-selected={layerFilter === layer.id}
                className={`${styles.layerFilterBtn}${layerFilter === layer.id ? ` ${styles.layerFilterBtnActive}` : ''}`}
                onClick={() => {
                  setLayerFilter(layer.id);
                  setSelectedNodeKey(null);
                  setSelectedRelationId(null);
                }}
              >
                {layer.label}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.toolbarActions}>
          {layerFilter !== 'variables' && (
            <>
              <button type="button" className={styles.toolBtn} onClick={fitView}>
                Сбросить вид
              </button>
              <button type="button" className={styles.toolBtn} onClick={resetLayout}>
                Сбросить расположение
              </button>
            </>
          )}
          <button type="button" className={styles.toolBtn} onClick={loadSchema} disabled={loading}>
            <ArrowPathIcon style={{ width: '1rem', height: '1rem' }} />
            Обновить
          </button>
          <button type="button" className={styles.toolBtn} onClick={onClose} aria-label="Закрыть">
            <XMarkIcon style={{ width: '1.1rem', height: '1.1rem' }} />
          </button>
        </div>
      </div>

      <div className={styles.body}>
        {layerFilter === 'variables' ? (
          <ModelSchemaVariablesPanel
            variables={variables}
            loading={loading}
            error={error || variablesError}
            onRetry={loadSchema}
          />
        ) : (
          <>
        <div
          ref={canvasWrapRef}
          className={`${styles.canvasWrap}${panning ? ` ${styles.panning}` : ''}${draggingTable ? ` ${styles.draggingTable}` : ''}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPan}
          onPointerLeave={endPan}
        >
          {loading && (
            <div className={styles.stateBox}>
              <div className={styles.spinner} />
              <div>Загрузка схемы…</div>
            </div>
          )}

          {!loading && error && (
            <div className={styles.stateBox}>
              <TableCellsIcon style={{ width: '2.5rem', height: '2.5rem' }} />
              <div>{error}</div>
              <button type="button" className={styles.toolBtn} onClick={loadSchema}>
                Повторить
              </button>
            </div>
          )}

          {!loading && !error && visibleTables.length === 0 && (
            <div className={styles.stateBox}>
              <TableCellsIcon style={{ width: '2.5rem', height: '2.5rem' }} />
              <div>
                {tables.length === 0
                  ? 'В модели пока нет таблиц'
                  : 'Нет таблиц для выбранного слоя'}
              </div>
            </div>
          )}

          {!loading && !error && visibleTables.length > 0 && (
            <div
              className={styles.canvas}
              style={{
                width: canvasSize.width,
                height: canvasSize.height,
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              }}
            >
              <svg
                className={styles.edges}
                width={canvasSize.width}
                height={canvasSize.height}
              >
                <defs>
                  <marker
                    id="schema-arrow"
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="7"
                    markerHeight="7"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
                  </marker>
                  <marker
                    id="schema-arrow-active"
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="7"
                    markerHeight="7"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#f59e0b" />
                  </marker>
                </defs>
                {edges.map((edge) => {
                  const active =
                    selectedRelationId === edge.id ||
                    (selectedTable &&
                      (edge.fromTable === selectedTable || edge.toTable === selectedTable));
                  return (
                    <g
                      key={edge.id}
                      className={styles.edgeGroup}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedRelationId(edge.id);
                        setSelectedNodeKey(`compiled:${edge.fromTable}`);
                        setDetailTab('fields');
                      }}
                    >
                      <path
                        d={edge.path}
                        className={styles.edgeHit}
                      />
                      <path
                        d={edge.path}
                        className={`${styles.edge}${active ? ` ${styles.edgeActive}` : ''}`}
                        markerEnd={`url(#${active ? 'schema-arrow-active' : 'schema-arrow'})`}
                      />
                      <circle
                        cx={edge.x1}
                        cy={edge.y1}
                        r={3.5}
                        className={`${styles.edgeDot}${active ? ` ${styles.edgeDotActive}` : ''}`}
                      />
                      <circle
                        cx={edge.x2}
                        cy={edge.y2}
                        r={3.5}
                        className={`${styles.edgeDot}${active ? ` ${styles.edgeDotActive}` : ''}`}
                      />
                      <title>
                        {edge.fromTable}.{edge.fromColumn} → {edge.toTable}.{edge.toColumn}
                      </title>
                    </g>
                  );
                })}
              </svg>

              {showLayerZones && layerZoneMeta.map((zone) => (
                <div
                  key={zone.id}
                  className={`${styles.layerZoneLabel} ${styles[`layerZone_${zone.id}`] || ''}`}
                  style={{ left: zone.x, top: 16, width: CARD_WIDTH }}
                >
                  {zone.label}
                </div>
              ))}

              {visibleTables.map((table, idx) => {
                const nodeKey = tableNodeKey(table);
                const layer = tableLayer(table);
                const badge = LAYER_BADGE[layer] || LAYER_BADGE.compiled;
                const pos = positions[nodeKey] || { x: 40, y: 40 };
                const color = headerColorForTable(table) || HEADER_COLORS[idx % HEADER_COLORS.length];
                const linked = linkedColumnsByTable[nodeKey] || new Set();
                const cols = columnsByTable[nodeKey] || [];
                const more = (table.columns || []).length - cols.length;
                const selectedCls = selectedNodeKey === nodeKey ? ` ${styles.tableCardSelected}` : '';
                const draggingCls = draggingTable === nodeKey ? ` ${styles.tableCardDragging}` : '';
                const layerCls = ` ${styles[`tableCard_${layer}`] || ''}`;
                const title = tableDisplayTitle(table);

                return (
                  <div
                    key={nodeKey}
                    className={`${styles.tableCard}${selectedCls}${draggingCls}${layerCls}`}
                    style={{ left: pos.x, top: pos.y, width: CARD_WIDTH }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (skipCardClickRef.current) {
                        skipCardClickRef.current = false;
                        return;
                      }
                      setSelectedNodeKey(nodeKey);
                      setSelectedRelationId(null);
                      setDetailTab('fields');
                    }}
                  >
                    <div
                      className={styles.tableHeader}
                      style={{ background: color }}
                      onPointerDown={(e) => onTableHeaderPointerDown(e, nodeKey, pos)}
                      title="Перетащите, чтобы переместить таблицу"
                    >
                      <span className={styles.tableHeaderName} title={title}>
                        {title}
                      </span>
                      <span className={`${styles.layerBadge} ${styles[badge.className]}`}>
                        {badge.label}
                      </span>
                      {table.row_count != null && (
                        <span className={styles.tableHeaderMeta}>{table.row_count}</span>
                      )}
                    </div>
                    <ul className={styles.fieldList}>
                      {cols.map((col) => {
                        const isLinked = linked.has(col.name);
                        return (
                          <li
                            key={col.name}
                            className={`${styles.fieldRow}${isLinked ? ` ${styles.fieldRowLinked}` : ''}`}
                            title={col.name}
                            style={{ height: FIELD_HEIGHT, minHeight: FIELD_HEIGHT }}
                          >
                            <span className={styles.fieldName}>{col.name}</span>
                            <span className={styles.fieldIcons}>
                              {col.pk && <KeyGlyph className={styles.keyIcon} />}
                              {isLinked && !col.pk && <LinkIcon className={styles.fkIcon} />}
                            </span>
                          </li>
                        );
                      })}
                      {more > 0 && (
                        <li className={styles.fieldRow} style={{ height: FIELD_HEIGHT }}>
                          <span className={styles.fieldName}>+{more} ещё…</span>
                        </li>
                      )}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {selected && (
          <aside className={styles.detailPanel}>
            <div className={styles.detailHeader}>
              <div>
                <h3 className={styles.detailTitle}>
                  {selected.name}
                  <span
                    className={`${styles.layerBadge} ${styles[LAYER_BADGE[tableLayer(selected)]?.className || 'layerBadgeCompiled']}`}
                    style={{ marginLeft: '0.5rem', verticalAlign: 'middle' }}
                  >
                    {LAYER_BADGE[tableLayer(selected)]?.label || tableLayer(selected)}
                  </span>
                </h3>
                <p className={styles.detailSub}>
                  {(selected.columns || []).length} полей
                  {selected.row_count != null ? ` · ${selected.row_count} строк` : ''}
                  {tableRelations.length ? ` · ${tableRelations.length} связей` : ''}
                </p>
              </div>
              <div className={styles.detailHeaderActions}>
                {canEdit && tableLayer(selected) === 'api' && (
                  <button
                    type="button"
                    className={`${styles.toolBtn} ${styles.toolBtnDanger}`}
                    disabled={schemaActionBusy}
                    onClick={() => void onResetApiSource()}
                    title="Удалить API-источник из схемы"
                  >
                    {schemaActionBusy ? 'Удаление…' : 'Удалить API'}
                  </button>
                )}
                {canEdit && tableLayer(selected) === 'data_input' && (
                  <button
                    type="button"
                    className={`${styles.toolBtn} ${styles.toolBtnDanger}`}
                    disabled={schemaActionBusy}
                    onClick={() => void onRemoveDataInputSource()}
                    title="Убрать таблицу из слоя DataInput (отвязать виджеты)"
                  >
                    {schemaActionBusy ? 'Удаление…' : 'Удалить DataInput'}
                  </button>
                )}
                {canEdit && (
                <button
                  type="button"
                  className={styles.toolBtn}
                  disabled={csvDownloading}
                  onClick={() => void onDownloadCsv()}
                  title="Скачать таблицу в CSV"
                >
                  <ArrowDownTrayIcon style={{ width: '1rem', height: '1rem' }} />
                  {csvDownloading ? 'Скачивание…' : 'CSV'}
                </button>
                )}
                <button
                  type="button"
                  className={styles.toolBtn}
                  onClick={() => setSelectedNodeKey(null)}
                  aria-label="Закрыть панель"
                >
                  <XMarkIcon style={{ width: '1rem', height: '1rem' }} />
                </button>
              </div>
            </div>

            <div className={styles.detailTabs}>
              <button
                type="button"
                className={`${styles.detailTab}${detailTab === 'fields' ? ` ${styles.detailTabActive}` : ''}`}
                onClick={() => setDetailTab('fields')}
              >
                Поля и типы
              </button>
              <button
                type="button"
                className={`${styles.detailTab}${detailTab === 'relations' ? ` ${styles.detailTabActive}` : ''}`}
                onClick={() => setDetailTab('relations')}
              >
                Связи
              </button>
              <button
                type="button"
                className={`${styles.detailTab}${detailTab === 'data' ? ` ${styles.detailTabActive}` : ''}`}
                onClick={() => setDetailTab('data')}
              >
                Данные
              </button>
            </div>

            <div className={styles.detailBody}>
              {detailTab === 'fields' && (
                <table className={styles.fieldsTable}>
                  <thead>
                    <tr>
                      <th>Поле</th>
                      <th>Тип</th>
                      <th>SQLite</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selected.columns || []).map((col) => {
                      const linked = (linkedColumnsByTable[tableNodeKey(selected)] || new Set()).has(col.name);
                      return (
                        <tr key={col.name}>
                          <td>
                            {col.name}
                            {col.pk && <span className={styles.pkBadge}>PK</span>}
                            {linked && <span className={styles.pkBadge}>FK</span>}
                          </td>
                          <td>
                            <span className={styles.typeBadge}>{col.type || 'string'}</span>
                          </td>
                          <td style={{ color: '#9ca3af' }}>{col.sqlite_type || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              {detailTab === 'relations' && (
                <>
                  {tableRelations.length === 0 && (
                    <div style={{ color: '#9ca3af', fontSize: '0.85rem' }}>
                      Для этой таблицы связей не найдено
                    </div>
                  )}
                  {tableRelations.length > 0 && (
                    <ul className={styles.relationsList}>
                      {tableRelations.map((rel) => (
                        <li key={rel.id}>
                          <button
                            type="button"
                            className={`${styles.relationItem}${
                              selectedRelationId === rel.id ? ` ${styles.relationItemActive}` : ''
                            }`}
                            onClick={() => setSelectedRelationId(rel.id)}
                          >
                            <span className={styles.relationPath}>
                              {rel.fromTable}.{rel.fromColumn}
                            </span>
                            <span className={styles.relationArrow}>→</span>
                            <span className={styles.relationPath}>
                              {rel.toTable}.{rel.toColumn}
                            </span>
                            <span className={styles.relationSource}>{rel.source}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}

              {detailTab === 'data' && selectedTable && (
                <ModelTableDataPanel
                  modelId={modelId}
                  tableName={selectedTable}
                  layer={tableLayer(selected)}
                  canEdit={canEdit}
                  onRowCountChange={onRowCountChange}
                />
              )}
            </div>
          </aside>
        )}
          </>
        )}
      </div>
    </div>
  );
};

export default ModelSchemaViewer;
