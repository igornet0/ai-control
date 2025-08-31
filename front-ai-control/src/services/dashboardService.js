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
  }
};
