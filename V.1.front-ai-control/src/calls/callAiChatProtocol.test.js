import { describe, expect, test } from 'vitest';
import {
  applyAiLockEvent,
  canTypeWithAiLock,
  encodeAiChatPayload,
  encodeAiLockEvent,
  parseAiChatPayload,
  parseAiLockEvent,
} from './callAiChatProtocol.js';

describe('callAiChatProtocol payloads', () => {
  test('roundtrips ai chat envelope', () => {
    const raw = encodeAiChatPayload({
      kind: 'ai_user',
      text: 'Привет',
      authorName: 'Игорь',
      authorPeerId: 'p1',
      id: 'm1',
      ts: 100,
    });
    const parsed = parseAiChatPayload(raw);
    expect(parsed).toMatchObject({
      kind: 'ai_user',
      text: 'Привет',
      authorName: 'Игорь',
      authorPeerId: 'p1',
      id: 'm1',
    });
  });

  test('rejects plain text chat', () => {
    expect(parseAiChatPayload('hello')).toBeNull();
  });
});

describe('callAiChatProtocol lock', () => {
  test('encode/parse acquire release heartbeat', () => {
    const acq = encodeAiLockEvent('acquire', 'n1', 'Anna|Boss');
    expect(parseAiLockEvent(acq)).toEqual({
      action: 'acquire',
      nonce: 'n1',
      displayName: 'Anna Boss',
    });
    expect(parseAiLockEvent(encodeAiLockEvent('release', 'n1'))).toEqual({
      action: 'release',
      nonce: 'n1',
      displayName: '',
    });
    expect(parseAiLockEvent(encodeAiLockEvent('heartbeat', 'n1'))).toEqual({
      action: 'heartbeat',
      nonce: 'n1',
      displayName: '',
    });
  });

  test('apply acquire overwrites and release clears', () => {
    const now = 1_000_000;
    let lock = applyAiLockEvent(null, parseAiLockEvent(encodeAiLockEvent('acquire', 'a', 'A')), 'pA', now);
    expect(lock.peerId).toBe('pA');
    expect(canTypeWithAiLock(lock, 'pA', now)).toBe(true);
    expect(canTypeWithAiLock(lock, 'pB', now)).toBe(false);

    lock = applyAiLockEvent(lock, parseAiLockEvent(encodeAiLockEvent('acquire', 'b', 'B')), 'pB', now + 10);
    expect(lock.peerId).toBe('pB');
    expect(lock.name).toBe('B');

    lock = applyAiLockEvent(lock, parseAiLockEvent(encodeAiLockEvent('release', 'b')), 'pB', now + 20);
    expect(lock).toBeNull();
    expect(canTypeWithAiLock(null, 'pA', now)).toBe(true);
  });

  test('heartbeat extends ttl', () => {
    const now = 1_000_000;
    let lock = applyAiLockEvent(null, parseAiLockEvent(encodeAiLockEvent('acquire', 'n', 'A')), 'p1', now, 1000);
    const before = lock.expiresAt;
    lock = applyAiLockEvent(lock, parseAiLockEvent(encodeAiLockEvent('heartbeat', 'n')), 'p1', now + 100, 1000);
    expect(lock.expiresAt).toBe(now + 100 + 1000);
    expect(lock.expiresAt).toBeGreaterThan(before);
  });
});
