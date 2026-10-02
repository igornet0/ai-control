import React from 'react';
import { Link } from 'react-router-dom';
import SiteMobileNav from './layout/SiteMobileNav';
import styles from './AdaptiveHeader.module.css';
import logo from '../assets/logo.png';

const AdaptiveHeader = ({ isAuthenticated, children }) => {
  
  return (
    <header className={styles.header}>
      <nav className={styles.nav}>
        <div className={styles.navContainer}>
          <div className={styles.logoSection}>
            <div className={styles.logoContainer}>
              <Link to="/" className={styles.logoLink}>
                <img src={logo} alt="ГПН ОРМ" className={styles.logo} />
                <span className={styles.logoText}>ГПН ОРМ</span>
              </Link>
            </div>
            
            {/* Десктопное меню */}
            <ul className={styles.navMenu}>
              <li>
                <Link to="/dashboard" className={styles.navLink}>
                  Панель управления
                </Link>
              </li>
              <li>
                <Link to="/tasks" className={styles.navLink}>
                  Задачи
                </Link>
              </li>
              <li>
                <Link to="/documents" className={styles.navLink}>
                  Документы
                </Link>
              </li>
              <li>
                <Link to="/support" className={styles.navLink}>
                  Поддержка
                </Link>
              </li>
            </ul>
          </div>
          
          <div className={styles.rightSection}>
            {children}
            <SiteMobileNav isAuthenticated={isAuthenticated} />
            <div className={styles.authSection}>
              {isAuthenticated ? (
                <Link to="/profile" className={styles.authButton}>
                  Профиль
                </Link>
              ) : (
                <Link to="/signin" className={`${styles.authButton} ${styles.authButtonPrimary}`}>
                  Войти
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
};

export default AdaptiveHeader;
