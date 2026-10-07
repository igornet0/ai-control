import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { WorkspaceEngine } from '../../dashboard_creater/src/core/WorkspaceEngine.js';
import { eventBus } from '../../dashboard_creater/src/core/EventBus.js';
import { registerBuiltins } from '../../dashboard_creater/src/sdk/index.js';
import { widgetService } from '../../../services/widgetService';
import { flowService } from '../../../services/flowService';
import { allowsExportToProfile } from '../../../services/profileWidgetCatalog';
import { buildDashboardSheetPath, resolveNavigateSheetId } from '../../../services/dashboardSheetNav.js';
import { loadProfileTableSort } from '../../../services/profileTableSortStorage.js';
import { showTaskToast } from '../../../components/shared/taskToast';
import mainCssUrl from '../../dashboard_creater/main/styles/main.css?url';
import styles from './EmbedDashboardWidgetPage.module.css';

function ensureEmbedCss() {
  if (typeof document === 'undefined') return Promise.resolve();
  if (document.getElementById('embed-dashboard-widget-css')) return Promise.resolve();
  return new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = mainCssUrl;
    link.id = 'embed-dashboard-widget-css';
    link.onload = () => resolve();
    link.onerror = () => resolve();
    document.head.appendChild(link);
  });
}

function parseDataConfig(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) || {};
    } catch {
      return {};
    }
  }
  return {};
}

function parseDataSource(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'object') return raw;
  if (typeof raw === 'string') {
    const text = raw.trim();
    if (text.startsWith('{') || text.startsWith('[')) {
      try {
        return JSON.parse(raw);
      } catch {
        return raw;
      }
    }
    return raw;
  }
  return null;
}

async function loadPinnedDashboardWidget({ widgetId, dashboardId, flowId }) {
  if (flowId && dashboardId) {
    const snapshot = await flowService.getFlowDashboardSnapshot(flowId, dashboardId);
    const sheets = Array.isArray(snapshot?.payload?.sheets) ? snapshot.payload.sheets : [];
    for (const sheet of sheets) {
      const found = (sheet.widgets || []).find((widget) => Number(widget.id) === Number(widgetId));
      if (found) return found;
    }
    throw new Error('Widget not found in published snapshot');
  }
  return widgetService.getWidget(widgetId);
}

function convertDbWidget(dbWidget) {
  const dc = parseDataConfig(dbWidget.data_config);
  return {
    id: `widget_${dbWidget.id}`,
    type: dbWidget.widget_type,
    x: 0,
    y: 0,
    width: Number(dbWidget.width) || 320,
    height: Number(dbWidget.height) || 220,
    zIndex: 1,
    settings: { ...(dc.settings || {}) },
    dataSource: parseDataSource(dbWidget.data_source),
    styles: dc.styles || {},
  };
}

function fitWidgetToViewport(widget, width, height) {
  if (!widget) return;
  const w = Math.max(120, Math.floor(width || 320));
  const h = Math.max(120, Math.floor(height || 220));
  // Ignore transient 0-size frames during profile card drag/resize.
  if ((width > 0 && width < 40) || (height > 0 && height < 40)) return;
  widget.x = 0;
  widget.y = 0;
  widget.width = w;
  widget.height = h;
  if (typeof widget.updatePosition === 'function') widget.updatePosition();
  if (typeof widget.setSize === 'function') {
    try {
      widget.setSize(w, h);
    } catch {
      // ignore
    }
  } else if (typeof widget.update === 'function') {
    widget.update();
  }
}

/** Widgets that keep local UI controls in the profile embed. */
const PROFILE_INTERACTIVE_TYPES = new Set(['button-widget', 'line-chart', 'table', 'image']);

function lockWidgetInteraction(widget) {
  if (!widget?.element) return;
  const el = widget.element;
  const isInteractive = PROFILE_INTERACTIVE_TYPES.has(widget.type);
  el.classList.add('widget--profile-host');
  el.querySelectorAll('.resize-handle, .widget-profile-pin-btn').forEach((node) => {
    node.style.display = 'none';
    node.style.pointerEvents = 'none';
  });

  if (isInteractive) {
    el.classList.add('widget--profile-interactive');
    el.classList.remove('widget--profile-readonly');
    el.style.pointerEvents = 'auto';
    el.style.cursor = '';
    const content = el.querySelector('.widget-content');
    if (content) {
      content.style.pointerEvents = 'auto';
      content.style.cursor = '';
    }
    return;
  }

  el.classList.add('widget--profile-readonly');
  el.classList.remove('widget--profile-interactive');
  el.style.pointerEvents = 'none';
  el.style.cursor = 'default';
  const content = el.querySelector('.widget-content');
  if (content) {
    content.style.pointerEvents = 'none';
    content.style.cursor = 'default';
  }
}

