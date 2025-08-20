import React from 'react';

/**
 * Универсальная «карточка» с отступами, скруглениями и тенью.
 * Принимает вложенный контент и дополнительные классы.
 */
export default function Card({ children, className = '' }) {
  return (
    <div className={`bg-black rounded-lg shadow p-6 ${className}`}>
      {children}
    </div>
  );
}