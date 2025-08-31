import React, { useState } from 'react';
import { register } from '../../services/authService';
import styles from './Form.module.css';
const RegisterPage = () => {
  const [formData, setFormData] = useState({ 
    username: '',
    email: '', 
    login: '', 
    password: '',
    confirmPassword: ''
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
    
    if (!formData.username) {
      newErrors.username = 'Имя пользователя обязательно';
    }
    
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
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Подтверждение пароля обязательно';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Пароли не совпадают';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('Register form submitted with data:', formData);
    
    if (!validate()) return;
    
    setIsLoading(true);
    setErrors({});
    
    try {
      console.log('Attempting to register...');
      await register({
        username: formData.username,
        email: formData.email,
        login: formData.login,
        password: formData.password
      });
      
      console.log('Registration successful');
      setSuccessMessage('Регистрация прошла успешно! Теперь вы можете войти в систему.');
      
      // Очищаем форму после успешной регистрации
      setFormData({ email: '', login: '', password: '', confirmPassword: '', username: '' });
      
    } catch (error) {
        console.error('Registration error:', error);
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
    <div>
      <div>        
        {/* Карточка формы */}
        <div>
          <div className="p-8">
            {successMessage && (
              <div>
                {successMessage}
              </div>
            )}
            
            {errors.general && (
              <div>
                {errors.general}
              </div>
            )}
            
            <form className={styles.form} onSubmit={handleSubmit}>
              <h2>Sign Up</h2>

              {[
                { label: 'Username', name: 'username', type: 'text' },
                { label: 'Login', name: 'login', type: 'text' },
                { label: 'Email', name: 'email', type: 'email' },
                { label: 'Password', name: 'password', type: 'password' },
                { label: 'Confirm Password', name: 'confirmPassword', type: 'password' }
              ].map(({ label, name, type }) => (
                <div key={name}>
                  <label
                    htmlFor={name}
                  >
                    {label}:
                  </label>
                  <input
                    name={name}
                    id={name}
                    type={type}
                    placeholder={label}
                    className={`w-full px-4 py-3 rounded-lg border-b ${
                      errors[name] ? 'border-red-500' : 'border-gray-300'
                    } bg-transparent text-white placeholder:text-gray-400 focus:ring-0 focus:outline-none focus:border-blue-500 transition`}
                    value={formData[name]}
                    onChange={handleChange}
                    disabled={isLoading}
                  />
                  {errors[name] && (
                    <p className="mt-1 text-sm text-red-500">{errors[name]}</p>
                  )}
                </div>
              ))}

              <button
                type="submit"
                onClick={() => console.log('Register button clicked')}
                className={`w-full flex justify-center items-center py-3 px-4 rounded-lg text-white font-medium transition ${
                  isLoading
                    ? 'bg-blue-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700'
                }`}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    Регистрация...
                  </>
                ) : (
                  'Register'
                )}
              </button>
            </form>
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
