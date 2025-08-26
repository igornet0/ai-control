import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './HeaderTabs.css';

export default function HeaderTabs() {
  const navigate = useNavigate();
  const location = useLocation();

  // Обновленный порядок вкладок: добавлена вкладка "Команды" между "Проекты" и "Файлы"
  const tabs = ["Задачи", "Обзор", "Статистика", "Проекты", "Команды", "Файлы"];

  const handleTabClick = (tab) => {
    if (tab === "Задачи") {
      navigate('/tasks');
    } else if (tab === "Обзор") {
      navigate('/overview');
    } else if (tab === "Статистика") {
      navigate('/statistics');
    } else if (tab === "Проекты") {
      navigate('/projects');
    } else if (tab === "Команды") {
      navigate('/teams');
    } else if (tab === "Файлы") {
      navigate('/files');
    }
  };

  const isActive = (tab) => {
    return (
      (location.pathname === '/tasks' && tab === 'Задачи') ||
      (location.pathname === '/overview' && tab === 'Обзор') ||
      (location.pathname === '/statistics' && tab === 'Статистика') ||
      (location.pathname === '/projects' && tab === 'Проекты') ||
      (location.pathname === '/teams' && tab === 'Команды') ||
      (location.pathname === '/files' && tab === 'Файлы')
    );
  };

  return (
    <div className="header-tabs">
      {tabs.map((tab) => (
        <button
          key={tab}
          className={`tab-button ${isActive(tab) ? 'active' : ''}`}
          onClick={() => handleTabClick(tab)}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}