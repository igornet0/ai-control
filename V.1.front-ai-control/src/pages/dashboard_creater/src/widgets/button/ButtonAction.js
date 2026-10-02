import { eventBus } from '../../core/EventBus.js';
import {
  sameDataModelId,
  syncFilterRowsByField,
  ensureDashboardFilterRowExists,
} from '../../../../../services/dashboardFilterUtils.js';
import {
  hardReloadDashboardFromButton,
  reloadDashboardDataFromButton,
} from './buttonDashboardRefresh.js';

export const BUTTON_EVENTS = Object.freeze({
  CLICK: 'BUTTON_CLICK',
  FILTER_UPDATE: 'FILTER_UPDATE',
  NAVIGATION: 'NAVIGATION',
  RELOAD: 'BUTTON_RELOAD',
  HARD_RELOAD: 'BUTTON_HARD_RELOAD',
});

export const BUTTON_ACTION_TYPES = Object.freeze([
  { id: 'navigate', label: 'Перейти на лист', hint: 'Открыть другой лист дашборда' },
  { id: 'link', label: 'Ссылка', hint: 'Открыть URL в новой вкладке' },
  { id: 'reload', label: 'Обновить данные', hint: 'Перезагрузить данные виджетов без сборки модели' },
  { id: 'hard_reload', label: 'Сборка модели', hint: 'Запустить сборку модели данных и обновить дашборд' },
  { id: 'filter', label: 'Фильтр', hint: 'Изменить выбранные значения фильтра' },
  { id: 'set_variable', label: 'Переменная', hint: 'Изменить @имя (модель или дашборд)' },
  { id: 'custom', label: 'Своё действие', hint: 'Вызвать зарегистрированный обработчик' },
]);

/** Устаревшие типы действий (ещё исполняются, в UI не показываются). */
const LEGACY_BUTTON_ACTION_TYPES = Object.freeze(['set_param']);

const BLOCKED_LINK_PROTOCOLS = /^(javascript|data|vbscript|file):/i;

/**
 * Нормализация URL для действия «Ссылка». `javascript:` и подобные отклоняются.
 * @param {unknown} raw
 * @returns {string|null}
 */
