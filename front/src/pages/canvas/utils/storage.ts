// src/utils/storage.ts
import { Widget } from '../store/dashboardSlice';
import { DataSource } from '../store/dataSourceSlice';

export interface DashboardStateSnapshot {
  widgets: Widget[];
  dataSources: DataSource[];
}

export const saveDashboard = (snapshot: DashboardStateSnapshot) => {
  localStorage.setItem('dashboard', JSON.stringify(snapshot));
};

export const loadDashboard = (): DashboardStateSnapshot | null => {
  const data = localStorage.getItem('dashboard');
  if (data) {
    return JSON.parse(data);
  }
  return null;
};

export const exportDashboard = (snapshot: DashboardStateSnapshot) => {
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = 'dashboard.json';
  link.click();
};

export const importDashboard = (file: File): Promise<DashboardStateSnapshot> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        const json = JSON.parse(event.target.result as string);
        resolve(json);
      } else {
        reject('Ошибка чтения файла');
      }
    };
    reader.readAsText(file);
  });
};