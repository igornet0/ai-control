import React from 'react';
import styles from './Header.module.css';

const Header = ({ isAuthenticated }) => {
  return (
    <header className={styles.header}>
      <nav className={styles.nav}>
        <ul>
          <li><a href="/dashboard">Dashboard</a></li>
          <li><a href="/tasks">Задачи</a></li>
          <li><a href="/support">Support</a></li>
          <li>
            {isAuthenticated ? (
              <a href="/profile" className={styles.profileLink}>Profile</a>
            ) : (
              <a href="/signin" className={styles.signIn}>Sign In</a>
            )}
            </li>
        </ul>
      </nav>
    </header>
  );
};

export default Header;