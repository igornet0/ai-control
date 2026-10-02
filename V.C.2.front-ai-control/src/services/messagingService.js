import axios from 'axios';
import { getMessagingBaseUrl, getAttachmentUrl, getMailAttachmentUrl } from './messagingBaseUrl';
import { refreshAccessToken, getAccessToken } from './tokenRefresh';

const messagingApi = axios.create({
  baseURL: getMessagingBaseUrl(),
  timeout: 15000,
});

messagingApi.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

messagingApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const originalRequest = error.config || {};
      if (!originalRequest._retry) {
        originalRequest._retry = true;
        const newToken = await refreshAccessToken();
        if (newToken) {
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return messagingApi(originalRequest);
        }
      }
    }
    return Promise.reject(error);
  }
);

const prefix = '/api/messaging';

export const messagingService = {
  async health() {
    const { data } = await messagingApi.get(`${prefix}/health`);
    return data;
  },

  async getRooms() {
    const { data } = await messagingApi.get(`${prefix}/rooms`);
    return data.rooms || [];
  },

  async createRoom(name, memberIds = []) {
    const { data } = await messagingApi.post(`${prefix}/rooms`, {
      name,
      member_ids: memberIds,
    });
    return data;
  },

  async createDirectRoom(userId) {
    const { data } = await messagingApi.post(`${prefix}/rooms/direct`, {
      user_id: userId,
    });
    return data;
  },

  async getRoomMembers(roomId) {
    const { data } = await messagingApi.get(`${prefix}/rooms/${roomId}/members`);
    return data.members || [];
  },

  async updateRoom(roomId, { name }) {
    const { data } = await messagingApi.patch(`${prefix}/rooms/${roomId}`, { name });
    return data;
  },

  async deleteRoom(roomId) {
    const { data } = await messagingApi.delete(`${prefix}/rooms/${roomId}`);
    return data;
  },

  async addRoomMembers(roomId, userIds) {
    const { data } = await messagingApi.post(`${prefix}/rooms/${roomId}/members`, {
      user_ids: userIds,
    });
    return data.members || [];
  },

  async removeRoomMember(roomId, userId) {
    const { data } = await messagingApi.delete(`${prefix}/rooms/${roomId}/members/${userId}`);
    return data.members || [];
  },

  async updateRoomMemberRole(roomId, userId, role) {
    const { data } = await messagingApi.patch(`${prefix}/rooms/${roomId}/members/${userId}`, {
      role,
    });
    return data.members || [];
  },

  async getMessages(roomId, { cursor, limit = 50 } = {}) {
    const params = { limit };
    if (cursor != null) params.cursor = cursor;
    const { data } = await messagingApi.get(`${prefix}/rooms/${roomId}/messages`, { params });
    return {
      messages: data.messages || [],
      readCursors: data.read_cursors || [],
    };
  },

  async markRoomRead(roomId, messageId) {
    const { data } = await messagingApi.post(`${prefix}/rooms/${roomId}/read`, {
      message_id: messageId,
    });
    return data;
  },

  async sendMessage(roomId, content, parentId = null, attachmentIds = [], entityRefs = []) {
    const body = { content: content || '' };
    if (parentId != null) body.parent_id = parentId;
    if (attachmentIds?.length) body.attachment_ids = attachmentIds;
    if (entityRefs?.length) body.entity_refs = entityRefs;
    const { data } = await messagingApi.post(`${prefix}/rooms/${roomId}/messages`, body);
    return data;
  },

  async uploadAttachment(roomId, file) {
    const form = new FormData();
    form.append('file', file);
    const { data } = await messagingApi.post(
      `${prefix}/rooms/${roomId}/attachments`,
      form,
      {
        timeout: 120000,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      }
    );
    return data;
  },

  getAttachmentUrl,

  async editMessage(roomId, messageId, { content, attachmentIds = null, entityRefs = null } = {}) {
    const body = { content: content || '' };
    if (attachmentIds != null) body.attachment_ids = attachmentIds;
    if (entityRefs != null) body.entity_refs = entityRefs;
    const { data } = await messagingApi.patch(
      `${prefix}/rooms/${roomId}/messages/${messageId}`,
      body
    );
    return data;
  },

  async deleteMessage(roomId, messageId) {
    const { data } = await messagingApi.delete(
      `${prefix}/rooms/${roomId}/messages/${messageId}`
    );
    return data;
  },

  async copyAttachments(targetRoomId, attachmentIds) {
    if (!attachmentIds?.length) return [];
    const { data } = await messagingApi.post(
      `${prefix}/rooms/${targetRoomId}/attachments/copy`,
      { attachment_ids: attachmentIds }
    );
    return data.attachments || [];
  },

  async forwardMessage(targetRoomId, { content = '', attachments = [], entityRefs = [] } = {}) {
    const sourceIds = (attachments || []).map((att) => att.id).filter((id) => id != null);
    let attachmentIds = [];
    if (sourceIds.length) {
      const copied = await this.copyAttachments(targetRoomId, sourceIds);
      attachmentIds = copied.map((att) => att.id);
    }
    return this.sendMessage(targetRoomId, content, null, attachmentIds, entityRefs);
  },

  async sendMail({ to, subject, body, attachmentIds = [] }) {
    const { data } = await messagingApi.post(`${prefix}/mail/send`, {
      to,
      subject,
      body,
      attachment_ids: attachmentIds,
    });
    return data;
  },

  async uploadMailAttachment(file, { onProgress } = {}) {
    const form = new FormData();
    form.append('file', file);
    const { data } = await messagingApi.post(`${prefix}/mail/attachments`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
      onUploadProgress: onProgress,
    });
    return data;
  },

  async getInboxMail({ cursor, limit = 50 } = {}) {
    const params = { limit };
    if (cursor != null) params.cursor = cursor;
    const { data } = await messagingApi.get(`${prefix}/mail/inbox`, { params });
    return data.items || [];
  },

  async getSentMail({ cursor, limit = 50 } = {}) {
    const params = { limit };
    if (cursor != null) params.cursor = cursor;
    const { data } = await messagingApi.get(`${prefix}/mail/sent`, { params });
    return data.items || [];
  },

  async getMailMessage(messageId, folder) {
    const { data } = await messagingApi.get(`${prefix}/mail/messages/${messageId}`, {
      params: { folder },
    });
    return data;
  },

  async markInboxRead(messageId) {
    const { data } = await messagingApi.patch(`${prefix}/mail/inbox/${messageId}/read`);
    return data;
  },

  getMailAttachmentUrl(attachmentId) {
    return getMailAttachmentUrl(attachmentId);
  },
};

export default messagingService;
export { getAttachmentUrl };
