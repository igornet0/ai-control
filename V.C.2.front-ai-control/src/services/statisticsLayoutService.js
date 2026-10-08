import api from './api';

const getDefaultStatisticsLayout = () => ({
  'completed-tasks': { position: 0, visible: true },
  'overdue-tasks': { position: 1, visible: true },
  'user-teams': { position: 2, visible: true },
  'user-projects': { position: 3, visible: true },
  productivity: { position: 4, visible: true, col_span: 2 },
});

export const statisticsLayoutService = {
  getStatisticsLayout: async () => {
    try {
      const response = await api.get('/api/personal-dashboard/statistics-layout');
      return response.data?.layout ?? getDefaultStatisticsLayout();
    } catch (error) {
      console.error('Error fetching statistics layout:', error);
      return getDefaultStatisticsLayout();
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
