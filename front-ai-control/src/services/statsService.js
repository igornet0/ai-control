import api from './api';

export const getUserStatistics = async (periodFrom = null, periodTo = null) => {
  try {
    const params = new URLSearchParams();
    if (periodFrom) params.set('period_from', new Date(periodFrom).toISOString());
    if (periodTo) params.set('period_to', new Date(periodTo).toISOString());
    
    const response = await api.get(`/api/stats/user?${params.toString()}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching user statistics:', error);
    throw error;
  }
};
