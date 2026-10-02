import React, { useState, useEffect, useCallback } from 'react';
import { useAuthModal } from '../../context/AuthModalContext';
import { useAuth } from '../../context/AuthContext';
import logo from '../../assets/logo.png';
import {
  ChartIcon,
  CloseIcon,
  KeyIcon,
  LockIcon,
  RocketIcon,
  SparklesIcon,
} from '../icons/AppIcons';
import styles from './AuthModal.module.css';
import ModernLoginForm from './ModernLoginForm';
import ModernRegisterForm from './ModernRegisterForm';

const AuthModal = () => {
  const { isOpen, closeModal, initialTab } = useAuthModal();
  const { login, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      // Блокируем скролл body когда модальное окно открыто
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, initialTab]);

  useEffect(() => {
    // Закрываем модальное окно при успешной авторизации
    if (isAuthenticated && isOpen) {
      closeModal();
    }
  }, [isAuthenticated, isOpen, closeModal]);

  const handleTabChange = useCallback((tab) => {
    setActiveTab((current) => (tab !== current ? tab : current));
  }, []);

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      closeModal();
    }
  };

  const handleLogin = () => {
    // Модальное окно закроется автоматически через useEffect при изменении isAuthenticated
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={handleBackdropClick}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        {/* Кнопка закрытия */}
        <button className={styles.closeButton} onClick={closeModal} aria-label="Закрыть">
          <CloseIcon size="md" />
        </button>

        {/* Логотип и заголовок */}
        <div className={styles.logoSection}>
          <div className={styles.logoContainer}>
            <img src={logo} alt="AI-Control Logo" className={styles.logo} />
            <div className={styles.logoGlow}></div>
          </div>
          {/* <h1 className={styles.title}>2A Данные</h1> */}
          <p className={styles.subtitle}>
            Добро пожаловать в будущее управления данными
          </p>
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
            <div hidden={activeTab !== 'login'} aria-hidden={activeTab !== 'login'}>
              <ModernLoginForm
                onLogin={handleLogin}
                onSwitchToRegister={() => handleTabChange('register')}
              />
            </div>
            <div hidden={activeTab !== 'register'} aria-hidden={activeTab !== 'register'}>
              <ModernRegisterForm onSwitchToLogin={() => handleTabChange('login')} />
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

export default AuthModal;

