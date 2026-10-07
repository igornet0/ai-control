import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  getFlowViewContext,
  flowNavigateState,
  buildDashboardSheetPath,
  resolveNavigateSheetId,
} from '../../services/dashboardSheetNav.js';
import { WorkspaceEngine } from './src/core/WorkspaceEngine.js';
import { eventBus } from './src/core/EventBus.js';
import { DataManager } from './src/data/DataManager.js';
import { ServerAPI } from './src/core/ServerAPI.js';
import { WidgetStylePanel } from './main/widget-style-panel.js';
import { widgetService } from '../../services/widgetService.js';
import { sheetService } from '../../services/sheetService.js';
import { flowService } from '../../services/flowService.js';
import { dashboardService } from '../../services/dashboardService.js';
import { publicDashboardLinkApi } from '../../services/publicDashboardLinkApi.js';
import { useProfileWidgets } from '../../context/ProfileWidgetsContext';
import {
  allowsExportToProfile,
  parseEngineWidgetDbId,
} from '../../services/profileWidgetCatalog.js';
import { showTaskToast } from '../../components/shared/taskToast';
import {
  dashboardModelsSupportAutoRefresh,
  getDashboardAutoRefreshEnabled,
  getDashboardAutoRefreshIntervalSec,
} from '../../utils/dashboardAutoRefresh.js';
import { canEditDashboard } from '../../utils/dashboardUtils';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import DashboardAiAssistant from './ai/DashboardAiAssistant.jsx';
import {
  applyDataFieldToWidget,
  serializeDashboardFilterSnapshot,
  applyDashboardFilterSnapshot,
} from '../../services/dashboardFilterUtils.js';
import { DATA_FIELD_DRAG_MIME } from '../../services/dashboardSqliteSchemaService.js';
import {
  commitDashboardFilterTransportChange,
  getDashboardFilterSnapshot,
  reloadDashboardDataWidgetsWithSnapshot,
  invalidateDashboardTransportCaches,
} from '../../services/dashboardFilterTransport.js';
import {
  loadDashboardFiltersFromLocalStorage,
  schedulePersistDashboardFilters,
  flushPersistDashboardFilters,
  cancelPersistDashboardFilters,
  shouldUseLocalFilterPersistence,
} from '../../services/dashboardFilterPersistence.js';
import {
  hydrateDashboardModelVariables,
  schedulePersistDashboardModelVars,
  flushPersistDashboardModelVars,
  cancelPersistDashboardModelVars,
  loadModelVariableOverrides,
} from '../../services/dashboardModelVariables.js';
import {
  getDashboardVariablesFromDashboard,
  buildLayoutConfigWithDashboardVariables,
} from '../../utils/dashboardVariables.js';
import { setupActiveFiltersBar } from './activeFiltersBar.js';
import DataPanel from './components/DataPanel.jsx';
import DashboardPresenceBar from './components/DashboardPresenceBar.jsx';
import DashboardRemoteCursors from './components/DashboardRemoteCursors.jsx';
import {
  setDashboardShareContext,
  clearDashboardShareContext,
  getDashboardShareContext,
} from '../../services/shareLinkContext';
import {
  connectRealtimeDashboard,
  realtimeDashboardWsEnabled,
  realtimeTokenForDashboard,
  realtimeIdentityTokenForDashboard,
  sendRealtimeEvent,
  RT_EVENT_OP_FILTERS,
  RT_EVENT_OP_REQUEST_SESSION,
  RT_EVENT_OP_SESSION_HELLO,
  RT_EVENT_OP_USER_JOIN,
  RT_EVENT_OP_USER_LEAVE,
  RT_EVENT_OP_CURSOR,
} from '../../services/realtimeDashboardWs.js';
import { normalizePeer } from './src/presence/dashboardPresence.js';
import {
  widgetPaletteIcons,
  svgToolbarUndo,
  svgToolbarRedo,
  svgToolbarHome,
  svgToolbarHomeSettings,
} from './icons/dashboardCreaterIcons.js';
import {
  applyViewportHomeFromLayoutConfig,
  applyViewportHomeToEngine,
  cancelPersistViewportHome,
  schedulePersistViewportHome,
  setHomePlaceMode,
  syncHomeMarker,
  tryConsumeHomePlaceClick,
} from './src/core/viewportHomeUi.js';
import { useCoarsePointer, isCoarsePointer } from './src/core/coarsePointer.js';

// Импорт виджетов (built-ins регистрируются через SDK)
import { registerBuiltins, builtinDefinitions } from './src/sdk/index.js';
import { applyFilterPayload } from './src/widgets/button/ButtonAction.js';

const WIDGET_PALETTE_ENTRIES = builtinDefinitions
  .filter((d) => !d.hideFromPalette)
  .map((d) => ({ type: d.type, label: d.displayName || d.type }));

// Импорт CSS файлов как URL для динамической загрузки
import mainCssUrl from './main/styles/main.css?url';
import widgetStylePanelCssUrl from './main/styles/widget-style-panel.css?url';

/**
 * Ждём применения stylesheet (или таймаут) перед гидрацией виджетов.
 * Без этого .workspace ещё не 20000px / .widget ещё не position:absolute.
 * @param {HTMLLinkElement | null} link
 * @param {number} [timeoutMs]
 * @returns {Promise<void>}
 */
function whenStylesheetReady(link, timeoutMs = 2500) {
  return new Promise((resolve) => {
    if (!link) {
      resolve();
      return;
    }
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    try {
      if (link.sheet) {
        done();
        return;
      }
    } catch {
      /* cross-origin / not ready */
    }
    link.addEventListener('load', done, { once: true });
    link.addEventListener('error', done, { once: true });
    setTimeout(done, timeoutMs);
  });
}

/** Приводит id к строке вида widget_<число> для ссылок между виджетами в data_config. */
function normalizeWidgetIdForConfig(raw) {
  if (raw == null || raw === '') return null;
  const s = String(raw);
  if (s.startsWith('widget_')) return s;
  const n = parseInt(s, 10);
  if (Number.isFinite(n)) return `widget_${n}`;
  return s;
}

/** Числовой id только для формата widget_<n> из БД (не client widget_<ts>_<rand>). */
function engineWidgetIdToDbNumeric(id) {
  if (id == null || typeof id !== 'string') return null;
  if (!id.startsWith('widget_')) return null;
  const parts = id.split('_');
  if (parts.length !== 2) return null;
  const n = parseInt(parts[1], 10);
  return Number.isFinite(n) ? n : null;
}

/** JSONB / API иногда отдаёт data_config строкой. */
function parseDataConfigFromDB(raw) {
  if (raw == null || raw === '') return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (t.startsWith('{') || t.startsWith('[')) {
      try {
        const p = JSON.parse(t);
        return typeof p === 'object' && p !== null && !Array.isArray(p) ? p : {};
      } catch {
        return {};
      }
    }
    return {};
  }
  return {};
}

const BUTTON_NAVIGATION_STORAGE_PREFIX = 'dashboard-creater:button-nav';


function makeButtonNavigationStorageKey(dashboardId, sheetId) {
  return `${BUTTON_NAVIGATION_STORAGE_PREFIX}:${String(dashboardId ?? '')}:${String(sheetId ?? '')}`;
}

function persistButtonNavigationContext(dashboardId, sheetId, payload = {}) {
  if (typeof window === 'undefined') return;
  if (dashboardId == null || sheetId == null || sheetId === '') return;
  try {
    window.sessionStorage.setItem(
      makeButtonNavigationStorageKey(dashboardId, sheetId),
      JSON.stringify({
        at: Date.now(),
        ...payload,
      }),
    );
  } catch {
    // ignore storage write errors
  }
}

