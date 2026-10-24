/** @vitest-environment node */

import { describe, expect, test, vi, beforeEach } from 'vitest';

const post = vi.fn();
const get = vi.fn();

vi.mock('axios', () => ({ default: { post, get } }));
vi.mock('./apiBaseUrl', () => ({ getApiBaseUrl: () => '' }));

const tokenRefresh = await import('./tokenRefresh');

function installLocks() {
  let tail = Promise.resolve();
  const request = vi.fn((name, opts, fn) => {
    const run = tail.then(() => fn());
    tail = run.catch(() => {});
    return run;
  });
  globalThis.navigator = { locks: { request } };
  return request;
}

beforeEach(() => {
  post.mockReset();
  get.mockReset();
  tokenRefresh.clearAccessToken();
  tokenRefresh.setCsrfToken('csrf-1');
  delete globalThis.navigator;
});

describe('refreshAccessToken', () => {
  test('runs the refresh inside the cross-tab lock', async () => {
    const request = installLocks();
    post.mockResolvedValue({ data: { access_token: 'a1' } });

    await expect(tokenRefresh.refreshAccessToken()).resolves.toBe('a1');
    expect(request).toHaveBeenCalledWith(
      'ai-control-auth-refresh',
      expect.objectContaining({ mode: 'exclusive' }),
      expect.any(Function)
    );
    expect(tokenRefresh.getAccessToken()).toBe('a1');
  });

  test('falls back to an unlocked refresh when the lock is stuck', async () => {
    vi.useFakeTimers();
    try {
      const request = vi.fn(
        (name, opts) =>
          new Promise((_, reject) => {
            opts.signal.addEventListener('abort', () =>
              reject(new DOMException('aborted', 'AbortError'))
            );
          })
      );
      globalThis.navigator = { locks: { request } };
      post.mockResolvedValue({ data: { access_token: 'a4' } });

      const pending = tokenRefresh.refreshAccessToken();
      await vi.advanceTimersByTimeAsync(10000);
      await expect(pending).resolves.toBe('a4');
      expect(post).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  test('works without the Web Locks API', async () => {
    post.mockResolvedValue({ data: { access_token: 'a2' } });
    await expect(tokenRefresh.refreshAccessToken()).resolves.toBe('a2');
  });

  test('retries once with a fresh CSRF token after 403', async () => {
    post
      .mockRejectedValueOnce({ response: { status: 403 } })
      .mockResolvedValueOnce({ data: { access_token: 'a3', csrf_token: 'csrf-3' } });
    get.mockResolvedValue({ data: { csrf_token: 'csrf-2', csrf_enabled: true } });

    await expect(tokenRefresh.refreshAccessToken()).resolves.toBe('a3');
    expect(get).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][2].headers['X-CSRF-Token']).toBe('csrf-1');
    expect(post.mock.calls[1][2].headers['X-CSRF-Token']).toBe('csrf-2');
    expect(tokenRefresh.getCsrfToken()).toBe('csrf-3');
  });

  test('returns null on 401 without retrying', async () => {
    post.mockRejectedValue({ response: { status: 401 } });
    await expect(tokenRefresh.refreshAccessToken()).resolves.toBeNull();
    expect(post).toHaveBeenCalledTimes(1);
    expect(tokenRefresh.getAccessToken()).toBeNull();
  });
});
