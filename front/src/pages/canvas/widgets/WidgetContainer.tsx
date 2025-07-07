import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { selectWidget } from '../store/dashboardSlice';
import { RootState } from '../store';

interface WidgetContainerProps {
  widgetId: string;
  children: React.ReactNode;
}

export default function WidgetContainer({ widgetId, children }: WidgetContainerProps) {
  const dispatch = useDispatch();
  const selectedWidgetId = useSelector((state: RootState) => state.dashboard.selectedWidgetId);
  const isSelected = selectedWidgetId === widgetId;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Остановим всплытие, чтобы не мешать другим обработчикам
    dispatch(selectWidget(widgetId));
  };

  const style: React.CSSProperties = {
    border: isSelected ? '2px solid #357EDD' : '1px solid transparent',
    borderRadius: '4px',
    padding: '4px',
    background: isSelected ? '#f0f8ff' : 'transparent',
  };

  return (
    <div onClick={handleClick} style={style}>
      {children}
    </div>
  );
}