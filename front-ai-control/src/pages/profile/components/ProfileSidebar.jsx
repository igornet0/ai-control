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
    <div className="w-64 h-screen flex flex-col backdrop-blur-xl border-r" style={{ 
      background: 'var(--gradient-surface)', 
      borderColor: 'var(--color-border-muted)' 
    }}>
      <div className="p-6 border-b" style={{ borderColor: 'var(--color-border-muted)' }}>
        <h2 className="text-xl font-bold text-gradient">Profile</h2>
      </div>
      
      <div className="flex flex-col flex-1">
        {navItems.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`w-full text-left p-4 transition-all duration-300 border-b ${
              activeTab === key 
                ? 'bg-gradient-to-r from-indigo-500/20 to-purple-600/20 text-white font-semibold border-indigo-500/30' 
                : 'hover:bg-slate-700/30 text-slate-300 hover:text-white border-slate-700/30'
            }`}
            style={{ borderColor: 'var(--color-border-muted)' }}
          >
            <span className="flex items-center gap-3">
              <span className="text-lg">
                {key === 'profile' && '👤'}
                {key === 'finance' && '💰'}
                {key === 'employees' && '👥'}
                {key === 'email' && '📧'}
                {key === 'strategys' && '📊'}
              </span>
              {label}
            </span>
          </button>
        ))}
      </div>
      
      <div className="p-4 border-t" style={{ borderColor: 'var(--color-border-muted)' }}>
        <button
          className="w-full text-left p-3 rounded-lg transition-all duration-300 hover:bg-red-500/20 text-red-300 hover:text-red-100 flex items-center gap-3"
          onClick={onLogout}
        >
          <span className="text-lg">🚪</span>
          Выйти
        </button>
      </div>
    </div>
  );
};

export default ProfileSidebar;