import { dataModelService } from '../../../../../services/dataModelService.js';
import { dashboardService } from '../../../../../services/dashboardService.js';
import { invalidateDedupe } from '../../../../../services/requestDedupe.js';
import {
  getDashboardFilterSnapshot,
  invalidateDashboardTransportCaches,
  notifyDashboardDataModelFullRefresh,
  reloadDashboardDataWidgetsWithSnapshot,
} from '../../../../../services/dashboardFilterTransport.js';
import { eventBus } from '../../core/EventBus.js';
import {
  finishButtonCompileProgressModal,
  hideButtonCompileProgressModal,
  showButtonCompileProgressModal,
  updateButtonCompileProgressModal,
} from './buttonCompileProgressModal.js';

let hardReloadInFlight = false;

function collectModelIdsFromWidgets(engine) {
  const ids = new Set();
  const widgets = engine?.widgetManager?.getAllWidgets?.() || [];
  widgets.forEach((w) => {
    const fromDs = w?.dataSource?.modelId ?? w?.dataSource?.model_id;
    const fromSettings = w?.settings?.modelId ?? w?.settings?.model_id;
    const fromBinding = w?.settings?.dataBinding?.modelId;
    [fromDs, fromSettings, fromBinding].forEach((raw) => {
      const n = Number(raw);
      if (Number.isFinite(n) && n > 0) ids.add(n);
    });
    const filters = w?.settings?.filters;
    if (Array.isArray(filters)) {
      filters.forEach((row) => {
        const n = Number(row?.modelId);
        if (Number.isFinite(n) && n > 0) ids.add(n);
      });
    }
  });
  return Array.from(ids);
}

async function resolveModelIds(engine, action = {}) {
  const payload = action.payload && typeof action.payload === 'object' ? action.payload : {};
  const explicit = [];
  if (payload.modelId != null && payload.modelId !== '') explicit.push(payload.modelId);
  if (Array.isArray(payload.modelIds)) explicit.push(...payload.modelIds);
  if (action.target != null && action.target !== '' && action.target !== 'global' && action.target !== 'all') {
    explicit.push(action.target);
  }

  const fromExplicit = [...new Set(
    explicit
      .map((x) => Number(x))
      .filter((n) => Number.isFinite(n) && n > 0),
  )];
  if (fromExplicit.length) return fromExplicit;

  const fromWidgets = collectModelIdsFromWidgets(engine);
  if (fromWidgets.length) return fromWidgets;

  const dashboardId = engine?.dashboardId;
  if (dashboardId == null || dashboardId === '') return [];
  try {
    const res = await dashboardService.getDashboardDataModels(dashboardId);
    const list = Array.isArray(res) ? res : res?.data_models || res?.data || [];
    return [...new Set(
      list
        .map((m) => Number(m?.id ?? m?.model_id ?? m))
        .filter((n) => Number.isFinite(n) && n > 0),
    )];
  } catch (_) {
    return [];
  }
}

