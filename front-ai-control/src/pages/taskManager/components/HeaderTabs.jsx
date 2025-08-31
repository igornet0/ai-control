import React from 'react';
import './HeaderTabs.css';

export default function HeaderTabs({ activeTab, onTabChange }) {
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