import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './HeaderTabs.css';

export default function HeaderTabs() {
  const navigate = useNavigate();
  const location = useLocation();

  const tabs = ["Задачи", "Обзор", "Статистика", "Проекты", "Файлы"];

  const handleTabClick = (tab) => {
    if (tab === "Задачи") {
      navigate('/tasks');
    } else if (tab === "Проекты") {
      navigate('/projects');
    } else if (tab === "Статистика") {
      navigate('/statistics');
    } else if (tab === "Файлы") {
      navigate('/files');
    }
    // Для других вкладок можно добавить логику навигации
  };

  return (
    <div className="header-tabs">
      {tabs.map((tab) => (
        <button
          key={tab}
          className={`tab-button ${
            (location.pathname === '/tasks' && tab === 'Задачи') ||
            (location.pathname === '/projects' && tab === 'Проекты') ||
            (location.pathname === '/files' && tab === 'Файлы') ||
            (location.pathname === '/statistics' && tab === 'Статистика') ? 'active' : ''
          }`}
          onClick={() => handleTabClick(tab)}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}