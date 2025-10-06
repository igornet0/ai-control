import React, { useState } from 'react';
import logo from '../../assets/logo.png';
import styles from './Auth.module.css';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';

const Auth = ({ login }) => {
  const [activeTab, setActiveTab] = useState('login');

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: 'var(--gradient-secondary)' }}>
      <div className="w-full max-w-md">
        <a href="/" className="flex flex-col items-center mb-8 animate-fadeIn">
          <img src={logo} alt="AI-Control Logo" className="w-16 h-16 mb-4 animate-bounce" />
          <h1 className="text-4xl font-bold text-gradient">AI-CONTROL</h1>
        </a>
        
        <div className="card animate-scaleIn">
          <div className="flex mb-6 bg-slate-800/50 backdrop-blur-sm border border-slate-600/50 rounded-xl overflow-hidden shadow-lg">
            <button
              className={`flex-1 px-4 py-3 text-sm font-medium transition-all duration-300 ${
                activeTab === 'login' 
                  ? 'bg-slate-600 text-slate-100 shadow-md' 
                  : 'text-slate-300 bg-transparent hover:bg-slate-700/40 hover:text-slate-100'
              }`}
              onClick={() => setActiveTab('login')}
            >
              <span className="flex items-center justify-center gap-2">
                <span>🔐</span>
                Login
              </span>
            </button>
            <button
              className={`flex-1 px-4 py-3 text-sm font-medium transition-all duration-300 ${
                activeTab === 'register' 
                  ? 'bg-slate-600 text-slate-100 shadow-md' 
                  : 'text-slate-300 bg-transparent hover:bg-slate-700/40 hover:text-slate-100'
              }`}
              onClick={() => setActiveTab('register')}
            >
              <span className="flex items-center justify-center gap-2">
                <span>✨</span>
                Sign Up
              </span>
            </button>
          </div>

          <div className="animate-fadeIn">
            {activeTab === 'login' ? <LoginForm onLogin={login} /> : <RegisterForm />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;