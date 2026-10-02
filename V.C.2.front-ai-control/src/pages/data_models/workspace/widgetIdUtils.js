/** Нормализация id виджетов/связей (БД отдаёт number, канвас хранит string). */

export function normalizeWidgetId(id) {
  if (id == null || id === '') return '';
  return String(id);
}

export function widgetIdsEqual(a, b) {
  return normalizeWidgetId(a) === normalizeWidgetId(b);
}

export function normalizeConnection(conn) {
  if (!conn || typeof conn !== 'object') return conn;
  return {
    ...conn,
    from: normalizeWidgetId(conn.from),
    to: normalizeWidgetId(conn.to),
  };
}

export function connectionPointKey(widgetId, handleType) {
  return `${normalizeWidgetId(widgetId)}_${handleType}`;
}
