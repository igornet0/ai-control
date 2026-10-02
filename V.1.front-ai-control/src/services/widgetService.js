import axios from 'axios';
import apiClient from './apiClient';
import { getDashboardShareContext } from './shareLinkContext';
import { getApiBaseUrl } from './apiBaseUrl';
import { getAccessToken } from './tokenRefresh';

function apiRoot() {
  return getApiBaseUrl();
}

const shareClientCache = new Map();

function shareHttp(token) {
  if (!shareClientCache.has(token)) {
    const client = axios.create({
      baseURL: `${apiRoot()}/api/public/dashboard-links/${encodeURIComponent(token)}`,
      timeout: 15000,
    });
    client.interceptors.request.use((config) => {
      const jwt = getAccessToken();
      if (jwt) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${jwt}`;
      }
      return config;
    });
    shareClientCache.set(token, client);
  }
  return shareClientCache.get(token);
}

class WidgetService {
  constructor() {
    this.dataCache = new Map();
    this.refreshIntervals = new Map();
  }

  async getSheetWidgets(sheetId) {
    const s = getDashboardShareContext();
    if (s?.token) {
      const response = await shareHttp(s.token).get(`/sheets/${sheetId}/widgets`);
      return response.data;
    }
    const response = await apiClient.get(`/dashboard-widgets/sheet/${sheetId}/widgets`);
    return response.data;
  }

  async getWidget(widgetId) {
    const s = getDashboardShareContext();
    if (s?.token) {
      const response = await shareHttp(s.token).get(`/widgets/${widgetId}`);
      return response.data;
    }
    const response = await apiClient.get(`/dashboard-widgets/${widgetId}`);
    return response.data;
  }

  async createWidget(sheetId, widgetData) {
    const response = await apiClient.post(`/dashboard-widgets/sheet/${sheetId}/widgets`, widgetData);
    return response.data;
  }

  async updateWidget(widgetId, widgetData) {
    const response = await apiClient.put(`/dashboard-widgets/${widgetId}`, widgetData);
    return response.data;
  }

  async deleteWidget(widgetId) {
    const response = await apiClient.delete(`/dashboard-widgets/${widgetId}`);
    return response.data;
  }

  /**
   * Массовое сохранение виджетов (создание, обновление, удаление)
   */
  async bulkSaveWidgets(sheetId, widgets) {
    const s = getDashboardShareContext();
    if (s?.token) {
      const response = await shareHttp(s.token).post(`/sheets/${sheetId}/widgets/bulk-save`, {
        widgets,
      });
      return response.data;
    }
    const response = await apiClient.post(`/dashboard-widgets/sheet/${sheetId}/bulk-save`, {
      widgets: widgets,
    });
    return response.data;
  }

  async getWidgetData(widgetId) {
    try {
      const response = await apiClient.get(`/dashboard-widgets/${widgetId}/data`);
      const data = response.data.data;

      this.dataCache.set(widgetId, {
        data,
        timestamp: Date.now(),
      });

      return data;
    } catch (error) {
      console.error(`Error fetching data for widget ${widgetId}:`, error);
      const cached = this.dataCache.get(widgetId);
      if (cached) {
                return cached.data;
      }
      throw error;
    }
  }

  startDataRefresh(widgetId, intervalSeconds = 60, onDataUpdate = null) {
    this.stopDataRefresh(widgetId);

    const intervalId = setInterval(async () => {
      try {
        const data = await this.getWidgetData(widgetId);
        if (onDataUpdate) {
          onDataUpdate(widgetId, data);
        }
      } catch (error) {
        console.error(`Error refreshing data for widget ${widgetId}:`, error);
      }
    }, intervalSeconds * 1000);

    this.refreshIntervals.set(widgetId, intervalId);
  }

  stopDataRefresh(widgetId) {
    const intervalId = this.refreshIntervals.get(widgetId);
    if (intervalId) {
      clearInterval(intervalId);
      this.refreshIntervals.delete(widgetId);
    }
  }

  stopAllDataRefresh() {
    this.refreshIntervals.forEach((intervalId) => {
      clearInterval(intervalId);
    });
    this.refreshIntervals.clear();
  }

  getCachedData(widgetId) {
    const cached = this.dataCache.get(widgetId);
    return cached ? cached.data : null;
  }

  clearCachedData(widgetId) {
    this.dataCache.delete(widgetId);
  }

  clearAllCachedData() {
    this.dataCache.clear();
  }

  isDataStale(widgetId, maxAge = 300000) {
    const cached = this.dataCache.get(widgetId);
    if (!cached) return true;
    return Date.now() - cached.timestamp > maxAge;
  }
}

export const widgetService = new WidgetService();
