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
    <div className="p-6 bg-gradient-to-b from-[#0D1414] to-[#16251C] min-h-screen space-y-6">
      {/* Верхний блок с аватаром, именем и email */}
      <Card className="flex items-center space-x-4">
        {/* <img src={user.avatar} alt="Avatar" className="w-16 h-16 rounded-full" /> */}
        <div>
          <h1 className="text-xl font-semibold">{user.username}</h1>
          <p className="text-gray-600">{user.email}</p>
        </div>
      </Card>

      {/* Метрики: Performance, Issues, Revenue */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricsCard title="Performance" value={performance} />
        <MetricsCard title="Issues" value={issuesCount} />
        <MetricsCard title="Revenue" value={revenue} />
      </div>

      {/* Два графика: Issues и Revenue */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Issues" />
        <ChartCard title="Revenue" />
      </div>

      {/* График прогноза и карточка "Open Issues" рядом */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Forecast" />
        <MetricsCard title="Open Issues" value={issuesCount} />
      </div>
    </div>
  );
}