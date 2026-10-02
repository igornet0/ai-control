import api from './api';

export const documentLinkService = {
  async createLink(documentId, { permission, expires_at, label }) {
    const res = await api.post(
      '/api/document-links/',
      { permission, expires_at, label },
      { params: { document_id: documentId } },
    );
    return res.data;
  },

  async listLinks(documentId) {
    const res = await api.get('/api/document-links/', { params: { document_id: documentId } });
    return res.data;
  },

  async revokeLink(token, documentId) {
    await api.delete(`/api/document-links/${encodeURIComponent(token)}`, {
      params: { document_id: documentId },
    });
  },

  async bootstrapShare(token) {
    const res = await api.get(`/api/documents/shares/${encodeURIComponent(token)}/bootstrap`);
    return res.data;
  },

  async getShareContent(token) {
    const res = await api.get(`/api/documents/shares/${encodeURIComponent(token)}`);
    return res.data;
  },

  async saveShareProposal(token, { field_data, title, comment }) {
    const res = await api.put(`/api/documents/shares/${encodeURIComponent(token)}/proposal`, {
      field_data,
      title,
      comment: comment != null && String(comment).trim() !== '' ? String(comment).trim() : null,
    });
    return res.data;
  },
};
