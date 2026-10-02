/** @vitest-environment node */

import { describe, expect, test, vi, beforeEach } from 'vitest';

const post = vi.fn();

vi.mock('axios', () => ({
  default: {
    create: () => ({
      post,
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    }),
  },
}));

vi.mock('./apiBaseUrl', () => ({
  getApiBaseUrl: () => 'http://localhost:8000',
}));

vi.mock('../utils/getAvatarUrl', () => ({
  getAvatarUrl: (p) => p,
}));

vi.mock('./tokenRefresh', () => ({
  refreshAccessToken: async () => null,
}));

const store = {};
globalThis.localStorage = {
  getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
  setItem: (k, v) => {
    store[k] = String(v);
  },
  removeItem: (k) => {
    delete store[k];
  },
  clear: () => {
    Object.keys(store).forEach((k) => delete store[k]);
  },
};

describe('aiAgentService.sendCallAiChat', () => {
  beforeEach(() => {
    post.mockReset();
    localStorage.clear();
  });

  test('posts participants and party_room_id to call-ai endpoint', async () => {
    post.mockResolvedValue({
      data: {
        content: 'Активные: Подготовить отчет',
        scope: { target: 'self' },
        provider: 'deepseek',
        model: 'deepseek-chat',
      },
    });

    const { aiAgentService } = await import('./aiAgentService.js');
    const result = await aiAgentService.sendCallAiChat('мои задачи', {
      partyRoomId: 'room-1',
      participants: [
        { user_id: 7, name: 'test_member' },
        { userId: 8, name: 'Boss' },
      ],
      historyScope: 'call-ai:test',
    });

    expect(post).toHaveBeenCalled();
    const [url, body] = post.mock.calls[0];
    expect(url).toBe('/api/v1/call-ai/chat');
    expect(body.party_room_id).toBe('room-1');
    expect(body.content).toBe('мои задачи');
    expect(body.participants).toEqual([
      { user_id: 7, name: 'test_member' },
      { user_id: 8, name: 'Boss' },
    ]);
    expect(result.agent_message.content).toContain('Подготовить отчет');
  });
});