/**
 * Isolated single-widget viewer for profile iframes.
 * Loads dashboard creator CSS only inside this document.
 */
export default function EmbedDashboardWidgetPage() {
  const [searchParams] = useSearchParams();
  const dashboardId = searchParams.get('dashboardId');
  const sheetId = searchParams.get('sheetId');
  const widgetId = Number(searchParams.get('widgetId'));
  const flowId = searchParams.get('flow');

  const viewportRef = useRef(null);
  const workspaceRef = useRef(null);
  const engineRef = useRef(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    document.documentElement.classList.add('embed-dashboard-widget');
    document.body.classList.add('embed-dashboard-widget');
    return () => {
      document.documentElement.classList.remove('embed-dashboard-widget');
      document.body.classList.remove('embed-dashboard-widget');
    };
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    const workspace = workspaceRef.current;
    if (!viewport || !workspace) return undefined;
    if (!Number.isInteger(widgetId) || widgetId <= 0) {
      setStatus('error');
      setError('Некорректный id виджета');
      return undefined;
    }

    let cancelled = false;
    let engine = null;
    let resizeObserver = null;
    let refreshTimer = null;

    const destroyEngine = () => {
      if (engine?.__embedNavigateHandler) {
        try {
          eventBus.off('dashboard:navigate-requested', engine.__embedNavigateHandler);
        } catch {
          // ignore
        }
        engine.__embedNavigateHandler = null;
      }
      if (engine && !engine._destroyed && typeof engine.destroy === 'function') {
        try {
          engine.destroy();
        } catch {
          // ignore
        }
      }
      if (window.engine === engine) {
        window.engine = null;
      }
      engine = null;
      engineRef.current = null;
    };

    const mount = async () => {
      setStatus('loading');
      setError('');
      try {
        await ensureEmbedCss();
        const dbWidget = await loadPinnedDashboardWidget({ widgetId, dashboardId, flowId });
        if (cancelled) return;

        const settings = parseDataConfig(dbWidget?.data_config)?.settings || {};
        if (!allowsExportToProfile(settings, dbWidget?.widget_type)) {
          setStatus('blocked');
          setError('Экспорт этого виджета в профиль отключён');
          return;
        }

        destroyEngine();
        engine = new WorkspaceEngine(viewport, workspace);
        engineRef.current = engine;
        window.engine = engine;
        engine.dashboardId = Number(dashboardId) || dashboardId;
        engine.sheetId = Number(sheetId) || sheetId;
        registerBuiltins(engine);
        engine.setWidgetAdapters({
          data: {
            getFilters: () => {
              if (engine.filterStore && typeof engine.filterStore.getDescriptors === 'function') {
                return engine.filterStore.getDescriptors();
              }
              return [];
            },
          },
          navigation: {
            getCurrentSheetId: () => engine.sheetId,
            goToSheet: (targetSheetId) => {
              eventBus.emit('dashboard:navigate-requested', {
                targetSheetId,
                payload: {},
              });
            },
          },
          ui: {
            notify: (message) => {
              showTaskToast({
                type: 'success',
                title: String(message || 'Готово'),
              });
            },
          },
        });
        engine.setMode('viewer');
        engine.__profileEmbed = true;
        engine.__profileFlowId = flowId || null;
        if (engine.viewportController) {
          engine.viewportController.staticView = true;
          engine.viewportController.zoom = 1;
          engine.viewportController.offsetX = 0;
          engine.viewportController.offsetY = 0;
          engine.viewportController.updateTransform?.();
        }

        const openDashboardSheet = (targetSheetId, payload = {}) => {
          if (!targetSheetId) return;
          const dash = engine.dashboardId;
          if (dash == null || dash === '') return;
          const resolved = resolveNavigateSheetId(targetSheetId, [], payload) || targetSheetId;
          const url = buildDashboardSheetPath({
            dashboardId: dash,
            sheetId: resolved,
            flowId,
          });
          if (!url) return;
          try {
            if (window.top && window.top !== window) {
              window.top.location.assign(url);
              return;
            }
          } catch {
            // cross-origin top — fall through
          }
          window.open(url, '_blank', 'noopener,noreferrer');
        };

        const onNavigate = ({ targetSheetId, payload }) => {
          openDashboardSheet(targetSheetId, payload);
        };
        eventBus.on('dashboard:navigate-requested', onNavigate);
        engine.__embedNavigateHandler = onNavigate;

        // Wait a frame so the iframe layout has non-zero size.
        await new Promise((resolve) => requestAnimationFrame(() => resolve()));
        if (cancelled) return;

        const widgetJson = convertDbWidget(dbWidget);
        const storedSort = loadProfileTableSort(widgetJson.id, flowId);
        if (storedSort) {
          widgetJson.settings = { ...widgetJson.settings, tableSort: storedSort };
        }
        const hostRect = viewport.getBoundingClientRect();
        widgetJson.width = Math.max(120, Math.floor(hostRect.width || window.innerWidth || widgetJson.width));
        widgetJson.height = Math.max(120, Math.floor(hostRect.height || window.innerHeight || widgetJson.height));

        engine.widgetManager.fromJSON([widgetJson], engine.widgetClasses, true);
        const widget = engine.widgetManager.getAllWidgets()?.[0];
        if (!widget) {
          setStatus('error');
          setError('Не удалось создать виджет');
          return;
        }

        widget.element?.querySelectorAll('.resize-handle, .widget-profile-pin-btn').forEach((node) => {
          node.style.display = 'none';
        });
        lockWidgetInteraction(widget);

        fitWidgetToViewport(
          widget,
          hostRect.width || window.innerWidth,
          hostRect.height || window.innerHeight,
        );

        if (typeof widget.reloadFromDataModel === 'function') {
          try {
            await widget.reloadFromDataModel(engine);
          } catch (reloadError) {
            console.warn('[embed-dashboard-widget] reload failed', reloadError);
          }
        } else if (typeof widget.update === 'function') {
          widget.update();
        }
        lockWidgetInteraction(widget);

        resizeObserver = new ResizeObserver((entries) => {
          const entry = entries[0];
          if (!entry || !engineRef.current) return;
          const { width, height } = entry.contentRect;
          if (width < 40 || height < 40) return;
          const live = engineRef.current.widgetManager?.getAllWidgets?.()?.[0];
          fitWidgetToViewport(live, width, height);
        });
        resizeObserver.observe(viewport);

        refreshTimer = window.setInterval(async () => {
          if (!engineRef.current || engineRef.current._destroyed) return;
          if (flowId) return;
          try {
            const fresh = await widgetService.getWidget(widgetId);
            const freshSettings = parseDataConfig(fresh?.data_config)?.settings || {};
            if (!allowsExportToProfile(freshSettings, fresh?.widget_type)) {
              setStatus('blocked');
              setError('Экспорт этого виджета в профиль отключён');
              destroyEngine();
              return;
            }
            const live = engineRef.current.widgetManager?.getAllWidgets?.()?.[0];
            if (!live) return;
            const keptSort = live.settings?.tableSort || loadProfileTableSort(live.id, flowId);
            const next = convertDbWidget(fresh);
            live.settings = {
              ...next.settings,
              tableSort: keptSort || next.settings?.tableSort || null,
            };
            live.dataSource = next.dataSource;
            live.styles = next.styles;
            if (typeof live.applyStyles === 'function') live.applyStyles();
            if (typeof live.reloadFromDataModel === 'function') {
              await live.reloadFromDataModel(engineRef.current);
            } else if (typeof live.update === 'function') {
              live.update();
            }
            lockWidgetInteraction(live);
            const rect = viewport.getBoundingClientRect();
            fitWidgetToViewport(live, rect.width, rect.height);
          } catch (refreshError) {
            console.warn('[embed-dashboard-widget] refresh failed', refreshError);
          }
        }, 30000);

        if (!cancelled) setStatus('ready');
      } catch (err) {
        console.error('[embed-dashboard-widget] mount failed', err);
        if (!cancelled) {
          setStatus('error');
          setError('Не удалось загрузить виджет дашборда');
          destroyEngine();
        }
      }
    };

    void mount();

    return () => {
      cancelled = true;
      if (refreshTimer) window.clearInterval(refreshTimer);
      if (resizeObserver) resizeObserver.disconnect();
      destroyEngine();
    };
  }, [dashboardId, sheetId, widgetId, flowId]);

  return (
    <div className={styles.page}>
      {(status === 'loading' || status === 'error' || status === 'blocked') && (
        <div className={styles.state}>
          {status === 'loading' && 'Загрузка виджета…'}
          {status !== 'loading' && (error || 'Виджет недоступен')}
        </div>
      )}
      <div
        ref={viewportRef}
        className={`viewport viewer-mode ${styles.viewport} ${status === 'ready' ? styles.viewportReady : styles.viewportHidden}`}
      >
        <div ref={workspaceRef} className={`workspace ${styles.workspace}`} />
      </div>
    </div>
  );
}
