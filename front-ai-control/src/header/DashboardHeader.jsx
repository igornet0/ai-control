import React from 'react';
import { useLocation } from 'react-router-dom';
import { useEditMode } from '../context/EditModeContext';
import styles from './Header.module.css';

const DashboardHeader = () => {
  const { isEditing, setIsEditing } = useEditMode();

  const location = useLocation();
  const pathParts = location.pathname.split('/');
  const id = pathParts[2];
  const sheetId = pathParts[4];

  return (
    <header className={styles.header}>
      <nav className={styles.nav}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button
              onClick={() => setIsEditing((prev) => !prev)}
              style={{
                marginRight: '10px',
                padding: '10px 20px',
                minWidth: '100px', // 👈 фиксированная ширина
                backgroundColor: isEditing ? '#05521C' : '#09AA39',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                color: '#fff',
                textAlign: 'center'
              }}
            >
              {isEditing ? 'Save' : 'Redact'}
            </button>
            <h3 style={{ color: '#32e87f' }}>Dashboard {id} - Sheet {sheetId}</h3>
          </div>

          <ul style={{ display: 'flex', alignItems: 'center', listStyle: 'none', margin: 0, padding: 0 }}>
            <li style={{ marginRight: '15px' }}><a href="/dashboard">Dashboard</a></li>
            <li style={{ marginRight: '15px' }}><a href="/tasks">Задачи</a></li>
            <li style={{ marginRight: '15px' }}><a href="/support">Support</a></li>
            <li><a href="/signin" className={styles.signIn}>Sign In</a></li>
          </ul>
        </div>
      </nav>
    </header>
  );
};

export default DashboardHeader;