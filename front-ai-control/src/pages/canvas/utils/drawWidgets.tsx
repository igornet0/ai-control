import { GRID_SIZE, RESIZE_SIZE } from '../CanvasApp';
import { WidgetBase } from '../core/WidgetBase';

export const drawWidgets = (ctx: CanvasRenderingContext2D, widgets: WidgetBase[], selectedWidgetId: string | null, resizingWidgetId: string | null, isEditing: boolean) => {
    widgets.forEach(widget => {
      if (isEditing) {
        if (widget.id === selectedWidgetId || widget.id === resizingWidgetId) {
          ctx.save();
          ctx.strokeStyle = '#00ffff';
          ctx.lineWidth = 2;
          ctx.strokeRect(widget.x - 2, widget.y - 2, widget.width + 4, widget.height + 4);
          ctx.restore();
        }
        widget.draw(ctx);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.fillRect(widget.x + widget.width - RESIZE_SIZE, widget.y + widget.height - RESIZE_SIZE, RESIZE_SIZE, RESIZE_SIZE);
      } else {
        widget.draw(ctx);
      }
    });
  };

export function getAutoSizedRect(canvasSize: { width: number; height: number }, widgets: WidgetBase[], dx: number, dy: number, widgetId: string, snapToGrid: (val: number) => number): { width: number, height: number } {
  let maxRight = canvasSize.width;
  let maxBottom = canvasSize.height;

  for (const w of widgets) {
    if (w.id === widgetId) continue;

    // ограничение по правому краю
    if (w.y < dy + RESIZE_SIZE && dy < w.y + w.height) {
      if (w.x > dx && w.x < maxRight) {
        maxRight = w.x;
      }
    }

    // ограничение по нижнему краю
    if (w.x < dx + RESIZE_SIZE && dx < w.x + w.width) {
      if (w.y > dy && w.y < maxBottom) {
        maxBottom = w.y;
      }
    }
  }

  const width = snapToGrid(maxRight - dx);
  const height = snapToGrid(maxBottom - dy);
  return {
    width: Math.max(GRID_SIZE * 5, width),
    height: Math.max(GRID_SIZE * 5, height)
  };
}

type FreeSpaceParams = {
  widgets: WidgetBase[];
  excludeWidget: WidgetBase;
  canvasSize: { width: number; height: number };
  startX: number;
  startY: number;
  gridSize: number;
  minSize: number;
  maxSize: number;
};
export function findFreeSpaceRect({
  widgets,
  excludeWidget,
  canvasSize,
  startX,
  startY,
  gridSize,
  minSize,
  maxSize,
}: FreeSpaceParams) {
  let minRight = canvasSize.width;
  let minBottom = canvasSize.height;
  let maxLeft = 0;
  let maxTop = 0;

  for (const w of widgets) {
    if (w.id === excludeWidget.id) continue;

    // Справа от точки
    if (
      w.y < startY + excludeWidget.height &&
      startY < w.y + w.height &&
      w.x > startX
    ) {
      minRight = Math.min(minRight, w.x);
    }

    // Снизу от точки
    if (
      w.x < startX + excludeWidget.width &&
      startX < w.x + w.width &&
      w.y > startY
    ) {
      minBottom = Math.min(minBottom, w.y);
    }

    // Слева от точки
    if (
      w.y < startY + excludeWidget.height &&
      startY < w.y + w.height &&
      w.x + w.width <= startX
    ) {
      maxLeft = Math.max(maxLeft, w.x + w.width);
    }

    // Сверху от точки
    if (
      w.x < startX + excludeWidget.width &&
      startX < w.x + w.width &&
      w.y + w.height <= startY
    ) {
      maxTop = Math.max(maxTop, w.y + w.height);
    }
  }

  const availableWidth = Math.max(minRight - startX, excludeWidget.width);
  const availableHeight = Math.max(minBottom - startY, excludeWidget.height);

  const snappedWidth = snapToNearest(availableWidth, gridSize, minSize, maxSize);
  const snappedHeight = snapToNearest(availableHeight, gridSize, minSize, maxSize);

  const testRect = { x: startX, y: startY, width: snappedWidth, height: snappedHeight };

  const collides = widgets.some(widget => {
    if (widget.id === excludeWidget.id) return false;
    return !(
      testRect.x + testRect.width <= widget.x ||
      testRect.x >= widget.x + widget.width ||
      testRect.y + testRect.height <= widget.y ||
      testRect.y >= widget.y + widget.height
    );
  });

  if (!collides && testRect.x + testRect.width <= canvasSize.width && testRect.y + testRect.height <= canvasSize.height) {
    return testRect;
  }

  return {
    x: startX,
    y: startY,
    width: excludeWidget.width,
    height: excludeWidget.height
  };
}

function snapToNearest(val: number, grid: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.floor(val / grid) * grid));
}