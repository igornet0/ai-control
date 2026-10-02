import api from './api';

export const inviteService = {
  async createInvite(payload) {
    const response = await api.post('/api/employees/invites', payload);
    return response.data;
  },

  async listInvites() {
    const response = await api.get('/api/employees/invites');
    return response.data;
  },

  async revokeInvite(id) {
    await api.delete(`/api/employees/invites/${id}`);
  },

  async getInviteByToken(token) {
    const response = await api.get(`/auth/invites/${token}`);
    return response.data;
  },

  async acceptInvite(token, payload) {
    const response = await api.post(`/auth/invites/${token}/accept`, payload);
    return response.data;
  },

  async getPasswordResetInvite(token) {
    const response = await api.get(`/auth/password-reset-invites/${token}`);
    return response.data;
  },

  async acceptPasswordResetInvite(token, payload) {
    const response = await api.post(`/auth/password-reset-invites/${token}/accept`, payload);
    return response.data;
  },
};

function getInviteOrigin() {
  if (typeof window === 'undefined') return '';
  const rt = window.__AICONTROL_RUNTIME__;
  const publicOrigin =
    rt && typeof rt === 'object' ? String(rt.publicOrigin || '').trim() : '';
  if (publicOrigin) return publicOrigin.replace(/\/$/, '');
  return String(window.location.origin || '').replace(/\/$/, '');
}

export function buildInviteUrl(token) {
  if (!token) return '';
  const origin = getInviteOrigin();
  return origin ? `${origin}/invite/${token}` : `/invite/${token}`;
}

export function buildPasswordResetInviteUrl(token) {
  if (!token) return '';
  const origin = getInviteOrigin();
  return origin ? `${origin}/reset-password/${token}` : `/reset-password/${token}`;
}
