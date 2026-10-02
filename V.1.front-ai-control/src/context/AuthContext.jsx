import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';
import {
  clearAuthTokens,
  clearAccessToken,
  clearLegacyLocalStorageTokens,
  getAccessToken,
  persistAuthTokens,
  refreshAccessToken,
} from '../services/tokenRefresh';

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
      const userData = await authService.getCurrentUser();
      setUser(userData);
    } catch {
      let isEmbedFrame = false;
      try {
        isEmbedFrame =
          typeof window !== 'undefined'
          && (window !== window.top || window.location.pathname.startsWith('/embed/'));
      } catch {
        isEmbedFrame = true;
      }
      if (!isEmbedFrame) {
        await clearAuthTokens();
      } else {
        clearAccessToken();
      }
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    clearLegacyLocalStorageTokens();

    let cancelled = false;
    const safetyTimer = window.setTimeout(() => {
      if (!cancelled) {
        setLoading(false);
      }
    }, 12000);

    (async () => {
      try {
        let token = getAccessToken();
        if (!token) {
          token = await refreshAccessToken();
        }
        if (!token) {
          if (!cancelled) {
            setUser(null);
            setLoading(false);
          }
          return;
        }

        const userData = await authService.getCurrentUser();
        if (!cancelled) setUser(userData);
      } catch {
        let isEmbedFrame = false;
        try {
          isEmbedFrame =
            typeof window !== 'undefined'
            && (window !== window.top || window.location.pathname.startsWith('/embed/'));
        } catch {
          isEmbedFrame = true;
        }
        if (!cancelled) {
          if (!isEmbedFrame) {
            await clearAuthTokens();
          } else {
            clearAccessToken();
          }
          setUser(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
        window.clearTimeout(safetyTimer);
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(safetyTimer);
    };
  }, []);

  const login = async (access_token, meta = {}) => {
    if (!access_token) {
      throw new Error('No token provided to login function');
    }

    persistAuthTokens({
      access_token,
      csrf_token: meta.csrf_token || meta.csrfToken,
    });
    await loadCurrentUser();
  };

  const logout = async () => {
    await clearAuthTokens();
    setUser(null);
  };

  const updateUser = (updatedUserData) => {
    setUser(updatedUserData);
  };

  const value = {
    user,
    loading,
    login,
    logout,
    updateUser,
    loadCurrentUser,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
