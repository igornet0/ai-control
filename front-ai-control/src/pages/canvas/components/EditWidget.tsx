import React from 'react';
import { WidgetBase } from '../core/WidgetBase';

type ContextMenuProps = {
    editingWidget: WidgetBase;
    setWidgets: React.Dispatch<React.SetStateAction<WidgetBase[]>>;
    setEditingWidget: React.Dispatch<React.SetStateAction<WidgetBase | null>>;
};

const ContextMenu: React.FC<ContextMenuProps> = ({ editingWidget, setWidgets, setEditingWidget}) => {
 
  return (
      <div
        style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: 250,
            height: '100%',
            background: '#222',
            color: '#fff',
            padding: '20px',
            boxShadow: '-2px 0 10px rgba(0,0,0,0.5)',
            zIndex: 1001,
        }}
        >
        <h3>Редактировать</h3>
        {['x', 'y', 'width', 'height'].map((key) => (
            <div key={key} style={{ marginBottom: 10 }}>
            <label>{key.toUpperCase()}: </label>
            <input
                type="number"
                value={(editingWidget as any)[key]}
                onChange={(e) => {
                const val = parseInt(e.target.value);
                if (isNaN(val)) return;
                setWidgets(prev =>
                    prev.map(w =>
                    w.id === editingWidget.id
                        ? Object.assign(Object.create(Object.getPrototypeOf(w)), {
                            ...w,
                            [key]: val,
                        })
                        : w
                    )
                );
                setEditingWidget(prev => {
                    if (!prev) return null;
                    const updated = Object.assign(Object.create(Object.getPrototypeOf(prev)), {
                    ...prev,
                    [key]: val
                    });
                    return updated;
                });
                }}
                style={{ width: '100%', background: '#333', color: '#fff', border: '1px solid #555' }}
            />
            </div>
        ))}
        <button 
            onClick={() => setEditingWidget(null)} 
            style={{ marginTop: 20, background: '#444', color: 'white', border: 'none', padding: '8px 16px' }}
        >
            Закрыть
        </button>
        </div>
  );
};

export default ContextMenu;