function consumeButtonNavigationContext(dashboardId, sheetId) {
  if (typeof window === 'undefined') return null;
  if (dashboardId == null || sheetId == null || sheetId === '') return null;
  const key = makeButtonNavigationStorageKey(dashboardId, sheetId);
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    window.sessionStorage.removeItem(key);
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function normalizeButtonFilterPayloads(filters) {
  if (!filters) return [];
  const arr = Array.isArray(filters) ? filters : [filters];
  return arr
    .map((item) => {
      if (typeof item === 'string') {
        const [field, value] = item.split('=');
        if (!field) return null;
        return { field, value: value ?? '' };
      }
      if (item && typeof item === 'object') return item;
      return null;
    })
    .filter(Boolean);
}

function applyButtonNavigationContext(engine, navContext) {
  if (!engine || !navContext || typeof navContext !== 'object') return;
  const params = navContext.params;
  if (params && typeof params === 'object') {
    engine.setRuntimeParams(params, { source: 'button-widget:navigation-context' });
  }
  const filterPayloads = normalizeButtonFilterPayloads(navContext.filters);
  filterPayloads.forEach((payload) => {
    applyFilterPayload(engine, payload, { sourceWidgetId: 'button-widget-navigation' });
  });
}

/**
 * Активный выбор фильтра (значения) — состояние листа/сессии, не конфиг виджета.
 * В БД сохраняем только привязку полей; выбор — в localStorage на весь dashboardId.
 * @param {string} type
 * @param {Record<string, unknown>} settings
 */
function sanitizeWidgetSettingsForPersist(type, settings) {
  if (!settings || typeof settings !== 'object') return settings || {};
  if (type === 'filter' && Array.isArray(settings.filters)) {
    return {
      ...settings,
      filters: settings.filters.map((row) => {
        if (!row || typeof row !== 'object') return row;
        return {
          ...row,
          selectedValues: [],
          excludedValues: [],
          pattern: '',
        };
      }),
    };
  }
  if (type === 'line-chart' && settings.dashboardBrushX) {
    const next = { ...settings };
    delete next.dashboardBrushX;
    return next;
  }
  return settings;
}

/**
 * Сбросить активный выбор на виджетах после загрузки из БД (до apply localStorage листа).
 * @param {object[]} widgets
 */
function clearEphemeralFilterSelectionsOnWidgets(widgets) {
  (widgets || []).forEach((w) => {
    if (w?.type === 'filter' && Array.isArray(w.settings?.filters)) {
      w.settings.filters.forEach((row) => {
        if (!row || typeof row !== 'object') return;
        row.selectedValues = [];
        row.excludedValues = [];
        row.pattern = '';
      });
    }
    if (w?.type === 'line-chart' && w.settings?.dashboardBrushX) {
      delete w.settings.dashboardBrushX;
    }
  });
}

/**
 * Преобразование виджета из формата WorkspaceEngine в формат БД
 */
function convertWidgetToDBFormat(widget, sheetId, orderIndex) {
  // Числовой id БД только для widget_<n> (две части). Иначе — новый виджет (id временный).
  let widgetId = widget.id;
  if (widgetId && widgetId.startsWith('widget_')) {
    const parts = String(widgetId).split('_');
    if (
      parts.length === 2 &&
      parts[0] === 'widget' &&
      parts[1] !== '' &&
      !Number.isNaN(Number(parts[1]))
    ) {
      widgetId = parts[1];
    }
  }

  const data_config = {
    settings: sanitizeWidgetSettingsForPersist(widget.type, widget.settings || {}),
    styles: widget.styles || {}
  };

  // Шкаф: связи с дочерними виджетами лежат вне settings — без этого после перезагрузки дети остаются на workspace.
  if (widget.type === 'container') {
    if (Array.isArray(widget.containedWidgets) && widget.containedWidgets.length > 0) {
      data_config.containedWidgets = widget.containedWidgets.map((id) => normalizeWidgetIdForConfig(id));
      const numericIds = widget.containedWidgets
        .map((id) => engineWidgetIdToDbNumeric(normalizeWidgetIdForConfig(id)))
        .filter((x) => x != null);
      if (numericIds.length) {
        data_config.containedWidgetNumericIds = numericIds;
      }
    }
    if (widget.activeTabId != null && widget.activeTabId !== '') {
      data_config.activeTabId = normalizeWidgetIdForConfig(widget.activeTabId);
    }
  }

  return {
    id: widgetId, // Может быть строкой или числом
    name: widget.name || `${widget.type}_${orderIndex}`,
    widget_type: widget.type,
    data_source: widget.dataSource || null,
    data_config,
    position_x: widget.x,
    position_y: widget.y,
    width: widget.width,
    height: widget.height,
    order_index: orderIndex,
    is_visible: true,
    refresh_interval: 60
  };
}

/**
 * data_source в БД: TEXT с JSON-объектом привязки или legacy-строка.
 */
function parseDataSourceFromDB(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'object') return raw;
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (t.startsWith('{') || t.startsWith('[')) {
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

/**
 * Преобразование виджета из формата БД в формат WorkspaceEngine
 */
function convertDBToWidgetFormat(dbWidget) {
  const dc = parseDataConfigFromDB(dbWidget.data_config);
  let settings = dc.settings || {};
  // Активный выбор не берём из БД (мог остаться от старых сохранений).
  settings = sanitizeWidgetSettingsForPersist(dbWidget.widget_type, settings);
  const out = {
    id: `widget_${dbWidget.id}`,
    type: dbWidget.widget_type,
    x: dbWidget.position_x,
    y: dbWidget.position_y,
    width: dbWidget.width,
    height: dbWidget.height,
    zIndex: dbWidget.order_index,
    settings,
    dataSource: parseDataSourceFromDB(dbWidget.data_source),
    styles: dc.styles || {}
  };

  if (dbWidget.widget_type === 'container') {
    let childIds = [];
    const rawList = dc.containedWidgets ?? dc.contained_widgets;
    if (Array.isArray(rawList) && rawList.length > 0) {
      childIds = rawList.map((id) => normalizeWidgetIdForConfig(id)).filter(Boolean);
    }
    const numericIds =
      dc.containedWidgetNumericIds ??
      dc.contained_widget_numeric_ids ??
      null;
    if (
      (!childIds || childIds.length === 0) &&
      Array.isArray(numericIds) &&
      numericIds.length > 0
    ) {
      childIds = numericIds.map((n) => `widget_${Number(n)}`);
    }
    // Ранние сохранения / только settings: восстанавливаем плоский список из групп вкладок
    if (
      childIds.length === 0 &&
      Array.isArray(settings.containerTabGroups) &&
      settings.containerTabGroups.length > 0
    ) {
      childIds = settings.containerTabGroups
        .flat()
        .map((id) => normalizeWidgetIdForConfig(id))
        .filter(Boolean);
    }
    if (childIds.length > 0) {
      out.containedWidgets = [...new Set(childIds)];
    }
    if (dc.activeTabId != null && dc.activeTabId !== '') {
      out.activeTabId = normalizeWidgetIdForConfig(dc.activeTabId);
    }
  }

  return out;
}

const DashboardCreaterApp = ({ user, onLogout, shareContext = null }) => {
  const { id, sheetId } = useParams();
  const dashboardId = shareContext?.dashboardId ?? id;
  const navigate = useNavigate();
  const location = useLocation();
  const profileWidgets = useProfileWidgets();
  const profileWidgetsRef = useRef(profileWidgets);
  profileWidgetsRef.current = profileWidgets;
  const routeIdsRef = useRef({ dashboardId, sheetId });
  routeIdsRef.current = { dashboardId, sheetId };
  const flowCtxFromRoute = getFlowViewContext(location);
  const hideModeSwitch = Boolean(flowCtxFromRoute);
  const shareReadOnly = shareContext?.permission === 'read';
  const [layoutReadOnly, setLayoutReadOnly] = useState(
    () => shareReadOnly || Boolean(flowCtxFromRoute),
  );
  const [accessKnown, setAccessKnown] = useState(
    () => Boolean(shareContext) || !dashboardId,
  );
  const viewOnly = shareReadOnly || hideModeSwitch || layoutReadOnly;
  const flowViewId = flowCtxFromRoute?.flowId ?? null;
  const engineRef = useRef(null);
  const stylePanelRef = useRef(null);
  const containerRef = useRef(null);
  const widgetsLoadedRef = useRef(false); // Флаг для предотвращения двойной загрузки
  /** true только после завершения loadWidgetsFromDB для текущего mount */
  const widgetsHydratedRef = useRef(false);
  /** Инвалидирует отложенный/in-flight load при Strict Mode remount */
  const widgetsLoadGenRef = useRef(0);
  /** @type {React.MutableRefObject<{ schedule: () => void, flush: () => Promise<void>, cancel: () => void } | null>} */
  const autoSaveRef = useRef(null);
  const [sheets, setSheets] = useState([]);
  const sheetsRef = useRef(sheets);
  sheetsRef.current = sheets;
  const [dashboardName, setDashboardName] = useState('');
  const currentSheetName = sheets.find((s) => String(s.id) === String(sheetId))?.name || '';
  useDocumentTitle([currentSheetName, dashboardName || 'Панель управления']);
  // Загружаем режим из localStorage или используем 'editor' по умолчанию
  const [currentMode, setCurrentMode] = useState(() => {
    const savedMode = localStorage.getItem('dashboard-creater-mode');
    return savedMode || 'editor';
  });

  const [sidebarTab, setSidebarTab] = useState(() => {
    const saved = localStorage.getItem('dashboard-creater-sidebar-tab');
    return saved === 'data' ? 'data' : 'widgets';
  });
  const coarsePointer = useCoarsePointer();
  const [widgetPanelOpen, setWidgetPanelOpen] = useState(false);
  const [toolbarMoreOpen, setToolbarMoreOpen] = useState(false);
  const [stylePanelOpen, setStylePanelOpen] = useState(false);
  const [presenceSelfId, setPresenceSelfId] = useState(null);
  const [presencePeers, setPresencePeers] = useState([]);
  const presencePeersRef = useRef([]);
  const presenceSelfIdRef = useRef(null);
  presencePeersRef.current = presencePeers;
  presenceSelfIdRef.current = presenceSelfId;

  const navCtxRef = useRef({});
  navCtxRef.current = {
    shareToken: shareContext?.token || null,
    dashboardId,
    flowViewId,
    viewOnly,
    sheetId,
  };

  const dataPanelEnabled =
    !viewOnly &&
    currentMode === 'editor' &&
    sidebarTab === 'data';

  useEffect(() => {
    localStorage.setItem('dashboard-creater-sidebar-tab', sidebarTab);
  }, [sidebarTab]);

  useEffect(() => {
    const engine = engineRef.current;
    if (engine) engine.coarsePointer = coarsePointer;
  }, [coarsePointer]);

  useEffect(() => {
    const closePanel = () => setWidgetPanelOpen(false);
    const unsubClose = eventBus.on('widget-panel:close', closePanel);
    const unsubStyle = eventBus.on('style-panel:visibility', ({ open } = {}) => {
      setStylePanelOpen(Boolean(open));
    });
    return () => {
      unsubClose?.();
      unsubStyle?.();
    };
  }, []);

  useEffect(() => {
    if (viewOnly || currentMode === 'viewer') {
      setWidgetPanelOpen(false);
      setToolbarMoreOpen(false);
    }
  }, [viewOnly, currentMode]);

  useEffect(() => {
    if (!toolbarMoreOpen) return undefined;
    const onPointerDown = (e) => {
      const wrap = document.querySelector('.toolbar-overflow');
      if (wrap && !wrap.contains(e.target)) {
        setToolbarMoreOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [toolbarMoreOpen]);

  useLayoutEffect(() => {
    const app = containerRef.current;
    if (!app) return undefined;

    const syncToolbarStackOffset = () => {
      const toolbar = app.querySelector('#toolbar');
      const filtersBar = app.querySelector('#active-filters-bar');
      let h = 0;
      if (toolbar) h += toolbar.getBoundingClientRect().height;
      if (
        filtersBar &&
        !filtersBar.classList.contains('active-filters-bar--empty') &&
        filtersBar.offsetHeight > 0
      ) {
        h += filtersBar.getBoundingClientRect().height;
      }
      app.style.setProperty('--toolbar-stack-offset', `${Math.round(h)}px`);
    };

    syncToolbarStackOffset();

    const ro = new ResizeObserver(() => syncToolbarStackOffset());
    const toolbar = app.querySelector('#toolbar');
    const filtersBar = app.querySelector('#active-filters-bar');
    if (toolbar) ro.observe(toolbar);
    if (filtersBar) ro.observe(filtersBar);

    const onFiltersSync = () => syncToolbarStackOffset();
    eventBus.on('active-filters:sync', onFiltersSync);
    window.addEventListener('resize', syncToolbarStackOffset);

    const mo =
      filtersBar &&
      new MutationObserver(() => {
        syncToolbarStackOffset();
      });
    if (mo && filtersBar) {
      mo.observe(filtersBar, { attributes: true, attributeFilter: ['class'] });
    }

    return () => {
      ro.disconnect();
      if (mo) mo.disconnect();
      eventBus.off('active-filters:sync', onFiltersSync);
      window.removeEventListener('resize', syncToolbarStackOffset);
    };
  }, []);

  useLayoutEffect(() => {
    if (shareContext) {
      setDashboardShareContext(shareContext);
    } else {
      clearDashboardShareContext();
    }
    return () => {
      if (shareContext) clearDashboardShareContext();
    };
  }, [shareContext]);

  useEffect(() => {
    const eng = engineRef.current;
    if (!eng || eng._destroyed) return;
    try {
      eng.widgetManager?.getAllWidgets?.()?.forEach((widget) => {
        if (typeof widget.syncProfilePinButton === 'function') {
          widget.syncProfilePinButton();
        }
      });
    } catch {
      // ignore
    }
  }, [profileWidgets?.widgets]);

  // Загрузка листов при изменении dashboard ID (из snapshot в flow-режиме)
  useEffect(() => {
    if (dashboardId) {
      const flowCtx = flowViewId ? { flowId: flowViewId, readOnlyFlow: true } : null;
      loadDashboardSheets(dashboardId, setSheets, flowCtx, shareContext?.token);
    }
  }, [dashboardId, flowViewId, shareContext?.token]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (shareContext?.token) {
          const b = await publicDashboardLinkApi.bootstrap(shareContext.token);
          if (!cancelled) {
            setDashboardName(b?.dashboard?.name || 'Панель (по ссылке)');
            setLayoutReadOnly(shareContext?.permission === 'read');
            setAccessKnown(true);
          }
          return;
        }
        if (flowViewId) {
          if (dashboardId) {
            try {
              const data = await dashboardService.getDashboard(dashboardId);
              if (!cancelled) {
                setDashboardName(data?.name || `Панель ${dashboardId}`);
              }
            } catch {
              if (!cancelled) setDashboardName(`Панель ${dashboardId}`);
            }
          }
          if (!cancelled) {
            setLayoutReadOnly(true);
            setAccessKnown(true);
          }
          return;
        }
        if (dashboardId) {
          const data = await dashboardService.getDashboard(dashboardId);
          if (!cancelled) {
            setDashboardName(data?.name || `Панель ${dashboardId}`);
            setLayoutReadOnly(!canEditDashboard(data, user));
            setAccessKnown(true);
          }
        } else if (!cancelled) {
          setAccessKnown(true);
        }
      } catch (error) {
        console.error('Error loading dashboard name for toolbar:', error);
        if (!cancelled) {
          setDashboardName('');
          setLayoutReadOnly(true);
          setAccessKnown(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dashboardId, shareContext?.token, shareContext?.permission, user, flowViewId]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !accessKnown) return;

    // Динамическая загрузка стилей
    const linkMain = document.createElement('link');
    linkMain.rel = 'stylesheet';
    linkMain.href = mainCssUrl;
    linkMain.id = 'dashboard-creater-main-css';
    document.head.appendChild(linkMain);

    const linkWidgetPanel = document.createElement('link');
    linkWidgetPanel.rel = 'stylesheet';
    linkWidgetPanel.href = widgetStylePanelCssUrl;
    linkWidgetPanel.id = 'dashboard-creater-widget-panel-css';
    document.head.appendChild(linkWidgetPanel);

    let engine = null;
    let stylePanel = null;
    let handleContainerRemoveWidget = null;
    let widgetSelectedHandler = null;
    let widgetDeselectedHandler = null;
    let widgetDataBindingUpdatedHandler = null;
    
    // Функции очистки для setup функций
    let cleanupToolbar = null;
    let cleanupWidgetPanel = null;
    let cleanupUI = null;
    let cleanupModePanels = null;
    let cleanupDataFieldDrop = null;
    let cleanupDashboardFilters = null;
    let cleanupDashboardModelVars = null;
    let cleanupActiveFiltersBar = null;
    let cleanupAutoSave = null;
    let autoSaveModeGuard = null;
    let cleanupRtFilters = null;
    let buttonNavigateHandler = null;
    let onDataInputSubmitted = null;
    let realtimeWs = null;
    /** @type {ReturnType<typeof setTimeout> | null} */
    let loadWidgetsTimeoutId = null;

    try {
      
      const viewport = document.getElementById('viewport');
      const workspace = document.getElementById('workspace');

      if (!viewport || !workspace) {
        console.error('Ошибка: viewport или workspace не найдены!');
        return;
      }

            // Создание движка
      engine = new WorkspaceEngine(viewport, workspace);
      engineRef.current = engine;
      engine.coarsePointer = isCoarsePointer();
      engine.dashboardId =
        dashboardId != null && dashboardId !== ''
          ? Number(dashboardId) || dashboardId
          : null;
      engine.sheetId = sheetId ?? null;
      if (shouldUseLocalFilterPersistence(shareContext)) {
        engine.applyModelVariableOverrides(
          loadModelVariableOverrides(engine.dashboardId, flowViewId),
          { persist: false, silent: true },
        );
      }
      const syncProfilePinButtons = () => {
        try {
          engine.widgetManager?.getAllWidgets?.()?.forEach((widget) => {
            if (typeof widget.syncProfilePinButton === 'function') {
              widget.syncProfilePinButton();
            }
          });
        } catch {
          // ignore
        }
      };
      const resolveDashboardPinIds = () => {
        const route = routeIdsRef.current || {};
        const dash = Number(engine.dashboardId ?? route.dashboardId);
        const sheet = Number(engine.sheetId ?? route.sheetId);
        if (!Number.isInteger(dash) || dash <= 0 || !Number.isInteger(sheet) || sheet <= 0) {
          return null;
        }
        return { dashboardId: dash, sheetId: sheet };
      };
      engine.profilePinController = {
        canPin(widget) {
          if (widget?.type === 'filter') return false;
          if (!allowsExportToProfile(widget?.settings, widget?.type)) return false;
          if (parseEngineWidgetDbId(widget?.id) == null) return false;
          return resolveDashboardPinIds() != null;
        },
        isPinned(widget) {
          const widgetId = parseEngineWidgetDbId(widget?.id);
          return widgetId != null
            && Boolean(profileWidgetsRef.current?.isPinned?.('dashboard', String(widgetId), {
              flowId: flowViewId || undefined,
            }));
        },
        async toggle(widget) {
          const widgetId = parseEngineWidgetDbId(widget?.id);
          if (widget?.type === 'filter') {
            showTaskToast({
              type: 'error',
              title: 'Фильтр нельзя добавить в профиль',
              message: 'Виджет «Фильтр» доступен только на дашборде',
            });
            return;
          }
          if (widgetId == null) {
            showTaskToast({
              type: 'error',
              title: 'Сначала сохраните виджет',
              message: 'В профиль можно добавить только сохранённый виджет дашборда',
            });
            return;
          }
          if (!allowsExportToProfile(widget?.settings, widget?.type)) {
            showTaskToast({
              type: 'error',
              title: 'Экспорт в профиль отключён',
              message: 'Включите параметр в панели настроек виджета',
            });
            return;
          }
          const ids = resolveDashboardPinIds();
          if (!ids) {
            showTaskToast({
              type: 'error',
              title: 'Нельзя закрепить виджет',
              message: 'Не удалось определить id дашборда или листа',
            });
            return;
          }
          const title = String(
            widget?.settings?.title
            || widget?.settings?.name
            || widget?.type
            || `Виджет #${widgetId}`,
          ).trim();
          try {
            await profileWidgetsRef.current?.toggleWidget?.('dashboard', String(widgetId), {
              dashboardId: ids.dashboardId,
              sheetId: ids.sheetId,
              title,
              widgetType: widget?.type,
              flowId: flowViewId || undefined,
            });
          } catch {
            // Toast already shown in ProfileWidgetsContext.persist
          }
          syncProfilePinButtons();
        },
      };
      const forcedViewer = viewOnly;
      const toolbarMode = forcedViewer ? 'viewer' : currentMode;
      if (forcedViewer) {
        setCurrentMode('viewer');
        localStorage.setItem('dashboard-creater-mode', 'viewer');
      }
      window.engine = engine; // Для отладки
      
      // Создание менеджера данных
      const dataManager = new DataManager();
      window.dataManager = dataManager; // Для отладки

      // Тот же origin в dev (Vite /api) или VITE_API_URL
      const apiUrl =
        import.meta.env.VITE_API_URL && String(import.meta.env.VITE_API_URL).trim()
          ? `${String(import.meta.env.VITE_API_URL).replace(/\/$/, '')}/api`
          : import.meta.env.DEV
            ? '/api'
            : `${typeof window !== 'undefined' ? window.location.origin : ''}/api`;
      const serverAPI = new ServerAPI(apiUrl);
      window.serverAPI = serverAPI; // Для отладки

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
          goToSheet: (sheetId, payload) => {
            eventBus.emit('dashboard:navigate-requested', {
              targetSheetId: sheetId,
              payload: payload || {},
            });
          },
        },
        ui: {
          notify: () => {},
        },
      });

      buttonNavigateHandler = ({ targetSheetId, payload, buttonId, widgetId }) => {
        const nav = navCtxRef.current || {};
        const resolvedSheetId = resolveNavigateSheetId(
          targetSheetId,
          sheetsRef.current,
          payload,
        );
        if (!resolvedSheetId) return;
        const navPayload = payload && typeof payload === 'object' ? payload : {};
        if (navPayload.params && typeof navPayload.params === 'object') {
          engine.setRuntimeParams(navPayload.params, {
            source: 'button-widget:navigate',
            buttonId,
            widgetId,
          });
        }
        persistButtonNavigationContext(engine.dashboardId, resolvedSheetId, {
          filters: navPayload.filters,
          params: navPayload.params,
          sourceWidgetId: widgetId || null,
          sourceButtonId: buttonId || null,
        });
        const path = buildDashboardSheetPath({
          shareToken: getDashboardShareContext()?.token || nav.shareToken,
          dashboardId: nav.dashboardId,
          sheetId: resolvedSheetId,
          flowId: nav.flowViewId,
        });
        if (!path) return;
        const go = () => {
          navigate(path, { state: flowNavigateState(nav.flowViewId) });
        };
        flushPersistDashboardFilters(engine, nav.sheetId, shareContext, nav.flowViewId);
        flushPersistDashboardModelVars(engine, shareContext, nav.flowViewId);
        if (nav.viewOnly) {
          go();
          return;
        }
        const flush = autoSaveRef.current?.flush;
        if (typeof flush === 'function') {
          Promise.resolve(flush())
            .catch(() => {})
            .finally(go);
        } else {
          go();
        }
      };
      eventBus.on('dashboard:navigate-requested', buttonNavigateHandler);

      const DATA_INPUT_TABLE_UPDATE_WINDOW_MS = 120000;
      const reloadDashboardDataAfterChange = (eventPayload = null) => {
        if (engineRef.current !== engine) return;
        void (async () => {
          try {
            const modelId =
              eventPayload?.model_id ?? eventPayload?.modelId ?? eventPayload?.payload?.model_id;
            const changedModelIds =
              modelId != null && modelId !== '' ? [modelId] : undefined;
            invalidateDashboardTransportCaches({
              filtersChanged: false,
              dataChanged: true,
              changedModelIds,
            });
            const snap = getDashboardFilterSnapshot(engine, { force: true });
            engine.__dashboardBypassCache = true;
            await reloadDashboardDataWidgetsWithSnapshot(engine, snap, {
              strategy: 'all',
              fallbackAll: true,
              bypassCache: true,
            });
          } catch (e) {
            console.warn('[dashboard] data reload failed', e);
          } finally {
            if (engineRef.current === engine) {
              engine.__dashboardBypassCache = false;
            }
          }
        })();
      };

      const shouldReloadOnTableUpdated = () => {
        if (engine?.__dashboardAutoRefresh) return true;
        const until = Number(engine?.__dashboardDataInputRefreshUntil) || 0;
        return until > Date.now();
      };

      onDataInputSubmitted = () => {
        engine.__dashboardDataInputRefreshUntil = Date.now() + DATA_INPUT_TABLE_UPDATE_WINDOW_MS;
        reloadDashboardDataAfterChange();
      };
      eventBus.on('dashboard:data-input-submitted', onDataInputSubmitted);

      
      // Режим после регистрации виджетов (read-only share → только просмотр)
      if (toolbarMode) {
                engine.setMode(toolbarMode);
      }

            // Настройка панели инструментов
      cleanupToolbar = setupToolbar(
        engine,
        sheetId,
        dashboardId,
        navigate,
        toolbarMode,
        setCurrentMode,
        forcedViewer
      );

      const dashNum = engine.dashboardId;
      engine.__dashboardAutoRefresh = false;
      let cleanupAutoRefreshPoll = null;

      const runAutoRefreshReload = (eventPayload = null) => {
        if (!engine?.__dashboardAutoRefresh) return;
        reloadDashboardDataAfterChange(eventPayload);
      };

      const applyAutoRefreshSetting = (dashMeta, linkedModels) => {
        if (engineRef.current !== engine) return;
        const models = Array.isArray(linkedModels)
          ? linkedModels
          : linkedModels?.data_models || [];
        engine.__linkedDataModels = models;
        // Trust saved dashboard flag. Model ingest check is only for settings UI visibility.
        const enabled = getDashboardAutoRefreshEnabled(dashMeta);
        engine.__dashboardAutoRefresh = enabled;
        engine.__dashboardAutoRefreshIntervalSec = getDashboardAutoRefreshIntervalSec(dashMeta);
        engine.__dashboardAutoRefreshModelsOk = dashboardModelsSupportAutoRefresh(models);
        return enabled;
      };

      const startAutoRefreshPolling = (intervalSec) => {
        if (cleanupAutoRefreshPoll) {
          cleanupAutoRefreshPoll();
          cleanupAutoRefreshPoll = null;
        }
        if (!engine.__dashboardAutoRefresh) return;
        const ms = Math.max(5, Number(intervalSec) || 30) * 1000;
        const timer = setInterval(runAutoRefreshReload, ms);
        cleanupAutoRefreshPoll = () => {
          clearInterval(timer);
        };
      };

      // Resolve auto-refresh even when realtime WS flag is off (polling fallback).
      // JWT dashboard meta is not available on guest share/demo links.
      if (dashNum != null && dashNum !== '' && !shareContext?.token) {
        void (async () => {
          try {
            const [dashMeta, linkedModels] = await Promise.all([
              dashboardService.getDashboard(dashNum).catch(() => null),
              dashboardService.getDashboardDataModels(dashNum).catch(() => []),
            ]);
            const enabled = applyAutoRefreshSetting(dashMeta, linkedModels);
            if (enabled) {
              startAutoRefreshPolling(engine.__dashboardAutoRefreshIntervalSec);
            }
          } catch (e) {
            console.warn('[auto-refresh] failed to resolve setting', e);
            if (engineRef.current === engine) {
              engine.__dashboardAutoRefresh = false;
            }
          }
        })();
      }

      if (realtimeDashboardWsEnabled() && dashNum != null && dashNum !== '') {
        const rtTok = realtimeTokenForDashboard();
        const rtIdentity = realtimeIdentityTokenForDashboard();
        if (rtTok) {
          const wid = typeof dashNum === 'string' ? Number(dashNum) || dashNum : dashNum;
          const onRtMessage = (msg) => {
            const t = msg?.type;
            if (t !== 'EVENT' && t !== 'Event') return;
            const msgClientId = msg?.meta?.client_id || msg?.payload?.client_id;
            if (msg.op === RT_EVENT_OP_SESSION_HELLO) {
              const selfPeer = normalizePeer(msg.payload?.self, msg.user);
              const peers = (msg.payload?.peers || [])
                .map((p) => normalizePeer(p, p?.user_id))
                .filter(Boolean);
              if (selfPeer) {
                setPresenceSelfId(selfPeer.clientId);
                setPresencePeers([...peers, selfPeer]);
              } else {
                setPresencePeers(peers);
              }
              return;
            }
            if (msg.op === RT_EVENT_OP_USER_JOIN) {
              const peer = normalizePeer(msg.payload, msg.user);
              if (!peer) return;
              setPresencePeers((prev) => {
                const rest = prev.filter((p) => p.clientId !== peer.clientId);
                return [...rest, peer];
              });
              return;
            }
            if (msg.op === RT_EVENT_OP_USER_LEAVE) {
              const leaveId = msgClientId || msg.payload?.client_id;
              if (!leaveId) return;
              setPresencePeers((prev) => prev.filter((p) => p.clientId !== String(leaveId)));
              eventBus.emit('presence:leave', { clientId: String(leaveId) });
              return;
            }
            if (msg.op === RT_EVENT_OP_CURSOR) {
              const cid = String(msgClientId || '');
              if (!cid || cid === presenceSelfIdRef.current) return;
              const known = presencePeersRef.current.find((p) => p.clientId === cid);
              const peer = known || normalizePeer(
                { ...msg.payload, client_id: cid, user_id: msg.user },
                msg.user,
              );
              if (!peer) return;
              const pl = msg.payload || {};
              eventBus.emit('presence:cursor', {
                clientId: cid,
                displayName: peer.displayName,
                color: peer.color,
                x: Number(pl.x) || 0,
                y: Number(pl.y) || 0,
                sheetId: pl.sheetId,
                visible: pl.visible !== false,
              });
              return;
            }
            if (msg.op === RT_EVENT_OP_REQUEST_SESSION) {
              const pl = msg.payload;
              // Фильтры — на весь дашборд: отвечаем пиру с любого листа.
              if (!pl) return;
              if (
                pl.dashboardId != null &&
                engine.dashboardId != null &&
                String(pl.dashboardId) !== String(engine.dashboardId)
              ) {
                return;
              }
              if (shareContext?.sessionType === 'isolated') return;
              try {
                const snap = serializeDashboardFilterSnapshot(engine, sheetId);
                sendRealtimeEvent(realtimeWs, {
                  op: RT_EVENT_OP_FILTERS,
                  payload: snap,
                  meta: { sessionBootstrap: true },
                });
              } catch (e) {
                console.warn('[realtime] session answer failed', e);
              }
              return;
            }
            if (msg.op !== RT_EVENT_OP_FILTERS) {
              if (
                shouldReloadOnTableUpdated() &&
                (msg.op === 'table_updated' || msg.payload?.type === 'table_updated')
              ) {
                reloadDashboardDataAfterChange(msg.payload || msg);
              }
              return;
            }
            const pl = msg.payload;
            if (!pl) return;
            if (
              pl.dashboardId != null &&
              engine.dashboardId != null &&
              String(pl.dashboardId) !== String(engine.dashboardId)
            ) {
              return;
            }
            applyDashboardFilterSnapshot(engine, pl);
            const snap = commitDashboardFilterTransportChange(engine);
            eventBus.emit('active-filters:sync', { source: 'realtime' });
            void reloadDashboardDataWidgetsWithSnapshot(engine, snap, {
              strategy: 'by-model',
            });
          };
          realtimeWs = connectRealtimeDashboard({
            dashboardId: wid,
            token: rtTok,
            identityToken: rtIdentity,
            onMessage: onRtMessage,
          });

          let rtFilterDebounce = null;
          const scheduleRtFilterBroadcast = (data) => {
            if (data?.source === 'realtime') return;
            if (!sheetId) return;
            if (!realtimeWs || realtimeWs.readyState !== WebSocket.OPEN) return;
            if (shareContext?.sessionType === 'isolated') return;
            if (rtFilterDebounce) clearTimeout(rtFilterDebounce);
            rtFilterDebounce = setTimeout(() => {
              rtFilterDebounce = null;
              try {
                const snap = serializeDashboardFilterSnapshot(engine, sheetId);
                sendRealtimeEvent(realtimeWs, {
                  op: RT_EVENT_OP_FILTERS,
                  payload: snap,
                });
              } catch (e) {
                console.warn('[realtime] filter broadcast failed', e);
              }
            }, 220);
          };
          eventBus.on('dashboard:filters-changed', scheduleRtFilterBroadcast);
          const sendCursor = (payload) => {
            if (!realtimeWs || realtimeWs.readyState !== WebSocket.OPEN) return;
            if (shareContext?.sessionType === 'isolated') return;
            sendRealtimeEvent(realtimeWs, {
              op: RT_EVENT_OP_CURSOR,
              payload,
            });
          };
          let lastCursorTs = 0;
          const viewportEl = engine.viewportController?.viewport;
          const onPointerMove = (e) => {
            const now = Date.now();
            if (now - lastCursorTs < 40) return;
            lastCursorTs = now;
            const vc = engine.viewportController;
            if (!vc?.viewport) return;
            const rect = vc.viewport.getBoundingClientRect();
            const ws = vc.viewportToWorkspace(e.clientX - rect.left, e.clientY - rect.top);
            sendCursor({ x: ws.x, y: ws.y, sheetId, visible: true });
          };
          const onPointerLeave = () => {
            sendCursor({ x: 0, y: 0, sheetId, visible: false });
          };
          viewportEl?.addEventListener('pointermove', onPointerMove);
          viewportEl?.addEventListener('pointerleave', onPointerLeave);
          const prevCleanupRt = cleanupRtFilters;
          cleanupRtFilters = () => {
            if (typeof prevCleanupRt === 'function') prevCleanupRt();
            eventBus.off('dashboard:filters-changed', scheduleRtFilterBroadcast);
            viewportEl?.removeEventListener('pointermove', onPointerMove);
            viewportEl?.removeEventListener('pointerleave', onPointerLeave);
            if (rtFilterDebounce) clearTimeout(rtFilterDebounce);
            rtFilterDebounce = null;
            setPresencePeers([]);
            setPresenceSelfId(null);
          };
        }
      }

      // Ensure poll cleanup is registered even if WS cleanup overwrites path above.
      {
        const prevCleanup = cleanupRtFilters;
        cleanupRtFilters = () => {
          if (typeof prevCleanup === 'function') prevCleanup();
          if (cleanupAutoRefreshPoll) {
            cleanupAutoRefreshPoll();
            cleanupAutoRefreshPoll = null;
          }
        };
      }

            // Настройка панели виджетов
      cleanupWidgetPanel = setupWidgetPanel(engine);

      // Register formula cache invalidation on query bump (data/filter refresh).
      void import('./src/formula/formulaInvalidation.js')
        .then((m) => m.ensureFormulaInvalidationHooks?.())
        .catch(() => {});

            // Инициализация панели стилей
      stylePanel = new WidgetStylePanel(engine.viewportController, engine);
      stylePanelRef.current = stylePanel;
      window.stylePanel = stylePanel; // Для отладки

      // Открытие панели стилей при выделении виджета (только в режиме редактора)
      widgetSelectedHandler = ({ widget }) => {
        if (engine.mode === 'editor') {
          stylePanel.show(widget);
        }
      };
      eventBus.on('widget:selected', widgetSelectedHandler);

      widgetDataBindingUpdatedHandler = async ({ widget: w }) => {
        if (w && typeof w.reloadFromDataModel === 'function') {
          await w.reloadFromDataModel(engine);
        }
        if (engine.mode === 'editor' && w) {
          engine.widgetManager.selectWidget(w.id);
          stylePanel.show(w);
        }
      };
      eventBus.on('widget:data-binding-updated', widgetDataBindingUpdatedHandler);

      // Закрытие панели стилей при снятии выделения
      widgetDeselectedHandler = () => {
        stylePanel.hide();
      };
      eventBus.on('widget:deselected-all', widgetDeselectedHandler);

      // Настройка автоматического сохранения (не для read-only share)
      if (sheetId && shareContext?.permission !== 'read' && !viewOnly) {
        const attachAutoSave = () => {
          if (cleanupAutoSave) return;
          if (engine.mode !== 'editor') return; // В режиме просмотра автосохранение запрещено

          const autoSave = createAutoSaveHandler(engine, sheetId);
          autoSaveRef.current = autoSave;

          // Подписка на события изменений виджетов
          const autoSaveOnAdd = () => autoSave.schedule();
          const autoSaveOnMove = () => autoSave.schedule();
          const autoSaveOnResize = () => autoSave.schedule();
          const autoSaveOnDelete = () => autoSave.schedule();
          const autoSaveOnContainerAdd = () => autoSave.schedule();
          const autoSaveOnStylesChanged = () => autoSave.schedule();
          const autoSaveOnSettingsChanged = () => autoSave.schedule();

          eventBus.on('widget:added', autoSaveOnAdd);
          eventBus.on('widget:move-end', autoSaveOnMove);
          eventBus.on('widget:resize-end', autoSaveOnResize);
          eventBus.on('widget:deleted', autoSaveOnDelete);
          eventBus.on('widget:added-to-container', autoSaveOnContainerAdd);
          eventBus.on('widget:styles-changed', autoSaveOnStylesChanged);
          eventBus.on('widget:settings-changed', autoSaveOnSettingsChanged);

          cleanupAutoSave = () => {
            eventBus.off('widget:added', autoSaveOnAdd);
            eventBus.off('widget:move-end', autoSaveOnMove);
            eventBus.off('widget:resize-end', autoSaveOnResize);
            eventBus.off('widget:deleted', autoSaveOnDelete);
            eventBus.off('widget:added-to-container', autoSaveOnContainerAdd);
            eventBus.off('widget:styles-changed', autoSaveOnStylesChanged);
            eventBus.off('widget:settings-changed', autoSaveOnSettingsChanged);
            if (autoSaveRef.current === autoSave) {
              autoSaveRef.current = null;
            }
            cleanupAutoSave = null;
          };
        };

        const detachAutoSave = async () => {
          const ctl = autoSaveRef.current;
          if (ctl) {
            try {
              if (engine?.__sheetWidgetsHydrated === true) {
                await ctl.flush();
              } else {
                ctl.cancel();
              }
            } catch (err) {
              console.warn('Не удалось дожать autosave перед отключением:', err);
            }
            ctl.cancel();
          }
          if (cleanupAutoSave) cleanupAutoSave();
        };

        // Первичная установка
        attachAutoSave();

        // Переключение режима на лету
        autoSaveModeGuard = ({ mode }) => {
          if (mode === 'viewer') {
            void detachAutoSave();
          }
          if (mode === 'editor') attachAutoSave();
        };
        eventBus.on('mode:changed', autoSaveModeGuard);
      }

      // Обработка удаления виджетов из контейнера
      handleContainerRemoveWidget = (e) => {
        const { containerId, widgetId } = e.detail;
        const container = engine.widgetManager.getWidget(containerId);
        if (container && container.removeWidget) {
          container.removeWidget(widgetId, engine.widgetManager);
          engine.saveSnapshot();
        }
      };
      document.addEventListener('container:remove-widget', handleContainerRemoveWidget);

            // Обновление UI при изменении состояния
      cleanupUI = updateUI(engine);

            // Управление видимостью панелей в зависимости от режима
      cleanupModePanels = setupModePanels(engine, stylePanel);

      cleanupDataFieldDrop = setupDataFieldDropOnWorkspace(engine);

      let dashboardFilterReloadCoalescePending = false;
      const flushDashboardFilterReloadWave = () => {
        dashboardFilterReloadCoalescePending = false;
        engine.__dashboardFilterReloadGen =
          typeof engine.__dashboardFilterReloadGen === 'number'
            ? engine.__dashboardFilterReloadGen + 1
            : 1;
        const snap = commitDashboardFilterTransportChange(engine);
        schedulePersistDashboardFilters(engine, sheetId, shareContext, flowViewId);
        void reloadDashboardDataWidgetsWithSnapshot(engine, snap, {
          strategy: 'by-model',
          // KPI/формулы без dataSource.modelId иначе пропускаются при непустом changedModelIds.
          fallbackAll: true,
          bypassCache: true,
        });
      };
      const onDashboardFiltersChanged = () => {
        if (dashboardFilterReloadCoalescePending) return;
        dashboardFilterReloadCoalescePending = true;
        queueMicrotask(flushDashboardFilterReloadWave);
      };
      eventBus.on('dashboard:filters-changed', onDashboardFiltersChanged);
      cleanupDashboardFilters = () => {
        eventBus.off('dashboard:filters-changed', onDashboardFiltersChanged);
      };

      const onDashboardModelVarsChanged = (payload = {}) => {
        const scope = payload?.meta?.scope;
        if (scope !== 'dashboard') {
          schedulePersistDashboardModelVars(engine, shareContext, flowViewId);
        }
        engine.__dashboardFilterReloadGen =
          typeof engine.__dashboardFilterReloadGen === 'number'
            ? engine.__dashboardFilterReloadGen + 1
            : 1;
        // Сброс formula/query caches — иначе TextWidget/KPI могут отдать старый снимок.
        try {
          invalidateDashboardTransportCaches({
            filtersChanged: true,
            dataChanged: true,
          });
        } catch (e) {
          console.warn('[dashboard] variable cache invalidate failed', e);
        }
        const snap = getDashboardFilterSnapshot(engine, { force: true });
        void reloadDashboardDataWidgetsWithSnapshot(engine, snap, {
          strategy: 'all',
          fallbackAll: true,
          bypassCache: true,
        });
      };
      eventBus.on('dashboard:model-variables-changed', onDashboardModelVarsChanged);

      let dashVarPersistTimer = null;
      const flushDashboardVariablesToDb = () => {
        if (dashVarPersistTimer) {
          clearTimeout(dashVarPersistTimer);
          dashVarPersistTimer = null;
        }
        const dashId = engine.dashboardId;
        if (dashId == null || dashId === '' || engine._destroyed) return;
        if (shareContext?.permission === 'read' || viewOnly) return;
        void (async () => {
          try {
            const list =
              typeof engine.getDashboardVariableCatalog === 'function'
                ? engine.getDashboardVariableCatalog()
                : [];
            const dash = await dashboardService.getDashboard(dashId);
            const layout_config = buildLayoutConfigWithDashboardVariables(dash, list);
            await dashboardService.updateDashboard(dashId, { layout_config });
          } catch (e) {
            console.warn('[dashboard] failed to persist dashboard variables', e);
          }
        })();
      };
      const onDashboardVarsPersist = (payload = {}) => {
        if (payload?.meta?.persist === false) return;
        if (payload?.meta?.silent) return;
        if (dashVarPersistTimer) clearTimeout(dashVarPersistTimer);
        dashVarPersistTimer = setTimeout(() => {
          dashVarPersistTimer = null;
          flushDashboardVariablesToDb();
        }, 350);
      };
      eventBus.on('dashboard:dashboard-variables-changed', onDashboardVarsPersist);

      cleanupDashboardModelVars = () => {
        eventBus.off('dashboard:model-variables-changed', onDashboardModelVarsChanged);
        eventBus.off('dashboard:dashboard-variables-changed', onDashboardVarsPersist);
        if (dashVarPersistTimer) {
          clearTimeout(dashVarPersistTimer);
          dashVarPersistTimer = null;
        }
      };

      cleanupActiveFiltersBar = setupActiveFiltersBar(engine);

      // Загрузка виджетов из БД после CSS + инициализации (иначе clamp/layout ломаются)
      if (sheetId && !widgetsLoadedRef.current) {
        widgetsLoadedRef.current = true;
        widgetsHydratedRef.current = false;
        if (engine) engine.__sheetWidgetsHydrated = false;
        const loadGen = ++widgetsLoadGenRef.current;
        const engineForLoad = engine;
        void (async () => {
          await whenStylesheetReady(linkMain);
          if (loadGen !== widgetsLoadGenRef.current || !engineForLoad || engineForLoad._destroyed) {
            return;
          }
          // Один кадр после CSS, чтобы computed style workspace успел обновиться
          await new Promise((r) => requestAnimationFrame(() => r()));
          if (loadGen !== widgetsLoadGenRef.current || engineForLoad._destroyed) return;

          loadWidgetsTimeoutId = setTimeout(() => {
            loadWidgetsTimeoutId = null;
            if (loadGen !== widgetsLoadGenRef.current || engineForLoad._destroyed) return;
            const flowCtx = getFlowViewContext(location);
            loadWidgetsFromDB(engineForLoad, sheetId, () => {
              // Общая ссылка (shared): после БД запросить у пиров актуальное состояние фильтров сессии
              if (!realtimeDashboardWsEnabled()) return;
              if (!shareContext || shareContext.sessionType !== 'shared') return;
              const tryRequestSession = (attempt) => {
                if (attempt > 25) return;
                if (!realtimeWs || realtimeWs.readyState !== WebSocket.OPEN) {
                  setTimeout(() => tryRequestSession(attempt + 1), 80);
                  return;
                }
                try {
                  sendRealtimeEvent(realtimeWs, {
                    op: RT_EVENT_OP_REQUEST_SESSION,
                    payload: { sheetId },
                  });
                } catch (e) {
                  console.warn('[realtime] REQUEST_DASHBOARD_SESSION failed', e);
                }
              };
              tryRequestSession(0);
            }, shareContext, flowCtx)
              .catch((error) => {
                console.error('Ошибка при загрузке виджетов из БД:', error);
                if (loadGen === widgetsLoadGenRef.current) {
                  widgetsLoadedRef.current = false; // Сбрасываем флаг при ошибке
                }
              })
              .finally(() => {
                if (loadGen !== widgetsLoadGenRef.current) return;
                widgetsHydratedRef.current = true;
                if (engineForLoad && !engineForLoad._destroyed) {
                  engineForLoad.__sheetWidgetsHydrated = true;
                }
              });
          }, 0);
        })();
      }

          } catch (error) {
      console.error('Критическая ошибка при инициализации DashboardCreaterApp:', error);
      alert('Ошибка при загрузке приложения: ' + error.message);
    }

    // Очистка при размонтировании
    return () => {
      
      if (loadWidgetsTimeoutId != null) {
        clearTimeout(loadWidgetsTimeoutId);
        loadWidgetsTimeoutId = null;
      }
      // Инвалидируем in-flight load (Strict Mode / смена листа)
      widgetsLoadGenRef.current += 1;
      const sheetWasHydrated = widgetsHydratedRef.current;
      widgetsHydratedRef.current = false;
      // Сбрасываем флаг загрузки виджетов
      widgetsLoadedRef.current = false;

      // Фильтры дашборда: не очищаем чипы «вхолостую» — после гидрации нового листа
      // применится тот же dashboard-снимок.
      
      // Удаление динамически загруженных стилей
      const linkMain = document.getElementById('dashboard-creater-main-css');
      if (linkMain && linkMain.parentNode) {
        linkMain.parentNode.removeChild(linkMain);
      }
      
      const linkWidgetPanel = document.getElementById('dashboard-creater-widget-panel-css');
      if (linkWidgetPanel && linkWidgetPanel.parentNode) {
        linkWidgetPanel.parentNode.removeChild(linkWidgetPanel);
      }
      
      // Вызываем функции очистки для setup функций
      if (cleanupToolbar && typeof cleanupToolbar === 'function') {
        cleanupToolbar();
      }
      
      if (cleanupWidgetPanel && typeof cleanupWidgetPanel === 'function') {
        cleanupWidgetPanel();
      }
      
      if (cleanupUI && typeof cleanupUI === 'function') {
        cleanupUI();
      }
      
      if (cleanupModePanels && typeof cleanupModePanels === 'function') {
        cleanupModePanels();
      }

      if (cleanupDataFieldDrop && typeof cleanupDataFieldDrop === 'function') {
        cleanupDataFieldDrop();
      }

      if (cleanupDashboardFilters && typeof cleanupDashboardFilters === 'function') {
        cleanupDashboardFilters();
      }
      if (cleanupDashboardModelVars && typeof cleanupDashboardModelVars === 'function') {
        cleanupDashboardModelVars();
      }

      if (cleanupActiveFiltersBar && typeof cleanupActiveFiltersBar === 'function') {
        cleanupActiveFiltersBar();
      }
      
      if (handleContainerRemoveWidget) {
        document.removeEventListener('container:remove-widget', handleContainerRemoveWidget);
      }
      
      if (widgetSelectedHandler) {
        eventBus.off('widget:selected', widgetSelectedHandler);
      }
      
      if (widgetDeselectedHandler) {
        eventBus.off('widget:deselected-all', widgetDeselectedHandler);
      }

      if (widgetDataBindingUpdatedHandler) {
        eventBus.off('widget:data-binding-updated', widgetDataBindingUpdatedHandler);
      }
      
      // Отписываемся от автосохранения (и блокировки по режиму)
      if (autoSaveModeGuard) {
        eventBus.off('mode:changed', autoSaveModeGuard);
        autoSaveModeGuard = null;
      }
      // Дожимаем pending save только если лист уже гидратирован из БД.
      // Иначе Strict Mode remount / быстрый unmount успевает flush([]) и стирает виджеты.
      const pendingFlush = autoSaveRef.current;
      let widgetsSnapshotForFlush = null;
      if (
        sheetWasHydrated &&
        pendingFlush &&
        engine &&
        !engine._destroyed &&
        typeof engine.widgetManager?.toJSON === 'function'
      ) {
        try {
          widgetsSnapshotForFlush = engine.widgetManager.toJSON() || [];
        } catch (_) {
          widgetsSnapshotForFlush = null;
        }
      }
      // Фильтры: sync flush до destroy, иначе 400ms debounce пишет fields:[] и removeItem.
      if (sheetWasHydrated && engine && !engine._destroyed) {
        flushPersistDashboardFilters(engine, sheetId, shareContext, flowViewId);
        flushPersistDashboardModelVars(engine, shareContext, flowViewId);
      } else if (engine) {
        cancelPersistDashboardFilters(engine);
        cancelPersistDashboardModelVars(engine);
      }
      if (cleanupAutoSave) {
        cleanupAutoSave();
      }
      if (pendingFlush) {
        if (sheetWasHydrated && typeof pendingFlush.flush === 'function') {
          try {
            void pendingFlush.flush(widgetsSnapshotForFlush);
          } catch (err) {
            console.warn('Не удалось дожать autosave при смене листа:', err);
          }
        } else if (typeof pendingFlush.cancel === 'function') {
          try {
            pendingFlush.cancel();
          } catch (_) {
            /* ignore */
          }
        }
      }

      if (stylePanel) {
        stylePanel.hide();
        if (typeof stylePanel.destroy === 'function') {
          stylePanel.destroy();
        }
      }

      if (cleanupRtFilters) {
        cleanupRtFilters();
        cleanupRtFilters = null;
      }
      if (buttonNavigateHandler) {
        eventBus.off('dashboard:navigate-requested', buttonNavigateHandler);
        buttonNavigateHandler = null;
      }
      if (onDataInputSubmitted) {
        eventBus.off('dashboard:data-input-submitted', onDataInputSubmitted);
        onDataInputSubmitted = null;
      }

      if (realtimeWs) {
        try {
          realtimeWs.close();
        } catch (_) {
          /* ignore */
        }
        realtimeWs = null;
      }

      if (engine) {
        // Очистка движка если есть метод destroy
        if (typeof engine.destroy === 'function') {
          engine.destroy();
        }
      }
      
      engineRef.current = null;
      stylePanelRef.current = null;
    };
  }, [dashboardId, sheetId, flowViewId, shareContext?.token, shareContext?.permission, shareContext?.sessionType, accessKnown, viewOnly]);

  const publishedNavState = flowNavigateState(flowViewId);

  const handleDashboardBack = () => {
    if (shareContext?.token) {
      navigate('/');
      return;
    }
    if (dashboardId) {
      navigate(`/dashboard/${dashboardId}`, { state: publishedNavState });
    }
  };

  return (
    <div
      id="app"
      ref={containerRef}
      className={[
        viewOnly || currentMode === 'viewer' ? 'mode-viewer' : 'mode-editor',
        coarsePointer ? 'app--coarse-pointer' : '',
        widgetPanelOpen ? 'app--widget-panel-open' : '',
        stylePanelOpen ? 'app--style-panel-open' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ height: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}
    >
      {/* Панель инструментов */}
      <div id="toolbar" className="toolbar">
        <div className="toolbar-section toolbar-section-leading">
          <button
            type="button"
            className="toolbar-dashboard-title"
            onClick={handleDashboardBack}
            title={
              shareContext?.token
                ? 'Вернуться на главную'
                : 'Вернуться к редактору панели управления'
            }
          >
            ← {dashboardName || '…'}
          </button>
        </div>
        <div
          className="toolbar-section"
          style={hideModeSwitch ? { display: 'none' } : undefined}
        >
          <button
            id="btn-mode-editor"
            className="btn btn-active"
            hidden={viewOnly}
            style={viewOnly ? { display: 'none' } : undefined}
          >
            Редактор
          </button>
          <button id="btn-mode-viewer" className="btn">Просмотр</button>
        </div>
        <div className="toolbar-section toolbar-section--secondary">
          <button id="btn-load" className="btn">Загрузить</button>
          <button id="btn-export" className="btn">Экспорт JSON</button>
        </div>
        <div className="toolbar-overflow">
          <button
            type="button"
            id="btn-toolbar-more"
            className="btn toolbar-more-btn"
            aria-label="Ещё"
            aria-expanded={toolbarMoreOpen}
            aria-controls="toolbar-overflow-menu"
            onClick={() => setToolbarMoreOpen((open) => !open)}
          >
            ⋯
          </button>
          <div
            id="toolbar-overflow-menu"
            className={`toolbar-overflow-menu${toolbarMoreOpen ? ' is-open' : ''}`}
            hidden={!toolbarMoreOpen}
          >
            <button
              type="button"
              className="btn"
              onClick={() => {
                document.getElementById('btn-load')?.click();
                setToolbarMoreOpen(false);
              }}
            >
              Загрузить
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                document.getElementById('btn-export')?.click();
                setToolbarMoreOpen(false);
              }}
            >
              Экспорт JSON
            </button>
          </div>
        </div>
        <div className="toolbar-section">
          <button
            id="btn-undo"
            type="button"
            className="btn"
            title="Отменить (Ctrl+Z)"
            aria-label="Отменить"
            dangerouslySetInnerHTML={{ __html: svgToolbarUndo }}
          />
          <button
            id="btn-redo"
            type="button"
            className="btn"
            title="Повторить (Ctrl+Y)"
            aria-label="Повторить"
            dangerouslySetInnerHTML={{ __html: svgToolbarRedo }}
          />
          <button
            id="btn-refresh-data"
            type="button"
            className="btn"
            title="Обновить данные виджетов"
          >
            Обновить данные
          </button>
          <button
            id="btn-delete-widget"
            type="button"
            className="btn"
            title="Удалить выделенный виджет (как Delete). Если фокус в поле панели стилей справа — кликните по холсту или используйте эту кнопку."
            style={{ display: 'none' }}
            hidden
          >
            Удалить виджет
          </button>
        </div>
        <div className="toolbar-section toolbar-home-wrap">
          <label className="toolbar-zoom-label">Масштаб:</label>
          <input type="range" id="zoom-slider" className="toolbar-zoom-range" min="0.1" max="3" step="0.1" defaultValue="1" />
          <span id="zoom-value">100%</span>
          <button
            id="btn-home"
            type="button"
            className="btn"
            title="Вернуться к точке Home"
            aria-label="Точка Home"
            dangerouslySetInnerHTML={{ __html: svgToolbarHome }}
          />
          <button
            id="btn-home-settings"
            type="button"
            className="btn"
            title="Настроить точку Home"
            aria-label="Настроить точку Home"
            aria-expanded="false"
            aria-controls="toolbar-home-config"
            style={{ display: 'none' }}
            hidden
            dangerouslySetInnerHTML={{ __html: svgToolbarHomeSettings }}
          />
          <div
            id="toolbar-home-config"
            className="toolbar-home-config"
            title="Точка возврата камеры"
            hidden
            role="dialog"
            aria-label="Настройки точки Home"
          >
            <label htmlFor="home-x">X</label>
            <input id="home-x" type="number" step="1" defaultValue="0" aria-label="Home X" />
            <label htmlFor="home-y">Y</label>
            <input id="home-y" type="number" step="1" defaultValue="0" aria-label="Home Y" />
            <input
              id="home-zoom"
              type="number"
              step="0.1"
              min="0.1"
              max="3"
              placeholder="zoom"
              title="Zoom при Home (пусто = не менять)"
              aria-label="Home zoom"
            />
            <button id="btn-place-home" type="button" className="btn btn-sm btn-place-home" title="Клик по полотну задаёт точку">
              Метка
            </button>
            <button id="btn-reset-home" type="button" className="btn btn-sm" title="Сбросить в (0, 0)">
              0,0
            </button>
          </div>
        </div>
        <div className="toolbar-section toolbar-section-trailing">
          <DashboardPresenceBar
            peers={presencePeers}
            selfClientId={presenceSelfId}
            engineRef={engineRef}
            sheetId={sheetId}
          />
          <label htmlFor="sheet-selector">Лист:</label>
          <select 
            id="sheet-selector" 
            className="sheet-selector"
            value={sheetId || ''}
            onChange={(e) => {
              const newSheetId = e.target.value;
              if (!newSheetId || !dashboardId || String(newSheetId) === String(sheetId || '')) {
                return;
              }
              const go = () => {
                const path = buildDashboardSheetPath({
                  shareToken: shareContext?.token,
                  dashboardId,
                  sheetId: newSheetId,
                  flowId: flowViewId,
                });
                if (!path) return;
                navigate(path, { state: publishedNavState });
              };
              flushPersistDashboardFilters(
                engineRef.current,
                sheetId,
                shareContext,
                flowViewId,
              );
              flushPersistDashboardModelVars(engineRef.current, shareContext, flowViewId);
              if (viewOnly) {
                go();
                return;
              }
              const flush = autoSaveRef.current?.flush;
              if (typeof flush === 'function') {
                Promise.resolve(flush())
                  .catch((err) => {
                    console.warn('Не удалось сохранить виджеты перед сменой листа:', err);
                  })
                  .finally(go);
              } else {
                go();
              }
            }}
          >
            {sheets.length === 0 ? (
              <option value="">Загрузка...</option>
            ) : (
              sheets.map((sheet) => (
                <option key={sheet.id} value={sheet.id}>
                  {sheet.name || `Лист ${sheet.id}`}
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      <div
        id="active-filters-bar"
        className="active-filters-bar active-filters-bar--empty"
        aria-label="Активные фильтры"
      />

      {/* Панель виджетов / данные (скрыта в read-only потоке и публичной ссылке) */}
      {!viewOnly && (
      <div id="widget-panel" className="widget-panel">
        <div className="sidebar-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={sidebarTab === 'widgets'}
            className={`sidebar-tab${sidebarTab === 'widgets' ? ' active' : ''}`}
            onClick={() => setSidebarTab('widgets')}
          >
            Виджеты
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={sidebarTab === 'data'}
            className={`sidebar-tab${sidebarTab === 'data' ? ' active' : ''}`}
            onClick={() => setSidebarTab('data')}
          >
            Данные
          </button>
        </div>

        <div
          className="sidebar-tab-panel"
          style={{ display: sidebarTab === 'widgets' ? 'block' : 'none' }}
          role="tabpanel"
          aria-hidden={sidebarTab !== 'widgets'}
        >
          <div className="widget-list">
            {WIDGET_PALETTE_ENTRIES.map(({ type, label }) => (
              <div key={type} className="widget-item" data-type={type}>
                <span
                  className="widget-item-icon"
                  aria-hidden="true"
                  dangerouslySetInnerHTML={{ __html: widgetPaletteIcons[type] || '' }}
                />
                <span className="widget-item-label">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div
          className="sidebar-tab-panel"
          style={{ display: sidebarTab === 'data' ? 'block' : 'none' }}
          role="tabpanel"
          aria-hidden={sidebarTab !== 'data'}
        >
          <DataPanel
            dashboardId={dashboardId}
            enabled={dataPanelEnabled}
            coarsePointer={coarsePointer}
            canEdit={!viewOnly}
          />
        </div>
      </div>
      )}

      <button
        type="button"
        className="widget-panel-fab"
        id="btn-open-widget-panel"
        aria-label="Виджеты и данные"
        hidden={viewOnly}
        onClick={() => {
          setWidgetPanelOpen((open) => {
            const next = !open;
            if (next) {
              stylePanelRef.current?.hide?.();
            }
            return next;
          });
        }}
      >
        +
      </button>
      <button
        type="button"
        className="widget-panel-backdrop"
        id="widget-panel-backdrop"
        aria-label="Закрыть панель"
        onClick={() => {
          setWidgetPanelOpen(false);
          stylePanelRef.current?.hide?.();
        }}
      />

      {/* Рабочее пространство */}
      <div id="viewport" className="viewport">
        <div id="workspace" className="workspace"></div>
        <DashboardRemoteCursors engineRef={engineRef} sheetId={sheetId} />
      </div>

      <DashboardAiAssistant
        engineRef={engineRef}
        dashboardId={dashboardId}
        sheetId={sheetId}
        dashboardName={dashboardName}
        mode={viewOnly || currentMode === 'viewer' ? 'viewer' : 'editor'}
        shareToken={shareContext?.token || null}
        onPersist={async () => {
          const flush = autoSaveRef.current?.flush;
          if (typeof flush === 'function') await flush();
        }}
      />
    </div>
  );
};

/**
 * Загрузка виджетов из БД
 */
const INITIAL_WIDGET_RELOAD_BATCH_SIZE = 4;

function sortWidgetsForInitialDataReload(widgets) {
  const priority = new Set([
    'kpi',
    'table',
    'line-chart',
    'bar-chart',
    'pie-chart',
    'gauge',
  ]);
  const hi = [];
  const lo = [];
  (widgets || []).forEach((w) => {
    if (priority.has(w.type)) hi.push(w);
    else lo.push(w);
  });
  return [...hi, ...lo];
}

function yieldForNextReloadChunk() {
  return new Promise((resolve) => {
    const ric = typeof requestIdleCallback === 'function' ? requestIdleCallback : null;
    if (ric) {
      ric(() => resolve(), { timeout: 1200 });
    } else {
      setTimeout(resolve, 16);
    }
  });
}

async function reloadWidgetsFromDataModelInBatches(widgets, engine) {
  const ordered = sortWidgetsForInitialDataReload(widgets);
  if (engine) {
    engine.__dashboardBulkReloadDepth = (engine.__dashboardBulkReloadDepth || 0) + 1;
  }
  try {
    for (let i = 0; i < ordered.length; i += INITIAL_WIDGET_RELOAD_BATCH_SIZE) {
      if (i > 0) {
        // eslint-disable-next-line no-await-in-loop
        await yieldForNextReloadChunk();
      }
      const chunk = ordered.slice(i, i + INITIAL_WIDGET_RELOAD_BATCH_SIZE);
      // eslint-disable-next-line no-await-in-loop
      await Promise.all(
        chunk.map(async (widget) => {
          if (typeof widget.reloadFromDataModel !== 'function') return;
          try {
            await widget.reloadFromDataModel(engine);
          } catch (err) {
            console.error('reloadFromDataModel', widget.type, err);
          }
        }),
      );
    }
  } finally {
    if (engine) {
      engine.__dashboardBulkReloadDepth = Math.max(
        0,
        (engine.__dashboardBulkReloadDepth || 1) - 1,
      );
    }
  }

  // После bulk: догрузить края линейных графиков (лимит 5000), иначе серия обрезана до pan.
  ordered.forEach((widget) => {
    if (widget?.type !== 'line-chart') return;
    if (typeof widget._tryFetchLineDataEdges === 'function') {
      void widget._tryFetchLineDataEdges();
    } else if (typeof widget._scheduleLineDataFetch === 'function') {
      widget._scheduleLineDataFetch();
    }
  });
}

async function loadWidgetsFromDB(engine, sheetId, onLoaded, shareCtx = null, flowCtx = null) {
  try {
    let dbWidgets = [];
    /** @type {Record<string, unknown>} */
    let layoutConfig = {};

    if (flowCtx?.readOnlyFlow && flowCtx?.flowId && engine.dashboardId != null) {
            const snapshotResponse = await flowService.getFlowDashboardSnapshot(
        flowCtx.flowId,
        engine.dashboardId,
      );
      const payload = snapshotResponse?.payload || {};
      const sheets = Array.isArray(payload.sheets) ? payload.sheets : [];
      const sheet = sheets.find((s) => String(s.id) === String(sheetId));
      dbWidgets = Array.isArray(sheet?.widgets) ? sheet.widgets : [];
      layoutConfig =
        sheet?.layout_config && typeof sheet.layout_config === 'object' ? sheet.layout_config : {};
    } else {
            const raw = await widgetService.getSheetWidgets(sheetId);
      dbWidgets = Array.isArray(raw) ? raw : raw?.widgets || raw?.data || [];
      try {
        const sheetMeta = await sheetService.getSheet(sheetId);
        layoutConfig =
          sheetMeta?.layout_config && typeof sheetMeta.layout_config === 'object'
            ? sheetMeta.layout_config
            : {};
      } catch (layoutErr) {
        console.warn('Не удалось загрузить layout_config листа', layoutErr);
        layoutConfig = {};
      }
    }

    engine.__sheetLayoutConfig = layoutConfig;
    applyViewportHomeFromLayoutConfig(layoutConfig, engine);

    if (dbWidgets && dbWidgets.length > 0) {
      // Преобразуем виджеты из формата БД в формат WorkspaceEngine
      const widgets = dbWidgets.map(convertDBToWidgetFormat);
      
      // Загружаем виджеты в движок (skipHistory=true чтобы не сохранять начальное состояние в историю)
      engine.widgetManager.fromJSON(widgets, engine.widgetClasses, true);
      
      // Обновляем все виджеты после загрузки
      const allWidgets = engine.widgetManager.getAllWidgets();
      allWidgets.forEach(widget => {
        // Убеждаемся, что виджет правильно позиционирован
        if (widget.updatePosition && typeof widget.updatePosition === 'function') {
          widget.updatePosition();
        }
        // Вызываем update() для обновления содержимого виджета
        if (widget.update && typeof widget.update === 'function') {
          widget.update();
        }
        // Убеждаемся, что виджет в правильном режиме
        if (widget.element) {
          engine.applyWidgetPointerEvents(widget, engine.mode);
          if (engine.mode === 'editor') {
            widget.element.style.cursor = 'move';
          } else {
            widget.element.style.cursor = 'default';
          }
        }
        // Убеждаемся, что виджет не выделен после загрузки
        if (widget.deselect && typeof widget.deselect === 'function') {
          widget.deselect();
        }
        if (typeof widget.syncProfilePinButton === 'function') {
          widget.syncProfilePinButton();
        }
      });

      // setMode вызывается до loadWidgetsFromDB — виджеты пропускают mode:changed.
      // Повторно применяем текущий режим (шкаф ×, pointer-events, deselect).
      if (engine.mode === 'viewer' || engine.mode === 'editor') {
        engine.setMode(engine.mode);
      }

      // Кнопки (canvas): гарантированная перерисовка после layout/CSS
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (engine._destroyed) return;
          engine.widgetManager.getAllWidgets().forEach((w) => {
            if (w?.type === 'button-widget' && typeof w.update === 'function') {
              w.update();
            }
          });
        });
      });
      
      
      // Выбор из БД не используем — активные фильтры живут на уровне дашборда (localStorage).
      clearEphemeralFilterSelectionsOnWidgets(allWidgets);

      if (shouldUseLocalFilterPersistence(shareCtx)) {
        const localSnap = loadDashboardFiltersFromLocalStorage(
          engine.dashboardId,
          sheetId,
          flowCtx?.flowId ?? null,
        );
        if (localSnap?.fields?.length) {
          applyDashboardFilterSnapshot(engine, localSnap);
          engine.filterStore?.syncFromEngine(engine);
        }
      }
      const navContext = consumeButtonNavigationContext(engine.dashboardId, sheetId);
      if (navContext) {
        applyButtonNavigationContext(engine, navContext);
      }
      commitDashboardFilterTransportChange(engine);

      let linkedModels = [];
      if (engine.dashboardId != null && engine.dashboardId !== '') {
        linkedModels = await dashboardService.getDashboardDataModels(engine.dashboardId).catch(() => []);
      }
      engine.__linkedDataModels = Array.isArray(linkedModels)
        ? linkedModels
        : linkedModels?.data_models || [];
      await hydrateDashboardModelVariables(engine, {
        shareContext: shareCtx,
        flowId: flowCtx?.flowId ?? null,
        linkedModels,
      });
      if (engine.dashboardId != null && engine.dashboardId !== '') {
        try {
          const dashMeta = await dashboardService.getDashboard(engine.dashboardId);
          const dashVars = getDashboardVariablesFromDashboard(dashMeta);
          engine.replaceDashboardVariables?.(dashVars, { silent: true });
        } catch (e) {
          console.warn('[dashboard] failed to load dashboard variables', e);
        }
      }

      // Published (flow snapshot) must reload too: KPI format/typography come from a live snapshot, not the stored string.
      await reloadWidgetsFromDataModelInBatches(allWidgets, engine);
      getDashboardFilterSnapshot(engine, { force: true });
      eventBus.emit('active-filters:sync', { source: 'db-load' });
    } else {
            // Даже без виджетов на листе — восстанавливаем dashboard-фильтры (чипы + virtual).
      if (shouldUseLocalFilterPersistence(shareCtx)) {
        const localSnap = loadDashboardFiltersFromLocalStorage(
          engine.dashboardId,
          sheetId,
          flowCtx?.flowId ?? null,
        );
        if (localSnap?.fields?.length) {
          applyDashboardFilterSnapshot(engine, localSnap);
          engine.filterStore?.syncFromEngine(engine);
        }
      }
      const navContext = consumeButtonNavigationContext(engine.dashboardId, sheetId);
      if (navContext) {
        applyButtonNavigationContext(engine, navContext);
      }
      commitDashboardFilterTransportChange(engine);
      let linkedModelsEmpty = [];
      if (engine.dashboardId != null && engine.dashboardId !== '') {
        linkedModelsEmpty = await dashboardService.getDashboardDataModels(engine.dashboardId).catch(() => []);
      }
      engine.__linkedDataModels = Array.isArray(linkedModelsEmpty)
        ? linkedModelsEmpty
        : linkedModelsEmpty?.data_models || [];
      await hydrateDashboardModelVariables(engine, {
        shareContext: shareCtx,
        flowId: flowCtx?.flowId ?? null,
        linkedModels: linkedModelsEmpty,
      });
      if (engine.dashboardId != null && engine.dashboardId !== '') {
        try {
          const dashMeta = await dashboardService.getDashboard(engine.dashboardId);
          engine.replaceDashboardVariables?.(
            getDashboardVariablesFromDashboard(dashMeta),
            { silent: true },
          );
        } catch (e) {
          console.warn('[dashboard] failed to load dashboard variables', e);
        }
      }
      eventBus.emit('active-filters:sync', { source: 'db-empty' });
    }
  } catch (error) {
    console.error('Ошибка при загрузке виджетов из БД:', error);
    // Не показываем ошибку пользователю, если это просто отсутствие данных
    if (error.response && error.response.status !== 404) {
      throw error;
    }
  } finally {
    if (typeof onLoaded === 'function') {
      queueMicrotask(() => onLoaded());
    }
  }
}

/**
 * Настройка панели инструментов
 * Возвращает функцию очистки для удаления обработчиков
 */
/**
 * Автоматическое сохранение виджетов в БД.
 * Возвращает { schedule, flush, cancel }: flush обязателен перед сменой листа / destroy.
 */
function createAutoSaveHandler(engine, sheetId) {
  let saveTimeout = null;
  let isSaving = false;
  let pendingSave = false;
  let cancelled = false;
  /** @type {Array|null} снимок для отложенного flush, если save уже идёт */
  let pendingFlushWidgets = null;
  let saveChain = Promise.resolve();
  const SAVE_DELAY = 1000; // Задержка перед сохранением (1 секунда)

  const cancel = () => {
    cancelled = true;
    pendingSave = false;
    pendingFlushWidgets = null;
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      saveTimeout = null;
    }
  };

  const runSave = async (preloadedWidgets = null) => {
    if (!sheetId || cancelled) {
      return;
    }
    if (getDashboardShareContext()?.permission === 'read') {
      return;
    }
    if (engine?.mode && engine.mode !== 'editor') {
      return;
    }

    let widgets;
    try {
      widgets = Array.isArray(preloadedWidgets)
        ? preloadedWidgets
        : (engine?._destroyed ? null : (engine.widgetManager.toJSON() || []));
    } catch (err) {
      console.error('Не удалось сериализовать виджеты для autosave:', err);
      return;
    }
    if (widgets == null) {
      return;
    }

    // Пустой payload до гидратации листа = wipe; после гидратации [] — осознанное удаление всех.
    if (
      widgets.length === 0 &&
      engine &&
      engine.__sheetWidgetsHydrated !== true
    ) {
      console.warn('autosave: пропуск пустого bulk-save до загрузки виджетов листа');
      return;
    }

    try {
      isSaving = true;

      const dbWidgets =
        widgets.length === 0
          ? []
          : widgets.map((widget, index) => convertWidgetToDBFormat(widget, sheetId, index));

      const result = await widgetService.bulkSaveWidgets(sheetId, dbWidgets);

      
      if (cancelled || engine?._destroyed) {
        return;
      }

      if (result.widgets && result.widgets.length > 0 && widgets.length === result.widgets.length) {
        const idMapping = new Map();
        const sortedResult = [...result.widgets].sort((a, b) => {
          const oa = a.order_index ?? 0;
          const ob = b.order_index ?? 0;
          if (oa !== ob) return oa - ob;
          return (a.id ?? 0) - (b.id ?? 0);
        });
        widgets.forEach((widget, index) => {
          if (index < sortedResult.length) {
            const dbWidget = sortedResult[index];
            const newId = `widget_${dbWidget.id}`;
            idMapping.set(widget.id, newId);
          }
        });

        idMapping.forEach((newId, oldId) => {
          if (oldId !== newId) {
            engine.widgetManager.remapWidgetId(oldId, newId);
          }
        });

        engine.widgetManager.getAllWidgets().forEach((w) => {
          if (typeof w.syncProfilePinButton === 'function') {
            w.syncProfilePinButton();
          }
        });

        const mapId = (wid) => (wid != null && idMapping.has(wid) ? idMapping.get(wid) : wid);
        engine.widgetManager.getAllWidgets().forEach((w) => {
          if (w.type !== 'container') return;
          if (Array.isArray(w.containedWidgets)) {
            w.containedWidgets = w.containedWidgets.map(mapId);
          }
          if (w.activeTabId != null) {
            w.activeTabId = mapId(w.activeTabId);
          }
          if (Array.isArray(w.tabGroups)) {
            w.tabGroups = w.tabGroups.map((row) => (Array.isArray(row) ? row.map(mapId) : row));
          }
          if (w.settings?.containerTabGroups && Array.isArray(w.settings.containerTabGroups)) {
            w.settings.containerTabGroups = w.settings.containerTabGroups.map((row) =>
              Array.isArray(row) ? row.map(mapId) : row
            );
          }
          if (w.settings?.tabLabels && typeof w.settings.tabLabels === 'object') {
            const nextLabels = {};
            Object.entries(w.settings.tabLabels).forEach(([oid, label]) => {
              nextLabels[mapId(oid)] = label;
            });
            w.settings.tabLabels = nextLabels;
          } else if (typeof w.remapTabLabelKey === 'function') {
            idMapping.forEach((newId, oldId) => {
              if (oldId !== newId) w.remapTabLabelKey(oldId, newId);
            });
          }
          if (w.widgetReferences instanceof Map && w.widgetReferences.size > 0) {
            const nextMap = new Map();
            w.widgetReferences.forEach((ref, oid) => {
              nextMap.set(mapId(oid), ref);
            });
            w.widgetReferences = nextMap;
          }
          if (typeof w.render === 'function') w.render();
        });
      }
    } catch (error) {
      console.error('Ошибка при автоматическом сохранении виджетов:', error);
    } finally {
      isSaving = false;
    }
  };

  const enqueueSave = (preloadedWidgets = null) => {
    saveChain = saveChain
      .catch(() => {})
      .then(async () => {
        if (cancelled && !Array.isArray(preloadedWidgets) && pendingFlushWidgets == null) {
          return;
        }
        const snap =
          pendingFlushWidgets != null
            ? pendingFlushWidgets
            : preloadedWidgets;
        pendingFlushWidgets = null;
        pendingSave = false;
        await runSave(snap);
        if (pendingSave && !cancelled) {
          pendingSave = false;
          await runSave(null);
        }
      });
    return saveChain;
  };

  const schedule = () => {
    if (cancelled) return;
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    saveTimeout = setTimeout(() => {
      enqueueSave(null);
    }, SAVE_DELAY);
  };

  /**
   * Немедленное сохранение текущего состояния листа.
   * @param {Array|null} [preloadedWidgets] снимок toJSON() (если уже снят до destroy)
   */
  const flush = async (preloadedWidgets = null) => {
    cancelled = false;
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      saveTimeout = null;
    }
    if (Array.isArray(preloadedWidgets)) {
      pendingFlushWidgets = preloadedWidgets;
    } else if (!engine?._destroyed && typeof engine?.widgetManager?.toJSON === 'function') {
      try {
        pendingFlushWidgets = engine.widgetManager.toJSON() || [];
      } catch (_) {
        pendingFlushWidgets = null;
      }
    }
    pendingSave = false;
    await enqueueSave(pendingFlushWidgets);
  };

  return { schedule, flush, cancel };
}

/**
 * Загрузка листов дашборда (из snapshot потока или live API).
 */
async function loadDashboardSheets(dashboardId, setSheets, flowCtx = null, shareToken = null) {
  try {
    if (flowCtx?.readOnlyFlow && flowCtx?.flowId) {
      const snapshotResponse = await flowService.getFlowDashboardSnapshot(flowCtx.flowId, dashboardId);
      const payload = snapshotResponse?.payload || {};
      const sheetsArray = Array.isArray(payload.sheets) ? payload.sheets : [];
      setSheets(sheetsArray);
      return;
    }

    const sheetsData = shareToken
      ? await publicDashboardLinkApi.listSheets(shareToken)
      : await sheetService.getDashboardSheets(dashboardId);
    const sheetsArray = Array.isArray(sheetsData) ? sheetsData : (sheetsData.sheets || []);
    setSheets(sheetsArray);
  } catch (error) {
    console.error('Ошибка при загрузке листов дашборда:', error);
    setSheets([]);
  }
}

/**
 * Настройка панели инструментов
 * Возвращает функцию очистки для удаления обработчиков
 */
function setupToolbar(
  engine,
  sheetId,
  dashboardId,
  navigate,
  currentMode,
  setCurrentMode,
  shareReadOnly = false
) {
  const btnLoad = document.getElementById('btn-load');
  const btnExport = document.getElementById('btn-export');
  const btnUndo = document.getElementById('btn-undo');
  const btnRedo = document.getElementById('btn-redo');
  const btnRefreshData = document.getElementById('btn-refresh-data');
  const btnDeleteWidget = document.getElementById('btn-delete-widget');
  const zoomSlider = document.getElementById('zoom-slider');
  const zoomValue = document.getElementById('zoom-value');
  const btnModeEditor = document.getElementById('btn-mode-editor');
  const btnModeViewer = document.getElementById('btn-mode-viewer');
  const sheetSelector = document.getElementById('sheet-selector');

  if (!btnLoad || !btnExport || !btnUndo || !btnRedo || !zoomSlider || !zoomValue || !btnModeEditor || !btnModeViewer) {
    console.error('Ошибка: не все элементы панели инструментов найдены!');
    return () => {}; // Возвращаем пустую функцию очистки
  }

  // Загрузка
  const loadHandler = () => {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          engine.load(file).catch(error => {
            console.error('Ошибка при загрузке:', error);
            alert('Ошибка при загрузке: ' + error.message);
          });
        }
      };
      input.click();
    } catch (error) {
      console.error('Ошибка при открытии диалога загрузки:', error);
      alert('Ошибка при загрузке: ' + error.message);
    }
  };
  btnLoad.addEventListener('click', loadHandler);

  // Экспорт JSON
  const exportHandler = () => {
    try {
      const json = engine.exportJSON();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'dashboard.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Ошибка при экспорте:', error);
      alert('Ошибка при экспорте: ' + error.message);
    }
  };
  btnExport.addEventListener('click', exportHandler);

  // Функция для обновления состояния кнопок undo/redo
  const updateUndoRedoButtons = (canUndo, canRedo) => {
    if (btnUndo) {
      btnUndo.disabled = !canUndo;
      btnUndo.classList.toggle('disabled', !canUndo);
    }
    if (btnRedo) {
      btnRedo.disabled = !canRedo;
      btnRedo.classList.toggle('disabled', !canRedo);
    }
  };

  // Функция для обновления видимости кнопок редактирования в зависимости от режима
  const updateDeleteWidgetVisibility = () => {
    if (!btnDeleteWidget) return;
    const hasSelection =
      engine?.mode === 'editor' &&
      !shareReadOnly &&
      (engine.widgetManager?.getSelectedWidgets?.()?.length || 0) > 0;
    btnDeleteWidget.style.display = hasSelection ? '' : 'none';
    if (hasSelection) {
      btnDeleteWidget.removeAttribute('hidden');
    } else {
      btnDeleteWidget.setAttribute('hidden', '');
    }
  };

  const updateUndoRedoVisibility = (mode) => {
    // Кнопки undo/redo
    if (btnUndo && btnRedo) {
      if (mode === 'viewer') {
        // Скрываем кнопки в режиме просмотра
        btnUndo.style.display = 'none';
        btnRedo.style.display = 'none';
        // Скрываем всю секцию, если она пустая
        const undoRedoSection = btnUndo.closest('.toolbar-section');
        if (undoRedoSection) {
          undoRedoSection.style.display = 'none';
        }
      } else {
        // Показываем кнопки в режиме редактора
        btnUndo.style.display = '';
        btnRedo.style.display = '';
        // Показываем секцию
        const undoRedoSection = btnUndo.closest('.toolbar-section');
        if (undoRedoSection) {
          undoRedoSection.style.display = '';
        }
      }
    }

    // Кнопки загрузки и экспорта
    if (btnLoad && btnExport) {
      if (mode === 'viewer') {
        // Скрываем кнопки в режиме просмотра
        btnLoad.style.display = 'none';
        btnExport.style.display = 'none';
        // Скрываем всю секцию, если она пустая
        const loadExportSection = btnLoad.closest('.toolbar-section');
        if (loadExportSection) {
          loadExportSection.style.display = 'none';
        }
      } else {
        // Показываем кнопки в режиме редактора
        btnLoad.style.display = '';
        btnExport.style.display = '';
        // Показываем секцию
        const loadExportSection = btnLoad.closest('.toolbar-section');
        if (loadExportSection) {
          loadExportSection.style.display = '';
        }
      }
    }

    const btnHomeSettings = document.getElementById('btn-home-settings');
    const homeConfig = document.getElementById('toolbar-home-config');
    const canEditHome = mode === 'editor' && !shareReadOnly;
    if (btnHomeSettings) {
      if (canEditHome) {
        btnHomeSettings.style.display = '';
        btnHomeSettings.removeAttribute('hidden');
      } else {
        btnHomeSettings.style.display = 'none';
        btnHomeSettings.setAttribute('hidden', '');
        btnHomeSettings.classList.remove('is-active');
        btnHomeSettings.setAttribute('aria-expanded', 'false');
        if (homeConfig) {
          homeConfig.classList.remove('is-open', 'is-placing');
          homeConfig.setAttribute('hidden', '');
        }
        setHomePlaceMode(engine, false);
      }
    } else if (homeConfig && !canEditHome) {
      homeConfig.classList.remove('is-open', 'is-placing');
      homeConfig.setAttribute('hidden', '');
      setHomePlaceMode(engine, false);
    }
    syncHomeMarker(engine);
    updateDeleteWidgetVisibility();
  };

  // Undo/Redo
  const undoHandler = () => {
    try {
      engine.undo();
    } catch (error) {
      console.error('Ошибка при отмене:', error);
    }
  };
  btnUndo.addEventListener('click', undoHandler);

  const redoHandler = () => {
    try {
      engine.redo();
    } catch (error) {
      console.error('Ошибка при повторе:', error);
    }
  };
  btnRedo.addEventListener('click', redoHandler);

  const refreshDataHandler = async () => {
    try {
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
    } catch (error) {
      console.error('Ошибка при обновлении данных дашборда:', error);
    } finally {
      engine.__dashboardBypassCache = false;
    }
  };
  if (btnRefreshData) {
    btnRefreshData.addEventListener('click', refreshDataHandler);
  }

  const deleteSelectedHandler = () => {
    if (shareReadOnly || engine.mode === 'viewer') return;
    const selected = engine.widgetManager.getSelectedWidgets();
    if (!selected.length) return;
    selected.forEach((w) => {
      eventBus.emit('widget:delete', { id: w.id });
    });
  };
  if (btnDeleteWidget) {
    btnDeleteWidget.addEventListener('click', deleteSelectedHandler);
  }

  // Подписка на изменения истории для обновления кнопок
  let historyChangedHandler;
  let modeChangedHandler;
  let selectionChangedHandler;
  if (typeof eventBus !== 'undefined') {
    historyChangedHandler = ({ canUndo, canRedo }) => {
      updateUndoRedoButtons(canUndo, canRedo);
    };
    eventBus.on('history:changed', historyChangedHandler);
    
    // Подписка на изменение режима для обновления видимости кнопок
    modeChangedHandler = ({ mode }) => {
      updateUndoRedoVisibility(mode);
    };
    eventBus.on('mode:changed', modeChangedHandler);

    selectionChangedHandler = () => {
      updateDeleteWidgetVisibility();
    };
    eventBus.on('widget:selected', selectionChangedHandler);
    eventBus.on('widget:deselected-all', selectionChangedHandler);
    eventBus.on('widget:deleted', selectionChangedHandler);
  }

  // Инициализация состояния кнопок
  const historyState = engine.historyManager.getState();
  updateUndoRedoButtons(historyState.canUndo, historyState.canRedo);

  // Zoom slider
  const zoomSliderHandler = (e) => {
    try {
      const zoom = parseFloat(e.target.value);
      engine.viewportController.setZoom(zoom);
      zoomValue.textContent = Math.round(zoom * 100) + '%';
    } catch (error) {
      console.error('Ошибка при изменении масштаба:', error);
    }
  };
  zoomSlider.addEventListener('input', zoomSliderHandler);

  // Обновление zoom slider при изменении zoom
  const viewportZoomHandler = ({ zoom }) => {
    try {
      zoomSlider.value = zoom;
      zoomValue.textContent = Math.round(zoom * 100) + '%';
    } catch (error) {
      console.error('Ошибка при обновлении zoom:', error);
    }
  };
  eventBus.on('viewport:zoom', viewportZoomHandler);

  const btnHome = document.getElementById('btn-home');
  const btnHomeSettings = document.getElementById('btn-home-settings');
  const homeConfigEl = document.getElementById('toolbar-home-config');
  const homeXInput = document.getElementById('home-x');
  const homeYInput = document.getElementById('home-y');
  const homeZoomInput = document.getElementById('home-zoom');
  const btnPlaceHome = document.getElementById('btn-place-home');
  const btnResetHome = document.getElementById('btn-reset-home');
  const homeWrapEl = btnHomeSettings?.closest('.toolbar-home-wrap') || homeConfigEl?.parentElement;

  let homePanelCloseTimer = null;
  const clearHomePanelCloseTimer = () => {
    if (homePanelCloseTimer != null) {
      clearTimeout(homePanelCloseTimer);
      homePanelCloseTimer = null;
    }
  };

  const isHomePanelOpen = () => !!homeConfigEl?.classList.contains('is-open');

  const closeHomeSettingsPanel = ({ keepPlaceMode = false } = {}) => {
    clearHomePanelCloseTimer();
    if (!homeConfigEl) return;
    homeConfigEl.classList.remove('is-open');
    homeConfigEl.setAttribute('hidden', '');
    btnHomeSettings?.classList.remove('is-active');
    btnHomeSettings?.setAttribute('aria-expanded', 'false');
    if (!keepPlaceMode) {
      setHomePlaceMode(engine, false);
      homeConfigEl.classList.remove('is-placing');
    }
  };

  const openHomeSettingsPanel = () => {
    if (shareReadOnly || engine.mode !== 'editor' || !homeConfigEl) return;
    clearHomePanelCloseTimer();
    syncHomeInputsFromEngine();
    homeConfigEl.classList.add('is-open');
    homeConfigEl.removeAttribute('hidden');
    btnHomeSettings?.classList.add('is-active');
    btnHomeSettings?.setAttribute('aria-expanded', 'true');
    homeXInput?.focus();
  };

  const scheduleCloseHomeSettingsPanel = () => {
    clearHomePanelCloseTimer();
    // Не закрывать, пока пользователь ставит метку на полотне.
    if (engine.__placingHomeMark) return;
    homePanelCloseTimer = setTimeout(() => {
      homePanelCloseTimer = null;
      if (engine.__placingHomeMark) return;
      closeHomeSettingsPanel();
    }, 220);
  };

  const syncHomeInputsFromEngine = () => {
    const h = engine.viewportHome || { x: 0, y: 0, zoom: null };
    if (homeXInput) homeXInput.value = String(Math.round(h.x) || 0);
    if (homeYInput) homeYInput.value = String(Math.round(h.y) || 0);
    if (homeZoomInput) {
      homeZoomInput.value = h.zoom == null ? '' : String(h.zoom);
    }
  };

  const persistHomeFromInputs = () => {
    if (shareReadOnly || engine.mode !== 'editor') return;
    const x = parseFloat(homeXInput?.value);
    const y = parseFloat(homeYInput?.value);
    const zRaw = String(homeZoomInput?.value ?? '').trim();
    const zoom = zRaw === '' ? null : parseFloat(zRaw);
    applyViewportHomeToEngine(engine, {
      x: Number.isFinite(x) ? x : 0,
      y: Number.isFinite(y) ? y : 0,
      zoom: Number.isFinite(zoom) ? zoom : null,
    });
    schedulePersistViewportHome(sheetId, engine.__sheetLayoutConfig, engine.viewportHome, {
      allowWrite: !shareReadOnly,
    });
  };

  const onHomeSaved = ({ layout_config: lc }) => {
    if (lc && typeof lc === 'object') {
      engine.__sheetLayoutConfig = lc;
    }
  };
  eventBus.on('viewport:home-saved', onHomeSaved);

  const onHomeConfig = () => {
    syncHomeInputsFromEngine();
  };
  eventBus.on('viewport:home-config', onHomeConfig);

  const homeBtnHandler = () => {
    try {
      engine.viewportController.goHome(engine.viewportHome || { x: 0, y: 0, zoom: null });
    } catch (err) {
      console.error('Home failed', err);
    }
  };
  if (btnHome) btnHome.addEventListener('click', homeBtnHandler);

  const homeSettingsBtnHandler = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (shareReadOnly || engine.mode !== 'editor') return;
    if (isHomePanelOpen()) closeHomeSettingsPanel();
    else openHomeSettingsPanel();
  };
  btnHomeSettings?.addEventListener('click', homeSettingsBtnHandler);

  const homeInputHandler = () => persistHomeFromInputs();
  homeXInput?.addEventListener('change', homeInputHandler);
  homeYInput?.addEventListener('change', homeInputHandler);
  homeZoomInput?.addEventListener('change', homeInputHandler);

  const placeHomeHandler = () => {
    if (shareReadOnly || engine.mode !== 'editor') return;
    if (!isHomePanelOpen()) openHomeSettingsPanel();
    const next = !engine.__placingHomeMark;
    setHomePlaceMode(engine, next);
    homeConfigEl?.classList.toggle('is-placing', next);
  };
  btnPlaceHome?.addEventListener('click', placeHomeHandler);

  const resetHomeHandler = () => {
    if (shareReadOnly || engine.mode !== 'editor') return;
    if (homeXInput) homeXInput.value = '0';
    if (homeYInput) homeYInput.value = '0';
    applyViewportHomeToEngine(engine, {
      x: 0,
      y: 0,
      zoom: engine.viewportHome?.zoom ?? null,
    });
    schedulePersistViewportHome(sheetId, engine.__sheetLayoutConfig, engine.viewportHome, {
      allowWrite: !shareReadOnly,
    });
  };
  btnResetHome?.addEventListener('click', resetHomeHandler);

  const placeClickCapture = (e) => {
    if (tryConsumeHomePlaceClick(engine, e)) {
      homeConfigEl?.classList.remove('is-placing');
      syncHomeInputsFromEngine();
      schedulePersistViewportHome(sheetId, engine.__sheetLayoutConfig, engine.viewportHome, {
        allowWrite: !shareReadOnly,
      });
      scheduleCloseHomeSettingsPanel();
    }
  };
  engine.viewport?.addEventListener('mousedown', placeClickCapture, true);

  const onHomePlaceMode = ({ placing }) => {
    homeConfigEl?.classList.toggle('is-placing', !!placing);
  };
  eventBus.on('viewport:home-place-mode', onHomePlaceMode);

  const homePanelFocusInHandler = () => {
    clearHomePanelCloseTimer();
  };
  const homePanelFocusOutHandler = (e) => {
    const next = e.relatedTarget;
    if (next && homeWrapEl?.contains(next)) return;
    scheduleCloseHomeSettingsPanel();
  };
  homeWrapEl?.addEventListener('focusin', homePanelFocusInHandler);
  homeWrapEl?.addEventListener('focusout', homePanelFocusOutHandler);

  const homeOutsideClickHandler = (e) => {
    if (!isHomePanelOpen()) return;
    if (homeWrapEl?.contains(e.target)) return;
    // Клик по полотну в режиме метки — не закрывать сразу.
    if (engine.__placingHomeMark) return;
    closeHomeSettingsPanel();
  };
  document.addEventListener('mousedown', homeOutsideClickHandler, true);

  const homeEscapeHandler = (e) => {
    if (e.key !== 'Escape') return;
    if (!isHomePanelOpen() && !engine.__placingHomeMark) return;
    closeHomeSettingsPanel();
  };
  document.addEventListener('keydown', homeEscapeHandler);

  syncHomeInputsFromEngine();
  closeHomeSettingsPanel();

  // Режимы
  const modeEditorHandler = () => {
    if (shareReadOnly) {
      return;
    }
    try {
      engine.setMode('editor');
      setCurrentMode('editor'); // Сохраняем режим в состоянии
      localStorage.setItem('dashboard-creater-mode', 'editor'); // Сохраняем в localStorage
      btnModeEditor.classList.add('btn-active');
      btnModeViewer.classList.remove('btn-active');
      updateUndoRedoVisibility('editor'); // Обновляем видимость кнопок
    } catch (error) {
      console.error('Ошибка при переключении в режим редактора:', error);
    }
  };
  btnModeEditor.addEventListener('click', modeEditorHandler);

  const modeViewerHandler = () => {
    try {
      engine.setMode('viewer');
      setCurrentMode('viewer'); // Сохраняем режим в состоянии
      localStorage.setItem('dashboard-creater-mode', 'viewer'); // Сохраняем в localStorage
      btnModeViewer.classList.add('btn-active');
      btnModeEditor.classList.remove('btn-active');
      updateUndoRedoVisibility('viewer'); // Обновляем видимость кнопок
    } catch (error) {
      console.error('Ошибка при переключении в режим просмотра:', error);
    }
  };
  btnModeViewer.addEventListener('click', modeViewerHandler);
  
  // Восстанавливаем состояние кнопок режима при инициализации
    if (currentMode === 'viewer') {
    btnModeViewer.classList.add('btn-active');
    btnModeEditor.classList.remove('btn-active');
  } else {
    btnModeEditor.classList.add('btn-active');
    btnModeViewer.classList.remove('btn-active');
  }
  
  // Устанавливаем видимость кнопок undo/redo при инициализации
  updateUndoRedoVisibility(currentMode);
  updateDeleteWidgetVisibility();

  if (shareReadOnly && btnModeEditor) {
    btnModeEditor.hidden = true;
    btnModeEditor.style.display = 'none';
    btnModeEditor.disabled = true;
    btnModeEditor.setAttribute('title', 'Редактирование недоступно');
  }

  // Возвращаем функцию очистки
  return () => {
    cancelPersistViewportHome();
    setHomePlaceMode(engine, false);
    btnLoad.removeEventListener('click', loadHandler);
    btnExport.removeEventListener('click', exportHandler);
    btnUndo.removeEventListener('click', undoHandler);
    btnRedo.removeEventListener('click', redoHandler);
    if (btnRefreshData) {
      btnRefreshData.removeEventListener('click', refreshDataHandler);
    }
    if (btnDeleteWidget) {
      btnDeleteWidget.removeEventListener('click', deleteSelectedHandler);
    }
    if (typeof eventBus !== 'undefined') {
      if (historyChangedHandler) {
        eventBus.off('history:changed', historyChangedHandler);
      }
      if (modeChangedHandler) {
        eventBus.off('mode:changed', modeChangedHandler);
      }
      if (selectionChangedHandler) {
        eventBus.off('widget:selected', selectionChangedHandler);
        eventBus.off('widget:deselected-all', selectionChangedHandler);
        eventBus.off('widget:deleted', selectionChangedHandler);
      }
    }
    zoomSlider.removeEventListener('input', zoomSliderHandler);
    btnModeEditor.removeEventListener('click', modeEditorHandler);
    btnModeViewer.removeEventListener('click', modeViewerHandler);
    eventBus.off('viewport:zoom', viewportZoomHandler);
    eventBus.off('viewport:home-saved', onHomeSaved);
    eventBus.off('viewport:home-config', onHomeConfig);
    eventBus.off('viewport:home-place-mode', onHomePlaceMode);
    clearHomePanelCloseTimer();
    closeHomeSettingsPanel();
    if (btnHome) btnHome.removeEventListener('click', homeBtnHandler);
    btnHomeSettings?.removeEventListener('click', homeSettingsBtnHandler);
    homeXInput?.removeEventListener('change', homeInputHandler);
    homeYInput?.removeEventListener('change', homeInputHandler);
    homeZoomInput?.removeEventListener('change', homeInputHandler);
    btnPlaceHome?.removeEventListener('click', placeHomeHandler);
    btnResetHome?.removeEventListener('click', resetHomeHandler);
    engine.viewport?.removeEventListener('mousedown', placeClickCapture, true);
    homeWrapEl?.removeEventListener('focusin', homePanelFocusInHandler);
    homeWrapEl?.removeEventListener('focusout', homePanelFocusOutHandler);
    document.removeEventListener('mousedown', homeOutsideClickHandler, true);
    document.removeEventListener('keydown', homeEscapeHandler);
    if (shareReadOnly && btnModeEditor) {
      btnModeEditor.hidden = false;
      btnModeEditor.disabled = false;
      btnModeEditor.removeAttribute('title');
      btnModeEditor.style.display = '';
    }
  };
}

