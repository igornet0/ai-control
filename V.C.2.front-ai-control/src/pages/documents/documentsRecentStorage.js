export const RECENT_OPENED_KEY = 'documents-recent-opened';
export const RECENT_OPENED_MAX = 8;

/** @typedef {'template_document' | 'template_table' | 'document' | 'table_record'} RecentOpenedKind */

/**
 * @typedef {Object} RecentOpenedItem
 * @property {RecentOpenedKind} kind
 * @property {number} id
 * @property {string} title
 * @property {number} openedAt
 * @property {number} [documentKindId]
 */

/** @returns {RecentOpenedItem[]} */
export function loadRecentOpened() {
  try {
    const raw = localStorage.getItem(RECENT_OPENED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && item.kind && item.id != null)
      .slice(0, RECENT_OPENED_MAX);
  } catch {
    return [];
  }
}

/** @param {Omit<RecentOpenedItem, 'openedAt'>} entry */
export function rememberRecentOpened(entry) {
  if (!entry?.kind || entry.id == null) return;
  const id = Number(entry.id);
  if (Number.isNaN(id)) return;
  const title = String(entry.title || '').trim() || `#${id}`;
  const documentKindId = entry.documentKindId != null ? Number(entry.documentKindId) : undefined;
  const prev = loadRecentOpened().filter(
    (item) => !(item.kind === entry.kind && Number(item.id) === id),
  );
  const nextItem = {
    kind: entry.kind,
    id,
    title,
    openedAt: Date.now(),
    ...(documentKindId != null && !Number.isNaN(documentKindId) ? { documentKindId } : {}),
  };
  const next = [nextItem, ...prev].slice(0, RECENT_OPENED_MAX);
  try {
    localStorage.setItem(RECENT_OPENED_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export const RECENT_KIND_ICONS = {
  template_document: 'templateDocument',
  template_table: 'templateTable',
  document: 'documentStack',
  table_record: 'grid',
};

export const RECENT_KIND_LABELS = {
  template_document: 'Шаблон документа',
  template_table: 'Шаблон таблицы',
  document: 'Документ',
  table_record: 'Таблица',
};
