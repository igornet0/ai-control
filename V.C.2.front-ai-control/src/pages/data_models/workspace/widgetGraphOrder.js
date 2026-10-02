/**
 * Tab order for the DataCode editor is the widget graph, not creation order.
 *
 * Levels (longest path from sources):
 *   data-source → always 0
 *   everything else → max(incoming levels) + 1, or 1 if there is no incoming edge
 *
 * Why not increment a stored level on every new connection?
 *   - Add u→v with propagate is O(descendants) per edge. Building / rewriting a
 *     long path can degrade to O(V·E). At 1e6 edges that is not acceptable.
 *   - Deleting an edge cannot lower levels with increment-only state; you must
 *     recompute the affected subgraph anyway (worst O(V+E)).
 *   - `level += 1` per edge is wrong: two predecessors at level 1 must yield 2,
 *     not 3. The correct update is max(incoming)+1.
 *
 * On-demand Kahn + longest-path is O(V+E): ~1e6 edges is a few million integer
 * ops (typically tens of milliseconds in JS). Recompute when opening the editor
 * (and optionally debounce after graph edits). Do not persist incremental levels.
 */

export const DATA_SOURCE_WIDGET_TYPE = 'data-source';
export const DATA_MODEL_WIDGET_TYPE = 'data-model';

const DATACODE_WIDGET_TYPES = new Set([
  'data-source',
  'data-model',
  'processing-block',
  'formula',
  'relationship',
]);

export function isDataSourceWidget(widget) {
  return widget?.type === DATA_SOURCE_WIDGET_TYPE || widget?.type === DATA_MODEL_WIDGET_TYPE;
}

export function widgetHasDataCode(widget) {
  return DATACODE_WIDGET_TYPES.has(widget?.type);
}

export function widgetIdKey(id) {
  return id == null ? '' : String(id);
}

/**
 * Deduplicate connections stored on both endpoints.
 * Accepts either engine.getAllConnections() or per-widget `connections` arrays.
 */
export function collectUniqueConnections(widgets = [], connections = null) {
  const list = Array.isArray(connections) && connections.length
    ? connections
    : (widgets || []).flatMap((w) => w?.connections || []);
  const seen = new Set();
  const edges = [];
  for (const conn of list) {
    if (!conn || conn.from == null || conn.to == null) continue;
    const from = widgetIdKey(conn.from);
    const to = widgetIdKey(conn.to);
    if (!from || !to || from === to) continue;
    const key = conn.id != null ? `id:${conn.id}` : `${from}->${to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push({ from, to, id: conn.id ?? null });
  }
  return edges;
}

function defaultLevel(widget) {
  return isDataSourceWidget(widget) ? 0 : 1;
}

/**
 * Longest-path levels in the widget DAG. O(V+E).
 * Sources stay 0 even if an incoming edge exists (they have no input handle).
 * Nodes left in a cycle keep the best level already relaxed from processed preds.
 *
 * @returns {Map<string, number>} widgetId → level
 */
export function computeWidgetLevels(widgets = [], connections = null) {
  const nodes = (widgets || []).filter(Boolean);
  const byId = new Map(nodes.map((w) => [widgetIdKey(w.id), w]));
  const levels = new Map(nodes.map((w) => [widgetIdKey(w.id), defaultLevel(w)]));
  const edges = collectUniqueConnections(nodes, connections);

  const outgoing = new Map();
  const indegree = new Map(nodes.map((w) => [widgetIdKey(w.id), 0]));
  for (const { from, to } of edges) {
    if (!byId.has(from) || !byId.has(to)) continue;
    if (!outgoing.has(from)) outgoing.set(from, []);
    outgoing.get(from).push(to);
    indegree.set(to, (indegree.get(to) || 0) + 1);
  }

  const queue = [];
  for (const [id, deg] of indegree) {
    if (deg === 0) queue.push(id);
  }

  const processed = new Set();
  let head = 0;
  while (head < queue.length) {
    const u = queue[head];
    head += 1;
    processed.add(u);
    const uLevel = levels.get(u) ?? 0;
    const next = outgoing.get(u) || [];
    for (const v of next) {
      const vWidget = byId.get(v);
      if (vWidget && !isDataSourceWidget(vWidget)) {
        levels.set(v, Math.max(levels.get(v) ?? 1, uLevel + 1));
      }
      const nextDeg = (indegree.get(v) || 1) - 1;
      indegree.set(v, nextDeg);
      if (nextDeg === 0) queue.push(v);
    }
  }

  if (processed.size < nodes.length) {
    for (const { from, to } of edges) {
      if (!processed.has(from) || processed.has(to)) continue;
      const toWidget = byId.get(to);
      if (!toWidget || isDataSourceWidget(toWidget)) continue;
      const fromLevel = levels.get(from) ?? 0;
      levels.set(to, Math.max(levels.get(to) ?? 1, fromLevel + 1));
    }
  }

  return levels;
}

function compareWidgetsForTabs(a, b, levels) {
  const aId = widgetIdKey(a.id);
  const bId = widgetIdKey(b.id);
  const aLevel = levels.get(aId) ?? defaultLevel(a);
  const bLevel = levels.get(bId) ?? defaultLevel(b);
  if (aLevel !== bLevel) return aLevel - bLevel;
  const aSrc = isDataSourceWidget(a) ? 0 : 1;
  const bSrc = isDataSourceWidget(b) ? 0 : 1;
  if (aSrc !== bSrc) return aSrc - bSrc;
  const aName = String(a.settings?.name || '').toLocaleLowerCase();
  const bName = String(b.settings?.name || '').toLocaleLowerCase();
  if (aName !== bName) return aName.localeCompare(bName, 'ru');
  return aId.localeCompare(bId, undefined, { numeric: true });
}

export function tabNameForWidget(widget) {
  const name = widget?.settings?.name?.trim();
  if (name) return name;
  if (widget?.type === 'data-source') return 'Источник данных';
  if (widget?.type === 'data-model') return 'Модель данных';
  if (widget?.type === 'formula') return 'Формула';
  if (widget?.type === 'relationship') return 'Связь';
  if (widget?.type === 'processing-block') {
    const labels = {
      filter: 'Фильтр',
      transform: 'Трансформация',
      formula: 'Формула',
      aggregate: 'Агрегация',
      join: 'Объединение',
      sort: 'Сортировка',
    };
    return labels[widget.settings?.blockType] || 'Блок обработки';
  }
  return widget?.id != null ? `Виджет ${widget.id}` : 'Виджет';
}

/**
 * Widgets that become DataCode editor tabs, sources first then graph order.
 */
export function orderWidgetsForDataCodeTabs(widgets = [], connections = null) {
  const candidates = (widgets || []).filter(widgetHasDataCode);
  const levels = computeWidgetLevels(widgets, connections);
  const ordered = candidates.slice().sort((a, b) => compareWidgetsForTabs(a, b, levels));
  return { ordered, levels };
}

export function findActiveTabIndex(orderedWidgets, selectedWidgetId) {
  if (selectedWidgetId == null) return 0;
  const key = widgetIdKey(selectedWidgetId);
  const idx = orderedWidgets.findIndex((w) => widgetIdKey(w.id) === key);
  return idx >= 0 ? idx : 0;
}
