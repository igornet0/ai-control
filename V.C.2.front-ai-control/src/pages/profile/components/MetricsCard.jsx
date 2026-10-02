import React from 'react';
import Card from './Card';

/**
 * Компонент для отображения метрики (заголовок + значение) в карточке.
 */
export default function MetricsCard({ title, value }) {
  return (
    <Card className="flex flex-col items-center justify-center text-center hover:scale-105 transition-transform duration-300">
      <span className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>
        {title}
      </span>
      <span className="text-3xl font-bold text-gradient">
        {value}
      </span>
    </Card>
  );
}