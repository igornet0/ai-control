import React, { useMemo } from 'react';
import styles from './PropertiesPanel.module.css';
import DataCodeOpenButton from './components/DataCodeOpenButton.jsx';
import {
  ASOF_DIRECTION_OPTIONS,
  JOIN_MODE_OPTIONS,
  JOIN_TYPE_OPTIONS,
  buildDefaultSeparateJoinVariableName,
  createDefaultJoinKey,
  joinNeedsKeys,
  normalizeJoinSettings,
  resolveJoinOutputVariableName,
} from './interactive/joinConfigSchema.js';
import {
  collectJoinTableSources,
  syncJoinStepsWithSources,
} from './interactive/joinDataCodeSync.js';

export default function JoinSettingsPanel({
  settings = {},
  joinWidget = null,
  widgetManager = null,
  widgetDbId = null,
  onFieldChange,
  onOpenDataCode,
  codeModified = false,
  onRegenerateCode,
}) {
  const sources = useMemo(
    () => collectJoinTableSources(joinWidget, widgetManager),
    [joinWidget, widgetManager, joinWidget?.connections],
  );
  const normalized = useMemo(() => normalizeJoinSettings(settings), [settings]);
  const steps = useMemo(
    () => syncJoinStepsWithSources(normalized, sources),
    [normalized, sources],
  );

  const left = sources[0] || null;
  const joinMode = normalized.joinMode;
  const joinType = normalized.joinType;
  const separate = normalized.joinSeparateOutput !== false;
  const leftVar = left?.tableVariable || 'data';
  const defaultSeparateName = buildDefaultSeparateJoinVariableName(leftVar, widgetDbId);
  const outputName = resolveJoinOutputVariableName(normalized, leftVar, { widgetId: widgetDbId });

  const updateSteps = (next) => onFieldChange('joinSteps', next);

  const patchStep = (index, patch) => {
    const next = steps.map((step, i) => (i === index ? { ...step, ...patch } : step));
    updateSteps(next);
  };

  const patchKey = (stepIndex, keyIndex, patch) => {
    const step = steps[stepIndex];
    if (!step) return;
    const keys = (step.keys || []).map((k, i) => (i === keyIndex ? { ...k, ...patch } : k));
    patchStep(stepIndex, { keys });
  };

  return (
    <div className={styles.settingsContent}>
      <h3 className={styles.sectionTitle}>Объединение</h3>
      <p className={styles.filterHint}>
        Соединяет минимум две входящие таблицы. Первое соединение — левая (родительская) таблица,
        остальные — правые. DataCode: <code>left_join</code>, <code>inner_join</code>,{' '}
        <code>merge_tables</code> и другие.
      </p>

      <div className={styles.fieldGroup}>
        <label className={styles.label}>Название</label>
        <input
          type="text"
          className={styles.input}
          value={settings.name || ''}
          onChange={(e) => onFieldChange('name', e.target.value)}
          placeholder="Например: Пользователи с заказами"
        />
      </div>

      {sources.length < 2 ? (
        <p className={styles.filterSubHint}>
          Подключите минимум два источника. Для модели данных на каждом входящем соединении
          выберите таблицу.
        </p>
      ) : (
        <div className={styles.fieldGroup}>
          <label className={styles.label}>Таблицы</label>
          <div className={styles.fieldsList}>
            {sources.map((src, index) => (
              <div key={`${src.connectionId || src.tableVariable}-${index}`} className={styles.fieldTag}>
                {index === 0 ? 'Левая · ' : `Правая ${index} · `}
                {src.widgetName} ({src.tableVariable})
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={styles.fieldGroup}>
        <label className={styles.label}>Режим</label>
        <select
          className={styles.select}
          value={joinMode}
          onChange={(e) => onFieldChange('joinMode', e.target.value)}
        >
          {JOIN_MODE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {joinMode === 'join' && (
        <div className={styles.fieldGroup}>
          <label className={styles.label}>Тип соединения</label>
          <select
            className={styles.select}
            value={joinType}
            onChange={(e) => onFieldChange('joinType', e.target.value)}
          >
            {JOIN_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      )}

      {joinMode === 'join' && joinNeedsKeys(joinType) && steps.map((step, stepIndex) => {
        const right = sources[stepIndex + 1];
        const rightCols = right?.columns || [];
        const leftCols = left?.columns || [];
        return (
          <div key={step.id || stepIndex} className={styles.fieldGroup}>
            <label className={styles.label}>
              Ключи: {leftVar} ↔ {step.rightTableVariable || right?.tableVariable || 'правая'}
            </label>
            {(step.keys || []).map((key, keyIndex) => (
              <div key={`${step.id}-k-${keyIndex}`} className={styles.expressionItem}>
                <select
                  className={styles.select}
                  value={key.leftColumn || ''}
                  onChange={(e) => patchKey(stepIndex, keyIndex, { leftColumn: e.target.value })}
                >
                  <option value="">Колонка слева…</option>
                  {leftCols.map((col) => <option key={col} value={col}>{col}</option>)}
                </select>
                <select
                  className={styles.select}
                  value={key.rightColumn || ''}
                  onChange={(e) => patchKey(stepIndex, keyIndex, { rightColumn: e.target.value })}
                >
                  <option value="">Колонка справа…</option>
                  {rightCols.map((col) => <option key={col} value={col}>{col}</option>)}
                </select>
                {(step.keys || []).length > 1 && (
                  <button
                    type="button"
                    className={styles.removeButton}
                    onClick={() => patchStep(stepIndex, {
                      keys: step.keys.filter((_, i) => i !== keyIndex),
                    })}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              className={styles.addButton}
              onClick={() => patchStep(stepIndex, {
                keys: [...(step.keys || []), createDefaultJoinKey()],
              })}
            >
              + Ключ (AND)
            </button>
          </div>
        );
      })}

      {joinMode === 'join' && joinType === 'asof' && steps.map((step, stepIndex) => (
        <div key={`asof-${step.id || stepIndex}`} className={styles.fieldGroup}>
          <label className={styles.label}>ASOF для {step.rightTableVariable}</label>
          <input
            className={styles.input}
            value={step.asofColumn || ''}
            onChange={(e) => patchStep(stepIndex, { asofColumn: e.target.value })}
            placeholder="Колонка времени (time)"
          />
          <input
            className={styles.input}
            value={step.asofBy || ''}
            onChange={(e) => patchStep(stepIndex, { asofBy: e.target.value })}
            placeholder="Группа (by), необязательно"
          />
          <select
            className={styles.select}
            value={step.asofDirection || 'backward'}
            onChange={(e) => patchStep(stepIndex, { asofDirection: e.target.value })}
          >
            {ASOF_DIRECTION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      ))}

      <div className={styles.fieldGroup}>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={separate}
            onChange={(e) => onFieldChange('joinSeparateOutput', e.target.checked)}
          />
          <span>Создать новую таблицу</span>
        </label>
        <p className={styles.filterSubHint}>
          Включено: результат пишется в новую переменную. Выключено: перезаписывается левая
          (родительская) таблица <code>{leftVar}</code>.
        </p>
      </div>

      {separate ? (
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
              Вход: <code>{leftVar}</code>
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
        <p className={styles.filterSubHint}>
          Выход: левая таблица <code>{outputName}</code> будет изменена
        </p>
      )}

      <div className={styles.fieldGroup}>
        <DataCodeOpenButton
          onClick={onOpenDataCode}
          modified={codeModified}
          onRegenerate={onRegenerateCode}
        />
      </div>
    </div>
  );
}
