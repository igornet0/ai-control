import api from './api';
import { getDefaultProfileWidgetSize, isKnownProfileWidget } from './profileWidgetCatalog';

export const DEFAULT_PROFILE_SCREEN_ID = 'default';
export const DEFAULT_PROFILE_SCREEN_NAME = 'Основной';
export const MAX_PROFILE_SCREENS = 8;

function clamp(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function sanitizeScreenId(value, fallback = DEFAULT_PROFILE_SCREEN_ID) {
  const text = String(value || '').trim();
  if (!text) return fallback;
  const cleaned = text.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 64);
  return cleaned || fallback;
}

export function createDefaultScreens() {
  return [{
    id: DEFAULT_PROFILE_SCREEN_ID,
    name: DEFAULT_PROFILE_SCREEN_NAME,
    position: 0,
  }];
}

export function normalizeScreens(rawScreens, widgets = []) {
  const list = Array.isArray(rawScreens) ? rawScreens : [];
  const seen = new Set();
  const screens = [];

  list
    .map((screen, index) => ({
      id: sanitizeScreenId(screen?.id, ''),
      name: String(screen?.name || '').trim().slice(0, 48),
      position: Number.isFinite(Number(screen?.position)) ? Number(screen.position) : index,
    }))
    .filter((screen) => screen.id)
    .sort((a, b) => a.position - b.position)
    .forEach((screen) => {
      if (seen.has(screen.id) || screens.length >= MAX_PROFILE_SCREENS) return;
      seen.add(screen.id);
      screens.push({
        id: screen.id,
        name: screen.name || (screen.id === DEFAULT_PROFILE_SCREEN_ID
          ? DEFAULT_PROFILE_SCREEN_NAME
          : `Экран ${screens.length + 1}`),
        position: screens.length,
      });
    });

  if (screens.length === 0) {
    const derived = [];
    (widgets || []).forEach((item) => {
      const sid = sanitizeScreenId(item?.screenId ?? item?.screen_id, '');
      if (sid && !derived.includes(sid)) derived.push(sid);
    });
    if (derived.length === 0) return createDefaultScreens();
    return derived.slice(0, MAX_PROFILE_SCREENS).map((id, index) => ({
      id,
      name: id === DEFAULT_PROFILE_SCREEN_ID ? DEFAULT_PROFILE_SCREEN_NAME : `Экран ${index + 1}`,
      position: index,
    }));
  }

  return screens;
}

function normalizeWidgets(rawWidgets, screens) {
  const items = Array.isArray(rawWidgets) ? rawWidgets : [];
  const screenIds = new Set(screens.map((screen) => screen.id));
  const fallbackScreen = screens[0]?.id || DEFAULT_PROFILE_SCREEN_ID;
  const seen = new Set();
  const byScreen = Object.fromEntries(screens.map((screen) => [screen.id, []]));

  items
    .map((item, index) => {
      const source = item?.source;
      const cardId = item?.card_id ?? item?.cardId;
      const dashboardId = item?.dashboard_id ?? item?.dashboardId ?? null;
      const sheetId = item?.sheet_id ?? item?.sheetId ?? null;
      const flowId = item?.flow_id ?? item?.flowId ?? null;
      const title = item?.title ?? null;
      const widgetType = item?.widget_type ?? item?.widgetType ?? null;
      return {
        source,
        cardId,
        screenId: sanitizeScreenId(item?.screen_id ?? item?.screenId, fallbackScreen),
        position: Number.isFinite(Number(item?.position)) ? Number(item.position) : index,
        colSpan: item?.col_span ?? item?.colSpan,
        rowSpan: item?.row_span ?? item?.rowSpan,
        dashboardId,
        sheetId,
        flowId,
        title,
        widgetType,
      };
    })
    .filter((item) => isKnownProfileWidget(item.source, item.cardId, item))
    .sort((a, b) => a.position - b.position)
    .forEach((item) => {
      const key = `${item.source}:${item.cardId}${
        item.source === 'dashboard' && Number(item.flowId) > 0 ? `:flow:${item.flowId}` : ''
      }`;
      if (seen.has(key)) return;
      seen.add(key);
      const screenId = screenIds.has(item.screenId) ? item.screenId : fallbackScreen;
      const defaults = getDefaultProfileWidgetSize(item.source, item.cardId);
      const next = {
        source: item.source,
        cardId: String(item.cardId),
        screenId,
        colSpan: clamp(item.colSpan, 1, 3, defaults.colSpan),
        rowSpan: clamp(item.rowSpan, 1, 6, defaults.rowSpan),
      };
      if (item.source === 'dashboard') {
        next.dashboardId = Number(item.dashboardId);
        next.sheetId = Number(item.sheetId);
        const flowId = Number(item.flowId);
        if (Number.isInteger(flowId) && flowId > 0) next.flowId = flowId;
        if (item.title) next.title = String(item.title).slice(0, 120);
        if (item.widgetType) next.widgetType = String(item.widgetType).slice(0, 64);
      }
      byScreen[screenId].push(next);
    });

  const widgets = [];
  screens.forEach((screen) => {
    (byScreen[screen.id] || []).forEach((item, index) => {
      widgets.push({ ...item, position: index });
    });
  });
  return widgets;
}

