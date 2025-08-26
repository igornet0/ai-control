import React from 'react';

export default function TeamRatings({ tasks = [], users = [] }) {
  // Показываем простую заглушку пока нет API пользователей
  return (
    <div className="bg-[#16251C] p-4 rounded-lg shadow-sm">
      <h3 className="font-medium mb-4">Производительность команды</h3>
      <div className="text-center text-gray-400 text-sm py-4">
        Отслеживание производительности команды пока недоступно
      </div>
    </div>
  );
}