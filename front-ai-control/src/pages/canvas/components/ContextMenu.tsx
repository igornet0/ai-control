import React from 'react';
import { WidgetBase } from '../core/WidgetBase';

type ContextMenuProps = {
    contextMenu: { x: number; y: number; widgetId: string };
    widgets: WidgetBase[];
    setEditingWidget: (w: WidgetBase | null) => void;
    setContextMenu: React.Dispatch<React.SetStateAction<{ x: number; y: number; widgetId: string } | null>>;
    handleDeleteWidget: (id: string) => void;
};

const ContextMenu: React.FC<ContextMenuProps> = ({ contextMenu, widgets, setEditingWidget, setContextMenu, handleDeleteWidget }) => {
 
  return (
      <div
        style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            backgroundColor: '#333',
            color: 'white',
            padding: '10px',
            borderRadius: '4px',
            zIndex: 1000,
        }}
        >
        <div
            style={{ cursor: 'pointer', padding: '5px' }}
            onClick={() => {
            const widget = widgets.find(w => w.id === contextMenu?.widgetId);
            if (widget) setEditingWidget(widget);
            setContextMenu(null);
            }}
        >
            ✏️ Изменить
        </div>
        <div
            style={{ cursor: 'pointer', padding: '5px', marginTop: 5 }}
            onClick={() => handleDeleteWidget(contextMenu.widgetId)}
        >
            ❌ Удалить
        </div>
    </div>
  );
};

export default ContextMenu;