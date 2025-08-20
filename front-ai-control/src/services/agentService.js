import api from './api';

export const register = async (userData) => {
  const response = await api.post('/auth/register/', userData);
  return response.data;
};

export const login = async (credentials) => {
  const data = new URLSearchParams();
  data.append('username', credentials.username);
  data.append('password', credentials.password);
  data.append('grant_type', 'password');
  
  const response = await api.post('/auth/login_user/', data, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });
  
  return response.data.access_token;
};

export const getCurrentUser = async () => {
  const response = await api.get('auth/user/me/');
  return response.data;
};

export const logout = () => {
  localStorage.removeItem('access_token');
};