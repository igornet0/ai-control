import React, { useState, useId } from 'react';
import { login as loginService } from '../../services/authService';
import { useAuth } from '../../context/AuthContext';
import {
  CheckIcon,
  EyeClosedIcon,
  EyeOpenIcon,
  LockIcon,
  RocketIcon,
  UserIcon,
  WarningIcon,
} from '../icons/AppIcons';
import styles from './ModernForm.module.css';

const ModernLoginForm = ({ onLogin, onSwitchToRegister, notice }) => {
  const fieldId = useId();
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState('');
  const { login } = useAuth();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    // Очищаем ошибки при изменении поля
    if (error) {
      setError('');
    }
    if (errors[e.target.name]) {
      setErrors({ ...errors, [e.target.name]: '' });
    }
  };

  const validate = () => {
    const newErrors = {};
    
    if (!formData.username.trim()) {
      newErrors.username = 'Имя пользователя обязательно';
    }
    
    if (!formData.password) {
      newErrors.password = 'Пароль обязателен';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setErrors({});
    
    // Валидация на клиенте
    if (!validate()) {
      return;
    }
    
    setLoading(true);

    try {
            const response = await loginService(formData);
            
      if (response && response.access_token) {
                await login(response.access_token, { csrf_token: response.csrf_token });
                // Wait a bit for state to update
        setTimeout(() => {
          onLogin();
        }, 100);
      } else {
        setError('Ошибка входа - токен не получен');
      }
    } catch (error) {
      console.error('Login error:', error);
      const fieldErrors = {};
      let generalError = '';
      
      if (error.response?.data) {
        const errorData = error.response.data;
        
        // Проверяем, есть ли ошибки для конкретных полей
        if (typeof errorData === 'object' && !Array.isArray(errorData)) {
          // Если есть ошибки для полей username или password
          if (errorData.username) {
            fieldErrors.username = typeof errorData.username === 'string' 
              ? errorData.username 
              : Array.isArray(errorData.username) 
                ? errorData.username.join(', ') 
                : 'Неверное имя пользователя';
          }
          if (errorData.password) {
            fieldErrors.password = typeof errorData.password === 'string' 
              ? errorData.password 
              : Array.isArray(errorData.password) 
                ? errorData.password.join(', ') 
                : 'Неверный пароль';
          }
          
          // Если есть общая ошибка detail
          if (errorData.detail) {
            if (typeof errorData.detail === 'string') {
              generalError = errorData.detail;
            } else if (Array.isArray(errorData.detail)) {
              generalError = errorData.detail.map(err => {
                if (typeof err === 'string') return err;
                if (err.msg) return err.msg;
                if (err.message) return err.message;
                if (err.loc && err.msg) {
                  // Обработка ошибок валидации Pydantic
                  const field = err.loc[err.loc.length - 1];
                  if (field === 'username' || field === 'password') {
                    fieldErrors[field] = err.msg;
                    return null;
                  }
                }
                return JSON.stringify(err);
              }).filter(Boolean).join(', ');
            } else {
              generalError = String(errorData.detail);
            }
          } else if (errorData.message && Object.keys(fieldErrors).length === 0) {
            generalError = errorData.message;
          }
        } else if (typeof errorData === 'string') {
          generalError = errorData;
        } else if (Array.isArray(errorData)) {
          generalError = errorData.map(err => {
            if (typeof err === 'string') return err;
            if (err.msg) return err.msg;
            if (err.message) return err.message;
            return JSON.stringify(err);
          }).join(', ');
        }
      } else if (error.message) {
        generalError = error.message;
      }
      
      // Если нет конкретных ошибок полей, показываем общую ошибку
      if (Object.keys(fieldErrors).length === 0 && !generalError) {
        generalError = 'Ошибка входа. Проверьте правильность введенных данных.';
      }
      
      if (Object.keys(fieldErrors).length > 0) {
        setErrors(fieldErrors);
      }
      if (generalError) {
        setError(generalError);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.formContainer}>
      <div className={styles.formHeader}>
        <h2 className={styles.formTitle}>Добро пожаловать!</h2>
        <p className={styles.formSubtitle}>
          Войдите в свой аккаунт для продолжения
        </p>
      </div>
      
      {notice && (
        <div className={styles.successMessage}>
          <div className={styles.successIcon}><CheckIcon size="md" /></div>
          <span>{notice}</span>
        </div>
      )}

      {error && (
        <div className={styles.errorMessage}>
          <div className={styles.errorIcon}><WarningIcon size="md" /></div>
          <span>{error}</span>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.inputGroup}>
          <div className={styles.inputContainer}>
            <input
              type="text"
              id={`${fieldId}-username`}
              name="username"
              value={formData.username}
              onChange={handleChange}
              onFocus={() => setFocusedField('username')}
              onBlur={() => setFocusedField('')}
              required
              className={`${styles.input} ${focusedField === 'username' ? styles.focused : ''} ${errors.username ? styles.error : ''}`}
              placeholder=" "
            />
            <label htmlFor={`${fieldId}-username`} className={styles.label}>
              <span className={styles.labelIcon}><UserIcon size="xs" /></span>
              Имя пользователя
            </label>
            <div className={styles.inputBorder}></div>
          </div>
          {errors.username && (
            <div className={styles.fieldError}>
              <span className={styles.errorIcon}><WarningIcon size="xs" /></span>
              {errors.username}
            </div>
          )}
        </div>
        
        <div className={styles.inputGroup}>
          <div className={styles.inputContainer}>
            <input
              type={showPassword ? 'text' : 'password'}
              id={`${fieldId}-password`}
              name="password"
              value={formData.password}
              onChange={handleChange}
              onFocus={() => setFocusedField('password')}
              onBlur={() => setFocusedField('')}
              required
              className={`${styles.input} ${focusedField === 'password' ? styles.focused : ''} ${errors.password ? styles.error : ''}`}
              placeholder=" "
            />
            <label htmlFor={`${fieldId}-password`} className={styles.label}>
              <span className={styles.labelIcon}><LockIcon size="xs" /></span>
              Пароль
            </label>
            <button
              type="button"
              className={styles.passwordToggle}
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeClosedIcon size="md" /> : <EyeOpenIcon size="md" />}
            </button>
            <div className={styles.inputBorder}></div>
          </div>
          {errors.password && (
            <div className={styles.fieldError}>
              <span className={styles.errorIcon}><WarningIcon size="xs" /></span>
              {errors.password}
            </div>
          )}
        </div>

        <div className={styles.formOptions}>
          <label className={styles.checkboxContainer}>
            <input type="checkbox" className={styles.checkbox} />
            <span className={styles.checkboxLabel}>Запомнить меня</span>
          </label>
          <a href="#" className={styles.forgotLink}>
            Забыли пароль?
          </a>
        </div>
        
        <button 
          type="submit" 
          disabled={loading} 
          className={`${styles.submitButton} ${loading ? styles.loading : ''}`}
        >
          {loading ? (
            <>
              <div className={styles.spinner}></div>
              Вход...
            </>
          ) : (
            <>
              <span className={styles.buttonIcon}><RocketIcon size="md" /></span>
              Войти
            </>
          )}
        </button>
      </form>

      <div className={styles.formFooter}>
        <p className={styles.footerText}>
          Нет аккаунта? 
          <button 
            type="button"
            onClick={onSwitchToRegister}
            className={styles.footerLink}
          >
            Зарегистрироваться
          </button>
        </p>
      </div>
    </div>
  );
};

export default ModernLoginForm;
