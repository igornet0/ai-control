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

const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 10000,
  withCredentials: true,
});

function redirectToSignin() {
  if (typeof window === 'undefined') return;
  if (window !== window.top) return;
  if (isGuestPublicLocation()) return;
  if (window.location.pathname !== '/signin' && window.location.pathname !== '/signup') {
    window.location.href = '/signin';
  }
}

// Request interceptor
api.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
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
          return api(originalRequest);
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

export default api;
