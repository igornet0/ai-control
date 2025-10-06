import React from 'react';
import styles from './Header.module.css';

const ProfileHeader = ({ isAuthenticated }) => {

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl border-b" style={{ 
      background: 'rgba(15, 23, 42, 0.8)', 
      borderColor: 'var(--color-border-muted)' 
    }}>
      <nav className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <a href="/" className="text-2xl font-bold text-gradient hover:opacity-80 transition-opacity">
              AI-CONTROL
            </a>
            <ul className="hidden md:flex items-center space-x-6">
              <li>
                <a 
                  href="/dashboard" 
                  className="text-sm font-medium transition-colors hover:text-gradient"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  📊 Dashboard
                </a>
              </li>
              <li>
                <a 
                  href="/tasks" 
                  className="text-sm font-medium transition-colors hover:text-gradient"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  📋 Tasks
                </a>
              </li>
              <li>
                <a 
                  href="/support" 
                  className="text-sm font-medium transition-colors hover:text-gradient"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  🆘 Support
                </a>
              </li>
            </ul>
          </div>
          
          <div className="flex items-center space-x-4">
            {isAuthenticated ? (
              <a 
                href="/profile" 
                className="btn btn-outline btn-sm"
              >
                <span>👤</span>
                Profile
              </a>
            ) : (
              <a 
                href="/signin" 
                className="btn btn-primary btn-sm"
              >
                <span>🔐</span>
                Sign In
              </a>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
};

export default ProfileHeader;