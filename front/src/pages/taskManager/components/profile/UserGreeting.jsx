import React from 'react';

const UserGreeting = ({ user }) => {
  return (
    <div className="lg:col-span-3 bg-white rounded-2xl shadow-lg p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-2">Добро пожаловать, {user.login}!</h2>
      <p className="text-gray-600">
        Наша ИИ система анализирует рынок 24/7 и совершает сделки с максимальной эффективностью.
      </p>
    </div>
  );
};

export default UserGreeting;