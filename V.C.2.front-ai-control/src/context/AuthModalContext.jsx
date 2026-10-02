import React, { createContext, useContext, useState } from 'react';

const AuthModalContext = createContext();

export const useAuthModal = () => {
  const context = useContext(AuthModalContext);
  if (!context) {
    throw new Error('useAuthModal must be used within AuthModalProvider');
  }
  return context;
};

export const AuthModalProvider = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [initialTab, setInitialTab] = useState('login');

  const openModal = (tab = 'login') => {
    setInitialTab(tab);
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
  };

  const preloadAuthModal = () => {
    void import('../components/auth/AuthModal.jsx');
  };

  return (
    <AuthModalContext.Provider
      value={{ isOpen, openModal, closeModal, initialTab, preloadAuthModal }}
    >
      {children}
    </AuthModalContext.Provider>
  );
};

