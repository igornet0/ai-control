import api from './api';

function normalizeListResponse(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.items)) return data.items;
  return [];
}

export const connectionService = {
  /**
   * Получить список всех соединений
   */
  async getConnections(skip = 0, limit = 100, connectionType = null, isActive = null) {
    try {
      const params = { skip, limit };
      if (connectionType) params.connection_type = connectionType;
      if (isActive !== null) params.is_active = isActive;
      
      const response = await api.get('/admin/connections/', { params });
      return normalizeListResponse(response.data);
    } catch (error) {
      console.error('Error fetching connections:', error);
      throw error;
    }
  },

  /**
   * Получить соединение по ID с доступами
   */
  async getConnection(connectionId) {
    try {
      const response = await api.get(`/admin/connections/${connectionId}/`);
            return response.data;
    } catch (error) {
      console.error('❌ Error fetching connection:', error);
      console.error('Error response:', error.response?.data);
      throw error;
    }
  },

  /**
   * Создать новое соединение
   */
  async createConnection(connectionData) {
    try {
      const response = await api.post('/admin/connections/', connectionData);
      return response.data;
    } catch (error) {
      console.error('Error creating connection:', error);
      throw error;
    }
  },

  /**
   * Обновить соединение
   */
  async updateConnection(connectionId, connectionData) {
    try {
      const response = await api.put(`/admin/connections/${connectionId}/`, connectionData);
      return response.data;
    } catch (error) {
      console.error('Error updating connection:', error);
      throw error;
    }
  },

  /**
   * Удалить соединение
   */
  async deleteConnection(connectionId) {
    try {
      const response = await api.delete(`/admin/connections/${connectionId}/`);
      return response.data;
    } catch (error) {
      console.error('Error deleting connection:', error);
      throw error;
    }
  },

  /**
   * Предоставить доступ пользователю
   */
  async grantAccess(connectionId, accessData) {
    try {
      const response = await api.post(`/admin/connections/${connectionId}/access/`, accessData);
      return response.data;
    } catch (error) {
      console.error('Error granting access:', error);
      throw error;
    }
  },

  /**
   * Удалить доступ пользователя
   */
  async revokeAccess(connectionId, accessId) {
    try {
      const response = await api.delete(`/admin/connections/${connectionId}/access/${accessId}/`);
      return response.data;
    } catch (error) {
      console.error('Error revoking access:', error);
      throw error;
    }
  },

  /**
   * Получить список пользователей для выбора
   */
  async getUsersList() {
    try {
      const response = await api.get('/admin/connections/users/list/');
      return normalizeListResponse(response.data);
    } catch (error) {
      console.error('Error fetching users list:', error);
      throw error;
    }
  },

  /**
   * Тестировать соединение по ID
   */
  async testConnection(connectionId) {
    try {
      const response = await api.post(`/admin/connections/${connectionId}/test/`);
      return response.data;
    } catch (error) {
      console.error('Error testing connection:', error);
      throw error;
    }
  },

  /**
   * Тестировать конфигурацию соединения без сохранения
   */
  async testConnectionConfig(connectionData) {
    try {
      const response = await api.post('/admin/connections/test-config/', connectionData);
      return response.data;
    } catch (error) {
      console.error('Error testing connection config:', error);
      throw error;
    }
  },

  /**
   * Просмотр папок и файлов на SMB-шаре
   */
  async browseConnection(connectionId, path = '') {
    try {
      const response = await api.get(`/admin/connections/${connectionId}/browse/`, {
        params: { path },
      });
      return response.data;
    } catch (error) {
      console.error('Error browsing SMB connection:', error);
      throw error;
    }
  },

  /**
   * Скачать файл с SMB-шары (для предпросмотра)
   */
  async readConnectionFile(connectionId, path) {
    try {
      const response = await api.get(`/admin/connections/${connectionId}/read-file/`, {
        params: { path },
      });
      return response.data;
    } catch (error) {
      console.error('Error reading SMB file:', error);
      throw error;
    }
  },
};
