import { useRef, useState } from 'react';
import styles from './Canvas.module.css';
import { useEditMode } from '../../context/EditModeContext.jsx';
import { WidgetBase } from './core/WidgetBase';
import Dashboard from './pages/Dashboard';
import Toolsbar from './components/Toolsbar';

export const GRID_SIZE = 20;
export const RESIZE_SIZE = 10;

const CanvasApp = () => {
  const { isEditing } = useEditMode();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const [resizingWidgetId, setResizingWidgetId] = useState<string | null>(null);
  const [widgets, setWidgets] = useState<WidgetBase[]>([]);
  const [showGrid] = useState(isEditing);
  const [canvasSize, setCanvasSize] = useState({ width: 1200, height: 800 });

  return (
    <div className={isEditing ? styles.layout : ''}>
      { isEditing && (
        <Toolsbar
            widgets={widgets}
            setWidgets={setWidgets}
            canvasSize={canvasSize}
          />
      )}
      <Dashboard 
            canvasRef={canvasRef}
            selectedWidgetId={selectedWidgetId}
            setSelectedWidgetId={setSelectedWidgetId}
            resizingWidgetId={resizingWidgetId}
            setResizingWidgetId={setResizingWidgetId}
            widgets={widgets}
            setWidgets={setWidgets}
            showGrid={isEditing || showGrid}
            canvasSize={canvasSize}
            setCanvasSize={setCanvasSize}
            />

    </div>
  );
};

export default CanvasApp;
