import React, { useState } from 'react';
import { login as loginService } from '../../services/authService';
import { useAuth } from '../../context/AuthContext';
import styles from './ModernForm.module.css';

const ModernLoginForm = ({ onLogin, onSwitchToRegister }) => {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState('');
  const { login } = useAuth();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    // Очищаем ошибку при изменении поля
    if (error) {
      setError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { access_token } = await loginService(formData);
      
      if (access_token) {
        await login(access_token);
        onLogin();
      } else {
        setError('Ошибка входа - токен не получен');
      }
    } catch (error) {
      console.error('Login error:', error);
      let errorMessage = 'Ошибка входа';
      
      if (error.response?.data) {
        if (typeof error.response.data === 'string') {
          errorMessage = error.response.data;
        } else if (error.response.data.detail) {
          errorMessage = error.response.data.detail;
        } else if (error.response.data.message) {
          errorMessage = error.response.data.message;
        } else if (Array.isArray(error.response.data)) {
          errorMessage = error.response.data.map(err => err.msg || err.message || err).join(', ');
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
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
      
      {error && (
        <div className={styles.errorMessage}>
          <div className={styles.errorIcon}>⚠️</div>
          <span>{error}</span>
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
              className={`${styles.input} ${focusedField === 'username' ? styles.focused : ''}`}
              placeholder=" "
            />
            <label htmlFor="username" className={styles.label}>
              <span className={styles.labelIcon}>👤</span>
              Имя пользователя
            </label>
            <div className={styles.inputBorder}></div>
          </div>
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
              className={`${styles.input} ${focusedField === 'password' ? styles.focused : ''}`}
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
              <span className={styles.buttonIcon}>🚀</span>
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
