import React from 'react';
import Card from './Card';
import MetricsCard from './MetricsCard';
import ChartCard from './ChartCard';

/**
 * Страница профиля пользователя. Отображается только при activeTab === 'profile'.
 */
export default function Profile({ activeTab, user }) {
  // Рендерим только при активной вкладке 'profile'
  if (activeTab !== 'profile') return null;

  // Пример данных пользователя и метрик (заменить реальными)
  // const user = {
  //   name: ',
  //   email: 'john.doe@example.com',
  //   avatar: 'https://via.placeholder.com/64'
  
  const performance = '83%';
  const issuesCount = '13';
  const revenue = '$ 12.4k';

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Верхний блок с аватаром, именем и email */}
      <div className="card animate-slideInLeft">
        <div className="flex items-center space-x-6">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-2xl font-bold text-white">
            {user.username ? user.username.charAt(0).toUpperCase() : 'U'}
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
              {user.username || 'User'}
            </h1>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              {user.email || 'user@example.com'}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className="px-2 py-1 text-xs rounded-full bg-green-500/20 text-green-300">
                Active
              </span>
              <span className="px-2 py-1 text-xs rounded-full bg-blue-500/20 text-blue-300">
                {user.role || 'User'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Метрики: Performance, Issues, Revenue */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="animate-slideInLeft" style={{ animationDelay: '0.1s' }}>
          <MetricsCard title="Performance" value={performance} />
        </div>
        <div className="animate-slideInLeft" style={{ animationDelay: '0.2s' }}>
          <MetricsCard title="Issues" value={issuesCount} />
        </div>
        <div className="animate-slideInLeft" style={{ animationDelay: '0.3s' }}>
          <MetricsCard title="Revenue" value={revenue} />
        </div>
      </div>

      {/* Два графика: Issues и Revenue */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="animate-slideInRight" style={{ animationDelay: '0.4s' }}>
          <ChartCard title="Issues" />
        </div>
        <div className="animate-slideInRight" style={{ animationDelay: '0.5s' }}>
          <ChartCard title="Revenue" />
        </div>
      </div>

      {/* График прогноза и карточка "Open Issues" рядом */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="animate-slideInLeft" style={{ animationDelay: '0.6s' }}>
          <ChartCard title="Forecast" />
        </div>
        <div className="animate-slideInRight" style={{ animationDelay: '0.7s' }}>
          <MetricsCard title="Open Issues" value={issuesCount} />
        </div>
      </div>
    </div>
  );
}