import api from './api';

/**
 * Параметры для списка записей о доходах (опциональные фильтры).
 * @typedef {{ date_from?: string, date_to?: string, category?: string }} GetEntriesParams
 */

export const financeService = {
  /**
   * Получить список записей о доходах текущего пользователя.
   * @param {GetEntriesParams} [params]
   * @returns {Promise<Array>}
   */
  async getEntries(params = {}) {
    const response = await api.get('/api/finances/', { params });
    return response.data;
  },

  /**
   * Получить одну запись по id.
   * @param {number} id
   * @returns {Promise<Object>}
   */
  async getEntry(id) {
    const response = await api.get(`/api/finances/${id}/`);
    return response.data;
  },

  /**
   * Создать запись о доходе.
   * @param {{ payment_date: string, amount: number, category: string, supplier: string, document_type?: string, comment?: string }} data
   * @returns {Promise<Object>}
   */
  async createEntry(data) {
    const response = await api.post('/api/finances/', data);
    return response.data;
  },

  /**
   * Обновить запись о доходе.
   * @param {number} id
   * @param {Partial<{ payment_date: string, amount: number, category: string, supplier: string, document_type: string, comment: string }>} data
   * @returns {Promise<Object>}
   */
  async updateEntry(id, data) {
    const response = await api.put(`/api/finances/${id}/`, data);
    return response.data;
  },

  /**
   * Удалить запись о доходе.
   * @param {number} id
   * @returns {Promise<void>}
   */
  async deleteEntry(id) {
    await api.delete(`/api/finances/${id}/`);
  },
};
