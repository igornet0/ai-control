import api from './api';

export const dashboardService = {
  async getDashboards() {
    try {
      const response = await api.get('/api/dashboards/');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async getDashboard(id) {
    try {
      const response = await api.get(`/api/dashboards/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async copyDashboard(id, payload = {}) {
    const response = await api.post(`/api/dashboards/${id}/copy`, payload);
    return response.data;
  },

  async createDashboard(dashboardData) {
    try {
      const response = await api.post('/api/dashboards/', dashboardData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async updateDashboard(id, dashboardData) {
    try {
      const response = await api.put(`/api/dashboards/${id}`, dashboardData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async updateDashboardImage(id, imageUrl) {
    return this.updateDashboard(id, { image_url: imageUrl });
  },

  async deleteDashboardImage(id) {
    return this.updateDashboard(id, { image_url: null });
  },

  async deleteDashboard(id) {
    try {
      await api.delete(`/api/dashboards/simple-delete/${id}`);
    } catch (error) {
      throw error;
    }
  },

  async getTemplates() {
    try {
      const response = await api.get('/api/dashboards/templates');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async getStats() {
    try {
      const response = await api.get('/api/dashboards/stats');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async getDashboardDataModels(dashboardId) {
    try {
      const response = await api.get(`/api/dashboards/${dashboardId}/data-models`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async addDataModelToDashboard(dashboardId, modelId) {
    try {
      await api.post(`/api/dashboards/${dashboardId}/data-models/${modelId}`);
    } catch (error) {
      throw error;
    }
  },

  async removeDataModelFromDashboard(dashboardId, modelId) {
    try {
      await api.delete(`/api/dashboards/${dashboardId}/data-models/${modelId}`);
    } catch (error) {
      throw error;
    }
  },

  async listTemplateAccess(dashboardId) {
    const response = await api.get(`/api/dashboards/${dashboardId}/access`);
    return response.data;
  },

  async getTemplateAccessOptions(dashboardId) {
    const response = await api.get(`/api/dashboards/${dashboardId}/access/options`);
    return response.data;
  },

  async searchTemplateAccessUsers(dashboardId, q) {
    const response = await api.get(`/api/dashboards/${dashboardId}/access/users`, { params: { q } });
    return response.data;
  },

  async grantTemplateAccess(dashboardId, payload) {
    const response = await api.post(`/api/dashboards/${dashboardId}/access`, payload);
    return response.data;
  },

  async updateTemplateAccess(dashboardId, accessId, payload) {
    const response = await api.patch(`/api/dashboards/${dashboardId}/access/${accessId}`, payload);
    return response.data;
  },

  async revokeTemplateAccess(dashboardId, accessId) {
    await api.delete(`/api/dashboards/${dashboardId}/access/${accessId}`);
  },
};
