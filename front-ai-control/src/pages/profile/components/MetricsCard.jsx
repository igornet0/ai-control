import React from 'react';
import Card from './Card';

/**
 * Компонент для отображения метрики (заголовок + значение) в карточке.
 */
export default function MetricsCard({ title, value }) {
  return (
    <Card className="flex flex-col items-center justify-center">
      <span className="text-gray-500">{title}</span>
      <span className="mt-1 text-2xl font-semibold">{value}</span>
    </Card>
  );
}