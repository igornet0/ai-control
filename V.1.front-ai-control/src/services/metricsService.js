import api from './api';

export const metricsService = {
  async getTaskStatistics() {
    try {
      const response = await api.get('/api/metrics/task-statistics');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async getDashboardStatistics() {
    try {
      const response = await api.get('/api/metrics/dashboard-statistics');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async getUserStatistics() {
    try {
      const response = await api.get('/api/metrics/user-statistics');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async getOrganizationStatistics() {
    try {
      const response = await api.get('/api/metrics/organization-statistics');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async getDepartmentStatistics() {
    try {
      const response = await api.get('/api/metrics/department-statistics');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async getKPIMetrics() {
    try {
      const response = await api.get('/api/metrics/kpi');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async getPerformanceMetrics() {
    try {
      const response = await api.get('/api/metrics/performance');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async getTimeMetrics() {
    try {
      const response = await api.get('/api/metrics/time');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async getPriorityMetrics() {
    try {
      const response = await api.get('/api/metrics/priority');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async getStatusMetrics() {
    try {
      const response = await api.get('/api/metrics/status');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async getTeamRatings() {
    try {
      const response = await api.get('/api/metrics/team-ratings');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async getUserRatings() {
    try {
      const response = await api.get('/api/metrics/user-ratings');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async getProjectProgress() {
    try {
      const response = await api.get('/api/metrics/project-progress');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async getCompletionTimeMetrics() {
    try {
      const response = await api.get('/api/metrics/completion-time');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async getQualityMetrics() {
    try {
      const response = await api.get('/api/metrics/quality');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async getResourceMetrics() {
    try {
      const response = await api.get('/api/metrics/resources');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async getFinancialMetrics() {
    try {
      const response = await api.get('/api/metrics/financial');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async getRiskMetrics() {
    try {
      const response = await api.get('/api/metrics/risk');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async getComparativeMetrics() {
    try {
      const response = await api.get('/api/metrics/comparative');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async getMetricTrends() {
    try {
      const response = await api.get('/api/metrics/trends');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async getMetricForecasts() {
    try {
      const response = await api.get('/api/metrics/forecasts');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async exportMetrics(format = 'json') {
    try {
      const response = await api.get('/api/metrics/export', {
        params: { format },
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async getMetricsDashboard() {
    try {
      const response = await api.get('/api/metrics/dashboard');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async getMetricAlerts() {
    try {
      const response = await api.get('/api/metrics/alerts');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async configureMetricAlerts(alertConfig) {
    try {
      const response = await api.post('/api/metrics/alerts/configure', alertConfig);
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};