export async function reloadDashboardDataFromButton(engine, context = {}) {
  if (!engine) return { ok: false, error: 'engine_missing' };
  try {
    invalidateDedupe();
    invalidateDashboardTransportCaches({
      filtersChanged: false,
      dataChanged: true,
    });
    const snap = getDashboardFilterSnapshot(engine, { force: true });
    engine.__dashboardBypassCache = true;
    await reloadDashboardDataWidgetsWithSnapshot(engine, snap, {
      strategy: 'all',
      fallbackAll: true,
      bypassCache: true,
    });
    eventBus.emit('dashboard:data-reloaded', {
      source: 'button-widget',
      buttonId: context.buttonId || null,
      widgetId: context.widgetId || null,
      at: Date.now(),
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  } finally {
    engine.__dashboardBypassCache = false;
  }
}

function ensureToastHost() {
  let host = document.getElementById('button-action-toast-host');
  if (host) return host;
  const styleId = 'button-action-toast-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      #button-action-toast-host {
        position: fixed;
        right: 1rem;
        bottom: 1rem;
        z-index: 10060;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        pointer-events: none;
        font-family: Inter, system-ui, -apple-system, sans-serif;
      }
      .button-action-toast {
        min-width: 220px;
        max-width: min(360px, calc(100vw - 2rem));
        padding: 0.7rem 0.9rem;
        border-radius: 10px;
        border: 1px solid rgba(255,255,255,0.14);
        background: #1a1d22;
        color: #fff;
        font-size: 0.82rem;
        line-height: 1.4;
        box-shadow: 0 10px 28px rgba(0,0,0,0.35);
        opacity: 0;
        transform: translateY(8px);
        transition: opacity 0.2s ease, transform 0.2s ease;
      }
      .button-action-toast.is-visible { opacity: 1; transform: translateY(0); }
      .button-action-toast.is-success { border-color: rgba(34,197,94,0.45); }
      .button-action-toast.is-error { border-color: rgba(239,68,68,0.5); }
      .button-action-toast.is-warning { border-color: rgba(245,158,11,0.5); }
    `;
    document.head.appendChild(style);
  }
  host = document.createElement('div');
  host.id = 'button-action-toast-host';
  document.body.appendChild(host);
  return host;
}

function toastNotify(message, type = 'info') {
  eventBus.emit('ui:notification', { message, type, duration: 4500 });
  if (typeof document === 'undefined' || !message) return;
  const host = ensureToastHost();
  const el = document.createElement('div');
  el.className = `button-action-toast is-${type || 'info'}`;
  el.textContent = String(message);
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add('is-visible'));
  setTimeout(() => {
    el.classList.remove('is-visible');
    setTimeout(() => el.remove(), 220);
  }, 4500);
}

export async function hardReloadDashboardFromButton(engine, action = {}, context = {}) {
  if (!engine) return { ok: false, error: 'engine_missing' };
  if (hardReloadInFlight) {
    toastNotify('Сборка модели уже выполняется', 'warning');
    return { ok: false, busy: true };
  }

  hardReloadInFlight = true;
  showButtonCompileProgressModal({ title: 'Жёсткая перезагрузка' });
  updateButtonCompileProgressModal({
    status: 'Определяю модели данных…',
    percent: 5,
    step: 0,
    totalSteps: 1,
  });

  try {
    const modelIds = await resolveModelIds(engine, action);
    if (!modelIds.length) {
      finishButtonCompileProgressModal({
        ok: false,
        status: 'Не найдена модель данных для сборки. Укажите modelId в настройках кнопки.',
        autoCloseMs: 0,
      });
      toastNotify('Не найдена модель данных для сборки', 'error');
      return { ok: false, error: 'model_not_found' };
    }

    const totalSteps = modelIds.length + 1; // compile each + refresh
    for (let i = 0; i < modelIds.length; i += 1) {
      const modelId = modelIds[i];
      const base = 8 + (i / totalSteps) * 75;
      updateButtonCompileProgressModal({
        status: `Сборка модели #${modelId} (${i + 1}/${modelIds.length})…`,
        percent: base,
        step: i + 1,
        totalSteps,
        indeterminate: true,
      });

      const res = await dataModelService.compileModel(modelId, {});
      const success = res?.success !== false && !res?.error;
      if (!success) {
        const errMsg = res?.error || res?.detail || 'Ошибка сборки модели';
        finishButtonCompileProgressModal({
          ok: false,
          status: `Модель #${modelId}: ${errMsg}`,
          autoCloseMs: 0,
        });
        toastNotify(`Ошибка сборки модели #${modelId}`, 'error');
        eventBus.emit('dashboard:hard-reload-failed', {
          modelId,
          error: errMsg,
          buttonId: context.buttonId || null,
          widgetId: context.widgetId || null,
        });
        return { ok: false, error: errMsg, modelId };
      }

      updateButtonCompileProgressModal({
        status: `Модель #${modelId} собрана`,
        percent: 8 + ((i + 1) / totalSteps) * 75,
        step: i + 1,
        totalSteps,
        indeterminate: false,
      });
    }

    updateButtonCompileProgressModal({
      status: 'Обновляю данные на дашборде…',
      percent: 88,
      step: totalSteps,
      totalSteps,
      indeterminate: true,
    });

    notifyDashboardDataModelFullRefresh(engine);
    const reloadResult = await reloadDashboardDataFromButton(engine, context);
    if (!reloadResult.ok) {
      finishButtonCompileProgressModal({
        ok: false,
        status: `Сборка завершена, но данные не обновились: ${reloadResult.error || ''}`,
        autoCloseMs: 0,
      });
      toastNotify('Сборка завершена, но данные не обновились', 'warning');
      return { ok: false, compiled: true, error: reloadResult.error };
    }

    const modelsLabel = modelIds.length === 1
      ? `модель #${modelIds[0]} собрана`
      : `${modelIds.length} модели собраны`;
    finishButtonCompileProgressModal({
      ok: true,
      status: `Готово: ${modelsLabel}, данные дашборда обновлены.`,
      autoCloseMs: 2400,
    });
    toastNotify(
      modelIds.length === 1
        ? 'Модель данных собрана, дашборд обновлён'
        : 'Модели данных собраны, дашборд обновлён',
      'success',
    );
    eventBus.emit('dashboard:hard-reload-completed', {
      modelIds,
      buttonId: context.buttonId || null,
      widgetId: context.widgetId || null,
      at: Date.now(),
    });
    return { ok: true, modelIds };
  } catch (err) {
    const detail = err?.response?.data?.detail;
    const msg =
      typeof detail === 'string'
        ? detail
        : detail
          ? JSON.stringify(detail)
          : err?.message || 'Запрос не выполнен';
    finishButtonCompileProgressModal({
      ok: false,
      status: msg,
      autoCloseMs: 0,
    });
    toastNotify(msg, 'error');
    eventBus.emit('dashboard:hard-reload-failed', {
      error: msg,
      buttonId: context.buttonId || null,
      widgetId: context.widgetId || null,
    });
    return { ok: false, error: msg };
  } finally {
    hardReloadInFlight = false;
  }
}

export function cancelButtonHardReloadUi() {
  hideButtonCompileProgressModal();
}
