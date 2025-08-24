import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './HeaderTabs.css';

export default function HeaderTabs() {
  const navigate = useNavigate();
  const location = useLocation();

  const tabs = ["Tasks", "Overview", "Statistics", "Projects"];

  const handleTabClick = (tab) => {
    if (tab === "Projects") {
      navigate('/projects');
    }
    // Для других вкладок можно добавить логику навигации
  };

  return (
    <div className="header-tabs">
      {tabs.map((tab) => (
        <button
          key={tab}
          className={`tab-button ${
            location.pathname === '/projects' && tab === 'Projects' ? 'active' : ''
          }`}
          onClick={() => handleTabClick(tab)}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}