import React, { useMemo } from 'react';
import styles from './PropertiesPanel.module.css';
import DataCodeOpenButton from './components/DataCodeOpenButton.jsx';
import { collectRelationshipTableSources } from './interactive/relationshipSources.js';
import {
  generateRelationshipDataCode,
  normalizeRelationshipSettings,
} from './interactive/relationshipDataCodeSync.js';

const RELATIONSHIP_TYPES = [
  { value: 'one-to-one', label: 'Один к одному (1:1)' },
  { value: 'one-to-many', label: 'Один ко многим (1:N)' },
  { value: 'many-to-many', label: 'Многие ко многим (N:M)' },
];

function makeFkId() {
  return `fk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function TableColumnPickers({
  tableValue,
  columnValue,
  tableOptions,
  columnsFor,
  onTable,
  onColumn,
  tablePlaceholder = 'Таблица…',
  columnPlaceholder = 'Колонка…',
}) {
  return (
    <div className={styles.expressionItem}>
      <select
        className={styles.select}
        value={tableValue || ''}
        onChange={(e) => onTable(e.target.value)}
      >
        <option value="">{tablePlaceholder}</option>
        {tableOptions.map((t) => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>
      <select
        className={styles.select}
        value={columnValue || ''}
        onChange={(e) => onColumn(e.target.value)}
        disabled={!tableValue}
      >
        <option value="">{columnPlaceholder}</option>
        {columnsFor(tableValue).map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
    </div>
  );
}

/**
 * Settings UI for relationship widget.
 * 1:1 / 1:N: PK + FK list → relate(PK, FK…)
 * N:M: left PK + right PK + junction FKs → two relate() calls.
 */
export default function RelationshipSettingsPanel({
  settings = {},
  relationshipWidget = null,
  widgetManager = null,
  onFieldChange,
  onOpenDataCode,
  codeModified = false,
  onRegenerateCode,
}) {
  const sources = useMemo(
    () => collectRelationshipTableSources(relationshipWidget, widgetManager),
    [relationshipWidget, widgetManager, relationshipWidget?.connections],
  );

  const normalized = useMemo(
    () => normalizeRelationshipSettings(settings),
    [settings],
  );
  const { pk, foreignKeys, left, right, junction } = normalized;
  const relationshipType = settings.relationshipType || 'one-to-many';
  const isManyToMany = relationshipType === 'many-to-many';
  const isOneToOne = relationshipType === 'one-to-one';

  const tableOptions = sources.map((s) => ({
    value: s.tableVariable,
    label: `${s.widgetName} (${s.tableVariable})`,
    columns: s.columns,
    widgetId: s.widgetId,
  }));

  const columnsFor = (tableVariable) => {
    const src = sources.find((s) => s.tableVariable === tableVariable);
    return src?.columns || [];
  };

  const widgetIdFor = (tableVariable) => {
    const opt = tableOptions.find((t) => t.value === tableVariable);
    return opt?.widgetId || null;
  };

  const patchCol = (current, patch) => {
    const next = { ...current, ...patch };
    if (patch.tableVariable) {
      next.widgetId = widgetIdFor(patch.tableVariable);
      if (!columnsFor(patch.tableVariable).includes(next.column)) {
        next.column = '';
      }
    }
    return next;
  };

  const updatePk = (patch) => {
    const next = patchCol(pk, patch);
    onFieldChange('pk', next);
    if (next.tableVariable && next.column) {
      onFieldChange('fromField', `${next.tableVariable}.${next.column}`);
    }
  };

  const updateForeignKeys = (nextList) => {
    onFieldChange('foreignKeys', nextList);
    const first = nextList.find((fk) => fk.tableVariable && fk.column);
    if (first) {
      onFieldChange('toField', `${first.tableVariable}.${first.column}`);
    }
    const desc = nextList
      .filter((fk) => fk.tableVariable && fk.column)
      .map((fk) => `${fk.tableVariable}.${fk.column}`)
      .join(', ');
    if (pk.tableVariable && pk.column && desc) {
      onFieldChange(
        'description',
        `FK: ${desc} → ${pk.tableVariable}.${pk.column}`,
      );
    }
  };

  const updateFk = (index, patch) => {
    const next = foreignKeys.map((fk, i) => {
      if (i !== index) return fk;
      return { ...patchCol(fk, patch), id: fk.id };
    });
    updateForeignKeys(next);
  };

  const addFk = () => {
    const other = tableOptions.find((t) => t.value !== pk.tableVariable) || tableOptions[0];
    updateForeignKeys([
      ...foreignKeys,
      {
        id: makeFkId(),
        tableVariable: other?.value || '',
        column: '',
        widgetId: other?.widgetId || null,
      },
    ]);
  };

  const removeFk = (index) => {
    updateForeignKeys(foreignKeys.filter((_, i) => i !== index));
  };

  const updateLeft = (patch) => {
    const next = patchCol(left, patch);
    onFieldChange('left', next);
    syncNmDescription(next, right, junction);
  };

  const updateRight = (patch) => {
    const next = patchCol(right, patch);
    onFieldChange('right', next);
    syncNmDescription(left, next, junction);
  };

  const updateJunction = (patch) => {
    const next = { ...junction, ...patch };
    if (patch.tableVariable) {
      next.widgetId = widgetIdFor(patch.tableVariable);
      const cols = columnsFor(patch.tableVariable);
      if (!cols.includes(next.leftColumn)) next.leftColumn = '';
      if (!cols.includes(next.rightColumn)) next.rightColumn = '';
    }
    onFieldChange('junction', next);
    syncNmDescription(left, right, next);
  };

  const syncNmDescription = (l, r, j) => {
    if (l.tableVariable && r.tableVariable && j.tableVariable) {
      onFieldChange(
        'description',
        `${l.tableVariable} ↔ ${r.tableVariable} via ${j.tableVariable}`,
      );
    }
  };

  const typeHint = isManyToMany
    ? 'N:M: две связи 1:N через промежуточную таблицу. relate(A.PK, junction.A_id) и relate(B.PK, junction.B_id).'
    : isOneToOne
      ? '1:1: relate(PK, FK). FK должен быть уникальным (не больше одной строки на PK).'
      : '1:N: relate(PK, FK…). Первая колонка — первичный ключ, остальные — внешние ключи на неё.';

  const previewCode = generateRelationshipDataCode(settings, { sources, widgetManager });
  const showPreview = previewCode.includes('relate(');

  return (
    <div className={styles.settingsContent}>
      <h3 className={styles.sectionTitle}>Настройки связи</h3>

      <div className={styles.fieldGroup}>
        <label className={styles.label}>Название</label>
        <input
          type="text"
          className={styles.input}
          value={settings.name || ''}
          onChange={(e) => onFieldChange('name', e.target.value)}
          placeholder="Customers → Orders"
        />
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.label}>Тип связи</label>
        <select
          className={styles.select}
          value={relationshipType}
          onChange={(e) => onFieldChange('relationshipType', e.target.value)}
        >
          {RELATIONSHIP_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      <p className={styles.filterHint}>{typeHint}</p>

      {tableOptions.length === 0 ? (
        <p className={styles.filterSubHint}>
          Нет входящих соединений. Проведите связь от источников / блоков обработки к этому виджету.
        </p>
      ) : isManyToMany ? (
        <>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Левая таблица (PK A)</label>
            <TableColumnPickers
              tableValue={left.tableVariable}
              columnValue={left.column}
              tableOptions={tableOptions}
              columnsFor={columnsFor}
              onTable={(v) => updateLeft({ tableVariable: v })}
              onColumn={(v) => updateLeft({ column: v })}
            />
          </div>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Правая таблица (PK B)</label>
            <TableColumnPickers
              tableValue={right.tableVariable}
              columnValue={right.column}
              tableOptions={tableOptions}
              columnsFor={columnsFor}
              onTable={(v) => updateRight({ tableVariable: v })}
              onColumn={(v) => updateRight({ column: v })}
            />
          </div>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Промежуточная таблица</label>
            <select
              className={styles.select}
              value={junction.tableVariable || ''}
              onChange={(e) => updateJunction({ tableVariable: e.target.value })}
            >
              <option value="">Таблица…</option>
              {tableOptions.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <p className={styles.filterSubHint}>
              Junction хранит два FK: на A и на B.
            </p>
          </div>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>FK на левую таблицу</label>
            <select
              className={styles.select}
              value={junction.leftColumn || ''}
              onChange={(e) => updateJunction({ leftColumn: e.target.value })}
              disabled={!junction.tableVariable}
            >
              <option value="">Колонка…</option>
              {columnsFor(junction.tableVariable).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>FK на правую таблицу</label>
            <select
              className={styles.select}
              value={junction.rightColumn || ''}
              onChange={(e) => updateJunction({ rightColumn: e.target.value })}
              disabled={!junction.tableVariable}
            >
              <option value="">Колонка…</option>
              {columnsFor(junction.tableVariable).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </>
      ) : (
        <>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Первичный ключ (PK)</label>
            <TableColumnPickers
              tableValue={pk.tableVariable}
              columnValue={pk.column}
              tableOptions={tableOptions}
              columnsFor={columnsFor}
              onTable={(v) => updatePk({ tableVariable: v })}
              onColumn={(v) => updatePk({ column: v })}
            />
            <p className={styles.filterSubHint}>
              Имена колонок учитывают переименования в upstream-трансформациях.
            </p>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>
              {isOneToOne ? 'Внешний ключ (FK, уникальный)' : 'Внешние ключи (FK)'}
            </label>
            {foreignKeys.length === 0 && (
              <p className={styles.filterSubHint}>Добавьте хотя бы один FK.</p>
            )}
            {(isOneToOne ? foreignKeys.slice(0, 1) : foreignKeys).map((fk, index) => (
              <div key={fk.id || index} className={styles.expressionItem} style={{ marginBottom: '0.5rem' }}>
                <select
                  className={styles.select}
                  value={fk.tableVariable || ''}
                  onChange={(e) => updateFk(index, { tableVariable: e.target.value })}
                >
                  <option value="">Таблица…</option>
                  {tableOptions.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <select
                  className={styles.select}
                  value={fk.column || ''}
                  onChange={(e) => updateFk(index, { column: e.target.value })}
                  disabled={!fk.tableVariable}
                >
                  <option value="">Колонка…</option>
                  {columnsFor(fk.tableVariable).map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                {!isOneToOne && (
                  <button
                    type="button"
                    className={styles.removeButton}
                    onClick={() => removeFk(index)}
                    title="Удалить FK"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            {!isOneToOne && (
              <button type="button" className={styles.addButton} onClick={addFk}>
                + Добавить FK
              </button>
            )}
            {isOneToOne && foreignKeys.length === 0 && (
              <button type="button" className={styles.addButton} onClick={addFk}>
                + Добавить FK
              </button>
            )}
          </div>
        </>
      )}

      {showPreview && (
        <div className={styles.fieldGroup}>
          <label className={styles.label}>Превью DataCode</label>
          <pre className={styles.codePreview} style={{
            fontSize: '0.7rem',
            background: 'rgba(0,0,0,0.35)',
            padding: '0.75rem',
            borderRadius: '8px',
            overflow: 'auto',
            color: '#B0B3B8',
            whiteSpace: 'pre-wrap',
          }}
          >
            {previewCode.trim()}
          </pre>
        </div>
      )}

      <div className={styles.filterDatacodeFooter}>
        <DataCodeOpenButton
          onClick={onOpenDataCode}
          modified={codeModified}
          onRegenerate={onRegenerateCode}
        />
      </div>
    </div>
  );
}
