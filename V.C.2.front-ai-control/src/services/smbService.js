import api from './api';

export const smbService = {
  /**
   * Получить список всех SMB соединений
   */
  async getConnections(skip = 0, limit = 100) {
    try {
      const response = await api.get('/admin/smb/connections/', {
        params: { skip, limit }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching SMB connections:', error);
      throw error;
    }
  },

  /**
   * Получить SMB соединение по ID с доступами
   */
  async getConnection(connectionId) {
    try {
      const response = await api.get(`/admin/smb/connections/${connectionId}/`);
      return response.data;
    } catch (error) {
      console.error('Error fetching SMB connection:', error);
      throw error;
    }
  },

  /**
   * Создать новое SMB соединение
   */
  async createConnection(connectionData) {
    try {
      const response = await api.post('/admin/smb/connections/', connectionData);
      return response.data;
    } catch (error) {
      console.error('Error creating SMB connection:', error);
      throw error;
    }
  },

  /**
   * Обновить SMB соединение
   */
  async updateConnection(connectionId, connectionData) {
    try {
      const response = await api.put(`/admin/smb/connections/${connectionId}/`, connectionData);
      return response.data;
    } catch (error) {
      console.error('Error updating SMB connection:', error);
      throw error;
    }
  },

  /**
   * Удалить SMB соединение
   */
  async deleteConnection(connectionId) {
    try {
      const response = await api.delete(`/admin/smb/connections/${connectionId}/`);
      return response.data;
    } catch (error) {
      console.error('Error deleting SMB connection:', error);
      throw error;
    }
  },

  /**
   * Предоставить доступ пользователю
   */
  async grantAccess(connectionId, accessData) {
    try {
      const response = await api.post(`/admin/smb/connections/${connectionId}/access/`, accessData);
      return response.data;
    } catch (error) {
      console.error('Error granting access:', error);
      throw error;
    }
  },

  /**
   * Отозвать доступ пользователя
   */
  async revokeAccess(connectionId, accessId) {
    try {
      const response = await api.delete(`/admin/smb/connections/${connectionId}/access/${accessId}/`);
      return response.data;
    } catch (error) {
      console.error('Error revoking access:', error);
      throw error;
    }
  },

  /**
   * Получить список пользователей
   */
  async getUsers(search = '', skip = 0, limit = 100) {
    try {
      const response = await api.get('/admin/smb/users/', {
        params: { search, skip, limit }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching users:', error);
      throw error;
    }
  },

  /**
   * Тестировать SMB соединение и получить содержимое папки
   */
  async testConnection(connectionId, path = '') {
    try {
      const response = await api.get(`/admin/smb/connections/${connectionId}/test/`, {
        params: { path }
      });
      return response.data;
    } catch (error) {
      console.error('Error testing SMB connection:', error);
      throw error;
    }
  }
};
