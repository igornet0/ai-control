import axios from 'axios';
import { getApiBaseUrl } from './apiBaseUrl';
import { refreshAccessToken, getAccessToken } from './tokenRefresh';

function getAiApiBaseUrl() {
  const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};
  if (env.VITE_AI_API_URL) return String(env.VITE_AI_API_URL).replace(/\/$/, '');
  const base = getApiBaseUrl();
  return `${base}/ai-api`;
}

const aiApi = axios.create({
  baseURL: getAiApiBaseUrl(),
  timeout: 120000,
});

aiApi.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

aiApi.interceptors.response.use(
  (r) => r,
  async (error) => {
    if (error.response?.status === 401) {
      const orig = error.config || {};
      if (!orig._retry) {
        orig._retry = true;
        const newToken = await refreshAccessToken();
        if (newToken) {
          orig.headers = orig.headers || {};
          orig.headers.Authorization = `Bearer ${newToken}`;
          return aiApi(orig);
        }
      }
    }
    return Promise.reject(error);
  }
);

function errMessage(error, fallback) {
  return error?.response?.data?.detail || error?.message || fallback;
}

export const taskManagerAiService = {
  async listConversations(surface = 'task_manager') {
    const { data } = await aiApi.get('/api/v1/conversations', { params: { surface } });
    return Array.isArray(data) ? data : [];
  },

  async createConversation(title = 'Новый чат', surface = 'task_manager') {
    const { data } = await aiApi.post('/api/v1/conversations', { title, surface });
    return data;
  },

  async renameConversation(id, title) {
    const { data } = await aiApi.patch(`/api/v1/conversations/${id}`, { title });
    return data;
  },

  async deleteConversation(id) {
    await aiApi.delete(`/api/v1/conversations/${id}`);
  },

  async listMessages(conversationId) {
    const { data } = await aiApi.get(`/api/v1/conversations/${conversationId}/messages`);
    return Array.isArray(data) ? data : [];
  },

  async sendMessage(conversationId, content) {
    const { data } = await aiApi.post(`/api/v1/conversations/${conversationId}/messages`, {
      content,
    });
    return data;
  },

  async analyze({
    mode = 'summary',
    target = 'self',
    employeeId = null,
    departmentId = null,
    forceRefresh = false,
  } = {}) {
    const { data } = await aiApi.post('/api/v1/task-manager/analyze', {
      mode,
      target,
      employee_id: employeeId,
      department_id: departmentId,
      force_refresh: Boolean(forceRefresh),
    });
    return data;
  },

  async applyAction(action, { messageId = null, actionIndex = null } = {}) {
    const { data } = await aiApi.post('/api/v1/task-actions/apply', {
      action,
      message_id: messageId,
      action_index: actionIndex,
    });
    return data;
  },

  async rejectAction(action, { messageId = null, actionIndex = null } = {}) {
    const { data } = await aiApi.post('/api/v1/task-actions/reject', {
      action,
      message_id: messageId,
      action_index: actionIndex,
    });
    return data;
  },

  formatError: errMessage,
};

export default taskManagerAiService;
