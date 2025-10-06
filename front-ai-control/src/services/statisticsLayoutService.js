import api from './api';

export const statisticsLayoutService = {
  getStatisticsLayout: async () => {
    try {
      const response = await api.get('/api/personal-dashboard/statistics-layout');
      return response.data.layout;
    } catch (error) {
      console.error('Error fetching statistics layout:', error);
      throw error;
    }
  },

  updateStatisticsLayout: async (layout) => {
    try {
      const response = await api.post('/api/personal-dashboard/statistics-layout', { cards: layout });
      return response.data.layout;
    } catch (error) {
      console.error('Error updating statistics layout:', error);
      throw error;
    }
  }
};