/**
 * Настройка панели виджетов
 * Возвращает функцию очистки для удаления обработчиков
 */
function setupWidgetPanel(engine) {
  const widgetPanel = document.getElementById('widget-panel');
  const widgetList = document.querySelector('.widget-list');

  if (!widgetPanel || !widgetList) {
    console.error('Ошибка: widget-panel или widget-list не найден!');
    return () => {}; // Возвращаем пустую функцию очистки
  }

  const widgetItems = document.querySelectorAll('.widget-item');
  if (widgetItems.length === 0) {
    console.error('Ошибка: элементы .widget-item не найдены!');
    return () => {}; // Возвращаем пустую функцию очистки
  }

  // Используем делегирование событий на родительском элементе
  const clickHandler = (e) => {
    try {
      const item = e.target.closest('.widget-item');
      if (!item) return;

      e.preventDefault();
      e.stopPropagation();

      const type = item.dataset.type;
      if (!type) {
        console.error('Ошибка: у элемента виджета не указан data-type');
        return;
      }

      
      // Не добавляем виджеты в режиме просмотра
      if (engine.mode === 'viewer') {
                return;
      }

      // Получаем центр viewport в координатах workspace
      const viewport = document.getElementById('viewport');
      if (!viewport) {
        console.error('Ошибка: viewport не найден');
        return;
      }

      const viewportRect = viewport.getBoundingClientRect();
      const centerX = viewportRect.width / 2;
      const centerY = viewportRect.height / 2;

      if (!engine.viewportController) {
        console.error('Ошибка: viewportController не инициализирован');
        return;
      }

      const workspacePos = engine.viewportController.viewportToWorkspace(centerX, centerY);

      // Добавляем виджет в центр экрана
      const config = {
        x: workspacePos.x - 150,
        y: workspacePos.y - 100
      };

      const def =
        typeof engine.getWidgetDefinition === 'function'
          ? engine.getWidgetDefinition(type)
          : null;
      if (def && typeof def.paletteDefaults === 'function') {
        const defaults = def.paletteDefaults() || {};
        if (defaults.settings) config.settings = { ...defaults.settings };
        if (defaults.styles) config.styles = { ...defaults.styles };
        if (defaults.dataSource) config.dataSource = defaults.dataSource;
        if (defaults.width != null) config.width = defaults.width;
        if (defaults.height != null) config.height = defaults.height;
      }

      if (!engine.widgetClasses[type]) {
        console.error(`Виджет типа "${type}" не зарегистрирован!`);
        alert(`Виджет типа "${type}" не зарегистрирован. Пожалуйста, обновите страницу.`);
        return;
      }

      engine.addWidget(type, config);
      eventBus.emit('widget-panel:close');
    } catch (error) {
      console.error('Ошибка при добавлении виджета:', error);
      alert(`Ошибка при добавлении виджета: ${error.message}`);
    }
  };

  widgetList.addEventListener('click', clickHandler);

  // Возвращаем функцию очистки
  return () => {
    widgetList.removeEventListener('click', clickHandler);
  };
}

