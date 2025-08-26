import { authFetch } from './http';

export async function listProjectFiles({ projectId, search, sortBy, sortOrder, onlyMy }) {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (sortBy) params.set('sort_by', sortBy);
  if (sortOrder) params.set('sort_order', sortOrder);
  if (onlyMy) params.set('only_my', 'true');
  const res = await authFetch(`/api/projects/${projectId}/attachments?${params.toString()}`);
  return res;
}

export async function toggleFavoriteFile({ projectId, filename, favorite }) {
  const res = await authFetch(`/api/projects/${projectId}/attachments/${encodeURIComponent(filename)}/favorite?favorite=${favorite ? 'true' : 'false'}`, {
    method: 'POST'
  });
  return res;
}

export function downloadProjectFile({ projectId, filename }) {
  const url = `${process.env.REACT_APP_API_URL || ''}/api/projects/${projectId}/attachments/${encodeURIComponent(filename)}`;
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.click();
}
