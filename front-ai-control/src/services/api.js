import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000',
});

// Интерцептор для автоматической подстановки токена
api.interceptors.request.use(config => {
  console.log('API request:', config.method?.toUpperCase(), config.url, config.data);
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Интерцептор для логирования ответов
api.interceptors.response.use(
  response => {
    console.log('API response:', response.status, response.config.url);
    return response;
  },
  error => {
    console.error('API error:', error.response?.status, error.response?.data, error.config?.url);
    return Promise.reject(error);
  }
);

export default api;