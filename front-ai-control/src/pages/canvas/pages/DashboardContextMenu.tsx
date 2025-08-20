// DashboardContextMenu.tsx
import React from 'react';
import ContextMenu from '../components/ContextMenu';
import { WidgetBase } from '../core/WidgetBase';

type Props = {
  contextMenu: { x: number; y: number; widgetId: string } | null;
  widgets: WidgetBase[];
  setContextMenu: (val: any) => void;
  setEditingWidget: (w: WidgetBase | null) => void;
  handleDeleteWidget: (id: string) => void;
};

const DashboardContextMenu: React.FC<Props> = ({
  contextMenu, widgets, setContextMenu, setEditingWidget, handleDeleteWidget
}) => {
  if (!contextMenu) return null;
  return (
    <ContextMenu
      contextMenu={contextMenu}
      widgets={widgets}
      setEditingWidget={setEditingWidget}
      setContextMenu={setContextMenu}
      handleDeleteWidget={handleDeleteWidget}
    />
  );
};

export default DashboardContextMenu;