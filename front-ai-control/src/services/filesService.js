import { authFetch } from './http';
import api from './api';

export async function listProjectFiles({ projectId, search, sortBy, sortOrder, onlyMy }) {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (sortBy) params.set('sort_by', sortBy);
  if (sortOrder) params.set('sort_order', sortOrder);
  if (onlyMy) params.set('only_my', 'true');
  const res = await authFetch(`/api/projects/${projectId}/attachments?${params.toString()}`);
  return res;
}

export async function addFileToFavorites({ projectId, filename }) {
  const res = await authFetch(`/api/projects/${projectId}/attachments/${encodeURIComponent(filename)}/favorite`, {
    method: 'POST'
  });
  return res;
}

export async function removeFileFromFavorites({ projectId, filename }) {
  const res = await authFetch(`/api/projects/${projectId}/attachments/${encodeURIComponent(filename)}/favorite`, {
    method: 'DELETE'
  });
  return res;
}

export async function listFavoriteFiles({ search, sortBy, sortOrder, limit }) {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (sortBy) params.set('sort_by', sortBy);
  if (sortOrder) params.set('sort_order', sortOrder);
  if (limit) params.set('limit', limit.toString());
  const res = await authFetch(`/api/projects/favorites/attachments?${params.toString()}`);
  return res;
}

export function downloadProjectFile({ projectId, filename }) {
  const base = (api && api.defaults && api.defaults.baseURL) || (typeof import.meta !== 'undefined' ? import.meta.env.VITE_API_URL : '') || '';
  const url = `${base}/api/projects/${projectId}/attachments/${encodeURIComponent(filename)}`;
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.click();
}
