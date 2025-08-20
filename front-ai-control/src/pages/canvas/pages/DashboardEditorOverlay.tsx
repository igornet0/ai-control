// DashboardEditorOverlay.tsx
import React from 'react';
import EditWidget from '../components/EditWidget';
import { EditFilterWidget } from '../components/EditFilterWidget';
import { WidgetFilter } from '../core/widgets/WidgetFilter';
import { WidgetBase } from '../core/WidgetBase';

type Props = {
  editingWidget: WidgetBase | null;
  isEditing: boolean;
  setWidgets: React.Dispatch<React.SetStateAction<WidgetBase[]>>;
  setEditingWidget: React.Dispatch<React.SetStateAction<WidgetBase | null>>;
};

const DashboardEditorOverlay: React.FC<Props> = ({
  editingWidget, isEditing, setWidgets, setEditingWidget
}) => {
  if (!editingWidget || !isEditing) return null;

  if (editingWidget instanceof WidgetFilter) {
    return <EditFilterWidget widget={editingWidget} setWidgets={setWidgets} />;
  }

  return (
    <EditWidget
      editingWidget={editingWidget}
      setWidgets={setWidgets}
      setEditingWidget={setEditingWidget}
    />
  );
};

export default DashboardEditorOverlay;