import React, { useState, useId } from 'react';
import { register } from '../../services/authService';
import { useAuth } from '../../context/AuthContext';
import {
  CheckIcon,
  EmailIcon,
  EyeClosedIcon,
  EyeOpenIcon,
  KeyIcon,
  LockIcon,
  SparklesIcon,
  TagIcon,
  UserIcon,
  WarningIcon,
} from '../icons/AppIcons';
import styles from './ModernForm.module.css';

const ModernRegisterForm = ({ onSwitchToLogin }) => {
  const fieldId = useId();
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
      const response = await register({
        name: formData.username,
        email: formData.email,
        login: formData.login,
        password: formData.password
      });

      if (response?.access_token) {
        await login(response.access_token, { csrf_token: response.csrf_token });
      }
      
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
          <div className={styles.successIcon}><CheckIcon size="md" /></div>
          <span>{successMessage}</span>
        </div>
      )}
      
      {errors.general && (
        <div className={styles.errorMessage}>
          <div className={styles.errorIcon}><WarningIcon size="md" /></div>
          <span>{errors.general}</span>
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
              Полное имя
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
              type="email"
              id={`${fieldId}-email`}
              name="email"
              value={formData.email}
              onChange={handleChange}
              onFocus={() => setFocusedField('email')}
              onBlur={() => setFocusedField('')}
              required
              className={`${styles.input} ${focusedField === 'email' ? styles.focused : ''} ${errors.email ? styles.error : ''}`}
              placeholder=" "
            />
            <label htmlFor={`${fieldId}-email`} className={styles.label}>
              <span className={styles.labelIcon}><EmailIcon size="xs" /></span>
              Email адрес
            </label>
            <div className={styles.inputBorder}></div>
          </div>
          {errors.email && (
            <div className={styles.fieldError}>
              <span className={styles.errorIcon}><WarningIcon size="xs" /></span>
              {errors.email}
            </div>
          )}
        </div>

        <div className={styles.inputGroup}>
          <div className={styles.inputContainer}>
            <input
              type="text"
              id={`${fieldId}-login`}
              name="login"
              value={formData.login}
              onChange={handleChange}
              onFocus={() => setFocusedField('login')}
              onBlur={() => setFocusedField('')}
              required
              className={`${styles.input} ${focusedField === 'login' ? styles.focused : ''} ${errors.login ? styles.error : ''}`}
              placeholder=" "
            />
            <label htmlFor={`${fieldId}-login`} className={styles.label}>
              <span className={styles.labelIcon}><TagIcon size="xs" /></span>
              Логин
            </label>
            <div className={styles.inputBorder}></div>
          </div>
          {errors.login && (
            <div className={styles.fieldError}>
              <span className={styles.errorIcon}><WarningIcon size="xs" /></span>
              {errors.login}
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
              <span className={styles.errorIcon}><WarningIcon size="xs" /></span>
              {errors.password}
            </div>
          )}
        </div>

        <div className={styles.inputGroup}>
          <div className={styles.inputContainer}>
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              id={`${fieldId}-confirmPassword`}
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              onFocus={() => setFocusedField('confirmPassword')}
              onBlur={() => setFocusedField('')}
              required
              className={`${styles.input} ${focusedField === 'confirmPassword' ? styles.focused : ''} ${errors.confirmPassword ? styles.error : ''}`}
              placeholder=" "
            />
            <label htmlFor={`${fieldId}-confirmPassword`} className={styles.label}>
              <span className={styles.labelIcon}><KeyIcon size="xs" /></span>
              Подтвердите пароль
            </label>
            <button
              type="button"
              className={styles.passwordToggle}
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              {showConfirmPassword ? <EyeClosedIcon size="md" /> : <EyeOpenIcon size="md" />}
            </button>
            <div className={styles.inputBorder}></div>
          </div>
          {errors.confirmPassword && (
            <div className={styles.fieldError}>
              <span className={styles.errorIcon}><WarningIcon size="xs" /></span>
              {errors.confirmPassword}
            </div>
          )}
        </div>

        <div className={styles.formOptions}>
          <label className={styles.checkboxContainer}>
            <input type="checkbox" className={styles.checkbox} required />
            <span className={styles.checkboxLabel}>
              Я согласен с 
              <a href="/legal/agreement" target="_blank" rel="noopener noreferrer" className={styles.link}>условиями использования</a>
              {' '}и{' '}
              <a href="/legal/privacy" target="_blank" rel="noopener noreferrer" className={styles.link}>политикой конфиденциальности</a>
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
              <span className={styles.buttonIcon}><SparklesIcon size="md" /></span>
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
