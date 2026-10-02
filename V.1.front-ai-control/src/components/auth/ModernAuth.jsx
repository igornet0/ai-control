import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import logo from '../../assets/logo.png';
import {
  ChartIcon,
  KeyIcon,
  LockIcon,
  RocketIcon,
  SparklesIcon,
} from '../icons/AppIcons';
import styles from './ModernAuth.module.css';
import ModernLoginForm from './ModernLoginForm';
import ModernRegisterForm from './ModernRegisterForm';

const ModernAuth = ({ login }) => {
  const [activeTab, setActiveTab] = useState('login');
  const [isAnimating, setIsAnimating] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const notice = location.state?.message;

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
            navigate('/profile');
    }
  }, [isAuthenticated, navigate]);

  const handleLoginSuccess = () => {
        navigate('/profile');
  };

  const handleTabChange = (tab) => {
    if (tab !== activeTab) {
      setIsAnimating(true);
      setTimeout(() => {
        setActiveTab(tab);
        setIsAnimating(false);
      }, 150);
    }
  };

  const handleLogoClick = () => {
    navigate('/');
  };

  return (
    <div className={styles.authContainer}>
      {/* Анимированный фон */}
      <div className={styles.backgroundAnimation}>
        <div className={styles.gradientOrb}></div>
        <div className={styles.gradientOrb}></div>
        <div className={styles.gradientOrb}></div>
        <div className={styles.floatingShapes}>
          <div className={styles.shape}></div>
          <div className={styles.shape}></div>
          <div className={styles.shape}></div>
        </div>
      </div>

      {/* Основной контент */}
      <div className={styles.authContent}>
        {/* Логотип и заголовок */}
        <div className={styles.logoSection} onClick={handleLogoClick}>
          <div className={styles.logoContainer}>
            <img src={logo} alt="AI-Control Logo" className={styles.logo} />
            <div className={styles.logoGlow}></div>
          </div>
          {/* <h1 className={styles.title}>2A Данные</h1> */}
          <p className={styles.subtitle}>
            Добро пожаловать в будущее управления данными
          </p>
          {/* <p className={styles.clickHint}>
            <span className={styles.hintIcon}><HomeIcon size="sm" /></span>
            Нажмите, чтобы вернуться на главную
          </p> */}
        </div>

        {/* Карточка аутентификации */}
        <div className={styles.authCard}>
          {/* Переключатель вкладок */}
          <div className={styles.tabSwitcher}>
            <button
              className={`${styles.tabButton} ${activeTab === 'login' ? styles.active : ''}`}
              onClick={() => handleTabChange('login')}
            >
              <span className={styles.tabIcon}><KeyIcon size="md" /></span>
              <span>Вход</span>
            </button>
            <button
              className={`${styles.tabButton} ${activeTab === 'register' ? styles.active : ''}`}
              onClick={() => handleTabChange('register')}
            >
              <span className={styles.tabIcon}><SparklesIcon size="md" /></span>
              <span>Регистрация</span>
            </button>
            <div className={`${styles.tabIndicator} ${activeTab === 'register' ? styles.right : ''}`}></div>
          </div>

          {/* Формы */}
          <div className={styles.formContainer}>
            <div className={`${styles.formWrapper} ${isAnimating ? styles.animating : ''}`}>
              {activeTab === 'login' ? (
                <ModernLoginForm
                  onLogin={handleLoginSuccess}
                  onSwitchToRegister={() => handleTabChange('register')}
                  notice={notice}
                />
              ) : (
                <ModernRegisterForm onSwitchToLogin={() => handleTabChange('login')} />
              )}
            </div>
          </div>

          {/* Дополнительная информация */}
          <div className={styles.authFooter}>
            <div className={styles.features}>
              <div className={styles.feature}>
                <span className={styles.featureIcon}><RocketIcon size="lg" /></span>
                <span>Быстрый доступ</span>
              </div>
              <div className={styles.feature}>
                <span className={styles.featureIcon}><LockIcon size="lg" /></span>
                <span>Безопасность</span>
              </div>
              <div className={styles.feature}>
                <span className={styles.featureIcon}><ChartIcon size="lg" /></span>
                <span>Аналитика</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModernAuth;
