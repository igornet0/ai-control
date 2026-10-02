import api from './api';

export const overviewDataService = {
  async getOverviewData() {
    const response = await api.get('/api/personal-dashboard/overview-data');
    return response.data;
  },

  async saveOverviewData({ checklist, schedule }) {
    const payload = {};
    if (checklist !== undefined) payload.checklist = checklist;
    if (schedule !== undefined) payload.schedule = schedule;
    const response = await api.post('/api/personal-dashboard/overview-data', payload);
    return response.data;
  },
};

export default overviewDataService;
