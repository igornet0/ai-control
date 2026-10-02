import axios from 'axios';
import { getPartyhomeApiPrefix, getPartyhomeBaseUrl, getPartyhomeToken } from './partyhomeBaseUrl';

const partyhomeApi = axios.create({
  timeout: 15000,
});

partyhomeApi.interceptors.request.use((config) => {
  const base = getPartyhomeBaseUrl();
  const prefix = getPartyhomeApiPrefix();
  config.baseURL = base || undefined;
  if (prefix && config.url && !config.url.startsWith('http')) {
    config.url = `${prefix}${config.url.startsWith('/') ? '' : '/'}${config.url}`;
  }
  return config;
});

export const partyhomeService = {
  async createRoom(title) {
    const { data } = await partyhomeApi.post('/api/v1/rooms', {
      title: title || undefined,
    });
    return data;
  },

  async postRoomEvent(roomId, event) {
    const token = getPartyhomeToken();
    await partyhomeApi.post(`/api/v1/rooms/${encodeURIComponent(roomId)}/events`, {
      event,
      token,
    });
  },

  async health() {
    const { data } = await partyhomeApi.get('/health');
    return data;
  },
};