export function normalizeProfileLayout(raw) {
  const rawWidgets = Array.isArray(raw) ? raw : (raw?.widgets || raw?.items || []);
  const screens = normalizeScreens(raw?.screens, rawWidgets);
  const widgets = normalizeWidgets(rawWidgets, screens);
  return { screens, widgets };
}

export function makeScreenId(name = '') {
  const base = sanitizeScreenId(name, 'screen') || 'screen';
  return `${base}-${Date.now().toString(36)}`;
}

export const profileWidgetsService = {
  async getProfileWidgets() {
    try {
      const response = await api.get('/api/personal-dashboard/profile-widgets');
      return normalizeProfileLayout(response.data);
    } catch (error) {
      console.error('Error getting profile widgets:', error);
      return { screens: createDefaultScreens(), widgets: [] };
    }
  },

  async updateProfileWidgets({ screens, widgets }) {
    const normalizedScreens = normalizeScreens(screens, widgets);
    const payload = {
      screens: normalizedScreens.map((screen, index) => ({
        id: screen.id,
        name: screen.name,
        position: index,
      })),
      widgets: (widgets || []).map((item, index) => {
        const defaults = getDefaultProfileWidgetSize(item.source, item.cardId);
        const next = {
          source: item.source,
          card_id: String(item.cardId),
          screen_id: sanitizeScreenId(item.screenId ?? item.screen_id, normalizedScreens[0]?.id),
          position: Number.isFinite(item.position) ? item.position : index,
          col_span: clamp(item.colSpan ?? item.col_span, 1, 3, defaults.colSpan),
          row_span: clamp(item.rowSpan ?? item.row_span, 1, 6, defaults.rowSpan),
        };
        if (item.source === 'dashboard') {
          const dashboardId = Number(item.dashboardId ?? item.dashboard_id);
          const sheetId = Number(item.sheetId ?? item.sheet_id);
          if (!Number.isInteger(dashboardId) || dashboardId <= 0
            || !Number.isInteger(sheetId) || sheetId <= 0) {
            throw new Error('Для виджета дашборда нужны dashboard_id и sheet_id');
          }
          next.dashboard_id = dashboardId;
          next.sheet_id = sheetId;
          const flowId = Number(item.flowId ?? item.flow_id);
          if (Number.isInteger(flowId) && flowId > 0) next.flow_id = flowId;
          const title = item.title;
          const widgetType = item.widgetType ?? item.widget_type;
          if (title) next.title = String(title).slice(0, 120);
          if (widgetType) next.widget_type = String(widgetType).slice(0, 64);
        }
        return next;
      }),
    };
    const response = await api.post('/api/personal-dashboard/profile-widgets', payload);
    return normalizeProfileLayout(response.data);
  },
};

export default profileWidgetsService;
