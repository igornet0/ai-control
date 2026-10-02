import { describe, expect, it } from 'vitest';
import { iceServersHaveTurn, iceStillWorking, isOfferer } from './MeshCallSession.js';

describe('mesh glare / ICE helpers', () => {
  it('picks a single offerer by peer id', () => {
    const a = '11111111-1111-1111-1111-111111111111';
    const b = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
    expect(isOfferer(a, b)).toBe(true);
    expect(isOfferer(b, a)).toBe(false);
    expect(isOfferer(a, b)).not.toBe(isOfferer(b, a));
  });

  it('treats checking/gathering as in-progress ICE', () => {
    expect(
      iceStillWorking({
        connectionState: 'connecting',
        iceConnectionState: 'checking',
        iceGatheringState: 'gathering',
      }),
    ).toBe(true);
    expect(
      iceStillWorking({
        connectionState: 'failed',
        iceConnectionState: 'failed',
        iceGatheringState: 'complete',
      }),
    ).toBe(false);
    expect(
      iceStillWorking({
        connectionState: 'disconnected',
        iceConnectionState: 'disconnected',
        iceGatheringState: 'gathering',
      }),
    ).toBe(false);
  });

  it('detects TURN in welcome iceServers', () => {
    expect(iceServersHaveTurn([{ urls: ['stun:stun.l.google.com:19302'] }])).toBe(false);
    expect(
      iceServersHaveTurn([
        { urls: ['stun:stun.l.google.com:19302'] },
        { urls: ['turn:example.com:3478?transport=udp'], username: 'u', credential: 'p' },
      ]),
    ).toBe(true);
  });
});
