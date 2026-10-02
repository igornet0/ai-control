import React from 'react';
import { useAuthModal } from '../../context/AuthModalContext';
import SiteMobileNav from '../../components/layout/SiteMobileNav';

const iconClass = 'w-5 h-5 shrink-0';

const navIcons = {
  dashboard: (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  ),
  tasks: (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
    </svg>
  ),
  support: (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
    </svg>
  ),
  documents: (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  ),
  profile: (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  ),
  signIn: (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
    </svg>
  ),
};

const ProfileHeader = ({ isAuthenticated }) => {
  const { openModal, preloadAuthModal } = useAuthModal();

  const handleSignInClick = (e) => {
    e.preventDefault();
    openModal('login');
  };

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl border-b" style={{ 
      background: 'rgba(15, 23, 42, 0.8)', 
      borderColor: 'var(--color-border-muted)' 
    }}>
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <a href="/" className="text-2xl font-bold text-gradient hover:opacity-80 transition-opacity">
              2A
            </a>
            <ul className="hidden md:flex items-center space-x-6">
              <li>
                <a 
                  href="/dashboard" 
                  className="text-sm font-medium transition-colors hover:text-gradient flex items-center gap-2"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  <span className="[&_svg]:flex-shrink-0">{navIcons.dashboard}</span>
                  Панель управления
                </a>
              </li>
              <li>
                <a 
                  href="/tasks" 
                  className="text-sm font-medium transition-colors hover:text-gradient flex items-center gap-2"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  <span className="[&_svg]:flex-shrink-0">{navIcons.tasks}</span>
                  Задачи
                </a>
              </li>
              <li>
                <a 
                  href="/documents" 
                  className="text-sm font-medium transition-colors hover:text-gradient flex items-center gap-2"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  <span className="[&_svg]:flex-shrink-0">{navIcons.documents}</span>
                  Документы
                </a>
              </li>
              <li>
                <a 
                  href="/support" 
                  className="text-sm font-medium transition-colors hover:text-gradient flex items-center gap-2"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  <span className="[&_svg]:flex-shrink-0">{navIcons.support}</span>
                  Поддержка
                </a>
              </li>
            </ul>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4">
            <SiteMobileNav isAuthenticated={isAuthenticated} onSignIn={handleSignInClick} />
            {isAuthenticated ? (
              <a 
                href="/profile" 
                className="btn btn-outline btn-sm hidden md:inline-flex items-center gap-2"
              >
                <span className="[&_svg]:flex-shrink-0">{navIcons.profile}</span>
                Профиль
              </a>
            ) : (
              <button 
                onClick={handleSignInClick}
                onMouseEnter={preloadAuthModal}
                onFocus={preloadAuthModal}
                className="btn btn-primary btn-sm hidden md:inline-flex items-center gap-2"
              >
                <span className="[&_svg]:flex-shrink-0">{navIcons.signIn}</span>
                Войти
              </button>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
};

export default ProfileHeader;