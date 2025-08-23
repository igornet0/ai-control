import React, { useState } from 'react';
import logo from '../../assets/logo.png';
import styles from './Auth.module.css';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';

const Auth = ({ login }) => {
  const [activeTab, setActiveTab] = useState('login');

  console.log('Auth component rendered, activeTab:', activeTab);

  return (
    <div className={styles.authContainer}>
      <a href="/" className={styles.logoContainer}>
        <img src={logo} alt="AI-Control Logo" className={styles.logo} />
        <h1 className={styles.title}>AI-CONTROL</h1>
      </a>
      <div className={styles.tabs}>
        <button
          className={activeTab === 'login' ? styles.active : ''}
          onClick={() => {
            console.log('Login tab clicked');
            setActiveTab('login');
          }}
        >
          Login
        </button>
        <button
          className={activeTab === 'register' ? styles.active : ''}
          onClick={() => {
            console.log('Register tab clicked');
            setActiveTab('register');
          }}
        >
          Sign Up
        </button>
      </div>

      <div className={styles.formContainer}>
        {activeTab === 'login' ? (
          <div>
            {console.log('Rendering LoginForm')}
            <LoginForm onLogin={login} />
          </div>
        ) : (
          <div>
            {console.log('Rendering RegisterForm')}
            <RegisterForm />
          </div>
        )}
      </div>
    </div>
  );
};

export default Auth;