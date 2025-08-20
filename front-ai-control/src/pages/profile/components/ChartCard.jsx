import React from 'react';
import Card from './Card';

/**
 * Компонент-заглушка для графика с градиентом. Заголовок задается через title.
 */
export default function ChartCard({ title }) {
  // Выбираем цвета градиента в зависимости от заголовка
  let colorFrom, colorTo;
  if (title === 'Issues') {
    colorFrom = 'from-red-400'; colorTo = 'to-red-600';
  } else if (title === 'Revenue') {
    colorFrom = 'from-green-400'; colorTo = 'to-green-600';
  } else {
    // Forecast и др. - синий градиент
    colorFrom = 'from-blue-400'; colorTo = 'to-blue-600';
  }
  return (
    <Card>
      <h3 className="text-gray-700 mb-4">{title}</h3>
      <div className={`h-48 bg-gradient-to-tr ${colorFrom} ${colorTo} rounded-lg`} />
    </Card>
  );
}