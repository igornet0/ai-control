import React from 'react';
import logo from '../assets/logo.png';
import styles from './LoadingPage.module.css';

const LoadingPage = ({ message = "Загрузка..." }) => {
  return (
    <div className={styles.loadingContainer}>
      {/* Анимированный фон */}
      <div className={styles.backgroundAnimation}>
        <div className={styles.gradientOrb}></div>
        <div className={styles.gradientOrb}></div>
        <div className={styles.gradientOrb}></div>
      </div>
      
      {/* Основной контент */}
      <div className={styles.loadingContent}>
        {/* Логотип с анимацией */}
        <div className={styles.logoContainer}>
          <img 
            src={logo} 
            alt="AI Control Logo" 
            className={styles.logo}
          />
          <div className={styles.logoGlow}></div>
        </div>
        
        {/* Текст загрузки */}
        <div className={styles.loadingText}>
          <h1 className={styles.title}>AI Control</h1>
          <p className={styles.subtitle}>{message}</p>
        </div>
        
        {/* Прогресс бар */}
        <div className={styles.progressContainer}>
          <div className={styles.progressBar}>
            <div className={styles.progressFill}></div>
          </div>
          <div className={styles.progressDots}>
            <div className={styles.dot}></div>
            <div className={styles.dot}></div>
            <div className={styles.dot}></div>
          </div>
        </div>
        
        {/* Дополнительные элементы */}
        <div className={styles.decorativeElements}>
          <div className={styles.floatingElement}></div>
          <div className={styles.floatingElement}></div>
          <div className={styles.floatingElement}></div>
        </div>
      </div>
    </div>
  );
};

export default LoadingPage;
