/** @typedef {'document'|'task'|'dashboard'|'dashboard_sheet'|'dashboard_share'|'call'|'template'|'project'|'data_model'|'employee'} EntityRefType */

/**
 * @typedef {Object} EntityRef
 * @property {EntityRefType} type
 * @property {number} id
 * @property {string} title
 * @property {number} [dashboard_id]
 * @property {string} [url]
 */

export const ENTITY_REF_LABELS = {
  document: 'Документ',
  task: 'Задача',
  dashboard: 'Дашборд',
  dashboard_sheet: 'Лист дашборда',
  dashboard_share: 'Сессия дашборда',
  call: 'Видеозвонок',
  template: 'Шаблон',
  project: 'Проект',
  data_model: 'Модель данных',
  employee: 'Сотрудник',
};

export const ENTITY_REF_OPEN_LABELS = {
  document: 'Открыть документ',
  task: 'Открыть задачу',
  dashboard: 'Открыть дашборд',
  dashboard_sheet: 'Открыть лист',
  dashboard_share: 'Открыть сессию',
  call: 'Присоединиться',
  template: 'Открыть шаблон',
  project: 'Открыть проект',
  data_model: 'Открыть модель',
  employee: 'Открыть профиль',
};

/**
 * @param {EntityRefType} type
 * @param {number} id
 * @param {string} title
 * @param {{ dashboardId?: number, url?: string }} [options]
 * @returns {EntityRef}
 */
export function buildEntityRef(type, id, title, options = {}) {
  const ref = {
    type,
    id: Number(id),
    title: String(title || '').trim(),
  };
  if (type === 'dashboard_sheet' && options.dashboardId != null) {
    ref.dashboard_id = Number(options.dashboardId);
  }
  if (
    (type === 'dashboard_share' || type === 'document' || type === 'call' || type === 'template') &&
    options.url
  ) {
    ref.url = String(options.url);
  }
  return ref;
}

/** @param {string} partyRoomId */
export function buildCallEntityRef(chatRoomId, partyRoomId, title = 'Видеозвонок') {
  return buildEntityRef('call', chatRoomId, title, {
    url: `/calls/${partyRoomId}`,
  });
}

/** @param {string|undefined|null} url */
export function parseCallPartyRoomId(url) {
  const raw = String(url || '').trim();
  const m = raw.match(/^\/calls\/([0-9a-fA-F-]{36})$/);
  return m ? m[1] : null;
}

/**
 * @param {EntityRef} ref
 * @returns {string}
 */
export function getEntityRefPath(ref) {
  if (!ref?.type || ref.id == null) return '/';
  if (ref.type === 'call') return '/';
  const customUrl = String(ref.url || '').trim();
  if (customUrl.startsWith('/') && !customUrl.startsWith('//')) {
    return customUrl;
  }
  switch (ref.type) {
    case 'document':
      return `/documents?document=${ref.id}`;
    case 'template':
      return `/documents?template=${ref.id}`;
    case 'task':
      return `/tasks?task=${ref.id}`;
    case 'project':
      return `/tasks?tab=projects&project=${encodeURIComponent(ref.id)}`;
    case 'data_model':
      return `/data-models/${ref.id}`;
    case 'employee':
      return `/profile?dm=${ref.id}`;
    case 'dashboard':
      return `/dashboard/${ref.id}`;
    case 'dashboard_sheet':
      return `/dashboard/${ref.dashboard_id}/sheet/${ref.id}`;
    case 'dashboard_share':
      return ref.url || `/share/${encodeURIComponent(ref.title || '')}`;
    default:
      return '/';
  }
}

/**
 * @param {EntityRef} ref
 * @param {{ newTab?: boolean }} [options]
 */
export function openEntityRef(ref, options = {}) {
  const path = getEntityRefPath(ref);
  if (!path || path === '/') return;
  if (options.newTab !== false) {
    window.open(path, '_blank', 'noopener,noreferrer');
  } else {
    window.location.assign(path);
  }
}

/**
 * @param {EntityRef} ref
 * @returns {string}
 */
export function getEntityRefLabel(ref) {
  const url = String(ref?.url || '');
  if (ref?.type === 'document' && url.includes('/documents/share/')) {
    return 'Приглашение';
  }
  if (ref?.type === 'document' && url.includes('review=1')) {
    return 'Предложение';
  }
  if (ref?.type === 'task' && ref?.title === 'Открыть задачу') {
    return 'Проверка';
  }
  return ENTITY_REF_LABELS[ref?.type] || 'Ссылка';
}

/**
 * @param {EntityRef} ref
 * @returns {string}
 */
export function getEntityRefOpenLabel(ref) {
  const url = String(ref?.url || '');
  if (ref?.type === 'document' && url.includes('/documents/share/')) {
    return 'Открыть документ';
  }
  if (ref?.type === 'document' && url.includes('review=1')) {
    return 'Открыть';
  }
  if (ref?.type === 'task' && ref?.title === 'Открыть задачу') {
    return 'Открыть задачу';
  }
  return ENTITY_REF_OPEN_LABELS[ref?.type] || 'Открыть';
}

/**
 * @param {unknown} doc
 * @returns {string}
 */
export function documentDisplayTitle(doc) {
  return doc?.title?.trim() || doc?.name?.trim() || `Документ #${doc?.id ?? '?'}`;
}

export function templateDisplayTitle(template) {
  return template?.name?.trim() || template?.title?.trim() || `Шаблон #${template?.id ?? '?'}`;
}

/**
 * @param {unknown} task
 * @returns {string}
 */
export function taskDisplayTitle(task) {
  return task?.title?.trim() || `Задача #${task?.id ?? '?'}`;
}

/**
 * @param {unknown} project
 * @returns {string}
 */
export function projectDisplayTitle(project) {
  return project?.name?.trim() || project?.title?.trim() || `Проект #${project?.id ?? '?'}`;
}

/**
 * @param {unknown} model
 * @returns {string}
 */
export function dataModelDisplayTitle(model) {
  return model?.name?.trim() || model?.title?.trim() || `Модель #${model?.id ?? '?'}`;
}

/**
 * @param {unknown} dashboard
 * @returns {string}
 */
export function dashboardDisplayTitle(dashboard) {
  return dashboard?.name?.trim() || dashboard?.title?.trim() || `Дашборд #${dashboard?.id ?? '?'}`;
}

/**
 * @param {unknown} sheet
 * @returns {string}
 */
export function sheetDisplayTitle(sheet) {
  return sheet?.name?.trim() || sheet?.title?.trim() || `Лист #${sheet?.id ?? '?'}`;
}

/** @param {EntityRef} ref */
export function entityRefKey(ref) {
  return `${ref?.type}:${ref?.id}${ref?.dashboard_id != null ? `:${ref.dashboard_id}` : ''}`;
}
