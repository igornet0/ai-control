const STORAGE_PREFIX = 'aicontrol:profile-table-sort:';

function widgetNumericId(widgetId) {
  const text = String(widgetId || '');
  const match = text.match(/^widget_(\d+)$/);
  return match ? match[1] : text;
}

export function profileTableSortStorageKey(widgetId, flowId = null) {
  const id = widgetNumericId(widgetId);
  const flow = Number(flowId);
  const scope = Number.isInteger(flow) && flow > 0 ? `flow:${flow}` : 'live';
  return `${STORAGE_PREFIX}${id}:${scope}`;
}

export function loadProfileTableSort(widgetId, flowId = null) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(profileTableSortStorageKey(widgetId, flowId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const column = String(parsed?.column || '').trim();
    const dir = parsed?.dir === 'desc' ? 'desc' : parsed?.dir === 'asc' ? 'asc' : '';
    if (!column || !dir) return null;
    return { column, dir };
  } catch {
    return null;
  }
}

export function saveProfileTableSort(widgetId, flowId, sort) {
  if (typeof window === 'undefined') return;
  const key = profileTableSortStorageKey(widgetId, flowId);
  try {
    if (!sort?.column) {
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem(
      key,
      JSON.stringify({ column: String(sort.column), dir: sort.dir === 'desc' ? 'desc' : 'asc' }),
    );
  } catch {
    // ignore quota / private mode
  }
}
