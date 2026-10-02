import api from './api';
import { getAccessToken } from './tokenRefresh';

export const supportService = {
  async createQuestion({ category, title, body, page_url }) {
    const response = await api.post('/api/support-questions/', {
      category,
      title,
      body,
      page_url: page_url || (typeof window !== 'undefined' ? window.location.href : undefined),
    });
    return response.data;
  },

  async getHelpEditCapability() {
    const response = await api.get('/api/support-help/can-edit');
    return response.data;
  },

  async listHelpImages(category, articleId) {
    const response = await api.get(`/api/support-help/images/${category}/${articleId}`);
    return response.data;
  },

  helpImageUrl(category, articleId, slot) {
    return `/api/support-help/images/${category}/${articleId}/${slot}`;
  },

  async fetchHelpImageBlob(category, articleId, slot) {
    const token = getAccessToken();
    const response = await fetch(this.helpImageUrl(category, articleId, slot), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(`Failed to load image (${response.status})`);
    }
    return response.blob();
  },

  async uploadHelpImage(category, articleId, slot, file) {
    const form = new FormData();
    form.append('file', file);
    const response = await api.put(
      `/api/support-help/images/${category}/${articleId}/${slot}`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return response.data;
  },

  async deleteHelpImage(category, articleId, slot) {
    const response = await api.delete(
      `/api/support-help/images/${category}/${articleId}/${slot}`,
    );
    return response.data;
  },
};
