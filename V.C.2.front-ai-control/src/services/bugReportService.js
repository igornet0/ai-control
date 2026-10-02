import api from './api';

export const bugReportService = {
  async create(payload) {
    const response = await api.post('/api/bug-reports/', payload);
    return response.data;
  },
};
