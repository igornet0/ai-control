import React from 'react';
import styles from './Header.module.css';
import logo from '../../assets/logo.png';


const ProfileHeader = ({ isAuthenticated }) => {

  return (
    <header className={styles.header}>
      <nav className={styles.nav}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <a href="/">
            <img src={logo} alt="AI Control Logo" style={{
                width: '40px',
                marginRight: '10px',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                color: '#fff',
                textAlign: 'center'
              }} />
            </a>
            <a href="/">
            <h3 style={{ color: '#32e87f' }}>AI Control</h3>
            
            </a>
        </div>

          <ul style={{ display: 'flex', alignItems: 'center', listStyle: 'none', margin: 0, padding: 0 }}>
            <li ><a href="/dashboard">Dashboard</a></li>
            <li ><a href="/tasks">Tasks</a></li>
            <li ><a href="/support">Support</a></li>
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

export default ProfileHeader;