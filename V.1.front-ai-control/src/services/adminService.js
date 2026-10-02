import api from './api';

export const adminService = {
  /**
   * Получить административную статистику
   * @param {string} period - Период: 'day', 'month', или 'year'
   * @returns {Promise<Object>} Статистика
   */
  async getStatistics(period = 'day') {
    try {
      const response = await api.get('/admin/statistics/', {
        params: { period }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching admin statistics:', error);
      throw error;
    }
  },

  /**
   * Получить список всех пользователей
   * @returns {Promise<Array>} Список пользователей
   */
  async getUsers() {
    try {
      const response = await api.get('/admin/users/');
      return response.data;
    } catch (error) {
      console.error('Error fetching users:', error);
      throw error;
    }
  },

  /**
   * Заблокировать пользователя
   * @param {number} userId - ID пользователя
   * @returns {Promise<Object>} Обновленный пользователь
   */
  async blockUser(userId) {
    try {
      const response = await api.put(`/admin/users/${userId}/block/`);
      return response.data;
    } catch (error) {
      console.error('Error blocking user:', error);
      throw error;
    }
  },

  /**
   * Разблокировать пользователя
   * @param {number} userId - ID пользователя
   * @returns {Promise<Object>} Обновленный пользователь
   */
  async unblockUser(userId) {
    try {
      const response = await api.put(`/admin/users/${userId}/unblock/`);
      return response.data;
    } catch (error) {
      console.error('Error unblocking user:', error);
      throw error;
    }
  },

  /**
   * Ограничить пользователя (изменить роль или статус)
   * @param {number} userId - ID пользователя
   * @param {Object} updateData - Данные для обновления {role?, is_active?}
   * @returns {Promise<Object>} Обновленный пользователь
   */
  async restrictUser(userId, updateData) {
    try {
            const response = await api.put(`/admin/users/${userId}/restrict/`, updateData, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error restricting user:', error);
      console.error('Error response:', error.response?.data);
      throw error;
    }
  },

  /**
   * Удалить пользователя
   * @param {number} userId - ID пользователя
   * @returns {Promise<Object>} Результат удаления
   */
  async deleteUser(userId) {
    try {
      const response = await api.delete(`/admin/users/${userId}/`);
      return response.data;
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  },

  /**
   * Создать инвайт на сброс пароля для существующего пользователя
   * @param {number} userId
   * @param {{ expires_at?: string }=} payload
   */
  async createPasswordResetInvite(userId, payload = {}) {
    const response = await api.post(`/admin/users/${userId}/password-reset-invite/`, payload);
    return response.data;
  },

  /**
   * Экспортировать всех пользователей в CSV
   * @returns {Promise<Blob>} CSV файл
   */
  async exportUsers() {
    try {
      const response = await api.get('/admin/users/export/', {
        responseType: 'blob'
      });
      
      // Создаем ссылку для скачивания
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `users_export_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      return response.data;
    } catch (error) {
      console.error('Error exporting users:', error);
      throw error;
    }
  },

  async getDatabridgeConfig() {
    const response = await api.get('/admin/databridge/config');
    return response.data;
  },

  async getDatabridgeEntities() {
    const response = await api.get('/admin/databridge/entities');
    return response.data;
  },

  async saveDatabridgeConfig(payload) {
    const response = await api.put('/admin/databridge/config', payload);
    return response.data;
  },

  async getHeroDemo() {
    const response = await api.get('/admin/hero-demo/');
    return response.data;
  },

  async saveHeroDemo(payload) {
    const response = await api.put('/admin/hero-demo/', payload);
    return response.data;
  },

  async listHeroDemoDashboards() {
    const response = await api.get('/admin/hero-demo/dashboards/');
    return response.data;
  },

  // ── AI Agent ──────────────────────────────────────────────────

  async getAiAgentConfig() {
    const response = await api.get('/admin/ai-agent/config/');
    return response.data;
  },

  async saveAiAgentConfig(payload) {
    const response = await api.put('/admin/ai-agent/config/', payload);
    return response.data;
  },

  async uploadAiAgentAvatar(file) {
    const form = new FormData();
    // Backend endpoint expects multipart field name "file"
    form.append('file', file);
    const response = await api.post('/admin/ai-agent/avatar/form/', form);
    return response.data;
  },

  async deleteAiAgentAvatar() {
    const response = await api.delete('/admin/ai-agent/avatar/');
    return response.data;
  },

  // ── AI Scenarios (AI-service proxy via /ai-api/) ────────────────
  async listAiScenarios() {
    const response = await api.get('/ai-api/api/v1/admin/scenarios');
    return response.data;
  },
  async createAiScenario(payload) {
    const response = await api.post('/ai-api/api/v1/admin/scenarios', payload);
    return response.data;
  },
  async updateAiScenario(id, payload) {
    const response = await api.patch(`/ai-api/api/v1/admin/scenarios/${id}`, payload);
    return response.data;
  },
  async deleteAiScenario(id) {
    await api.delete(`/ai-api/api/v1/admin/scenarios/${id}`);
  },
  async listAiMethods() {
    const response = await api.get('/ai-api/api/v1/admin/methods');
    return response.data;
  },
  async createAiMethod(payload) {
    const response = await api.post('/ai-api/api/v1/admin/methods', payload);
    return response.data;
  },
  async updateAiMethod(id, payload) {
    const response = await api.patch(`/ai-api/api/v1/admin/methods/${id}`, payload);
    return response.data;
  },
  async deleteAiMethod(id) {
    await api.delete(`/ai-api/api/v1/admin/methods/${id}`);
  },
  async listAiApiKeys() {
    const response = await api.get('/admin/ai-keys/');
    return response.data;
  },
  async createAiApiKey(payload) {
    const response = await api.post('/admin/ai-keys/', payload);
    return response.data;
  },
  async updateAiApiKey(id, payload) {
    const response = await api.patch(`/admin/ai-keys/${id}/`, payload);
    return response.data;
  },
  async deleteAiApiKey(id) {
    await api.delete(`/admin/ai-keys/${id}/`);
  },
  async getAiConfig() {
    const response = await api.get('/ai-api/api/v1/admin/config');
    return response.data;
  },
};
