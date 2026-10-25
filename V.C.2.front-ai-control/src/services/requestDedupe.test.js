import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dedupeGet, invalidateDedupe } from './requestDedupe';

describe('requestDedupe', () => {
  beforeEach(() => invalidateDedupe());

  it('shares in-flight and recent results', async () => {
    const fetcher = vi.fn(async () => ({ id: 1, items: [1] }));
    const [a, b] = await Promise.all([dedupeGet('k', fetcher), dedupeGet('k', fetcher)]);
    const c = await dedupeGet('k', fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(a).toEqual({ id: 1, items: [1] });
    a.items.push(2);
    expect(b.items).toEqual([1]);
    expect(c.items).toEqual([1]);
  });

  it('refetches after invalidate, ttl expiry, force and error', async () => {
    let n = 0;
    const fetcher = vi.fn(async () => ++n);
    expect(await dedupeGet('dash:1', fetcher)).toBe(1);
    invalidateDedupe('dash:');
    expect(await dedupeGet('dash:1', fetcher)).toBe(2);
    expect(await dedupeGet('dash:1', fetcher, { force: true })).toBe(3);
    expect(await dedupeGet('ttl', fetcher, { ttlMs: 0 })).toBe(4);
    await new Promise((r) => setTimeout(r, 2));
    expect(await dedupeGet('ttl', fetcher, { ttlMs: 0 })).toBe(5);

    const failing = vi.fn().mockRejectedValueOnce(new Error('x')).mockResolvedValue('ok');
    await expect(dedupeGet('e', failing)).rejects.toThrow('x');
    expect(await dedupeGet('e', failing)).toBe('ok');
  });
});
