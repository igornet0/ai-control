export const GRID_ROW_UNIT_PX = 132;
export const GRID_GAP_PX = 24;
export const MIN_COL_SPAN = 1;
export const MAX_COL_SPAN = 3;
export const MIN_ROW_SPAN = 1;
export const MAX_ROW_SPAN = 6;
export const RESIZE_STEP_THRESHOLD = 0.42;

export function getGridColumnCount(width = typeof window !== 'undefined' ? window.innerWidth : 1280) {
  if (width >= 1280) return 3;
  if (width >= 768) return 2;
  return 1;
}

export function clampColSpan(value, gridColumns = 3) {
  const max = Math.min(MAX_COL_SPAN, gridColumns);
  return Math.max(MIN_COL_SPAN, Math.min(max, value));
}

export function clampRowSpan(value) {
  return Math.max(MIN_ROW_SPAN, Math.min(MAX_ROW_SPAN, value));
}

export function normalizeCardSize(config = {}, gridColumns = 3) {
  return {
    col_span: clampColSpan(Number(config.col_span ?? config.colSpan ?? 1), gridColumns),
    row_span: clampRowSpan(Number(config.row_span ?? config.rowSpan ?? 1)),
  };
}

export function getColumnUnitPx(containerWidth, gridColumns) {
  if (!containerWidth || gridColumns <= 0) return 280;
  return (containerWidth - GRID_GAP_PX * (gridColumns - 1)) / gridColumns;
}

function deltaToSpanChange(delta, unitSize) {
  const step = unitSize + GRID_GAP_PX;
  if (Math.abs(delta) < step * RESIZE_STEP_THRESHOLD) {
    return 0;
  }
  return Math.round(delta / step);
}

export function spansFromDrag({
  direction,
  startColSpan,
  startRowSpan,
  deltaX,
  deltaY,
  columnUnitPx,
  gridColumns,
}) {
  let colSpan = startColSpan;
  let rowSpan = startRowSpan;

  const colDelta = deltaToSpanChange(deltaX, columnUnitPx);
  const rowDelta = deltaToSpanChange(deltaY, GRID_ROW_UNIT_PX);

  if (direction === 'se') {
    colSpan = startColSpan + colDelta;
    rowSpan = startRowSpan + rowDelta;
  } else if (direction === 'e') {
    colSpan = startColSpan + colDelta;
  } else if (direction === 's') {
    rowSpan = startRowSpan + rowDelta;
  }

  return {
    col_span: clampColSpan(colSpan, gridColumns),
    row_span: clampRowSpan(rowSpan),
  };
}

export function mergeLayoutEntry(existing = {}, patch = {}) {
  return {
    position: patch.position ?? existing.position ?? 0,
    visible: patch.visible ?? existing.visible ?? true,
    col_span: patch.col_span ?? existing.col_span ?? 1,
    row_span: patch.row_span ?? existing.row_span ?? 1,
  };
}

export function formatWidgetSize(colSpan, rowSpan) {
  const widthLabel = colSpan === 1 ? 'узкий' : colSpan === 2 ? 'широкий' : 'на всю ширину';
  const heightLabels = ['компактный', 'средний', 'высокий', 'очень высокий', 'большой', 'максимальный'];
  const heightLabel = heightLabels[Math.min(rowSpan, heightLabels.length) - 1] ?? 'максимальный';
  return `${widthLabel}, ${heightLabel}`;
}
