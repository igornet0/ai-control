import React from 'react';
import styles from './Header.module.css';

const Header = ({ isAuthenticated }) => {
  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl border-b relative overflow-hidden">
      {/* Градиентный фон с анимацией */}
      <div className="absolute inset-0 bg-gradient-to-r from-slate-900/95 via-purple-900/90 to-slate-900/95"></div>
      <div className="absolute inset-0 bg-gradient-to-r from-blue-900/20 via-transparent to-indigo-900/20"></div>
      <div className="absolute inset-0 border-b border-gradient-to-r from-blue-500/30 via-purple-500/30 to-cyan-500/30"></div>
      
      <nav className="max-w-7xl mx-auto px-6 py-4 relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <a href="/" className="text-2xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent hover:from-blue-300 hover:via-purple-300 hover:to-cyan-300 transition-all duration-300">
              AI-CONTROL
            </a>
            <ul className="hidden md:flex items-center space-x-6">
              <li>
                <a 
                  href="/dashboard" 
                  className="text-sm font-medium transition-all duration-300 hover:scale-105 relative group"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  <span className="group-hover:text-blue-400 transition-colors">📊 Dashboard</span>
                  <div className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-blue-400 to-purple-400 group-hover:w-full transition-all duration-300"></div>
                </a>
              </li>
              <li>
                <a 
                  href="/tasks" 
                  className="text-sm font-medium transition-all duration-300 hover:scale-105 relative group"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  <span className="group-hover:text-purple-400 transition-colors">📋 Tasks</span>
                  <div className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-purple-400 to-cyan-400 group-hover:w-full transition-all duration-300"></div>
                </a>
              </li>
              <li>
                <a 
                  href="/support" 
                  className="text-sm font-medium transition-all duration-300 hover:scale-105 relative group"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  <span className="group-hover:text-cyan-400 transition-colors">🆘 Support</span>
                  <div className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-cyan-400 to-blue-400 group-hover:w-full transition-all duration-300"></div>
                </a>
              </li>
            </ul>
          </div>
          
          <div className="flex items-center space-x-4">
            {isAuthenticated ? (
              <a 
                href="/profile" 
                className="btn btn-outline btn-sm group relative overflow-hidden"
              >
                <span className="group-hover:animate-bounce">👤</span>
                Profile
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </a>
            ) : (
              <a 
                href="/signin" 
                className="btn btn-primary btn-sm group relative overflow-hidden"
              >
                <span className="group-hover:animate-bounce">🔐</span>
                Sign In
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </a>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
};

export default Header;