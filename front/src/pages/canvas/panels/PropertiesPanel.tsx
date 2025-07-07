import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store';
import { updateWidget } from '../store/dashboardSlice';

export default function PropertiesPanel() {
  const dataSources = useSelector((state: RootState) => state.dataSource.sources);

  const dispatch = useDispatch();
  const widgets = useSelector((state: RootState) => state.dashboard.widgets);
  const selectedWidgetId = useSelector((state: RootState) => state.dashboard.selectedWidgetId);

  const widget = widgets.find(w => w.id === selectedWidgetId);

  if (!widget) {
    return <div style={{ padding: '20px' }}>Выберите виджет для настройки</div>;
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    dispatch(updateWidget({ id: widget.id, [name]: value }));
  };

  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <h3>Настройки виджета</h3>
      <label>
        Название:
        <input
          type="text"
          name="title"
          value={(widget as any).title || ''}
          onChange={handleChange}
        />
      </label>

      {widget.type === 'chart' && (
        <label>
          Тип графика:
          <select name="chartType" value={(widget as any).chartType || 'bar'} onChange={handleChange}>
            <option value="bar">Bar</option>
            <option value="line">Line</option>
            <option value="pie">Pie</option>
          </select>
        </label>
      )}

      <label>
        Источник данных:
        <select
            name="dataSourceId"
            value={widget.dataSourceId || ''}
            onChange={handleChange}
        >
            <option value="">Не выбрано</option>
            {dataSources.map(source => (
            <option key={source.id} value={source.id}>{source.name}</option>
            ))}
        </select>
        </label>
    </div>
  );
}