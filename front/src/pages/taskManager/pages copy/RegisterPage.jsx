import React, { useState } from 'react';
import { register } from '../services/authService';
import logo from '../img/logo.webp';
import spinner from '../img/pageload-spinner.gif';

const RegisterPage = () => {
  const [formData, setFormData] = useState({ 
    email: '', 
    login: '', 
    password: '' 
  });
  
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    // Очищаем ошибку при изменении поля
    if (errors[e.target.name]) {
      setErrors({ ...errors, [e.target.name]: '' });
    }
  };

  const validate = () => {
    const newErrors = {};
    
    if (!formData.email) {
      newErrors.email = 'Email обязателен';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Некорректный формат email';
    }
    
    if (!formData.login) {
      newErrors.login = 'Логин обязателен';
    } else if (formData.login.length < 3) {
      newErrors.login = 'Логин должен быть не менее 3 символов';
    }
    
    if (!formData.password) {
      newErrors.password = 'Пароль обязателен';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Пароль должен быть не менее 6 символов';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validate()) return;
    
    setIsLoading(true);
    setErrors({});
    
    try {
      await register({
        email: formData.email,
        login: formData.login,
        password: formData.password
      });
      
      setSuccessMessage('Регистрация прошла успешно! Теперь вы можете войти в систему.');
      
      // Очищаем форму после успешной регистрации
      setFormData({ email: '', login: '', password: '' });
      
    } catch (error) {
        console.error('Registration error:', error.response);
        if (error.response && error.response.data) {
            const apiErrors = error.response.data;
            
            // Обработка специфических ошибок FastAPI
            if (apiErrors.detail) {
                if (typeof apiErrors.detail === 'string') {
                    // Ошибка в формате строки
                    if (apiErrors.detail.includes("Email")) {
                    setErrors({ email: apiErrors.detail });
                    } else if (apiErrors.detail.includes("Login")) {
                    setErrors({ login: apiErrors.detail });
                    } else {
                    setErrors({ general: apiErrors.detail });
                    }
                } else if (Array.isArray(apiErrors.detail)) {
                    // Ошибка в формате массива объектов
                    const fieldErrors = {};
                    apiErrors.detail.forEach(err => {
                    if (err.loc && err.msg) {
                        const field = err.loc[err.loc.length - 1];
                        fieldErrors[field] = err.msg;
                    }
                    });
                    setErrors(fieldErrors);
                }
            } else {
                setErrors({ general: 'Ошибка регистрации. Пожалуйста, попробуйте позже.' });
            }
        } else {
            setErrors({ general: 'Сервер недоступен. Пожалуйста, попробуйте позже.' });
        }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 to-purple-900 p-4">
      <div className="w-full max-w-md">
        {/* Логотип */}
        <div className="flex justify-center mb-8">
          <img 
            src={logo} 
            alt="AI Trading Logo" 
            className="w-48 h-auto"
          />
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
              <h2 className="text-2xl font-bold text-gray-800 text-center">Регистрация</h2>
            </div>
            
            {successMessage && (
              <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg text-center">
                {successMessage}
              </div>
            )}
            
            {errors.general && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-center">
                {errors.general}
              </div>
            )}
            
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="email">
                  Email
                </label>
                <input
                  name="email"
                  id="email"
                  type="email"
                  className={`w-full px-4 py-3 rounded-lg border ${
                    errors.email ? 'border-red-500' : 'border-gray-300'
                  } focus:ring-2 focus:ring-blue-500 focus:border-transparent transition`}
                  placeholder="Введите ваш email"
                  value={formData.email}
                  onChange={handleChange}
                  disabled={isLoading}
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-500">{errors.email}</p>
                )}
              </div>
              
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="login">
                  Логин
                </label>
                <input
                  name="login"
                  id="login"
                  className={`w-full px-4 py-3 rounded-lg border ${
                    errors.login ? 'border-red-500' : 'border-gray-300'
                  } focus:ring-2 focus:ring-blue-500 focus:border-transparent transition`}
                  placeholder="Придумайте логин"
                  value={formData.login}
                  onChange={handleChange}
                  disabled={isLoading}
                />
                {errors.login && (
                  <p className="mt-1 text-sm text-red-500">{errors.login}</p>
                )}
              </div>
              
              <div className="mb-6">
                <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="password">
                  Пароль
                </label>
                <input
                  name="password"
                  id="password"
                  type="password"
                  className={`w-full px-4 py-3 rounded-lg border ${
                    errors.password ? 'border-red-500' : 'border-gray-300'
                  } focus:ring-2 focus:ring-blue-500 focus:border-transparent transition`}
                  placeholder="Придумайте пароль"
                  value={formData.password}
                  onChange={handleChange}
                  disabled={isLoading}
                />
                {errors.password && (
                  <p className="mt-1 text-sm text-red-500">{errors.password}</p>
                )}
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
                    <img src={spinner} alt="Loading" className="w-5 h-5 mr-2" />
                    Регистрация...
                  </>
                ) : (
                  'Зарегистрироваться'
                )}
              </button>
            </form>
          </div>
          
          <div className="bg-gray-50 px-8 py-6 text-center">
            <p className="text-gray-600">
              Уже есть аккаунт?{' '}
              <a 
                href="/login" 
                className="font-medium text-blue-600 hover:text-blue-800 transition"
              >
                Войдите
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

export default RegisterPage;
















          
//           {/* Блок с чатами */}
//           <div className="bg-white rounded-2xl shadow-lg p-6">
//             <h2 className="text-xl font-bold text-gray-800 mb-4">Chats</h2>
//             <div className="space-y-4">
//               <div className="p-4 bg-gray-50 rounded-lg">
//                 <div className="font-semibold">Support Team</div>
//                 <p className="text-sm text-gray-600 mt-1">
//                   I hope you are finding Blocs fun to build websites with. Thanks for your support!
//                 </p>
//                 <div className="text-xs text-gray-400 mt-2">TODAY, 14:30</div>
//               </div>
//               <div className="p-4 bg-blue-50 rounded-lg">
//                 <div className="font-semibold">Norm</div>
//                 <p className="text-sm text-gray-600 mt-1">
//                   Hey Norm, Blocs Rocks, congrats!
//                 </p>
//                 <div className="text-xs text-gray-400 mt-2">TODAY, 19:30</div>
//               </div>
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default ProfilePage;
