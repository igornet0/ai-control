import React, { useState } from 'react';
import logo from '../../assets/logo.png';
import styles from './Auth.module.css';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';

const Auth = ({ login }) => {
  const [activeTab, setActiveTab] = useState('login');

  return (
    <div className={styles.authContainer}>
      <a href="/" className={styles.logoContainer}>
        <img src={logo} alt="AI-Control Logo" className={styles.logo} />
        <h1 className={styles.title}>AI-CONTROL</h1>
      </a>
      <div className={styles.tabs}>
        <button
          className={activeTab === 'login' ? styles.active : ''}
          onClick={() => setActiveTab('login')}
        >
          Login
        </button>
        <button
          className={activeTab === 'register' ? styles.active : ''}
          onClick={() => setActiveTab('register')}
        >
          Sign Up
        </button>
      </div>

      <div className={styles.formContainer}>
        {activeTab === 'login' ? <LoginForm onLogin={login} /> : <RegisterForm />}
      </div>
    </div>
  );
};

export default Auth;