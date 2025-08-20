// src/pages/profile/components/ProfileSidebar.jsx
import React from 'react';

const navItems = [
  { key: 'profile', label: 'Профиль' },
  { key: 'finance', label: 'Финансы' },
  { key: 'employees', label: 'Сотрудники' },
  { key: 'email', label: 'Почта' },
  { key: 'strategys', label: 'Стратегии' },
];

const ProfileSidebar = ({ activeTab, setActiveTab, onLogout }) => {
  return (
    <div className="w-50 bg-gradient-to-b from-[#0D1414] to-[#16251C] text-white h-screen flex flex-col">
      <div className="flex flex-col">
        {navItems.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`w-full text-left p-4 border-b border-[#16251C] hover:bg-[#16251C] hover:text-white transition ${
              activeTab === key ? 'bg-white text-[#16251C] font-bold' : ''
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <button
        className="w-full text-left p-4 border-b border-[#16251C] hover:bg-[#16251C] transition mt-auto"
        onClick={onLogout}
      >
        Выйти
      </button>
    </div>
  );
};

export default ProfileSidebar;