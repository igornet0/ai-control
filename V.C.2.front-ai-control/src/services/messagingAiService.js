import axios from 'axios';
import { getApiBaseUrl } from './apiBaseUrl';
import { refreshAccessToken, getAccessToken } from './tokenRefresh';

function getAiApiBaseUrl() {
  const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};
  if (env.VITE_AI_API_URL) return String(env.VITE_AI_API_URL).replace(/\/$/, '');
  const base = getApiBaseUrl();
  return `${base}/ai-api`;
}

const aiApi = axios.create({
  baseURL: getAiApiBaseUrl(),
  timeout: 90000,
});

aiApi.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

aiApi.interceptors.response.use(
  (r) => r,
  async (error) => {
    if (error.response?.status === 401) {
      const originalRequest = error.config || {};
      if (!originalRequest._retry) {
        originalRequest._retry = true;
        const newToken = await refreshAccessToken();
        if (newToken) {
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return aiApi(originalRequest);
        }
      }
    }
    return Promise.reject(error);
  },
);

/** @param {string} content */
export function messageMentionsAi(content) {
  return /(^|[\s([{])@ai\b/i.test(String(content || ''));
}

/**
 * Split message content into text / @ai mention segments for rendering.
 * @param {string} content
 * @returns {Array<{ type: 'text'|'mention', value: string }>}
 */
export function splitAiMentions(content) {
  const text = String(content || '');
  const re = /@ai\b/gi;
  const parts = [];
  let last = 0;
  let m = re.exec(text);
  while (m) {
    if (m.index > last) {
      parts.push({ type: 'text', value: text.slice(last, m.index) });
    }
    parts.push({ type: 'mention', value: m[0] });
    last = m.index + m[0].length;
    m = re.exec(text);
  }
  if (last < text.length) parts.push({ type: 'text', value: text.slice(last) });
  return parts.length ? parts : [{ type: 'text', value: text }];
}

export const messagingAiService = {
  /**
   * @param {{ roomId: number, content: string, parentMessageId?: number|null }} args
   */
  async mention({ roomId, content, parentMessageId = null }) {
    const { data } = await aiApi.post('/api/v1/messaging-ai/mention', {
      room_id: roomId,
      content,
      parent_message_id: parentMessageId || null,
    });
    return data;
  },
};

export const AI_ASSISTANT_USER_ID = -1;
