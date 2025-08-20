import { useCallback, useState } from 'react';
import { WidgetBase } from '../core/WidgetBase';
import { findFreeSpaceRect } from '../utils/drawWidgets';
import { WidgetContainer } from '../core/widgets/WidgetContainer';

type UseCanvasMouseHandlersProps = {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  isEditing: boolean;
  widgets: WidgetBase[];
  setWidgets: React.Dispatch<React.SetStateAction<WidgetBase[]>>;
  setContextMenu: React.Dispatch<React.SetStateAction<{ x: number; y: number; widgetId: string } | null>>;
  selectedWidgetId: string | null;
  setSelectedWidgetId: React.Dispatch<React.SetStateAction<string | null>>;
  resizingWidgetId: string | null;
  setResizingWidgetId: React.Dispatch<React.SetStateAction<string | null>>;
  draggingWidgetId: string | null;
  setDraggingWidgetId: React.Dispatch<React.SetStateAction<string | null>>;
  dropPreview: { x: number; y: number; width: number; height: number; isCollision?: boolean; swapTargetId?: string } | null;
  setDropPreview: React.Dispatch<React.SetStateAction<{ x: number; y: number; width: number; height: number; isCollision?: boolean; swapTargetId?: string } | null>>;
  setDragIndicator: React.Dispatch<React.SetStateAction<{ x: number; y: number } | null>>;
  setEditingWidget: React.Dispatch<React.SetStateAction<WidgetBase | null>>;
  canvasSize: { width: number; height: number };
  editingWidget: WidgetBase | null;
  GRID_SIZE: number;
  RESIZE_SIZE: number;
};

