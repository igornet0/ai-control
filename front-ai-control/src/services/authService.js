import api from './api';

export const register = async (userData) => {
  console.log('authService.register called with:', userData);
  // const data = new URLSearchParams();
  // data.append('username', userData.username);
  // data.append('login', userData.login);
  // data.append('email', userData.email);
  // data.append('password', userData.password);

  console.log('Making API request to /auth/register/');
  const response = await api.post('/auth/register/', userData);
  console.log('Registration API response received:', response.data);
  return response.data;
};

export const login = async (credentials) => {
  console.log('authService.login called with:', credentials);
  const data = new URLSearchParams();
  data.append('username', credentials.username);
  data.append('password', credentials.password);
  data.append('grant_type', 'password');
  
  console.log('Making API request to /auth/login_user/');
  const response = await api.post('/auth/login_user/', data, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });
  
  console.log('API response received:', response.data);
  return response.data.access_token;
};

export const getCurrentUser = async () => {
  const response = await api.get('auth/user/me/');
  return response.data;
};

export const logout = () => {
  localStorage.removeItem('access_token');
};