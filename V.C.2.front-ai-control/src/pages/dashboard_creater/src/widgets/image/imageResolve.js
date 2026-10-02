/**
 * Resolve media cell values (image / video / pdf / social embeds):
 * - asset://sha
 * - model-file://{modelId}/{fileId}  (DataModelFile from ai_control_dev)
 * - http(s) | /static/... | YouTube / Vimeo / etc.
 */

const ASSET_RE = /^asset:\/\/([0-9a-f]{64})$/i;
const MODEL_FILE_RE = /^model-file:\/\/(\d+)\/(\d+)$/i;

const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|bmp|svg|avif|ico)(?:[?#]|$)/i;
const VIDEO_EXT_RE = /\.(mp4|webm|ogg|ogv|mov|m4v|mkv)(?:[?#]|$)/i;
const PDF_EXT_RE = /\.pdf(?:[?#]|$)/i;
const AUDIO_EXT_RE = /\.(mp3|wav|ogg|m4a|aac|flac|oga)(?:[?#]|$)/i;

const EXT_MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ogv': 'video/ogg',
  '.mov': 'video/quicktime',
  '.m4v': 'video/x-m4v',
  '.mkv': 'video/x-matroska',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.flac': 'audio/flac',
  '.oga': 'audio/ogg',
  '.ogg': 'audio/ogg',
  '.pdf': 'application/pdf',
};

/**
 * @param {string|null|undefined} filename
 * @returns {string}
 */
export function guessMimeFromFilename(filename) {
  const name = String(filename || '').trim().toLowerCase();
  const m = name.match(/(\.[a-z0-9]+)(?:[?#]|$)/i);
  if (!m) return '';
  return EXT_MIME[m[1].toLowerCase()] || '';
}

/**
 * @param {string|null|undefined} role
 * @param {string|null|undefined} mime
 * @param {string|null|undefined} filename
 * @returns {'image'|'video'|'pdf'|'audio'|'unknown'}
 */
export function mediaKindFromMeta(role, mime, filename) {
  const r = String(role || '').toLowerCase();
  if (r === 'video' || r === 'audio' || r === 'pdf' || r === 'image') return r;
  const m = String(mime || '').toLowerCase().split(';')[0].trim();
  if (m.startsWith('image/')) return 'image';
  if (m.startsWith('video/')) return 'video';
  if (m.startsWith('audio/')) return 'audio';
  if (m === 'application/pdf') return 'pdf';
  const guessed = guessMimeFromFilename(filename);
  if (guessed.startsWith('image/')) return 'image';
  if (guessed.startsWith('video/')) return 'video';
  if (guessed.startsWith('audio/')) return 'audio';
  if (guessed === 'application/pdf') return 'pdf';
  const name = String(filename || '');
  if (IMAGE_EXT_RE.test(name)) return 'image';
  if (VIDEO_EXT_RE.test(name)) return 'video';
  if (AUDIO_EXT_RE.test(name)) return 'audio';
  if (PDF_EXT_RE.test(name)) return 'pdf';
  return 'unknown';
}

/**
 * @param {number|string} modelId
 * @param {number|string} fileId
 */
export function modelFileUri(modelId, fileId) {
  return `model-file://${Number(modelId)}/${Number(fileId)}`;
}

/**
 * @param {string|null|undefined} value
 * @returns {{ kind: 'asset', sha: string }
 *   | { kind: 'model-file', modelId: number, fileId: number }
 *   | { kind: 'url', url: string }
 *   | { kind: 'empty' }}
 */
export function parseImageValue(value) {
  const text = value == null ? '' : String(value).trim();
  if (!text) return { kind: 'empty' };
  const asset = text.match(ASSET_RE);
  if (asset) return { kind: 'asset', sha: asset[1].toLowerCase() };
  const mf = text.match(MODEL_FILE_RE);
  if (mf) {
    return {
      kind: 'model-file',
      modelId: Number(mf[1]),
      fileId: Number(mf[2]),
    };
  }
  return { kind: 'url', url: text };
}

/**
 * Convert social / streaming page URLs to embeddable iframe src.
 * @param {string} rawUrl
 * @returns {string|null} embed URL or null if not recognized
 */
export function toEmbedUrl(rawUrl) {
  const text = String(rawUrl || '').trim();
  if (!text) return null;
  let u;
  try {
    u = new URL(text, typeof window !== 'undefined' ? window.location?.origin : 'https://local.invalid');
  } catch {
    return null;
  }
  const host = (u.hostname || '').replace(/^www\./i, '').toLowerCase();
  const path = u.pathname || '';

  // YouTube
  if (host === 'youtu.be') {
    const id = path.replace(/^\//, '').split('/')[0];
    if (id) return `https://www.youtube.com/embed/${encodeURIComponent(id)}`;
  }
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
    if (path.startsWith('/embed/')) return `https://www.youtube.com${path}${u.search || ''}`;
    if (path.startsWith('/shorts/')) {
      const id = path.split('/')[2];
      if (id) return `https://www.youtube.com/embed/${encodeURIComponent(id)}`;
    }
    const v = u.searchParams.get('v');
    if (v) return `https://www.youtube.com/embed/${encodeURIComponent(v)}`;
  }

  // Vimeo
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    if (host === 'player.vimeo.com' && path.startsWith('/video/')) {
      return `https://player.vimeo.com${path}`;
    }
    const m = path.match(/^\/(?:video\/)?(\d+)/);
    if (m) return `https://player.vimeo.com/video/${m[1]}`;
  }

  // Rutube
  if (host === 'rutube.ru' || host === 'www.rutube.ru') {
    const m = path.match(/\/video\/([a-f0-9-]+)/i);
    if (m) return `https://rutube.ru/play/embed/${m[1]}`;
    if (path.startsWith('/play/embed/')) return `https://rutube.ru${path}`;
  }

  // VK Video
  if (host === 'vk.com' || host === 'm.vk.com' || host === 'vkvideo.ru') {
    const m = path.match(/\/video(-?\d+_\d+)/);
    if (m) return `https://vk.com/video_ext.php?oid=${m[1].split('_')[0]}&id=${m[1].split('_')[1]}&hd=2`;
    const z = u.searchParams.get('z');
    if (z && /^video-?\d+_\d+/.test(z)) {
      const id = z.replace(/^video/, '').split('/')[0];
      const [oid, vid] = id.split('_');
      if (oid && vid) return `https://vk.com/video_ext.php?oid=${oid}&id=${vid}&hd=2`;
    }
  }

  // Dailymotion
  if (host === 'dailymotion.com' || host === 'www.dailymotion.com' || host === 'dai.ly') {
    if (host === 'dai.ly') {
      const id = path.replace(/^\//, '');
      if (id) return `https://www.dailymotion.com/embed/video/${encodeURIComponent(id)}`;
    }
    const m = path.match(/\/video\/([a-zA-Z0-9]+)/);
    if (m) return `https://www.dailymotion.com/embed/video/${m[1]}`;
    if (path.startsWith('/embed/video/')) return `https://www.dailymotion.com${path}`;
  }

  return null;
}

/**
 * @param {string|null|undefined} url
 * @param {string|null|undefined} [mimeHint]
 * @param {string|null|undefined} [filenameHint]
 * @returns {'image'|'video'|'pdf'|'audio'|'embed'|'link'|'unknown'}
 */
export function detectMediaKind(url, mimeHint, filenameHint) {
  const fromMeta = mediaKindFromMeta(null, mimeHint, filenameHint);
  if (fromMeta !== 'unknown') return fromMeta;

  const text = String(url || '').trim();
  if (!text) return 'unknown';

  if (toEmbedUrl(text)) return 'embed';

  // strip query for extension checks on http(s) / paths
  const pathOnly = text.split(/[?#]/)[0];
  if (IMAGE_EXT_RE.test(pathOnly) || IMAGE_EXT_RE.test(text)) return 'image';
  if (VIDEO_EXT_RE.test(pathOnly) || VIDEO_EXT_RE.test(text)) return 'video';
  if (PDF_EXT_RE.test(pathOnly) || PDF_EXT_RE.test(text)) return 'pdf';
  if (AUDIO_EXT_RE.test(pathOnly) || AUDIO_EXT_RE.test(text)) return 'audio';

  if (/^https?:\/\//i.test(text)) return 'link';
  if (text.startsWith('data:image/')) return 'image';
  if (text.startsWith('data:video/')) return 'video';
  if (text.startsWith('data:audio/')) return 'audio';
  if (text.startsWith('data:application/pdf')) return 'pdf';
  // blob: without mime/filename stays unknown — caller should pass mimeHint
  return 'unknown';
}

/**
 * @param {string} url
 * @param {string|null|undefined} [mimeHint]
 * @param {string|null|undefined} [filenameHint]
 * @returns {{ mediaKind: string, displaySrc: string, embedSrc?: string }}
 */
export function resolveMediaPresentation(url, mimeHint, filenameHint) {
  const kind = detectMediaKind(url, mimeHint, filenameHint);
  if (kind === 'embed') {
    const embedSrc = toEmbedUrl(url);
    return { mediaKind: 'embed', displaySrc: url, embedSrc: embedSrc || url };
  }
  return { mediaKind: kind === 'unknown' ? 'image' : kind, displaySrc: url };
}

/**
 * Ensure blob has a playable MIME (servers often return application/octet-stream).
 * @param {Blob} blob
 * @param {string|null|undefined} mimeHint
 * @param {string|null|undefined} filenameHint
 * @returns {{ blob: Blob, mime: string, mediaKind: string }}
 */
export function coerceMediaBlob(blob, mimeHint, filenameHint) {
  const rawType = String(blob?.type || '').toLowerCase().split(';')[0].trim();
  const useful =
    rawType &&
    rawType !== 'application/octet-stream' &&
    rawType !== 'binary/octet-stream'
      ? rawType
      : '';
  const mime =
    useful ||
    String(mimeHint || '').toLowerCase().split(';')[0].trim() ||
    guessMimeFromFilename(filenameHint) ||
    '';
  const mediaKind = mediaKindFromMeta(null, mime, filenameHint);
  const nextBlob =
    mime && (!useful || useful !== mime) ? new Blob([blob], { type: mime }) : blob;
  return { blob: nextBlob, mime, mediaKind: mediaKind === 'unknown' ? 'image' : mediaKind };
}

/**
 * @param {string} modelId
 * @param {string} sha
 * @param {{ get?: Function }} apiClient
 * @returns {Promise<string>} object URL
 */
export async function fetchAssetObjectUrl(modelId, sha, apiClient) {
  // apiClient baseURL is already `/api`
  const { data } = await apiClient.get(`/data-models/${modelId}/assets/${sha}`, {
    responseType: 'blob',
  });
  return URL.createObjectURL(data);
}

/**
 * @param {number} modelId
 * @param {number} fileId
 * @param {{ getModelFileBlob?: Function }} dataModelService
 */
export async function fetchModelFileObjectUrl(modelId, fileId, dataModelService) {
  const blob = await dataModelService.getModelFileBlob(modelId, fileId);
  return URL.createObjectURL(blob);
}

/**
 * @param {string} url
 * @param {(path: string) => string|null} getAvatarUrl
 */
export function resolveHttpOrStaticUrl(url, getAvatarUrl) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url) || url.startsWith('blob:') || url.startsWith('data:')) {
    return url;
  }
  if (typeof getAvatarUrl === 'function') {
    return getAvatarUrl(url) || url;
  }
  return url;
}

/** Heuristic: treat DataModelFile as an image for the picker. */
export function isModelImageFile(file) {
  if (!file) return false;
  const role = String(file.role || file.file_role || '').toLowerCase();
  if (role === 'image') return true;
  const mime = String(file.mime_type || file.content_type || '').toLowerCase();
  if (mime.startsWith('image/')) return true;
  const type = String(file.file_type || '').toLowerCase();
  if (type === 'image') return true;
  const name = String(file.original_filename || file.filename || file.name || '').toLowerCase();
  return IMAGE_EXT_RE.test(name);
}

/** Image / video / pdf / audio files for the media picker. */
export function isModelMediaFile(file) {
  if (!file) return false;
  if (isModelImageFile(file)) return true;
  const role = String(file.role || file.file_role || '').toLowerCase();
  if (['video', 'pdf', 'audio', 'media'].includes(role)) return true;
  const mime = String(file.mime_type || file.content_type || '').toLowerCase();
  if (mime.startsWith('video/') || mime.startsWith('audio/') || mime === 'application/pdf') {
    return true;
  }
  const type = String(file.file_type || '').toLowerCase();
  if (['video', 'pdf', 'audio', 'media'].includes(type)) return true;
  const name = String(file.original_filename || file.filename || file.name || '').toLowerCase();
  return VIDEO_EXT_RE.test(name) || PDF_EXT_RE.test(name) || AUDIO_EXT_RE.test(name);
}

/**
 * Flatten cell values from rows into unique non-empty media refs.
 * Supports scalar cells and JSON arrays stored as TEXT.
 * @param {Array<object>} rows
 * @param {string} field
 * @returns {string[]}
 */
export function collectUniqueImageValues(rows, field) {
  const out = [];
  const seen = new Set();
  const push = (raw) => {
    if (raw == null) return;
    if (Array.isArray(raw)) {
      raw.forEach(push);
      return;
    }
    if (typeof raw === 'object') return;
    let text = String(raw).trim();
    if (!text) return;
    if (text.startsWith('[') && text.endsWith(']')) {
      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          parsed.forEach(push);
          return;
        }
      } catch {
        /* plain string */
      }
    }
    if (seen.has(text)) return;
    seen.add(text);
    out.push(text);
  };

  for (const row of rows || []) {
    if (!row || typeof row !== 'object') continue;
    push(row[field]);
  }
  return out;
}
