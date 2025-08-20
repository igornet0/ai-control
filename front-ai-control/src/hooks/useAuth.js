import { useState, useEffect, useCallback } from 'react';
import { getCurrentUser, logout as apiLogout } from '../services/authService';

export default function useAuth() {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    setLoading(true);
    try {
      const accessToken = localStorage.getItem('access_token');
      if (!accessToken) {
        setIsAuthenticated(false);
        setUser(null);
        return;
      }
      const userData = await getCurrentUser();
      setUser(userData);
      setIsAuthenticated(true);
    } catch (error) {
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLogin = useCallback(() => {
    checkAuth();
  }, [checkAuth]);

  const handleLogout = useCallback(() => {
    apiLogout();
    setIsAuthenticated(false);
    setUser(null);
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return {
    user,
    isAuthenticated,
    loading,
    login: handleLogin,
    logout: handleLogout,
    checkAuth
  };
}