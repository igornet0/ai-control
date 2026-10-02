import axios from 'axios';
import { getApiBaseUrl } from './apiBaseUrl';
import { getAccessToken } from './tokenRefresh';

function apiRoot() {
  return getApiBaseUrl();
}

function authHeaders() {
  const jwt = typeof localStorage !== 'undefined' ? getAccessToken() : null;
  return jwt ? { Authorization: `Bearer ${jwt}` } : {};
}

/** Public share-link API; forwards JWT when present so sheet/model ACL applies. */
export const publicDashboardLinkApi = {
  async bootstrap(token) {
    const res = await axios.get(
      `${apiRoot()}/api/public/dashboard-links/${encodeURIComponent(token)}/bootstrap`,
      { headers: authHeaders() },
    );
    return res.data;
  },

  async listSheets(token) {
    const res = await axios.get(
      `${apiRoot()}/api/public/dashboard-links/${encodeURIComponent(token)}/sheets`,
      { headers: authHeaders() },
    );
    return res.data;
  },
};
