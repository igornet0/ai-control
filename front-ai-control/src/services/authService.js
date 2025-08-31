import api from './api';

export const authService = {
  async register(userData) {
    try {
      const response = await api.post('/auth/register_user/', userData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async login(credentials) {
    try {
      const response = await api.post('/auth/login_user/', credentials);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async getCurrentUser() {
    try {
      const response = await api.get('/auth/user/me/');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async refreshToken(refreshToken) {
    try {
      const response = await api.post('/auth/refresh/', { refresh: refreshToken });
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};