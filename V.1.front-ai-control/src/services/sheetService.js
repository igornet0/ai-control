import axios from 'axios';
import apiClient from './apiClient';
import { dedupeGet, invalidateDedupe } from './requestDedupe';
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

class SheetService {
  async getDashboardSheets(dashboardId) {
    const s = getDashboardShareContext();
    if (s?.token) {
      return dedupeGet(`sheets:share:${s.token}`, async () => {
        const response = await shareHttp(s.token).get('/sheets');
        return response.data;
      });
    }
    return dedupeGet(`sheets:${dashboardId}`, async () => {
      const response = await apiClient.get(`/dashboards/${dashboardId}/sheets`);
      return response.data;
    });
  }

  async getSheet(sheetId) {
    const s = getDashboardShareContext();
    if (s?.token) {
      const response = await shareHttp(s.token).get(`/sheets/${sheetId}`);
      return response.data;
    }
    const response = await apiClient.get(`/dashboards/sheets/${sheetId}`);
    return response.data;
  }

  async createSheet(dashboardId, sheetData) {
    const response = await apiClient.post(`/dashboards/${dashboardId}/sheets`, sheetData);
    invalidateDedupe('sheets:');
    return response.data;
  }

  async updateSheet(sheetId, sheetData) {
    const response = await apiClient.put(`/dashboards/sheets/${sheetId}`, sheetData);
    invalidateDedupe('sheets:');
    return response.data;
  }

  async deleteSheet(sheetId) {
    const response = await apiClient.delete(`/dashboards/sheets/${sheetId}`);
    invalidateDedupe('sheets:');
    return response.data;
  }

  async listSheetAccess(sheetId) {
    const response = await apiClient.get(`/dashboards/sheets/${sheetId}/access`);
    return response.data;
  }

  async getSheetAccessOptions(sheetId) {
    const response = await apiClient.get(`/dashboards/sheets/${sheetId}/access/options`);
    return response.data;
  }

  async searchSheetAccessUsers(sheetId, q) {
    const response = await apiClient.get(`/dashboards/sheets/${sheetId}/access/users`, { params: { q } });
    return response.data;
  }

  async grantSheetAccess(sheetId, payload) {
    const response = await apiClient.post(`/dashboards/sheets/${sheetId}/access`, payload);
    return response.data;
  }

  async updateSheetAccess(sheetId, accessId, payload) {
    const response = await apiClient.patch(`/dashboards/sheets/${sheetId}/access/${accessId}`, payload);
    return response.data;
  }

  async revokeSheetAccess(sheetId, accessId) {
    await apiClient.delete(`/dashboards/sheets/${sheetId}/access/${accessId}`);
  }
}

export const sheetService = new SheetService();
