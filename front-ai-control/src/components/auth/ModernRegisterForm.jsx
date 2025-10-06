import React, { useState } from 'react';
import { register } from '../../services/authService';
import styles from './ModernForm.module.css';

const ModernRegisterForm = ({ onSwitchToLogin }) => {
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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [focusedField, setFocusedField] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    // Очищаем ошибку при изменении поля
    if (errors[e.target.name]) {
      setErrors({ ...errors, [e.target.name]: '' });
    }
  };

  const validate = () => {
    const newErrors = {};
    
    if (!formData.username.trim()) {
      newErrors.username = 'Имя пользователя обязательно';
    } else if (formData.username.length < 2) {
      newErrors.username = 'Имя должно быть не менее 2 символов';
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email обязателен';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Некорректный формат email';
    }
    
    if (!formData.login.trim()) {
      newErrors.login = 'Логин обязателен';
    } else if (formData.login.length < 3) {
      newErrors.login = 'Логин должен быть не менее 3 символов';
    } else if (!/^[a-zA-Z0-9_]+$/.test(formData.login)) {
      newErrors.login = 'Логин может содержать только буквы, цифры и _';
    }
    
    if (!formData.password) {
      newErrors.password = 'Пароль обязателен';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Пароль должен быть не менее 6 символов';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      newErrors.password = 'Пароль должен содержать заглавные и строчные буквы, цифры';
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
      setFormData({ 
        username: '', 
        email: '', 
        login: '', 
        password: '', 
        confirmPassword: '' 
      });
      
    } catch (error) {
      console.error('Registration error:', error);
      let errorMessage = 'Ошибка регистрации';
      
      if (error.response?.data) {
        if (typeof error.response.data === 'string') {
          errorMessage = error.response.data;
        } else if (error.response.data.detail) {
          errorMessage = error.response.data.detail;
        } else if (error.response.data.message) {
          errorMessage = error.response.data.message;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setErrors({ general: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  const getPasswordStrength = (password) => {
    if (!password) return { strength: 0, text: '', color: '' };
    
    let strength = 0;
    if (password.length >= 6) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z\d]/.test(password)) strength++;
    
    const levels = [
      { text: 'Очень слабый', color: 'var(--color-accent-red)' },
      { text: 'Слабый', color: 'var(--color-accent-orange)' },
      { text: 'Средний', color: 'var(--color-accent-yellow)' },
      { text: 'Хороший', color: 'var(--color-accent-blue)' },
      { text: 'Отличный', color: 'var(--color-accent-green)' }
    ];
    
    return {
      strength: (strength / 5) * 100,
      text: levels[Math.min(strength, 4)].text,
      color: levels[Math.min(strength, 4)].color
    };
  };

  const passwordStrength = getPasswordStrength(formData.password);

  return (
    <div className={styles.formContainer}>
      <div className={styles.formHeader}>
        <h2 className={styles.formTitle}>Создать аккаунт</h2>
        <p className={styles.formSubtitle}>
          Присоединяйтесь к AI-CONTROL уже сегодня
        </p>
      </div>
      
      {successMessage && (
        <div className={styles.successMessage}>
          <div className={styles.successIcon}>✅</div>
          <span>{successMessage}</span>
        </div>
      )}
      
      {errors.general && (
        <div className={styles.errorMessage}>
          <div className={styles.errorIcon}>⚠️</div>
          <span>{errors.general}</span>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.inputGroup}>
          <div className={styles.inputContainer}>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              onFocus={() => setFocusedField('username')}
              onBlur={() => setFocusedField('')}
              required
              className={`${styles.input} ${focusedField === 'username' ? styles.focused : ''} ${errors.username ? styles.error : ''}`}
              placeholder=" "
            />
            <label htmlFor="username" className={styles.label}>
              <span className={styles.labelIcon}>👤</span>
              Полное имя
            </label>
            <div className={styles.inputBorder}></div>
          </div>
          {errors.username && (
            <div className={styles.fieldError}>
              <span className={styles.errorIcon}>⚠️</span>
              {errors.username}
            </div>
          )}
        </div>

        <div className={styles.inputGroup}>
          <div className={styles.inputContainer}>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              onFocus={() => setFocusedField('email')}
              onBlur={() => setFocusedField('')}
              required
              className={`${styles.input} ${focusedField === 'email' ? styles.focused : ''} ${errors.email ? styles.error : ''}`}
              placeholder=" "
            />
            <label htmlFor="email" className={styles.label}>
              <span className={styles.labelIcon}>📧</span>
              Email адрес
            </label>
            <div className={styles.inputBorder}></div>
          </div>
          {errors.email && (
            <div className={styles.fieldError}>
              <span className={styles.errorIcon}>⚠️</span>
              {errors.email}
            </div>
          )}
        </div>

        <div className={styles.inputGroup}>
          <div className={styles.inputContainer}>
            <input
              type="text"
              id="login"
              name="login"
              value={formData.login}
              onChange={handleChange}
              onFocus={() => setFocusedField('login')}
              onBlur={() => setFocusedField('')}
              required
              className={`${styles.input} ${focusedField === 'login' ? styles.focused : ''} ${errors.login ? styles.error : ''}`}
              placeholder=" "
            />
            <label htmlFor="login" className={styles.label}>
              <span className={styles.labelIcon}>🏷️</span>
              Логин
            </label>
            <div className={styles.inputBorder}></div>
          </div>
          {errors.login && (
            <div className={styles.fieldError}>
              <span className={styles.errorIcon}>⚠️</span>
              {errors.login}
            </div>
          )}
        </div>

        <div className={styles.inputGroup}>
          <div className={styles.inputContainer}>
            <input
              type={showPassword ? 'text' : 'password'}
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              onFocus={() => setFocusedField('password')}
              onBlur={() => setFocusedField('')}
              required
              className={`${styles.input} ${focusedField === 'password' ? styles.focused : ''} ${errors.password ? styles.error : ''}`}
              placeholder=" "
            />
            <label htmlFor="password" className={styles.label}>
              <span className={styles.labelIcon}>🔒</span>
              Пароль
            </label>
            <button
              type="button"
              className={styles.passwordToggle}
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? '🙈' : '👁️'}
            </button>
            <div className={styles.inputBorder}></div>
          </div>
          
          {formData.password && (
            <div className={styles.passwordStrength}>
              <div className={styles.strengthBar}>
                <div 
                  className={styles.strengthFill}
                  style={{ 
                    width: `${passwordStrength.strength}%`,
                    backgroundColor: passwordStrength.color
                  }}
                ></div>
              </div>
              <span 
                className={styles.strengthText}
                style={{ color: passwordStrength.color }}
              >
                {passwordStrength.text}
              </span>
            </div>
          )}
          
          {errors.password && (
            <div className={styles.fieldError}>
              <span className={styles.errorIcon}>⚠️</span>
              {errors.password}
            </div>
          )}
        </div>

        <div className={styles.inputGroup}>
          <div className={styles.inputContainer}>
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              onFocus={() => setFocusedField('confirmPassword')}
              onBlur={() => setFocusedField('')}
              required
              className={`${styles.input} ${focusedField === 'confirmPassword' ? styles.focused : ''} ${errors.confirmPassword ? styles.error : ''}`}
              placeholder=" "
            />
            <label htmlFor="confirmPassword" className={styles.label}>
              <span className={styles.labelIcon}>🔐</span>
              Подтвердите пароль
            </label>
            <button
              type="button"
              className={styles.passwordToggle}
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              {showConfirmPassword ? '🙈' : '👁️'}
            </button>
            <div className={styles.inputBorder}></div>
          </div>
          {errors.confirmPassword && (
            <div className={styles.fieldError}>
              <span className={styles.errorIcon}>⚠️</span>
              {errors.confirmPassword}
            </div>
          )}
        </div>

        <div className={styles.formOptions}>
          <label className={styles.checkboxContainer}>
            <input type="checkbox" className={styles.checkbox} required />
            <span className={styles.checkboxLabel}>
              Я согласен с 
              <a href="#" className={styles.link}>условиями использования</a>
              {' '}и{' '}
              <a href="#" className={styles.link}>политикой конфиденциальности</a>
            </span>
          </label>
        </div>
        
        <button 
          type="submit" 
          disabled={isLoading} 
          className={`${styles.submitButton} ${isLoading ? styles.loading : ''}`}
        >
          {isLoading ? (
            <>
              <div className={styles.spinner}></div>
              Регистрация...
            </>
          ) : (
            <>
              <span className={styles.buttonIcon}>✨</span>
              Создать аккаунт
            </>
          )}
        </button>
      </form>

      <div className={styles.formFooter}>
        <p className={styles.footerText}>
          Уже есть аккаунт? 
          <button 
            type="button"
            onClick={onSwitchToLogin}
            className={styles.footerLink}
          >
            Войти
          </button>
        </p>
      </div>
    </div>
  );
};

export default ModernRegisterForm;
