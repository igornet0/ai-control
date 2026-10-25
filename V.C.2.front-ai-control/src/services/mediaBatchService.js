import JSZip from 'jszip';
import api from './api';
import { getApiBaseUrl } from './apiBaseUrl';
import { getAccessToken } from './tokenRefresh';

const BATCH_LIMIT = 50;

function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

export function buildVariantUrl(ref, { preset, w, h, fit, modelId } = {}) {
  if (!ref) return null;
  const params = new URLSearchParams({ ref });
  if (preset) params.set('preset', preset);
  if (w) params.set('w', String(w));
  if (h) params.set('h', String(h));
  if (fit) params.set('fit', fit);
  if (modelId) params.set('model_id', String(modelId));
  const path = `/api/media/variant?${params.toString()}`;
  const base = getApiBaseUrl();
  return base ? `${base}${path}` : path;
}

function authHeaders() {
  const token = typeof localStorage !== 'undefined' ? getAccessToken() : '';
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const _variantBlobs = new Map();

/** Blob неизменяем — одновременные/повторные запросы одного URL делят результат. */
export async function fetchMediaVariantBlob(ref, options = {}) {
  const url = buildVariantUrl(ref, options);
  if (!url) return null;
  if (_variantBlobs.has(url)) return _variantBlobs.get(url);
  const promise = fetch(url, {
    headers: authHeaders(),
    cache: 'force-cache',
  }).then((response) => {
    if (!response.ok) {
      throw new Error(`variant HTTP ${response.status}`);
    }
    return response.blob();
  });
  _variantBlobs.set(url, promise);
  if (_variantBlobs.size > 200) _variantBlobs.delete(_variantBlobs.keys().next().value);
  promise.then(
    () => setTimeout(() => {
      if (_variantBlobs.get(url) === promise) _variantBlobs.delete(url);
    }, 60_000),
    () => _variantBlobs.delete(url),
  );
  return promise;
}

export async function fetchMediaBatch(items) {
  const valid = (items || []).filter((item) => item && item.key && item.ref);
  const map = new Map();
  if (!valid.length) return map;

  const seen = new Set();
  const unique = valid.filter((item) => {
    if (seen.has(item.key)) return false;
    seen.add(item.key);
    return true;
  });

  for (const group of chunk(unique, BATCH_LIMIT)) {
    const response = await api.post(
      '/api/media/batch',
      { items: group },
      { responseType: 'arraybuffer', timeout: 60000 },
    );
    const zip = await JSZip.loadAsync(response.data);
    const manifestFile = zip.file('manifest.json');
    const manifest = manifestFile
      ? JSON.parse(await manifestFile.async('string'))
      : { items: [] };

    for (const entry of manifest.items || []) {
      if (!entry?.key || entry.error || !entry.filename) continue;
      const file = zip.file(entry.filename);
      if (!file) continue;
      const raw = await file.async('blob');
      const blob = new Blob([raw], { type: entry.mime_type || raw.type || 'image/webp' });
      const url = URL.createObjectURL(blob);
      map.set(entry.key, url);
      if (entry.original_ref) map.set(entry.original_ref, url);
    }
  }

  return map;
}

export function revokeMediaUrls(urls) {
  if (!urls) return;
  const values = urls instanceof Map ? urls.values() : Object.values(urls);
  for (const url of values) {
    if (typeof url === 'string' && url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  }
}
