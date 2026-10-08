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

/** Продуктивность сотрудника за последние `days` дней (userId — по умолчанию текущий пользователь). */
export const getProductivity = async ({ userId = null, days = 30 } = {}) => {
  const params = { days };
  if (userId != null) params.user_id = userId;
  const response = await api.get('/api/stats/productivity', { params });
  return response.data;
};

/** Сотрудники, чью продуктивность может смотреть текущий пользователь (первым — он сам). */
export const getProductivityPeople = async () => {
  const response = await api.get('/api/stats/productivity/people');
  return Array.isArray(response.data) ? response.data : [];
};
