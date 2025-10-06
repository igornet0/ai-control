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
      // Convert to form data for OAuth2PasswordRequestForm
      const formData = new FormData();
      formData.append('username', credentials.username);
      formData.append('password', credentials.password);
      
      const response = await api.post('/auth/login_user/', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
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
  },

  logout() {
    // Clear tokens from localStorage
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    // Redirect to login page or handle logout logic
    window.location.href = '/login';
  }
};

// Export individual functions for backward compatibility
export const getCurrentUser = () => authService.getCurrentUser();
export const login = (credentials) => authService.login(credentials);
export const register = (userData) => authService.register(userData);
export const logout = () => authService.logout();