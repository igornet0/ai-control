export const PROFILE_WIDGET_SOURCES = {
  overview: 'overview',
  statistics: 'statistics',
  taskWidgets: 'task-widgets',
  dashboard: 'dashboard',
};

export const PROFILE_WIDGET_CATALOG = [
  { source: 'overview', cardId: 'priorities', title: 'Мои приоритеты' },
  { source: 'overview', cardId: 'overdue', title: 'Просроченные задачи' },
  { source: 'overview', cardId: 'upcoming', title: 'Предстоящие дедлайны' },
  { source: 'overview', cardId: 'projects', title: 'Статусы проектов' },
  { source: 'overview', cardId: 'notes', title: 'Заметки' },
  { source: 'overview', cardId: 'checklist', title: 'Чек-лист' },
  { source: 'overview', cardId: 'time-management', title: 'Тайм-менеджмент на сегодня' },
  { source: 'overview', cardId: 'ai-analysis', title: 'AI анализ' },
  { source: 'overview', cardId: 'ai-chat', title: 'AI чат' },
  { source: 'statistics', cardId: 'completed-tasks', title: 'Выполненные задачи' },
  { source: 'statistics', cardId: 'overdue-tasks', title: 'Просрочки' },
  { source: 'statistics', cardId: 'user-teams', title: 'Команды' },
  { source: 'statistics', cardId: 'user-projects', title: 'Проекты' },
  { source: 'statistics', cardId: 'productivity', title: 'Продуктивность' },
  { source: 'task-widgets', cardId: 'progress-chart', title: 'Обзор задач' },
  { source: 'task-widgets', cardId: 'bar-chart', title: 'Приоритеты' },
  { source: 'task-widgets', cardId: 'team-ratings', title: 'Производительность' },
];

const TITLE_BY_KEY = new Map(
  PROFILE_WIDGET_CATALOG.map((item) => [`${item.source}:${item.cardId}`, item.title])
);

export function normalizeProfileFlowId(flowId) {
  const n = Number(flowId);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Live pin vs published-flow pin of the same widget id. */
export function profileDashboardPinKey(cardId, flowId) {
  const base = `dashboard:${cardId}`;
  const flow = normalizeProfileFlowId(flowId);
  return flow ? `${base}|flow:${flow}` : base;
}

export function sameDashboardPin(item, cardId, flowId) {
  if (!item || item.source !== 'dashboard') return false;
  if (String(item.cardId) !== String(cardId)) return false;
  return normalizeProfileFlowId(item.flowId ?? item.flow_id)
    === normalizeProfileFlowId(flowId);
}

export function profileWidgetKey(source, cardId, meta = null) {
  if (source === 'dashboard') {
    return profileDashboardPinKey(cardId, meta?.flowId ?? meta?.flow_id);
  }
  return `${source}:${cardId}`;
}

export function parseProfileWidgetKey(key) {
  const text = String(key || '');
  let flowId = null;
  let rest = text;
  const flowSep = text.indexOf('|flow:');
  if (flowSep >= 0) {
    const parsed = Number(text.slice(flowSep + 6));
    flowId = Number.isInteger(parsed) && parsed > 0 ? parsed : null;
    rest = text.slice(0, flowSep);
  }
  const separator = rest.indexOf(':');
  if (separator <= 0) return { source: '', cardId: rest, flowId };
  return {
    source: rest.slice(0, separator),
    cardId: rest.slice(separator + 1),
    flowId,
  };
}

export function isDashboardProfileWidget(source, cardId) {
  if (source !== 'dashboard') return false;
  const id = Number(cardId);
  return Number.isInteger(id) && id > 0;
}

export function getProfileWidgetTitle(source, cardId, meta = null) {
  if (source === 'dashboard') {
    const title = String(meta?.title || '').trim();
    if (title) return title;
    const type = String(meta?.widgetType || meta?.widget_type || '').trim();
    return type ? `Виджет: ${type}` : `Виджет #${cardId}`;
  }
  return TITLE_BY_KEY.get(profileWidgetKey(source, cardId)) || cardId;
}

export function isKnownProfileWidget(source, cardId, meta = null) {
  if (source === 'dashboard') {
    if (!isDashboardProfileWidget(source, cardId)) return false;
    const dashboardId = Number(meta?.dashboardId ?? meta?.dashboard_id);
    const sheetId = Number(meta?.sheetId ?? meta?.sheet_id);
    return Number.isInteger(dashboardId) && dashboardId > 0
      && Number.isInteger(sheetId) && sheetId > 0;
  }
  return TITLE_BY_KEY.has(profileWidgetKey(source, cardId));
}

export function getDefaultProfileWidgetSize(source, cardId) {
  if (source === 'dashboard') return { colSpan: 1, rowSpan: 3 };
  if (source === 'task-widgets') return { colSpan: 1, rowSpan: 4 };
  if (source === 'overview') {
    if (cardId === 'overdue' || cardId === 'upcoming') return { colSpan: 1, rowSpan: 4 };
    if (cardId === 'ai-analysis') return { colSpan: 1, rowSpan: 3 };
    if (cardId === 'ai-chat') return { colSpan: 2, rowSpan: 4 };
    return { colSpan: 1, rowSpan: 2 };
  }
  return { colSpan: 1, rowSpan: 3 };
}

/** Engine id `widget_<dbId>` → DB id, else null (unsaved). */
export function parseEngineWidgetDbId(engineWidgetId) {
  const parts = String(engineWidgetId || '').split('_');
  if (
    parts.length === 2
    && parts[0] === 'widget'
    && parts[1] !== ''
    && !Number.isNaN(Number(parts[1]))
  ) {
    return Number(parts[1]);
  }
  return null;
}

/** Widget types that must never be pinned to the user profile. */
export const PROFILE_EXPORT_BLOCKED_TYPES = new Set(['filter']);

export function isProfileExportBlockedType(widgetType) {
  return PROFILE_EXPORT_BLOCKED_TYPES.has(String(widgetType || ''));
}

export function allowsExportToProfile(settings, widgetType = null) {
  if (isProfileExportBlockedType(widgetType)) return false;
  return settings?.allowExportToProfile !== false;
}
