import React from 'react';
import { useNavigate } from 'react-router-dom';
import './HeaderTabs.css';

export default function HeaderTabs({ activeTab, onTabChange }) {
  const navigate = useNavigate();
  // Обновленный порядок вкладок: добавлена вкладка "Команды" между "Проекты" и "Файлы"
  const tabs = ["Задачи", "Обзор", "Статистика", "Проекты", "Команды", "Файлы"];

  const handleTabClick = (tab) => {
    if (onTabChange) {
      onTabChange(tab);
    }
  };

  const isActive = (tab) => {
    return activeTab === tab;
  };

  return (
    <div className="header-tabs">
      <div className="tabs-container">
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
      {activeTab === 'Задачи' && (
        <div className="header-actions">
          <button
            className="create-task-button"
            onClick={() => navigate('/tasks/create')}
            title="Создать новую задачу"
          >
            <span className="create-icon">✨</span>
            Создать задачу
          </button>
        </div>
      )}
    </div>
  );
}