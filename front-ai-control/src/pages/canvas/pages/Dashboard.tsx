import React, { useEffect, useState } from 'react';
import DashboardContextMenu from './DashboardContextMenu';
import { useEditMode } from '../../../context/EditModeContext.jsx';
import DashboardEditorOverlay from './DashboardEditorOverlay';
import { WidgetBase } from '../core/WidgetBase';
import { drawWidgets } from '../utils/drawWidgets';
import { useCanvasMouseHandlers } from '../hooks/useCanvasMouseHandlers';
import { GRID_SIZE, RESIZE_SIZE } from '../CanvasApp';

type DashboardProps = {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  selectedWidgetId: string | null;
  setSelectedWidgetId: React.Dispatch<React.SetStateAction<string | null>>;
  resizingWidgetId: string | null;
  setResizingWidgetId: React.Dispatch<React.SetStateAction<string | null>>;
  widgets: WidgetBase[];
  setWidgets: React.Dispatch<React.SetStateAction<WidgetBase[]>>;
  showGrid: boolean;
  canvasSize: { width: number; height: number };
  setCanvasSize: React.Dispatch<React.SetStateAction<{ width: number; height: number }>>;
};

const Dashboard: React.FC<DashboardProps> = ({
  canvasRef,
  selectedWidgetId,
  setSelectedWidgetId,
  resizingWidgetId,
  setResizingWidgetId,
  widgets,
  setWidgets,
  showGrid,
  canvasSize,
  setCanvasSize,
}) => {
  const [draggingWidgetId, setDraggingWidgetId] = useState<string | null>(null);
  const [editingWidget, setEditingWidget] = useState<WidgetBase | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; widgetId: string } | null>(null);
  const [dropPreview, setDropPreview] = useState<null | { x: number; y: number; width: number; height: number } & { swapTargetId?: string }>(null);
  const [dragIndicator, setDragIndicator] = useState<null | { x: number; y: number }>(null);
  const { isEditing } = useEditMode();

  const {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleContextMenu,
    hoveredWidgetId: _hoveredWidgetId,
  } = useCanvasMouseHandlers({
    canvasRef,
    isEditing,
    widgets,
    setWidgets,
    setContextMenu,
    selectedWidgetId,
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
  });

  useEffect(() => {
    const updateCanvasSize = () => {
      setCanvasSize({ width: window.innerWidth, height: window.innerHeight });
    };
    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);

    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleLeave = () => {
      setDraggingWidgetId(null);
      setResizingWidgetId(null);
      canvas.style.cursor = 'default';
    };

    canvas.addEventListener('mouseleave', handleLeave);

    return () => {
      window.removeEventListener('resize', updateCanvasSize);
      canvas.removeEventListener('mouseleave', handleLeave);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (showGrid) {
      ctx.strokeStyle = '#333';
      for (let x = 0; x < canvas.width; x += GRID_SIZE) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += GRID_SIZE) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
    }

    if (isEditing) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      widgets.forEach(w => {
        ctx.strokeRect(w.x, w.y, w.width, w.height);
      });
      ctx.restore();
    }

    drawWidgets(ctx, widgets, selectedWidgetId, resizingWidgetId, isEditing);

    if (dragIndicator && isEditing) {
      ctx.save();
      const size = GRID_SIZE * 1.5;
      const x = dragIndicator.x - size / 2;
      const y = dragIndicator.y - size / 2;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fillRect(x, y, size, size);

      ctx.fillStyle = '#000';
      const dotSize = 2;
      const gap = size / 4;
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          ctx.beginPath();
          ctx.arc(x + gap + col * gap, y + gap + row * gap, dotSize, 0, 2 * Math.PI);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    if (dropPreview) {
      ctx.save();
      ctx.strokeStyle = '#4CAF50';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(dropPreview.x, dropPreview.y, dropPreview.width, dropPreview.height);
      
      if (dropPreview.swapTargetId) {
        ctx.strokeStyle = '#FFC107'; // желтая рамка
        ctx.lineWidth = 3;
        ctx.strokeRect(dropPreview.x, dropPreview.y, dropPreview.width, dropPreview.height);
      }
      
      ctx.fillStyle = 'rgba(76, 175, 80, 0.1)';
      ctx.fillRect(dropPreview.x, dropPreview.y, dropPreview.width, dropPreview.height);
      ctx.restore();
    }
  }, [widgets, showGrid, selectedWidgetId, canvasSize, isEditing, dragIndicator, dropPreview]);

  const handleDeleteWidget = (id: string) => {
    setWidgets(prev => prev.filter(w => w.id !== id));
    setContextMenu(null);
    if (editingWidget?.id === id) {
      setEditingWidget(null);
    }
  };

  useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenu) setContextMenu(null);
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [contextMenu]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{ flexGrow: 1, overflow: 'hidden', position: 'relative' }}>
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          style={{ display: 'block', width: '100%', height: '100%', border: 'none', background: '#1e1e1e' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onContextMenu={handleContextMenu}
        />

        <DashboardEditorOverlay
          editingWidget={editingWidget}
          isEditing={isEditing}
          setWidgets={setWidgets}
          setEditingWidget={setEditingWidget}
        />

        {contextMenu && (
          <DashboardContextMenu
            contextMenu={contextMenu}
            widgets={widgets}
            setEditingWidget={setEditingWidget}
            setContextMenu={setContextMenu}
            handleDeleteWidget={handleDeleteWidget}
          />
        )}
      </div>
    </div>
  );
};

export default Dashboard;