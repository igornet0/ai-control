import React, { useState } from 'react';
import { register } from '../../services/authService';
import { useAuth } from '../../context/AuthContext';
import { CheckIcon, RefreshIcon, SparklesIcon, WarningIcon } from '../icons/AppIcons';
import styles from './Form.module.css';
const RegisterPage = () => {
  const { login } = useAuth();
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
      const response = await register({
        username: formData.username,
        email: formData.email,
        login: formData.login,
        password: formData.password
      });

      if (response?.access_token) {
        await login(response.access_token, { csrf_token: response.csrf_token });
      }
      
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
    <div className="space-y-6">
      {successMessage && (
        <div className="bg-gradient-to-r from-green-500/20 to-emerald-600/20 border border-green-500/30 text-green-300 p-4 rounded-lg backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <CheckIcon size="md" />
            <span>{successMessage}</span>
          </div>
        </div>
      )}
      
      {errors.general && (
        <div className="bg-gradient-to-r from-red-500/20 to-rose-600/20 border border-red-500/30 text-red-300 p-4 rounded-lg backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <WarningIcon size="md" />
            <span>{errors.general}</span>
          </div>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gradient mb-2">Sign Up</h2>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Create your account to get started
          </p>
        </div>

        {[
          { label: 'Username', name: 'username', type: 'text' },
          { label: 'Login', name: 'login', type: 'text' },
          { label: 'Email', name: 'email', type: 'email' },
          { label: 'Password', name: 'password', type: 'password' },
          { label: 'Confirm Password', name: 'confirmPassword', type: 'password' }
        ].map(({ label, name, type }) => (
          <div key={name}>
            <label htmlFor={name} className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              {label}
            </label>
            <input
              name={name}
              id={name}
              type={type}
              placeholder={`Enter your ${label.toLowerCase()}`}
              className={`form-input ${
                errors[name] ? 'border-red-500' : ''
              }`}
              value={formData[name]}
              onChange={handleChange}
              disabled={isLoading}
            />
            {errors[name] && (
              <div className="mt-1 flex items-center text-sm text-red-400">
                <WarningIcon size="xs" />
                {errors[name]}
              </div>
            )}
          </div>
        ))}

        <button
          type="submit"
          className="btn btn-primary w-full"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <RefreshIcon size="sm" className="animate-spin" />
              Регистрация...
            </>
          ) : (
            <>
              <SparklesIcon size="sm" />
              Register
            </>
          )}
        </button>
      </form>
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
