import React, { useState } from 'react';
import { login } from '../services/authService';
import logo from '../img/logo.webp'; // Используем webp для лучшей производительности
import spinner from '../img/pageload-spinner.gif';

const LoginPage = ({ onLogin }) => {
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      const access_token = await login(formData);
      localStorage.setItem('access_token', access_token);
      onLogin();
    } catch (err) {
      console.log(err);
      setError('Неверное имя пользователя или пароль');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 to-purple-900 p-4">
      <div className="w-full max-w-md">
        {/* Логотип */}
        <div className="flex justify-center mb-8">
          <a href="https://agent-trade.ru" className="flex items-center">
          <img 
            src={logo} 
            alt="AI Trading Logo" 
            className="w-48 h-auto"
          />
          </a>
        </div>
        
        {/* Заголовок */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-white mb-2">Торговля с помощью ИИ</h1>
          <p className="text-xl text-blue-200">
            Доверьте свои инвестиции нейросетям нового поколения
          </p>
        </div>
        
        {/* Карточка формы */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="p-8">
            <div className="border-b border-gray-200 pb-6 mb-6">
              <h2 className="text-2xl font-bold text-gray-800 text-center">Вход в систему</h2>
            </div>
            
            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-center">
                {error}
              </div>
            )}
            
            <form onSubmit={handleSubmit}>
              <div className="mb-5">
                <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="username">
                  Имя пользователя/Почта
                </label>
                <input
                  name="username"
                  id="username"
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="Введите ваш логин или почту"
                  value={formData.username}
                  onChange={handleChange}
                  required
                  disabled={isLoading}
                />
              </div>
              
              <div className="mb-6">
                <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="password">
                  Пароль
                </label>
                <input
                  name="password"
                  id="password"
                  type="password"
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="Введите ваш пароль"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  disabled={isLoading}
                />
              </div>
              
              <button
                type="submit"
                className={`w-full flex justify-center items-center py-3 px-4 rounded-lg text-white font-medium transition ${
                  isLoading 
                    ? 'bg-blue-400 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700'
                }`}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    Вход в систему...
                  </>
                ) : (
                  'Войти в систему'
                )}
              </button>
            </form>
          </div>
          
          <div className="bg-gray-50 px-8 py-6 text-center">
            <p className="text-gray-600">
              Нет аккаунта?{' '}
              <a 
                href="/register" 
                className="font-medium text-blue-600 hover:text-blue-800 transition"
              >
                Зарегистрируйтесь
              </a>
            </p>
          </div>
        </div>
        
        {/* Футер */}
        <div className="mt-8 text-center text-blue-100 text-sm">
          <p>Наша система анализирует рынок 24/7 и совершает сделки с максимальной эффективностью</p>
          <div className="mt-4 flex justify-center space-x-6">
            <a href="#" className="hover:text-white transition">Finance Activity</a>
            <a href="#" className="hover:text-white transition">Expense</a>
            <a href="#" className="hover:text-white transition">Income</a>
            <a href="#" className="hover:text-white transition">TRANSFER</a>
            <a href="#" className="hover:text-white transition">Chats</a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;