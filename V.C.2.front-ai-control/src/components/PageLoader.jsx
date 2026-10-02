import React from 'react';
import styles from './PageLoader.module.css';

const PageLoader = ({ message = "Загрузка страницы...", size = "medium" }) => {
  return (
    <div className={`${styles.pageLoader} ${styles[size]}`}>
      <div className={styles.loaderContent}>
        {/* Спиннер */}
        <div className={styles.spinner}>
          <div className={styles.spinnerRing}></div>
          <div className={styles.spinnerRing}></div>
          <div className={styles.spinnerRing}></div>
        </div>
        
        {/* Текст загрузки */}
        <p className={styles.loadingText}>{message}</p>
        
        {/* Дополнительные точки */}
        <div className={styles.dots}>
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    </div>
  );
};

export default PageLoader;
