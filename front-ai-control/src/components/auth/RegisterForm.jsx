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
    
    if (!validate()) return;
    
    setIsLoading(true);
    setErrors({});
    
    try {
      await register({
        username: formData.username,
        email: formData.email,
        login: formData.login,
        password: formData.password
      });
      
      setSuccessMessage('Регистрация прошла успешно! Теперь вы можете войти в систему.');
      
      // Очищаем форму после успешной регистрации
      setFormData({ email: '', login: '', password: '', confirmPassword: '', username: '' });
      
    } catch (error) {
      setError(error.response?.data?.detail || error.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div>        
        {/* Карточка формы */}
        <div>
          <div className="p-8">
            {successMessage && (
              <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg">
                <div className="flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  {successMessage}
                </div>
              </div>
            )}
            
            {errors.general && (
              <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
                <div className="flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  {errors.general}
                </div>
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
                    <div className="mt-1 flex items-center text-sm text-red-500">
                      <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      {errors[name]}
                    </div>
                  )}
                </div>
              ))}

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
