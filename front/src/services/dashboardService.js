// src/services/dashboardService.js
export const saveDashboard = async (dashboard) => {
  const res = await api.post('/dashboards', dashboard);
  return res.data;
};

export const fetchDashboards = async () => {
  const res = await api.get('/dashboards');
  return res.data;
};