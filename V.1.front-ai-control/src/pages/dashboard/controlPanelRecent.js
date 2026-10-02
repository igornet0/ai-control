const RECENT_KEY = 'control-panel-recent-items';
const MAX_RECENT = 6;

export function getRecentItems() {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

export function pushRecentItem(item) {
  if (!item?.id || !item?.path || !item?.name) return;
  const entry = {
    id: item.id,
    type: item.type,
    name: item.name,
    path: item.path,
    openedAt: Date.now(),
  };
  const prev = getRecentItems().filter(
    (x) => !(x.type === entry.type && String(x.id) === String(entry.id)),
  );
  const next = [entry, ...prev].slice(0, MAX_RECENT);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
  return next;
}

export function setRecentItems(items) {
  const normalized = Array.isArray(items) ? items.slice(0, MAX_RECENT) : [];
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(normalized));
  } catch {
    // ignore storage errors
  }
  return normalized;
}

export function removeRecentItem(type, id) {
  const next = getRecentItems().filter(
    (x) => !(x.type === type && String(x.id) === String(id)),
  );
  return setRecentItems(next);
}
