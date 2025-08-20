import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useEditMode } from '../../context/EditModeContext';
import styles from './Header.module.css';

const DashboardHeader = ({ isAuthenticated }) => {
  const { isEditing, setIsEditing } = useEditMode();
  const location = useLocation();
  const navigate = useNavigate();

  const pathParts = location.pathname.split('/');
  const id = pathParts[2];
  const sheetId = pathParts[4];

  // Mock sheet options
  const sheets = [
    { id: '1', name: 'Overview' },
    { id: '2', name: 'Sales' },
    { id: '3', name: 'Marketing' },
  ];

  const handleSheetChange = (e) => {
    const newSheetId = e.target.value;
    navigate(`/dashboard/${id}/sheet/${newSheetId}`);
  };

  return (
    <header className={styles.header}>
      <nav className={styles.nav}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button
              onClick={() => setIsEditing((prev) => !prev)}
              style={{
                marginRight: '10px',
                padding: '5px 5px',
                minWidth: '100px',
                backgroundColor: isEditing ? '#05521C' : '#09AA39',
                border: 'none',
                borderRadius: '25px',
                cursor: 'pointer',
                color: '#fff',
                textAlign: 'center'
              }}
            >
              {isEditing ? 'Save' : 'Redact'}
            </button>

            <h3 style={{ color: '#32e87f', marginRight: '10px' }}>Dashboard {id}</h3>
            <select
              value={sheetId}
              onChange={handleSheetChange}
              style={{
                backgroundColor: '#222',
                color: '#32e87f',
                padding: '5px 10px',
                borderRadius: '8px',
                border: '1px solid #444'
              }}
            >
              {sheets.map(sheet => (
                <option key={sheet.id} value={sheet.id}>{sheet.name}</option>
              ))}
            </select>
          </div>

          <ul style={{ display: 'flex', alignItems: 'center', listStyle: 'none', margin: 0, padding: 0 }}>
            <li style={{ marginRight: '15px' }}><a href="/dashboard">Dashboard</a></li>
            <li style={{ marginRight: '15px' }}><a href="/tasks">Tasks</a></li>
            <li style={{ marginRight: '15px' }}><a href="/support">Support</a></li>
            <li>
              {isAuthenticated ? (
                <a href="/profile" className={styles.profileLink}>Profile</a>
              ) : (
                <a href="/signin" className={styles.signIn}>Sign In</a>
              )}
            </li>
          </ul>
        </div>
      </nav>
    </header>
  );
};

export default DashboardHeader;