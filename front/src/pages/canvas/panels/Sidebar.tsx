import { useDispatch } from 'react-redux';
import { addWidget } from '../store/dashboardSlice';
import DataSourceManager from '../data/DataSourceManager';
import DataSourcesList from '../data/DataSourcesList';
import DashboardManager from '../components/DashboardManager';
import FilterPanel from '../components/FilterPanel';
import { v4 as uuidv4 } from 'uuid';

export default function Sidebar() {
  const dispatch = useDispatch();

  const handleAdd = (type: 'chart' | 'table' | 'kpi') => {
    dispatch(
      addWidget({
        id: uuidv4(),
        type,
        x: 0,
        y: Infinity,
        w: 4,
        h: 4,
      })
    );
  };

  return (
    <div className="sidebar">
      {/* Кнопки для добавления виджетов */}
      <button onClick={() => handleAdd('chart')}>📊 Добавить график</button>
      <button onClick={() => handleAdd('table')}>📋 Добавить таблицу</button>
      <button onClick={() => handleAdd('kpi')}>🔢 Добавить KPI</button>

      {/* Менеджер источников данных */}
      <DataSourceManager />

      {/* Список доступных источников */}
      <DataSourcesList />

      {/* Менеджер макетов */}
      <DashboardManager />

      <FilterPanel />
    </div>
  );
}