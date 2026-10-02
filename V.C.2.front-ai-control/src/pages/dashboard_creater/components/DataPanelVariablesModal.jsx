import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { dashboardService } from '../../../services/dashboardService';
import { eventBus } from '../src/core/EventBus.js';
import {
  buildLayoutConfigWithDashboardVariables,
  coerceDashboardVariableValue,
  DASHBOARD_VARIABLE_TYPES,
  getDashboardVariablesFromDashboard,
  isValidDashboardVariableName,
} from '../../../utils/dashboardVariables.js';

function formatDisplayValue(value) {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

/**
 * Overlay: model variables (read-only) + dashboard variables CRUD (persisted in layout_config).
 * Portaled to document.body so it covers the canvas (sidebar backdrop-filter traps fixed).
 */
export default function DataPanelVariablesModal({
  open,
  onClose,
  dashboardId,
  engine,
  canEdit = true,
}) {
  const [modelVars, setModelVars] = useState([]);
  const [dashVars, setDashVars] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('Number');
  const [newValue, setNewValue] = useState('0');

  const syncFromEngine = useCallback(() => {
    if (!engine) {
      setModelVars([]);
      setDashVars([]);
      return;
    }
    const catalog =
      typeof engine.getModelVariableCatalog === 'function' ? engine.getModelVariableCatalog() : [];
    setModelVars((catalog || []).filter((v) => v.source !== 'dashboard'));
    setDashVars(
      typeof engine.getDashboardVariableCatalog === 'function'
        ? engine.getDashboardVariableCatalog()
        : [],
    );
  }, [engine]);

  const loadFromDb = useCallback(async () => {
    if (!dashboardId) return;
    setLoading(true);
    setError(null);
    try {
      const dash = await dashboardService.getDashboard(dashboardId);
      const list = getDashboardVariablesFromDashboard(dash);
      if (engine?.replaceDashboardVariables) {
        engine.replaceDashboardVariables(list, { silent: true });
      }
      syncFromEngine();
    } catch (e) {
      setError(e?.response?.data?.detail || e?.message || 'Не удалось загрузить переменные');
      syncFromEngine();
    } finally {
      setLoading(false);
    }
  }, [dashboardId, engine, syncFromEngine]);

  useEffect(() => {
    if (!open) return undefined;
    void loadFromDb();
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, loadFromDb, onClose]);

  const modelNameSet = useMemo(
    () => new Set(modelVars.map((v) => String(v.name))),
    [modelVars],
  );

  const persistList = useCallback(
    async (nextList, { refreshEngine = true } = {}) => {
      if (!dashboardId) return;
      setSaving(true);
      setError(null);
      setNotice(null);
      try {
        const dash = await dashboardService.getDashboard(dashboardId);
        const layout_config = buildLayoutConfigWithDashboardVariables(dash, nextList);
        const updated = await dashboardService.updateDashboard(dashboardId, { layout_config });
        const saved = getDashboardVariablesFromDashboard(updated);
        if (refreshEngine && engine?.replaceDashboardVariables) {
          engine.replaceDashboardVariables(saved, { silent: true });
        }
        setDashVars(saved);
        setNotice('Сохранено в дашборд');
        syncFromEngine();
        eventBus.emit('dashboard:model-variables-changed', {
          variables: engine?.getModelVariables?.() || {},
          meta: { scope: 'dashboard', persist: false, source: 'variables-panel' },
        });
      } catch (e) {
        setError(e?.response?.data?.detail || e?.message || 'Не удалось сохранить');
        throw e;
      } finally {
        setSaving(false);
      }
    },
    [dashboardId, engine, syncFromEngine],
  );

  const onCreate = async (e) => {
    e?.preventDefault?.();
    const name = String(newName || '').trim();
    if (!isValidDashboardVariableName(name)) {
      setError('Имя: латиница, цифры и _, не с цифры');
      return;
    }
    if (dashVars.some((v) => v.name === name)) {
      setError(`Переменная «${name}» уже есть в дашборде`);
      return;
    }
    if (modelNameSet.has(name)) {
      setError(`Имя «${name}» занято переменной модели. Выберите другое.`);
      return;
    }
    const value = coerceDashboardVariableValue(newType, newValue);
    const next = [
      ...dashVars,
      { name, type: newType, value, description: '' },
    ];
    try {
      await persistList(next);
      if (engine?.upsertDashboardVariable) {
        engine.upsertDashboardVariable(name, { type: newType, value, description: '' }, {
          silent: true,
          persist: false,
        });
      }
      setNewName('');
      setNewValue(newType === 'Bool' ? 'false' : newType === 'String' ? '' : '0');
      syncFromEngine();
    } catch {
      /* error shown */
    }
  };

  const onUpdateValue = async (name, raw) => {
    const current = dashVars.find((v) => v.name === name);
    if (!current) return;
    const value = coerceDashboardVariableValue(current.type, raw);
    const next = dashVars.map((v) => (v.name === name ? { ...v, value } : v));
    try {
      await persistList(next);
      engine?.setModelVariable?.(name, value, { source: 'variables-panel', silent: true });
      if (engine?.dashboardVariables?.has(name)) {
        const prev = engine.dashboardVariables.get(name);
        engine.dashboardVariables.set(name, { ...prev, value });
      }
      syncFromEngine();
    } catch {
      /* error shown */
    }
  };

  const onDelete = async (name) => {
    if (!window.confirm(`Удалить переменную дашборда «${name}»?`)) return;
    const next = dashVars.filter((v) => v.name !== name);
    try {
      await persistList(next);
      engine?.removeDashboardVariable?.(name, { silent: true, persist: false });
      syncFromEngine();
    } catch {
      /* error shown */
    }
  };

  if (!open) return null;

  return createPortal(
    <div
      className="data-vars-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Переменные"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="data-vars-modal">
        <div className="data-vars-modal__header">
          <h3 className="data-vars-modal__title">Переменные</h3>
          <button type="button" className="data-vars-modal__close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>

        <div className="data-vars-modal__body">
          {loading && <p className="data-panel__hint">Загрузка…</p>}
          {error && <p className="data-panel__hint data-panel__hint--error">{error}</p>}
          {notice && <p className="data-panel__hint data-vars-modal__notice">{notice}</p>}

          <section className="data-vars-section">
            <h4 className="data-vars-section__title">Модель данных</h4>
            <p className="data-vars-section__hint">
              Скаляры из _datacode_variables. В формулах: @имя. Локальные изменения кнопкой не пишутся в БД.
            </p>
            {modelVars.length === 0 ? (
              <p className="data-panel__hint">Нет скалярных переменных модели.</p>
            ) : (
              <ul className="data-vars-list">
                {modelVars.map((v) => (
                  <li key={`m:${v.name}`} className="data-vars-row">
                    <div className="data-vars-row__main">
                      <code className="data-vars-row__name">@{v.name}</code>
                      <span className="data-vars-row__type">{v.type || 'Number'}</span>
                    </div>
                    <div className="data-vars-row__value">{formatDisplayValue(v.value)}</div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="data-vars-section">
            <h4 className="data-vars-section__title">Дашборд</h4>
            <p className="data-vars-section__hint">
              Хранятся в БД (layout_config). Изменения сохраняются сразу. В формулах: @имя (перекрывают модель).
            </p>
            {dashVars.length === 0 ? (
              <p className="data-panel__hint">Пока нет переменных дашборда.</p>
            ) : (
              <ul className="data-vars-list">
                {dashVars.map((v) => (
                  <li key={`d:${v.name}`} className="data-vars-row data-vars-row--editable">
                    <div className="data-vars-row__main">
                      <code className="data-vars-row__name">@{v.name}</code>
                      <span className="data-vars-row__type">{v.type || 'Number'}</span>
                    </div>
                    <div className="data-vars-row__edit">
                      {canEdit ? (
                        <>
                          {v.type === 'Bool' ? (
                            <select
                              className="data-vars-input"
                              value={v.value ? 'true' : 'false'}
                              disabled={saving}
                              onChange={(ev) => void onUpdateValue(v.name, ev.target.value)}
                            >
                              <option value="true">true</option>
                              <option value="false">false</option>
                            </select>
                          ) : (
                            <input
                              className="data-vars-input"
                              type={v.type === 'Number' ? 'number' : 'text'}
                              defaultValue={formatDisplayValue(v.value)}
                              key={`${v.name}:${formatDisplayValue(v.value)}`}
                              disabled={saving}
                              onBlur={(ev) => {
                                const next = ev.target.value;
                                if (String(next) === formatDisplayValue(v.value)) return;
                                void onUpdateValue(v.name, next);
                              }}
                              onKeyDown={(ev) => {
                                if (ev.key === 'Enter') {
                                  ev.currentTarget.blur();
                                }
                              }}
                            />
                          )}
                          <button
                            type="button"
                            className="data-vars-btn data-vars-btn--danger"
                            disabled={saving}
                            onClick={() => void onDelete(v.name)}
                            title="Удалить"
                          >
                            Удалить
                          </button>
                        </>
                      ) : (
                        <span className="data-vars-row__value">{formatDisplayValue(v.value)}</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {canEdit && (
              <form className="data-vars-create" onSubmit={onCreate}>
                <div className="data-vars-create__row">
                  <input
                    className="data-vars-input"
                    placeholder="имя"
                    value={newName}
                    onChange={(ev) => setNewName(ev.target.value)}
                    disabled={saving}
                    autoComplete="off"
                  />
                  <select
                    className="data-vars-input"
                    value={newType}
                    onChange={(ev) => {
                      const t = ev.target.value;
                      setNewType(t);
                      setNewValue(t === 'Bool' ? 'false' : t === 'String' ? '' : '0');
                    }}
                    disabled={saving}
                  >
                    {[...DASHBOARD_VARIABLE_TYPES].map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="data-vars-create__row">
                  {newType === 'Bool' ? (
                    <select
                      className="data-vars-input"
                      value={newValue}
                      onChange={(ev) => setNewValue(ev.target.value)}
                      disabled={saving}
                    >
                      <option value="true">true</option>
                      <option value="false">false</option>
                    </select>
                  ) : (
                    <input
                      className="data-vars-input"
                      type={newType === 'Number' ? 'number' : 'text'}
                      placeholder="значение"
                      value={newValue}
                      onChange={(ev) => setNewValue(ev.target.value)}
                      disabled={saving}
                    />
                  )}
                  <button type="submit" className="data-vars-btn data-vars-btn--primary" disabled={saving}>
                    Добавить
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      </div>
    </div>,
    document.body,
  );
}
