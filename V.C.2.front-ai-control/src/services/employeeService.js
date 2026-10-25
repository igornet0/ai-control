import api from './api';

export const TEAM_ROLES = [
  'CEO', 'CTO', 'COO', 'CFO', 'CPO', 'CMO',
  'Manager', 'TeamLead',
  'Developer', 'Engineer', 'QAEngineer',
  'ProductOwner', 'ProductManager', 'Analyst',
  'Sales', 'Marketing', 'Support', 'HR',
  'Designer', 'Guest',
];

export const employeeService = {
  async getContext() {
    const response = await api.get('/api/employees/context');
    return response.data;
  },

  async getEmployees(params = {}) {
    const response = await api.get('/api/employees/', { params });
    return response.data;
  },

  /** Full org directory for chat pickers (not limited by HR visibility). */
  async getChatDirectory(params = {}) {
    const response = await api.get('/api/employees/chat-directory', { params });
    return response.data;
  },

  async getEmployee(id) {
    const response = await api.get(`/api/employees/${id}`);
    return response.data;
  },

  /** Employee profile for chat cards (any active non-guest user). */
  async getChatEmployee(id) {
    const response = await api.get(`/api/employees/chat-directory/${id}`);
    return response.data;
  },

  async getChatAvatars(userIds) {
    const response = await api.post('/api/employees/chat-avatars', { user_ids: userIds });
    return response.data;
  },

  async getOrgTree() {
    const response = await api.get('/api/employees/tree');
    return response.data;
  },

  async getDepartments() {
    const response = await api.get('/api/employees/departments/');
    return response.data;
  },

  async createDepartment(data) {
    const response = await api.post('/api/employees/departments/', data);
    return response.data;
  },

  async updateDepartment(id, data) {
    const response = await api.put(`/api/employees/departments/${id}`, data);
    return response.data;
  },

  async assignDepartmentManager(departmentId, managerId) {
    const response = await api.post(
      `/api/employees/departments/${departmentId}/assign-manager`,
      { manager_id: managerId }
    );
    return response.data;
  },

  async createEmployee(data) {
    const response = await api.post('/api/employees/', data);
    return response.data;
  },

  async updateEmployee(id, data) {
    const response = await api.put(`/api/employees/${id}`, data);
    return response.data;
  },

  async blockEmployee(id) {
    const response = await api.put(`/api/employees/${id}/block/`);
    return response.data;
  },

  async unblockEmployee(id) {
    const response = await api.put(`/api/employees/${id}/unblock/`);
    return response.data;
  },

  async deleteEmployee(id) {
    await api.delete(`/api/employees/${id}/`);
  },

  async getNotifications() {
    const response = await api.get('/api/employees/notifications/');
    return response.data;
  },

  async getEmployeeDocuments(employeeId, params = {}) {
    const response = await api.get(`/api/employees/${employeeId}/documents`, { params });
    return response.data;
  },

  async uploadEmployeeDocuments(employeeId, files, { title = '', category = 'other' } = {}) {
    const form = new FormData();
    Array.from(files).forEach((file) => form.append('files', file));
    if (title) form.append('title', title);
    form.append('category', category);
    const response = await api.post(`/api/employees/${employeeId}/documents`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  async linkEmployeeDocument(employeeId, data) {
    const response = await api.post(`/api/employees/${employeeId}/documents/link`, data);
    return response.data;
  },

  async downloadEmployeeDocument(employeeId, docId) {
    const response = await api.get(`/api/employees/${employeeId}/documents/${docId}/download`, {
      responseType: 'blob',
    });
    return response.data;
  },

  async deleteEmployeeDocument(employeeId, docId) {
    await api.delete(`/api/employees/${employeeId}/documents/${docId}`);
  },

  async addTeamMember(teamId, userId, membershipRole = 'member') {
    const response = await api.post(`/api/employees/teams/${teamId}/members`, {
      user_id: userId,
      membership_role: membershipRole,
    });
    return response.data;
  },
};
