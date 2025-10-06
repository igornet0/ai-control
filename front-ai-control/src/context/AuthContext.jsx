import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadCurrentUser = async () => {
    try {
      console.log('Loading current user...');
      const userData = await authService.getCurrentUser();
      console.log('User loaded:', userData);
      setUser(userData);
    } catch (error) {
      console.log('Auth error:', error);
      // Clear invalid token
      localStorage.removeItem('access_token');
      setUser(null);
    } finally {
      console.log('Setting loading to false');
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('AuthContext useEffect running');
    const token = localStorage.getItem('access_token');
    console.log('Token found:', !!token);
    
    if (token) {
      // If we have a token, try to load the user
      loadCurrentUser();
    } else {
      // No token, set loading to false immediately
      console.log('No token found, setting loading to false');
      setLoading(false);
      setUser(null);
    }
  }, []);

  const login = async (access_token) => {
    if (!access_token) {
      throw new Error('No token provided to login function');
    }
    
    localStorage.setItem('access_token', access_token);
    await loadCurrentUser();
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    setUser(null);
  };

  const value = {
    user,
    loading,
    login,
    logout,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};