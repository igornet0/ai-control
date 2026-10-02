import api from './api';

export const strategyApiService = {
  // ─── Company Strategy ────────────────────────────────────────────────────

  /** GET /api/strategy/company — for all non-guest users */
  async getCompanyStrategy() {
    const res = await api.get('/api/strategy/company');
    return res.data;
  },

  /** PUT /api/strategy/company — executive/admin only */
  async updateCompanyStrategy(data) {
    const res = await api.put('/api/strategy/company', data);
    return res.data;
  },

  // ─── Department Strategy ─────────────────────────────────────────────────

  async getDeptStrategy(departmentId) {
    const res = await api.get(`/api/strategy/department/${departmentId}`);
    return res.data;
  },

  async updateDeptStrategy(departmentId, data) {
    const res = await api.put(`/api/strategy/department/${departmentId}`, data);
    return res.data;
  },

  // ─── Goals ───────────────────────────────────────────────────────────────

  async getGoals(strategyType, strategyId) {
    const res = await api.get('/api/strategy/goals', {
      params: { strategy_type: strategyType, strategy_id: strategyId },
    });
    return res.data;
  },

  async createGoal(strategyType, strategyId, data) {
    const res = await api.post('/api/strategy/goals', data, {
      params: { strategy_type: strategyType, strategy_id: strategyId },
    });
    return res.data;
  },

  async updateGoal(goalId, data) {
    const res = await api.put(`/api/strategy/goals/${goalId}`, data);
    return res.data;
  },

  async deleteGoal(goalId) {
    await api.delete(`/api/strategy/goals/${goalId}`);
  },

  // ─── Milestones ──────────────────────────────────────────────────────────

  async getMilestones(goalId) {
    const res = await api.get(`/api/strategy/milestones/${goalId}`);
    return res.data;
  },

  async createMilestone(goalId, data) {
    const res = await api.post(`/api/strategy/milestones/${goalId}`, data);
    return res.data;
  },

  async updateMilestone(milestoneId, data) {
    const res = await api.put(`/api/strategy/milestones/${milestoneId}`, data);
    return res.data;
  },

  async deleteMilestone(milestoneId) {
    await api.delete(`/api/strategy/milestones/${milestoneId}`);
  },

  async getGoalLinks(goalId) {
    const res = await api.get(`/api/strategy/goals/${goalId}/links`);
    return res.data;
  },

  async linkWorkToGoal(goalId, data) {
    const res = await api.post(`/api/strategy/goals/${goalId}/links`, data);
    return res.data;
  },

  // ─── Widgets / Stats ─────────────────────────────────────────────────────

  async getCompanyWidgets() {
    const res = await api.get('/api/strategy/widgets/company');
    return res.data;
  },

  async getDeptWidgets(departmentId) {
    const res = await api.get(`/api/strategy/widgets/department/${departmentId}`);
    return res.data;
  },

  async getAllWidgets() {
    const res = await api.get('/api/strategy/widgets/all');
    return res.data;
  },

  // ─── Company Profile / Onboarding ────────────────────────────────────────

  async getCompanyProfile() {
    const res = await api.get('/api/strategy/profile');
    return res.data;
  },

  async updateCompanyProfile(data) {
    const res = await api.put('/api/strategy/profile', data);
    return res.data;
  },

  async getStrategyVersions() {
    const res = await api.get('/api/strategy/versions');
    return res.data;
  },

  async createStrategyVersion(data) {
    const res = await api.post('/api/strategy/versions', data);
    return res.data;
  },
};
