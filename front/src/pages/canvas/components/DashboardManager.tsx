import React, { useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
import { saveDashboard, loadDashboard, exportDashboard, importDashboard } from '../utils/storage';
import { setDashboard } from '../store/dashboardSlice';
import { setDataSources } from '../store/dataSourceSlice';

export default function DashboardManager() {
  const dispatch = useDispatch();
  const widgets = useSelector((state: RootState) => state.dashboard.widgets);
  const dataSources = useSelector((state: RootState) => state.dataSource.sources);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSaveLocal = () => {
    saveDashboard({ widgets, dataSources });
    alert('Макет сохранён в localStorage!');
  };

  const handleLoadLocal = () => {
    const snapshot = loadDashboard();
    if (snapshot) {
      dispatch(setDashboard(snapshot.widgets));
      dispatch(setDataSources(snapshot.dataSources));
      alert('Макет загружен из localStorage!');
    } else {
      alert('Нет сохранённого макета!');
    }
  };

  const handleExport = () => {
    exportDashboard({ widgets, dataSources });
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    importDashboard(file).then(snapshot => {
      dispatch(setDashboard(snapshot.widgets));
      dispatch(setDataSources(snapshot.dataSources));
      alert('Макет успешно импортирован!');
    }).catch(() => alert('Ошибка при загрузке файла!'));
  };

  return (
    <div style={{ padding: '10px' }}>
      <h4>Управление макетом</h4>
      <button onClick={handleSaveLocal}>💾 Сохранить в localStorage</button>
      <button onClick={handleLoadLocal}>📂 Загрузить из localStorage</button>
      <button onClick={handleExport}>⬇️ Экспортировать JSON</button>
      <input type="file" ref={fileInputRef} onChange={handleImport} />
    </div>
  );
}