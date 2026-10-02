import api from './api';

/**
 * Authenticated: create/list/revoke share links.
 * base: api → http://localhost:8000
 */
export const dashboardLinkService = {
  async createLink(dashboardId, { permission, session_type, expires_at, label, flow_id, invite_user_id }) {
    const res = await api.post('/api/dashboard-links/', {
      permission,
      session_type,
      expires_at,
      label,
      flow_id,
      invite_user_id,
    }, { params: { dashboard_id: dashboardId } });
    return res.data;
  },

  async listLinks(dashboardId) {
    const res = await api.get('/api/dashboard-links/', { params: { dashboard_id: dashboardId } });
    return res.data;
  },

  async revokeLink(token, dashboardId) {
    await api.delete(`/api/dashboard-links/${encodeURIComponent(token)}`, {
      params: { dashboard_id: dashboardId },
    });
  },
};
