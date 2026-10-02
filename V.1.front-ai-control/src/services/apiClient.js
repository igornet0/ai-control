import axios from 'axios';
import { getApiBaseUrl } from './apiBaseUrl';
import {
  clearAuthTokens,
  getAccessToken,
  isAuthRelatedRequest,
  isGuestPublicLocation,
  isPublicShareRequest,
  refreshAccessToken,
} from './tokenRefresh';

const apiBase = getApiBaseUrl();
const apiClient = axios.create({
  baseURL: apiBase ? `${apiBase}/api` : '/api',
  timeout: 10000,
  withCredentials: true,
});

function redirectToSignin() {
  // Embed iframes and guest share/demo pages must not navigate away.
  if (typeof window === 'undefined') return;
  if (window !== window.top) return;
  if (isGuestPublicLocation()) return;
  if (window.location.pathname !== '/signin' && window.location.pathname !== '/signup') {
    window.location.href = '/signin';
  }
}

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Для FormData не устанавливаем Content-Type - пусть браузер сам установит с boundary
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    if (error.response?.status === 401) {
      const originalRequest = error.config || {};
      const requestUrl = originalRequest.url || '';

      if (
        !isAuthRelatedRequest(requestUrl) &&
        !isPublicShareRequest(requestUrl) &&
        !originalRequest._retry
      ) {
        originalRequest._retry = true;
        const newToken = await refreshAccessToken();
        if (newToken) {
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return apiClient(originalRequest);
        }

        if (isGuestPublicLocation()) {
          return Promise.reject(error);
        }
        await clearAuthTokens();
        redirectToSignin();
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
