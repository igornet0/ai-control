import React, { useMemo, useState } from 'react';
import styles from './PropertiesPanel.module.css';
import DataCodeOpenButton from './components/DataCodeOpenButton.jsx';
import {
  TRANSFORM_OPERATION_GROUPS,
  TRANSFORM_TYPE_OPTIONS,
  DATE_PART_OPTIONS,
  getTransformOperationMeta,
  createDefaultTransformOperation,
} from './interactive/transformConfigSchema.js';
import {
  buildDefaultSeparateTransformVariableName,
  resolveTransformOutputVariableName,
} from './interactive/transformDataCodeSync.js';

function FieldMultiSelect({ availableFields, value, onChange }) {
  const selected = new Set(value || []);
  return (
    <div className={styles.transformFieldChips}>
      {availableFields.map((field) => {
        const active = selected.has(field);
        return (
          <button
            key={field}
            type="button"
            className={`${styles.transformFieldChip} ${active ? styles.transformFieldChipActive : ''}`}
            onClick={() => {
              const next = new Set(selected);
              if (active) next.delete(field);
              else next.add(field);
              onChange(Array.from(next));
            }}
          >
            {field}
          </button>
        );
      })}
    </div>
  );
}

function OperationParamsEditor({ operation, availableFields, onChange }) {
  const p = operation.params || {};

  const updateParam = (key, val) => {
    onChange({ ...operation, params: { ...p, [key]: val } });
  };

  switch (operation.type) {
    case 'renameColumn':
      return (
        <>
          <label className={styles.label}>Колонка</label>
          <select className={styles.select} value={p.column || ''} onChange={(e) => updateParam('column', e.target.value)}>
            <option value="">—</option>
            {availableFields.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <label className={styles.label}>Новое имя</label>
          <input className={styles.input} value={p.newName || ''} onChange={(e) => updateParam('newName', e.target.value)} />
        </>
      );
    case 'selectColumns':
    case 'reorderColumns':
      return (
        <>
          <label className={styles.label}>Колонки</label>
          <FieldMultiSelect availableFields={availableFields} value={p.columns} onChange={(v) => updateParam('columns', v)} />
        </>
      );
    case 'dropColumn':
      return (
        <>
          <label className={styles.label}>Колонка</label>
          <select className={styles.select} value={p.column || ''} onChange={(e) => updateParam('column', e.target.value)}>
            <option value="">—</option>
            {availableFields.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </>
      );
    case 'addColumn':
      return (
        <>
          <label className={styles.label}>Имя колонки</label>
          <input className={styles.input} value={p.name || ''} onChange={(e) => updateParam('name', e.target.value)} />
          <label className={styles.label}>Значение</label>
          <input className={styles.input} value={p.value ?? ''} onChange={(e) => updateParam('value', e.target.value)} />
        </>
      );
    case 'changeType':
      return (
        <>
          <label className={styles.label}>Колонка</label>
          <select className={styles.select} value={p.column || ''} onChange={(e) => updateParam('column', e.target.value)}>
            <option value="">—</option>
            {availableFields.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <label className={styles.label}>Тип</label>
          <select className={styles.select} value={p.targetType || 'string'} onChange={(e) => updateParam('targetType', e.target.value)}>
            {TRANSFORM_TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          {p.targetType === 'datetime' && (
            <>
              <label className={styles.label}>Формат даты</label>
              <input className={styles.input} placeholder="YYYY-MM-DD" value={p.dateFormat || ''} onChange={(e) => updateParam('dateFormat', e.target.value)} />
            </>
          )}
          {(p.targetType === 'float' || p.targetType === 'int') && (
            <>
              <label className={styles.label}>Разделитель дробной части</label>
              <input className={styles.input} value={p.decimalSeparator || '.'} onChange={(e) => updateParam('decimalSeparator', e.target.value)} />
            </>
          )}
        </>
      );
    case 'trim':
    case 'upper':
    case 'lower':
    case 'capitalize':
      return (
        <>
          <label className={styles.label}>Колонки</label>
          <FieldMultiSelect availableFields={availableFields} value={p.columns} onChange={(v) => updateParam('columns', v)} />
        </>
      );
    case 'replace':
      return (
        <>
          <label className={styles.label}>Колонка</label>
          <select className={styles.select} value={p.column || ''} onChange={(e) => updateParam('column', e.target.value)}>
            <option value="">—</option>
            {availableFields.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <label className={styles.label}>Найти</label>
          <input className={styles.input} value={p.find ?? ''} onChange={(e) => updateParam('find', e.target.value)} />
          <label className={styles.label}>Заменить на</label>
          <input className={styles.input} value={p.replaceWith ?? ''} onChange={(e) => updateParam('replaceWith', e.target.value)} />
        </>
      );
    case 'splitColumn':
      return (
        <>
          <label className={styles.label}>Колонка</label>
          <select className={styles.select} value={p.column || ''} onChange={(e) => updateParam('column', e.target.value)}>
            <option value="">—</option>
            {availableFields.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <label className={styles.label}>Разделитель</label>
          <input className={styles.input} value={p.delimiter ?? ' '} onChange={(e) => updateParam('delimiter', e.target.value)} />
          <label className={styles.label}>Новые колонки (через запятую)</label>
          <input
            className={styles.input}
            value={(p.targetColumns || []).join(', ')}
            onChange={(e) => updateParam('targetColumns', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
          />
        </>
      );
    case 'joinColumns':
      return (
        <>
          <label className={styles.label}>Колонки</label>
          <FieldMultiSelect availableFields={availableFields} value={p.columns} onChange={(v) => updateParam('columns', v)} />
          <label className={styles.label}>Результирующая колонка</label>
          <input className={styles.input} value={p.targetColumn || ''} onChange={(e) => updateParam('targetColumn', e.target.value)} />
          <label className={styles.label}>Разделитель</label>
          <input className={styles.input} value={p.separator ?? ' '} onChange={(e) => updateParam('separator', e.target.value)} />
        </>
      );
    case 'round':
      return (
        <>
          <label className={styles.label}>Колонка</label>
          <select className={styles.select} value={p.column || ''} onChange={(e) => updateParam('column', e.target.value)}>
            <option value="">—</option>
            {availableFields.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <label className={styles.label}>Знаков после запятой</label>
          <input className={styles.input} type="number" value={p.decimals ?? 0} onChange={(e) => updateParam('decimals', e.target.value)} />
        </>
      );
    case 'ceil':
    case 'floor':
    case 'abs':
      return (
        <>
          <label className={styles.label}>Колонка</label>
          <select className={styles.select} value={p.column || ''} onChange={(e) => updateParam('column', e.target.value)}>
            <option value="">—</option>
            {availableFields.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </>
      );
    case 'extractDatePart':
      return (
        <>
          <label className={styles.label}>Колонка даты</label>
          <select className={styles.select} value={p.column || ''} onChange={(e) => updateParam('column', e.target.value)}>
            <option value="">—</option>
            {availableFields.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <label className={styles.label}>Часть</label>
          <select className={styles.select} value={p.part || 'year'} onChange={(e) => updateParam('part', e.target.value)}>
            {DATE_PART_OPTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
          <label className={styles.label}>Колонка результата</label>
          <input className={styles.input} value={p.targetColumn || ''} onChange={(e) => updateParam('targetColumn', e.target.value)} />
        </>
      );
    case 'fillEmpty':
      return (
        <>
          <label className={styles.label}>Колонка</label>
          <select className={styles.select} value={p.column || ''} onChange={(e) => updateParam('column', e.target.value)}>
            <option value="">—</option>
            {availableFields.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <label className={styles.label}>Значение вместо пустого</label>
          <input className={styles.input} value={p.value ?? ''} onChange={(e) => updateParam('value', e.target.value)} />
        </>
      );
    case 'dropEmptyRows':
      return (
        <>
          <label className={styles.label}>Колонка</label>
          <select className={styles.select} value={p.column || ''} onChange={(e) => updateParam('column', e.target.value)}>
            <option value="">—</option>
            {availableFields.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </>
      );
    case 'distinct':
      return (
        <>
          <label className={styles.label}>По колонкам (пусто = все)</label>
          <FieldMultiSelect availableFields={availableFields} value={p.columns} onChange={(v) => updateParam('columns', v)} />
        </>
      );
    case 'sort':
      return (
        <>
          <label className={styles.label}>Поля сортировки</label>
          {(p.sorts || []).map((sort, idx) => (
            <div key={idx} className={styles.transformSortRow}>
              <select
                className={styles.select}
                value={sort.column || ''}
                onChange={(e) => {
                  const next = [...(p.sorts || [])];
                  next[idx] = { ...next[idx], column: e.target.value };
                  updateParam('sorts', next);
                }}
              >
                <option value="">—</option>
                {availableFields.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
              <select
                className={styles.select}
                value={sort.ascending !== false ? 'asc' : 'desc'}
                onChange={(e) => {
                  const next = [...(p.sorts || [])];
                  next[idx] = { ...next[idx], ascending: e.target.value === 'asc' };
                  updateParam('sorts', next);
                }}
              >
                <option value="asc">ASC</option>
                <option value="desc">DESC</option>
              </select>
              <button
                type="button"
                className={styles.removeButton}
                onClick={() => updateParam('sorts', (p.sorts || []).filter((_, i) => i !== idx))}
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            className={styles.addButton}
            onClick={() => updateParam('sorts', [...(p.sorts || []), { column: availableFields[0] || '', ascending: true }])}
          >
            + Поле сортировки
          </button>
        </>
      );
    case 'rowNumber':
      return (
        <>
          <label className={styles.label}>Имя колонки</label>
          <input className={styles.input} value={p.targetColumn || 'RowNumber'} onChange={(e) => updateParam('targetColumn', e.target.value)} />
          <label className={styles.label}>Начать с</label>
          <input className={styles.input} type="number" value={p.startFrom ?? 1} onChange={(e) => updateParam('startFrom', e.target.value)} />
        </>
      );
    case 'valueMap':
      return (
        <>
          <label className={styles.label}>Колонка</label>
          <select className={styles.select} value={p.column || ''} onChange={(e) => updateParam('column', e.target.value)}>
            <option value="">—</option>
            {availableFields.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <label className={styles.label}>Соответствия</label>
          {(p.mappings || []).map((map, idx) => (
            <div key={idx} className={styles.transformSortRow}>
              <input className={styles.input} placeholder="Было" value={map.from ?? ''} onChange={(e) => {
                const next = [...(p.mappings || [])];
                next[idx] = { ...next[idx], from: e.target.value };
                updateParam('mappings', next);
              }} />
              <input className={styles.input} placeholder="Стало" value={map.to ?? ''} onChange={(e) => {
                const next = [...(p.mappings || [])];
                next[idx] = { ...next[idx], to: e.target.value };
                updateParam('mappings', next);
              }} />
              <button type="button" className={styles.removeButton} onClick={() => updateParam('mappings', (p.mappings || []).filter((_, i) => i !== idx))}>×</button>
            </div>
          ))}
          <button type="button" className={styles.addButton} onClick={() => updateParam('mappings', [...(p.mappings || []), { from: '', to: '' }])}>+ Соответствие</button>
        </>
      );
    default:
      return <p className={styles.filterSubHint}>Параметры для этой операции пока не настроены.</p>;
  }
}

export default function TransformSettingsPanel({
  settings,
  availableFields,
  inputSourceName,
  transformCodegenCtx,
  widgetDbId,
  onFieldChange,
  onOpenDataCode,
  codeModified = false,
  onRegenerateCode,
  emptyFieldsHint = null,
}) {
  const operations = settings.transformOperations || [];
  const [selectedOpId, setSelectedOpId] = useState(operations[0]?.id || null);
  const [addOpType, setAddOpType] = useState('trim');

  const selectedOp = useMemo(
    () => operations.find((op) => op.id === selectedOpId) || operations[0] || null,
    [operations, selectedOpId],
  );

  const transformSeparateOutput = settings.transformSeparateOutput || false;
  const defaultSeparateName = buildDefaultSeparateTransformVariableName(
    transformCodegenCtx.inputVariable,
    widgetDbId,
  );
  const outputName = resolveTransformOutputVariableName(
    settings,
    transformCodegenCtx.inputVariable,
    { widgetId: widgetDbId },
  );

  const updateOperations = (next) => onFieldChange('transformOperations', next);

  const moveOperation = (index, direction) => {
    const next = [...operations];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    updateOperations(next);
  };

  return (
    <div className={styles.settingsContent}>
      <h3 className={styles.sectionTitle}>Трансформация</h3>
      <p className={styles.filterHint}>
        Конвейер преобразований одной таблицы: колонки, типы, текст, числа, даты, пустые значения, сортировка.
        Фильтр отвечает только за отбор строк.
      </p>

      <div className={styles.fieldGroup}>
        <label className={styles.label}>Название</label>
        <input
          type="text"
          className={styles.input}
          value={settings.name || ''}
          onChange={(e) => onFieldChange('name', e.target.value)}
          placeholder="Например: Очистка данных"
        />
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={transformSeparateOutput}
            onChange={(e) => onFieldChange('transformSeparateOutput', e.target.checked)}
          />
          <span>Сохранить в отдельную переменную</span>
        </label>
        <p className={styles.filterSubHint}>
          По умолчанию: <code>{transformCodegenCtx.inputVariable} = {transformCodegenCtx.inputVariable}…</code>
        </p>
      </div>

      {transformSeparateOutput ? (
        <>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Переменная DataCode</label>
            <input
              type="text"
              className={styles.input}
              value={settings.dataCodeVariableName ?? ''}
              onChange={(e) => onFieldChange('dataCodeVariableName', e.target.value)}
              placeholder={defaultSeparateName}
            />
            <p className={styles.filterSubHint}>
              Вход: <code>{transformCodegenCtx.inputVariable}</code>
              {' → '}
              выход: <code>{outputName}</code>
            </p>
          </div>
          <div className={styles.fieldGroup}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={settings.exportGlobal || false}
                onChange={(e) => onFieldChange('exportGlobal', e.target.checked)}
              />
              <span>Экспортировать (global)</span>
            </label>
          </div>
        </>
      ) : (
        <p className={styles.filterSubHint}>Выход: <code>{outputName}</code></p>
      )}

      {inputSourceName ? (
        <p className={styles.filterSourceLabel}>Вход: <span className={styles.filterSourceName}>{inputSourceName}</span></p>
      ) : (
        <p className={styles.filterSubHint}>Подключите входную таблицу по связи с источником или предыдущим блоком.</p>
      )}

      {inputSourceName && availableFields.length === 0 && (
        <p className={styles.filterSubHint}>
          {emptyFieldsHint || `Колонки источника пока не определены. Настройте «${inputSourceName}» или укажите имена полей вручную в операциях.`}
        </p>
      )}

      {inputSourceName ? (
        <>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Поля входной таблицы</label>
            <div className={styles.fieldsList}>
              {availableFields.map((f) => (
                <span key={f} className={styles.fieldTag}>{f}</span>
              ))}
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Операции</label>
            <div className={styles.transformLayout}>
              <div className={styles.transformOpList}>
                {operations.map((op, idx) => {
                  const meta = getTransformOperationMeta(op.type);
                  const active = selectedOp?.id === op.id;
                  return (
                    <div
                      key={op.id}
                      className={`${styles.transformOpItem} ${active ? styles.transformOpItemActive : ''}`}
                      onClick={() => setSelectedOpId(op.id)}
                    >
                      <label className={styles.transformOpCheck} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={op.enabled !== false}
                          onChange={(e) => {
                            const next = operations.map((item) => (
                              item.id === op.id ? { ...item, enabled: e.target.checked } : item
                            ));
                            updateOperations(next);
                          }}
                        />
                      </label>
                      <span className={styles.transformOpIndex}>{idx + 1}.</span>
                      <span className={styles.transformOpLabel}>{meta?.label || op.type}</span>
                      <div className={styles.transformOpActions}>
                        <button type="button" className={styles.transformOpMoveBtn} onClick={(e) => { e.stopPropagation(); moveOperation(idx, -1); }} disabled={idx === 0}>↑</button>
                        <button type="button" className={styles.transformOpMoveBtn} onClick={(e) => { e.stopPropagation(); moveOperation(idx, 1); }} disabled={idx === operations.length - 1}>↓</button>
                        <button
                          type="button"
                          className={styles.removeButton}
                          onClick={(e) => {
                            e.stopPropagation();
                            const next = operations.filter((item) => item.id !== op.id);
                            updateOperations(next);
                            if (selectedOpId === op.id) setSelectedOpId(next[0]?.id || null);
                          }}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className={styles.transformOpParams}>
                {selectedOp ? (
                  <>
                    <div className={styles.transformOpParamsTitle}>
                      {getTransformOperationMeta(selectedOp.type)?.label || selectedOp.type}
                    </div>
                    <OperationParamsEditor
                      operation={selectedOp}
                      availableFields={availableFields}
                      onChange={(updated) => {
                        updateOperations(operations.map((op) => (op.id === updated.id ? updated : op)));
                      }}
                    />
                  </>
                ) : (
                  <p className={styles.filterSubHint}>Добавьте операцию или выберите из списка.</p>
                )}
              </div>
            </div>

            <div className={styles.transformAddRow}>
              <select className={styles.select} value={addOpType} onChange={(e) => setAddOpType(e.target.value)}>
                {TRANSFORM_OPERATION_GROUPS.map((group) => (
                  <optgroup key={group.id} label={group.label}>
                    {group.operations.map((op) => (
                      <option key={op.type} value={op.type}>{op.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <button
                type="button"
                className={styles.addButton}
                onClick={() => {
                  const created = createDefaultTransformOperation(addOpType, availableFields);
                  const next = [...operations, created];
                  updateOperations(next);
                  setSelectedOpId(created.id);
                }}
              >
                + Добавить операцию
              </button>
            </div>
          </div>
        </>
      ) : (
        <p className={styles.filterSubHint}>Подключите источник данных — появятся поля для операций.</p>
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
