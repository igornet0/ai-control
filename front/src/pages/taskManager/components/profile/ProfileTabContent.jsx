import React from 'react';

const ProfileTabContent = ({ user }) => {
  return (
            <div className="lg:col-span-3">
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">Личная информация</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-700 mb-4">Основные данные</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm text-gray-500 mb-1">Имя пользователя</label>
                        <div className="p-3 bg-gray-50 rounded-lg">{user.login}</div>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-500 mb-1">Email</label>
                        <div className="p-3 bg-gray-50 rounded-lg">{user.email}</div>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-500 mb-1">Дата регистрации</label>
                        <div className="p-3 bg-gray-50 rounded-lg">{user.created.split('T')[0]}</div>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-semibold text-gray-700 mb-4">Безопасность</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm text-gray-500 mb-1">Статус аккаунта</label>
                        <div className="p-3 bg-green-50 text-green-700 rounded-lg">Подтвержден</div>
                      </div>
                      <button className="w-full bg-blue-100 text-blue-700 hover:bg-blue-200 p-3 rounded-lg transition">
                        Сменить пароль
                      </button>
                      <button className="w-full bg-blue-100 text-blue-700 hover:bg-blue-200 p-3 rounded-lg transition">
                        Двухфакторная аутентификация
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
  );
};

export default ProfileTabContent;

