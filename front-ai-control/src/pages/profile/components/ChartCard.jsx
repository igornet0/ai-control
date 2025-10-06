import React from 'react';
import Card from './Card';

/**
 * Компонент-заглушка для графика с градиентом. Заголовок задается через title.
 */
export default function ChartCard({ title }) {
  // Выбираем цвета градиента в зависимости от заголовка
  let gradientClass;
  if (title === 'Issues') {
    gradientClass = 'bg-gradient-to-tr from-red-500/20 to-red-600/30';
  } else if (title === 'Revenue') {
    gradientClass = 'bg-gradient-to-tr from-green-500/20 to-green-600/30';
  } else {
    // Forecast и др. - синий градиент
    gradientClass = 'bg-gradient-to-tr from-blue-500/20 to-blue-600/30';
  }
  
  return (
    <Card className="hover:scale-105 transition-transform duration-300">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          {title}
        </h3>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600"></div>
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Live</span>
        </div>
      </div>
      <div className={`h-48 ${gradientClass} rounded-lg flex items-center justify-center backdrop-blur-sm border border-slate-700/30`}>
        <div className="text-center">
          <div className="text-4xl mb-2 opacity-50">
            {title === 'Issues' && '📊'}
            {title === 'Revenue' && '💰'}
            {title === 'Forecast' && '📈'}
          </div>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Chart visualization
          </p>
        </div>
      </div>
    </Card>
  );
}