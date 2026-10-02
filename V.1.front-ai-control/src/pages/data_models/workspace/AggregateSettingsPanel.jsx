import React from 'react';
import styles from './PropertiesPanel.module.css';
import DataCodeOpenButton from './components/DataCodeOpenButton.jsx';
import FieldNameInput from './components/FieldNameInput.jsx';
import {
  AGGREGATE_FUNCTIONS,
  createDefaultAggregateMetric,
  createDefaultGroupByField,
} from './interactive/aggregateConfigSchema.js';
import {
  buildDefaultSeparateAggregateVariableName,
  resolveAggregateOutputVariableName,
} from './interactive/aggregateDataCodeSync.js';

export default function AggregateSettingsPanel({
  settings,
  availableFields,
  inputSourceName,
  aggregateCodegenCtx,
  widgetDbId,
  onFieldChange,
  onOpenDataCode,
  codeModified = false,
  onRegenerateCode,
  emptyFieldsHint = null,
}) {
  const groupBy = settings.aggregateGroupBy || [];
  const metrics = settings.aggregateMetrics || [];
  const aggregateSeparateOutput = settings.aggregateSeparateOutput || false;

  const defaultSeparateName = buildDefaultSeparateAggregateVariableName(
    aggregateCodegenCtx.inputVariable,
    widgetDbId,
  );

  const outputName = resolveAggregateOutputVariableName(
    settings,
    aggregateCodegenCtx.inputVariable,
    { widgetId: widgetDbId },
  );

  const updateGroupBy = (next) => onFieldChange('aggregateGroupBy', next);
  const updateMetrics = (next) => onFieldChange('aggregateMetrics', next);

  return (
    <div className={styles.settingsContent}>
      <h3 className={styles.sectionTitle}>Агрегация</h3>
      <p className={styles.filterHint}>
        SQL-подобная агрегация: GROUP BY + метрики. Виджет отвечает только за свертку данных.
      </p>

      <div className={styles.fieldGroup}>
        <label className={styles.label}>Название</label>
        <input
          type="text"
          className={styles.input}
          value={settings.name || ''}
          onChange={(e) => onFieldChange('name', e.target.value)}
          placeholder="Например: Продажи по странам"
        />
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={aggregateSeparateOutput}
            onChange={(e) => onFieldChange('aggregateSeparateOutput', e.target.checked)}
          />
          <span>Сохранить в отдельную переменную</span>
        </label>
        <p className={styles.filterSubHint}>
          По умолчанию: <code>{aggregateCodegenCtx.inputVariable} = {aggregateCodegenCtx.inputVariable}…</code>
        </p>
      </div>

      {aggregateSeparateOutput ? (
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
              Вход: <code>{aggregateCodegenCtx.inputVariable}</code>
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
        <p className={styles.filterSubHint}>Подключите входную таблицу по связи.</p>
      )}
      {inputSourceName && availableFields.length === 0 && emptyFieldsHint && (
        <p className={styles.filterSubHint}>{emptyFieldsHint}</p>
      )}
      {inputSourceName && availableFields.length === 0 && !emptyFieldsHint && (
        <p className={styles.filterSubHint}>
          {`Колонки источника пока не определены. Настройте «${inputSourceName}» или укажите имена полей вручную.`}
        </p>
      )}

      {inputSourceName ? (
        <>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Группировать по</label>
            <div className={styles.filterConditionsList}>
              {groupBy.map((item, idx) => (
                <div key={item.id || idx} className={styles.filterConditionRow}>
                  <FieldNameInput
                    availableFields={availableFields}
                    className={styles.filterFieldSelect}
                    value={item.field || ''}
                    onChange={(field) => {
                      const next = [...groupBy];
                      next[idx] = { ...next[idx], field };
                      updateGroupBy(next);
                    }}
                  />
                  <button
                    type="button"
                    className={styles.removeButton}
                    onClick={() => updateGroupBy(groupBy.filter((_, i) => i !== idx))}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              className={styles.addButton}
              onClick={() => updateGroupBy([...groupBy, createDefaultGroupByField(availableFields)])}
            >
              + Добавить поле GROUP BY
            </button>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Метрики</label>
            <div className={styles.filterConditionsList}>
              {metrics.map((metric, idx) => (
                <div key={metric.id || idx} className={styles.aggregateMetricCard}>
                  <div className={styles.filterConditionRow}>
                    <label className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={metric.enabled !== false}
                        onChange={(e) => {
                          const next = [...metrics];
                          next[idx] = { ...next[idx], enabled: e.target.checked };
                          updateMetrics(next);
                        }}
                      />
                      <span>Активна</span>
                    </label>
                    <button
                      type="button"
                      className={styles.removeButton}
                      onClick={() => updateMetrics(metrics.filter((_, i) => i !== idx))}
                    >
                      ×
                    </button>
                  </div>

                  <label className={styles.label}>Функция</label>
                  <select
                    className={styles.select}
                    value={metric.func || 'sum'}
                    onChange={(e) => {
                      const next = [...metrics];
                      next[idx] = { ...next[idx], func: e.target.value };
                      updateMetrics(next);
                    }}
                  >
                    {AGGREGATE_FUNCTIONS.map((f) => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>

                  {metric.func !== 'count' && (
                    <>
                      <label className={styles.label}>Поле</label>
                      <FieldNameInput
                        availableFields={availableFields}
                        className={styles.select}
                        value={metric.field || ''}
                        onChange={(field) => {
                          const next = [...metrics];
                          next[idx] = { ...next[idx], field };
                          updateMetrics(next);
                        }}
                      />
                    </>
                  )}

                  {metric.func === 'percentile' && (
                    <>
                      <label className={styles.label}>Percentile</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        className={styles.input}
                        value={metric.percentile ?? 90}
                        onChange={(e) => {
                          const next = [...metrics];
                          next[idx] = { ...next[idx], percentile: e.target.value };
                          updateMetrics(next);
                        }}
                      />
                    </>
                  )}

                  <label className={styles.label}>Название результата</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={metric.alias || ''}
                    onChange={(e) => {
                      const next = [...metrics];
                      next[idx] = { ...next[idx], alias: e.target.value };
                      updateMetrics(next);
                    }}
                  />

                  <label className={styles.label}>Тип результата</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={metric.resultType || ''}
                    onChange={(e) => {
                      const next = [...metrics];
                      next[idx] = { ...next[idx], resultType: e.target.value };
                      updateMetrics(next);
                    }}
                    placeholder="float / int / string"
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              className={styles.addButton}
              onClick={() => updateMetrics([...metrics, createDefaultAggregateMetric(availableFields)])}
            >
              + Добавить метрику
            </button>
          </div>
        </>
      ) : (
        <p className={styles.filterSubHint}>Подключите источник данных и выберите поля в входящей связи.</p>
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
