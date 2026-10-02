import api from './api';
import { clearAuthTokens } from './tokenRefresh';

export const authService = {
  async register(userData) {
    try {
      const response = await api.post('/auth/register/', userData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async login(credentials) {
    try {
      const loginData = {
        password: credentials.password
      };

      if (credentials.username && credentials.username.includes('@')) {
        loginData.email = credentials.username;
      } else if (credentials.login) {
        loginData.login = credentials.login;
      } else if (credentials.email) {
        loginData.email = credentials.email;
      } else if (credentials.username) {
        loginData.login = credentials.username;
      }

      const response = await api.post('/auth/login_user/', loginData);
      return response.data;
    } catch (error) {
      console.error('Login error in authService:', error);
      if (
        import.meta.env.DEV &&
        error.response?.status === 404 &&
        error.response?.data &&
        typeof error.response.data === 'object'
      ) {
        const d = error.response.data.detail;
        const fromMock =
          typeof d === 'string' &&
          (d.includes('realtime-sync-mock') || d === 'not found');
        if (fromMock) {
          error.response.data = {
            ...error.response.data,
            detail:
              'На :8000 отвечает не FastAPI (часто realtime-sync mock). Остановите процесс на порту 8000 и запустите бэкенд, либо поднимите API на другом порту и задайте в .env VITE_DEV_PROXY_TARGET (см. vite.config.ts).',
          };
        }
      }
      throw error;
    }
  },

  async getCurrentUser() {
    try {
      const response = await api.get('/auth/user/me/');
      const user = response.data;
      return {
        ...user,
        is_admin: Boolean(user.is_superuser || user.role === 'admin'),
      };
    } catch (error) {
      throw error;
    }
  },

  async uploadAvatar(file) {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post('/auth/user/avatar/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async refreshToken() {
    const { refreshAccessToken } = await import('./tokenRefresh');
    const access_token = await refreshAccessToken();
    if (!access_token) {
      throw new Error('Refresh failed');
    }
    return { access_token };
  },

  async logout() {
    await clearAuthTokens();
    window.location.href = '/signin';
  }
};

export const getCurrentUser = () => authService.getCurrentUser();
export const login = (credentials) => authService.login(credentials);
export const register = (userData) => authService.register(userData);
export const logout = () => authService.logout();