/**
 * Обновление UI при изменении состояния
 * Возвращает функцию очистки для удаления обработчиков
 */
function updateUI(engine) {
  // Обновление кнопок Undo/Redo
  const historyChangedHandler = ({ canUndo, canRedo }) => {
    const btnUndo = document.getElementById('btn-undo');
    const btnRedo = document.getElementById('btn-redo');
    if (btnUndo) btnUndo.disabled = !canUndo;
    if (btnRedo) btnRedo.disabled = !canRedo;
  };
  eventBus.on('history:changed', historyChangedHandler);

  // Возвращаем функцию очистки
  return () => {
    eventBus.off('history:changed', historyChangedHandler);
  };
}

/**
 * Drag полей данных с панели «Данные» на виджет в workspace.
 */
function setupDataFieldDropOnWorkspace(engine) {
  const workspace = document.getElementById('workspace');
  if (!workspace) {
    return () => {};
  }

  let currentDropTarget = null;

  const clearDropTarget = () => {
    if (currentDropTarget) {
      currentDropTarget.classList.remove('drop-target');
      currentDropTarget = null;
    }
  };

  const typesIncludeField = (dt) => {
    if (!dt || !dt.types) return false;
    try {
      return Array.from(dt.types).includes(DATA_FIELD_DRAG_MIME);
    } catch {
      return false;
    }
  };

  const onDragOver = (e) => {
    if (!typesIncludeField(e.dataTransfer)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    const wEl = e.target.closest('.widget');
    if (wEl !== currentDropTarget) {
      clearDropTarget();
      currentDropTarget = wEl;
      if (currentDropTarget) {
        currentDropTarget.classList.add('drop-target');
      }
    }
  };

  const onDrop = (e) => {
    if (!typesIncludeField(e.dataTransfer)) return;
    const raw = e.dataTransfer.getData(DATA_FIELD_DRAG_MIME);
    if (!raw) {
      clearDropTarget();
      return;
    }
    const wEl = e.target.closest('.widget');
    if (!wEl) {
      clearDropTarget();
      return;
    }
    e.preventDefault();
    clearDropTarget();

    if (engine.mode === 'viewer') {
      return;
    }

    const widgetId = wEl.dataset.widgetId;
    const widget = engine.widgetManager.getWidget(widgetId);
    if (!widget) return;

    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      return;
    }

    const kind = applyDataFieldToWidget(widget, payload);
    if (kind === 'ignored') {
      return;
    }

    if (typeof widget.update === 'function') {
      widget.update();
    }
    engine.saveSnapshot();
    eventBus.emit('widget:data-binding-updated', { widget });
    if (kind === 'filter') {
      eventBus.emit('dashboard:filters-changed', { source: 'drop' });
    } else {
      eventBus.emit('widget:styles-changed', { widget });
    }
  };

  const onDocumentDragEnd = () => {
    clearDropTarget();
  };

  workspace.addEventListener('dragover', onDragOver);
  workspace.addEventListener('drop', onDrop);
  document.addEventListener('dragend', onDocumentDragEnd);

  return () => {
    workspace.removeEventListener('dragover', onDragOver);
    workspace.removeEventListener('drop', onDrop);
    document.removeEventListener('dragend', onDocumentDragEnd);
    clearDropTarget();
  };
}

