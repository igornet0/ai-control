import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import FlowManagement from './FlowManagement';
import styles from './FlowManagementPage.module.css';

const FlowManagementPage = () => {
  const navigate = useNavigate();

  const handleBack = () => {
    navigate('/dashboard');
  };

  return (
    <div className={styles.flowManagementPage}>
      <div className={styles.container}>
        <div className={styles.header}>
          <button
            onClick={handleBack}
            className={styles.backButton}
          >
            <ArrowLeftIcon style={{ width: '1.25rem', height: '1.25rem' }} />
            Назад к дашбордам
          </button>
          <div className={styles.headerInfo}>
            <span className={styles.pageKicker}>Администрирование</span>
            <p className={styles.pageSubtitle}>
              Настройка потоков, прав доступа и связанных дашбордов.
            </p>
          </div>
        </div>
        
        <div className={styles.content}>
          <FlowManagement />
        </div>
      </div>
    </div>
  );
};

export default FlowManagementPage;