export const useCanvasMouseHandlers = ({
  canvasRef,
  isEditing,
  widgets,
  setWidgets,
  setContextMenu,
  selectedWidgetId: _selectedWidgetId,
  setSelectedWidgetId,
  resizingWidgetId,
  setResizingWidgetId,
  draggingWidgetId,
  setDraggingWidgetId,
  dropPreview,
  setDropPreview,
  setDragIndicator,
  setEditingWidget,
  canvasSize,
  editingWidget,
  GRID_SIZE,
  RESIZE_SIZE
}: UseCanvasMouseHandlersProps) => {

  const [hoveredWidgetId, setHoveredWidgetId] = useState<string | null>(null);

  const snapToGrid = (val: number) => Math.round(val / GRID_SIZE) * GRID_SIZE;

  const hasCollision = (x: number, y: number, movingWidget: WidgetBase, width = movingWidget.width, height = movingWidget.height) => {
    return widgets.some(widget => {
      if (widget.id === movingWidget.id) return false;
      return !(
        x + width <= widget.x ||
        x >= widget.x + widget.width ||
        y + height <= widget.y ||
        y >= widget.y + widget.height
      );
    });
  };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    for (let i = widgets.length - 1; i >= 0; i--) {
      const widget = widgets[i];

      if (widget.isHit(x, y)) {
        if (typeof (widget as any).handleClick === 'function') {
          (widget as any).handleClick(x, y);
          setWidgets([...widgets]);
        }

        if (!isEditing) return;

        const isResizeCorner = (
          x >= widget.x + widget.width - RESIZE_SIZE &&
          x <= widget.x + widget.width &&
          y >= widget.y + widget.height - RESIZE_SIZE &&
          y <= widget.y + widget.height
        );

        if (isResizeCorner) {
          setResizingWidgetId(widget.id);
          canvas.style.cursor = 'nwse-resize';
          return;
        }

        setSelectedWidgetId(widget.id);
        setDraggingWidgetId(widget.id);
        if (editingWidget) setEditingWidget(widget);
        canvas.style.cursor = 'grabbing';
        return;
      }
    }

    setSelectedWidgetId(null);
    setDraggingWidgetId(null);
  }, [canvasRef, widgets, setWidgets, isEditing, editingWidget]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas || !isEditing) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const activeId = draggingWidgetId || resizingWidgetId;

    if (isEditing && activeId) {
      const widget = widgets.find(w => w.id === activeId);
      if (!widget) return;

      canvas.style.cursor = draggingWidgetId ? 'grabbing' : 'nwse-resize';

      if (resizingWidgetId) {
        const newWidth = x - widget.x;
        const newHeight = y - widget.y;

        const clampedWidth = Math.min(Math.max(20, newWidth), canvasSize.width - widget.x);
        const clampedHeight = Math.min(Math.max(20, newHeight), canvasSize.height - widget.y);

        const tempWidget = Object.assign(Object.create(Object.getPrototypeOf(widget)), {
          ...widget,
          width: clampedWidth,
          height: clampedHeight
        });

        if (hasCollision(tempWidget.x, tempWidget.y, tempWidget)) return;

        setWidgets(prev =>
          prev.map(w =>
            w.id === resizingWidgetId ? tempWidget : w
          )
        );
        return;
      }

      if (draggingWidgetId && isEditing) {
        setDragIndicator({ x, y });

        const widget = widgets.find(w => w.id === draggingWidgetId);
        if (widget) {
          const suggested = findFreeSpaceRect({
            widgets,
            excludeWidget: widget,
            canvasSize,
            startX: snapToGrid(x),
            startY: snapToGrid(y),
            gridSize: GRID_SIZE,
            minSize: widget.width || GRID_SIZE * 5,
            maxSize: widget.width || GRID_SIZE * 20,
          });

          let adaptedWidth = suggested.width;
          let adaptedHeight = suggested.height;

          while (
            (adaptedWidth >= GRID_SIZE * 2 || adaptedHeight >= GRID_SIZE * 2) &&
            hasCollision(suggested.x, suggested.y, widget, adaptedWidth, adaptedHeight)
          ) {
            if (adaptedWidth >= adaptedHeight) {
              adaptedWidth -= GRID_SIZE;
            } else {
              adaptedHeight -= GRID_SIZE;
            }
          }

          adaptedWidth = snapToGrid(Math.max(GRID_SIZE * 2, adaptedWidth));
          adaptedHeight = snapToGrid(Math.max(GRID_SIZE * 2, adaptedHeight));

          const finalCollision = hasCollision(suggested.x, suggested.y, widget, adaptedWidth, adaptedHeight);

          const adaptedRect = {
            ...suggested,
            width: adaptedWidth,
            height: adaptedHeight
          };

          setDropPreview(finalCollision ? {
            ...adaptedRect,
            isCollision: true
          } : adaptedRect);

          const targetWidget = widgets.find(w => w.id !== draggingWidgetId && w.isHit(x, y));
          if (targetWidget) {
            setDropPreview({
              x: targetWidget.x,
              y: targetWidget.y,
              width: targetWidget.width,
              height: targetWidget.height,
              isCollision: false,
              swapTargetId: targetWidget.id
            });
          } else {
            setDropPreview(adaptedRect);
          }
        }
        return;
      }
    }

    // Hover detection
    let hoveringResize = false;
    let hoveringWidget = false;
    let hoveredId: string | null = null;

    for (const widget of widgets) {
      if (
        x >= widget.x + widget.width - RESIZE_SIZE &&
        x <= widget.x + widget.width &&
        y >= widget.y + widget.height - RESIZE_SIZE &&
        y <= widget.y + widget.height
      ) {
        hoveringResize = true;
        break;
      }

      if (widget.isHit(x, y)) {
        hoveringWidget = true;
        hoveredId = widget.id;
      }
    }

    if (hoveredId !== hoveredWidgetId) {
      setHoveredWidgetId(hoveredId);
      setWidgets(prev =>
        prev.map(w => {
          const updated = Object.assign(Object.create(Object.getPrototypeOf(w)), {
            ...w,
            hovered: w.id === hoveredId
          });
          return updated;
        })
      );
    }

    canvas.style.cursor = hoveringResize ? 'nwse-resize' : (hoveringWidget ? 'grab' : 'default');
    setDragIndicator(null);
  }, [canvasRef, widgets, canvasSize, isEditing, draggingWidgetId, resizingWidgetId, hoveredWidgetId, setWidgets]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (!isEditing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (resizingWidgetId) {
      setWidgets(prev =>
        prev.map(w =>
          w.id === resizingWidgetId
            ? Object.assign(Object.create(Object.getPrototypeOf(w)), {
                ...w,
                width: snapToGrid(w.width),
                height: snapToGrid(w.height),
              })
            : w
        )
      );
    }

    else if (draggingWidgetId) {
      const droppedWidget = widgets.find(w => w.id === draggingWidgetId);

      if (!droppedWidget) return;

      if (!(droppedWidget instanceof WidgetContainer)) {

        for (const widget of widgets) {
          if (
            widget instanceof WidgetContainer && widget.id !== draggingWidgetId &&
            widget.addIfHit(droppedWidget, e.clientX - canvas.getBoundingClientRect().left, e.clientY - canvas.getBoundingClientRect().top)
          ) {
            setWidgets(prev => prev.filter(w => w.id !== draggingWidgetId)); // Удалим из корня
            break;
          }
        }
      }

      if (dropPreview?.swapTargetId) {

        const targetId = dropPreview.swapTargetId;
        setWidgets(prev => {
          const w1 = prev.find(w => w.id === draggingWidgetId);
          const w2 = prev.find(w => w.id === targetId);
          if (!w1 || !w2) return prev;

          const updated = prev.map(w => {
            if (w.id === w1.id) {
              return Object.assign(Object.create(Object.getPrototypeOf(w)), {
                ...w,
                x: w2.x,
                y: w2.y,
                width: w2.width,
                height: w2.height,
              });
            }
            if (w.id === w2.id) {
              return Object.assign(Object.create(Object.getPrototypeOf(w)), {
                ...w,
                x: w1.x,
                y: w1.y,
                width: w1.width,
                height: w1.height,
              });
            }
            return w;
          });

          return updated;
        });
      } else if (dropPreview && !dropPreview.isCollision) {
        setWidgets(prev =>
          prev.map(w =>
            w.id === draggingWidgetId
              ? Object.assign(Object.create(Object.getPrototypeOf(w)), {
                  ...w,
                  x: dropPreview.x,
                  y: dropPreview.y,
                  width: dropPreview.width,
                  height: dropPreview.height
                })
              : w
          )
        );
      }
    }

    setDraggingWidgetId(null);
    setResizingWidgetId(null);
    setDropPreview(null);
    setDragIndicator(null);
    if (canvas) canvas.style.cursor = 'default';
  }, [canvasRef, draggingWidgetId, resizingWidgetId, dropPreview, isEditing]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    for (let i = widgets.length - 1; i >= 0; i--) {
      const widget = widgets[i];
      if (widget.isHit(x, y)) {
        setSelectedWidgetId(widget.id);
        if (editingWidget) {
          setEditingWidget(widget);
        }
        setContextMenu({ x: e.clientX, y: e.clientY, widgetId: widget.id });
        return;
      }
    }
    setContextMenu(null);
  }, [canvasRef, widgets, editingWidget]);

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleContextMenu,
    hoveredWidgetId,
  };
};