/**
 * Управление видимостью панелей в зависимости от режима
 * Возвращает функцию очистки для удаления обработчиков
 */
function setupModePanels(engine, stylePanel) {
  const widgetPanel = document.getElementById('widget-panel');
  const app = document.getElementById('app');

  // Функция для обновления видимости панелей
  const updatePanelsVisibility = (mode) => {
    if (app) {
      app.classList.toggle('mode-editor', mode === 'editor');
      app.classList.toggle('mode-viewer', mode === 'viewer');
    }
    if (mode === 'viewer') {
      if (widgetPanel) widgetPanel.classList.add('hidden');
      if (stylePanel) {
        stylePanel.hide();
      }
      eventBus.emit('widget-panel:close');
    } else {
      if (widgetPanel) widgetPanel.classList.remove('hidden');
    }
  };

  // Подписка на изменение режима
  const modeChangedHandler = ({ mode }) => {
    updatePanelsVisibility(mode);
  };
  eventBus.on('mode:changed', modeChangedHandler);

  // Инициализация при загрузке (по умолчанию режим 'editor')
  updatePanelsVisibility(engine.mode || 'editor');

  // Возвращаем функцию очистки
  return () => {
    eventBus.off('mode:changed', modeChangedHandler);
  };
}

export default DashboardCreaterApp;