export function normalizeButtonLinkUrl(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (BLOCKED_LINK_PROTOCOLS.test(s)) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (/^\/\//.test(s)) return `https:${s}`;
  if (/^(mailto|tel):/i.test(s)) return s;
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return null;
  return `https://${s}`;
}

/**
 * URL из action.target или payload.url / payload.href.
 * @param {object} [action]
 * @returns {string|null}
 */
export function resolveButtonLinkUrl(action = {}) {
  const payload = action.payload && typeof action.payload === 'object' ? action.payload : {};
  const raw = payload.url ?? payload.href ?? action.target;
  if (raw == null || raw === '' || raw === 'global' || raw === 'all') return null;
  return normalizeButtonLinkUrl(raw);
}

export function normalizeButtonActionType(type) {
  const t = String(type || 'custom').toLowerCase();
  const allowed = BUTTON_ACTION_TYPES.map((x) => x.id);
  if (allowed.includes(t) || LEGACY_BUTTON_ACTION_TYPES.includes(t)) return t;
  return 'custom';
}

const DEFAULT_FILTER_DEBOUNCE_MS = 220;
const customHandlers = new Map();

function normalizeAction(action = {}) {
  return {
    type: normalizeButtonActionType(action.type),
    target: action.target ?? 'global',
    payload: action.payload && typeof action.payload === 'object' ? action.payload : {},
  };
}

function normalizeSelectedValues(value, values) {
  if (Array.isArray(values)) return values.map((x) => String(x));
  if (value == null || value === '') return [];
  const raw = String(value);
  if (raw.includes(',')) {
    return raw
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
  }
  return [raw];
}

/**
 * Split `table.field` / `schema.table.field` into { table, field }.
 * Bare `field` stays as field only.
 * @param {string} raw
 * @returns {{ table: string, field: string }}
 */
export function splitQualifiedFilterField(raw) {
  const text = String(raw || '').trim();
  if (!text) return { table: '', field: '' };
  if (!text.includes('.')) return { table: '', field: text };
  const parts = text.split('.').map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return { table: '', field: text };
  const field = parts[parts.length - 1];
  const table = parts.slice(0, -1).join('.');
  return { table, field };
}

/**
 * Resolve filter target from payload + optional button/widget dataSource.
 * Accepts qualified `employees.name` in payload.field.
 * @param {object} payload
 * @param {object|null} [sourceWidget]
 */
export function normalizeFilterPayload(payload = {}, sourceWidget = null) {
  const out = {
    ...(payload && typeof payload === 'object' ? payload : {}),
  };

  const ds = sourceWidget?.dataSource || null;
  if (out.modelId == null && ds?.modelId != null) out.modelId = ds.modelId;
  if (!out.table && ds?.table) out.table = ds.table;
  if (!out.field && ds?.field) out.field = ds.field;
  if (!out.type && (ds?.fieldType || ds?.type)) out.type = ds.fieldType || ds.type;

  if (out.field && String(out.field).includes('.')) {
    const split = splitQualifiedFilterField(out.field);
    if (split.field) {
      if (!out.table && split.table) out.table = split.table;
      out.field = split.field;
    }
  }

  if (out.table) out.table = String(out.table).trim();
  if (out.field) out.field = String(out.field).trim();

  return out;
}

function matchesFilterTarget(row, payload) {
  if (!payload || !row) return false;
  if (payload.field && String(row.field) !== String(payload.field)) return false;
  if (payload.table && String(row.table) !== String(payload.table)) return false;
  if (payload.modelId != null && !sameDataModelId(row.modelId, payload.modelId)) return false;
  return true;
}

function applyValuesToFilterRow(row, payload, engine, options) {
  const mode = String(payload.mode || 'replace').toLowerCase();
  const selected = normalizeSelectedValues(payload.value, payload.values);
  if (mode === 'append') {
    const prev = new Set((row.selectedValues || []).map((x) => String(x)));
    selected.forEach((x) => prev.add(x));
    row.selectedValues = Array.from(prev);
  } else if (mode === 'clear') {
    row.selectedValues = [];
  } else {
    row.selectedValues = selected;
  }

  row.excludedValues = Array.isArray(payload.excludedValues)
    ? payload.excludedValues.map((x) => String(x))
    : [];
  if (typeof payload.pattern === 'string') {
    row.pattern = payload.pattern;
  }
  syncFilterRowsByField(engine, row, { sourceWidgetId: options.sourceWidgetId || null });
}

/**
 * Apply button filter payload to Filter widgets and/or virtual dashboard filters.
 * @param {object} engine
 * @param {object} payload
 * @param {{ sourceWidgetId?: string|null, sourceWidget?: object|null }} [options]
 */
export function applyFilterPayload(engine, payload = {}, options = {}) {
  if (!engine?.widgetManager) return { applied: false, rows: 0, reason: 'no-engine' };

  const sourceWidget =
    options.sourceWidget ||
    (options.sourceWidgetId != null
      ? engine.widgetManager.getWidget?.(options.sourceWidgetId) ||
        engine.widgetManager.getAllWidgets?.()?.find((w) => w.id === options.sourceWidgetId)
      : null);

  const normalized = normalizeFilterPayload(payload, sourceWidget);
  if (!normalized.field) {
    return { applied: false, rows: 0, reason: 'missing-field', payload: normalized };
  }

  const widgets = engine.widgetManager.getAllWidgets() || [];
  let changedRows = 0;

  widgets.forEach((widget) => {
    if (widget.type !== 'filter' || !Array.isArray(widget.settings?.filters)) return;
    widget.settings.filters.forEach((row) => {
      if (!matchesFilterTarget(row, normalized)) return;
      applyValuesToFilterRow(row, normalized, engine, options);
      changedRows += 1;
    });
  });

  // Fallback: virtual filter (same path as chart click filters) — no Filter widget required
  if (changedRows === 0 && normalized.modelId != null && normalized.table && normalized.field) {
    const ensured = ensureDashboardFilterRowExists(engine, {
      modelId: normalized.modelId,
      table: normalized.table,
      field: normalized.field,
      type: normalized.type || 'string',
    });
    if (ensured.ok && ensured.row) {
      applyValuesToFilterRow(ensured.row, normalized, engine, options);
      changedRows += 1;
    }
  }

  return {
    applied: changedRows > 0,
    rows: changedRows,
    reason: changedRows > 0 ? 'ok' : 'no-match',
    payload: normalized,
  };
}

function normalizeNavigateTarget(target) {
  if (target == null || target === '') return null;
  const str = String(target).trim();
  if (!str || str === 'global' || str === 'all') return null;
  const match = str.match(/^dashboard[_-](.+)$/i);
  if (match) return match[1];
  return str;
}

export class ButtonActionDispatcher {
  constructor(engine, options = {}) {
    this.engine = engine;
    this.options = options;
    this._filterTimer = null;
  }

  static registerCustomAction(name, handler) {
    if (!name || typeof handler !== 'function') return;
    customHandlers.set(String(name), handler);
  }

  static unregisterCustomAction(name) {
    customHandlers.delete(String(name));
  }

  dispatch(action, context = {}) {
    const normalized = normalizeAction(action);
    const baseEventPayload = {
      action: normalized,
      buttonId: context.buttonId || null,
      widgetId: context.widgetId || null,
      at: Date.now(),
    };
    eventBus.emit(BUTTON_EVENTS.CLICK, baseEventPayload);

    switch (normalized.type) {
      case 'navigate':
        return this._dispatchNavigate(normalized, baseEventPayload);
      case 'link':
        return this._dispatchLink(normalized, baseEventPayload);
      case 'reload':
        return this._dispatchReload(normalized, baseEventPayload);
      case 'hard_reload':
        return this._dispatchHardReload(normalized, baseEventPayload);
      case 'filter':
        return this._dispatchFilter(normalized, baseEventPayload);
      case 'set_param':
        return this._dispatchSetParam(normalized, baseEventPayload);
      case 'set_variable':
        return this._dispatchSetVariable(normalized, baseEventPayload);
      default:
        return this._dispatchCustom(normalized, baseEventPayload);
    }
  }

  destroy() {
    if (this._filterTimer) {
      clearTimeout(this._filterTimer);
      this._filterTimer = null;
    }
  }

  _dispatchNavigate(action, baseEventPayload) {
    const actionPayload = action.payload && typeof action.payload === 'object' ? action.payload : {};
    const targetSheetId =
      normalizeNavigateTarget(action.target) ||
      normalizeNavigateTarget(actionPayload.sheetId) ||
      normalizeNavigateTarget(actionPayload.sheet_id);
    if (!targetSheetId) return { ok: false };
    const eventPayload = {
      ...baseEventPayload,
      targetSheetId,
      payload: actionPayload,
    };
    eventBus.emit(BUTTON_EVENTS.NAVIGATION, eventPayload);
    eventBus.emit('dashboard:navigate-requested', eventPayload);
    return { ok: true, targetSheetId };
  }

  _dispatchLink(action, baseEventPayload) {
    const url = resolveButtonLinkUrl(action);
    if (!url) {
      eventBus.emit('ui:notification', {
        message: 'У кнопки не задан корректный URL',
        type: 'warning',
        duration: 3500,
      });
      return { ok: false, reason: 'invalid-url' };
    }
    const payload = { ...baseEventPayload, url, payload: action.payload || {} };
    eventBus.emit('button:link-open', payload);
    const openFn = typeof window !== 'undefined' && typeof window.open === 'function' ? window.open : null;
    if (!openFn) return { ok: false, reason: 'no-window', url };
    const win = openFn(url, '_blank', 'noopener,noreferrer');
    if (win) {
      try {
        win.opener = null;
      } catch {
        /* ignore */
      }
    }
    return { ok: true, url };
  }

  async _dispatchReload(action, baseEventPayload) {
    eventBus.emit(BUTTON_EVENTS.RELOAD, { ...baseEventPayload, payload: action.payload || {} });
    const result = await reloadDashboardDataFromButton(this.engine, baseEventPayload);
    return result;
  }

  async _dispatchHardReload(action, baseEventPayload) {
    eventBus.emit(BUTTON_EVENTS.HARD_RELOAD, { ...baseEventPayload, payload: action.payload || {} });
    const result = await hardReloadDashboardFromButton(this.engine, action, baseEventPayload);
    return result;
  }

  _dispatchFilter(action, baseEventPayload) {
    const run = () => {
      const sourceWidget =
        this.engine?.widgetManager?.getWidget?.(baseEventPayload.widgetId) ||
        this.engine?.widgetManager?.getAllWidgets?.()?.find((w) => w.id === baseEventPayload.widgetId) ||
        null;
      const result = applyFilterPayload(this.engine, action.payload, {
        sourceWidgetId: baseEventPayload.widgetId,
        sourceWidget,
      });
      if (result.applied) {
        eventBus.emit(BUTTON_EVENTS.FILTER_UPDATE, {
          ...baseEventPayload,
          payload: result.payload || action.payload,
          affectedRows: result.rows,
        });
        eventBus.emit('dashboard:filters-changed', {
          source: 'button-widget',
          buttonId: baseEventPayload.buttonId,
          widgetId: baseEventPayload.widgetId,
        });
      } else {
        const fieldHint = result.payload?.field
          ? `${result.payload.table ? `${result.payload.table}.` : ''}${result.payload.field}`
          : 'поле';
        eventBus.emit('ui:notification', {
          message:
            result.reason === 'missing-field'
              ? 'У кнопки не задано поле фильтра'
              : `Фильтр не применён: не найдено поле «${fieldHint}». Укажите таблицу.поле или перетащите колонку на кнопку (нужен modelId).`,
          type: 'warning',
          duration: 4500,
        });
      }
      return result;
    };

    const debounceMs = Number.isFinite(Number(action.payload?.debounceMs))
      ? Number(action.payload.debounceMs)
      : DEFAULT_FILTER_DEBOUNCE_MS;

    if (debounceMs <= 0) return run();
    clearTimeout(this._filterTimer);
    this._filterTimer = setTimeout(run, debounceMs);
    return { ok: true, scheduled: true };
  }

  _dispatchSetParam(action, baseEventPayload) {
    const payload = action.payload || {};
    if (!this.engine?.setRuntimeParam && !this.engine?.setRuntimeParams) {
      return { ok: false };
    }
    if (payload.key != null) {
      this.engine.setRuntimeParam(String(payload.key), payload.value, {
        source: 'button-widget',
        widgetId: baseEventPayload.widgetId,
        buttonId: baseEventPayload.buttonId,
      });
    }
    if (payload.params && typeof payload.params === 'object') {
      this.engine.setRuntimeParams(payload.params, {
        source: 'button-widget',
        widgetId: baseEventPayload.widgetId,
        buttonId: baseEventPayload.buttonId,
      });
    }
    return { ok: true };
  }

  _dispatchSetVariable(action, baseEventPayload) {
    const payload = action.payload || {};
    if (!this.engine?.setModelVariable && !this.engine?.setModelVariables) {
      return { ok: false };
    }
    const meta = {
      source: 'button-widget',
      widgetId: baseEventPayload.widgetId,
      buttonId: baseEventPayload.buttonId,
    };
    const catalog =
      typeof this.engine.getModelVariableCatalog === 'function'
        ? this.engine.getModelVariableCatalog()
        : [];
    const typeByName = new Map((catalog || []).map((v) => [String(v.name), v.type]));
    const coerce = (key, raw) => {
      const type = typeByName.get(String(key)) || '';
      if (String(type).toLowerCase() === 'bool') {
        const s = String(raw ?? '').trim().toLowerCase();
        if (s === 'true' || s === '1' || s === 'yes') return true;
        if (s === 'false' || s === '0' || s === 'no') return false;
      }
      if (String(type).toLowerCase() === 'number' || String(type).toLowerCase() === 'currency') {
        const n = Number(raw);
        if (Number.isFinite(n) && String(raw).trim() !== '') return n;
      }
      if (raw === true || raw === false) return raw;
      if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
      const s = String(raw ?? '').trim();
      if (s === 'true') return true;
      if (s === 'false') return false;
      if (s !== '' && Number.isFinite(Number(s))) return Number(s);
      return raw;
    };
    if (payload.key != null && String(payload.key).trim() !== '') {
      const key = String(payload.key).trim();
      this.engine.setModelVariable(key, coerce(key, payload.value), meta);
    }
    const batch = payload.variables && typeof payload.variables === 'object' ? payload.variables : null;
    if (batch) {
      const next = {};
      Object.entries(batch).forEach(([key, value]) => {
        const k = String(key || '').trim();
        if (k) next[k] = coerce(k, value);
      });
      this.engine.setModelVariables(next, meta);
    }
    return { ok: true };
  }

  _dispatchCustom(action, baseEventPayload) {
    const payload = action.payload || {};
    const handlerName = payload.handler || payload.name || action.target;
    const handler = customHandlers.get(String(handlerName || ''));
    if (!handler) {
      eventBus.emit('button:custom-missing', { ...baseEventPayload, handlerName });
      return { ok: false, missing: true };
    }
    return handler({
      engine: this.engine,
      action,
      context: baseEventPayload,
    });
  }
}
