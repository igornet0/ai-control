import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  buildVideoConstraints,
  callMediaConstraintAttempts,
  isRecoverableMediaError,
  mediaErrorMessage,
  acquireCallMedia,
} from './callMediaPrefs.js';

describe('call media constraints', () => {
  it('does not request facingMode (breaks Windows Chrome webcams)', () => {
    const video = buildVideoConstraints('');
    expect(video.facingMode).toBeUndefined();
    expect(video.deviceId).toBeUndefined();
  });

  it('tries unconstrained A+V before audio-only', () => {
    const attempts = callMediaConstraintAttempts('', '');
    const videoTrueIdx = attempts.findIndex((c) => c.audio && c.video === true);
    const audioOnlyIdx = attempts.findIndex((c) => c.audio && c.video === false);
    expect(videoTrueIdx).toBeGreaterThanOrEqual(0);
    expect(audioOnlyIdx).toBeGreaterThan(videoTrueIdx);
    expect(attempts[0].video).toEqual({ width: { ideal: 1280 }, height: { ideal: 720 } });
  });

  it('maps NotFoundError to a recoverable device message', () => {
    const err = { name: 'NotFoundError', message: 'Requested device not found' };
    expect(isRecoverableMediaError(err)).toBe(true);
    expect(mediaErrorMessage(err)).toMatch(/не найден/i);
  });
});

describe('acquireCallMedia', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('retries unconstrained video then audio-only after Requested device not found', async () => {
    const audioTrack = { kind: 'audio', getSettings: () => ({ deviceId: 'mic-1' }) };
    const getUserMedia = vi.fn().mockImplementation((constraints) => {
      if (constraints?.video) {
        return Promise.reject(
          Object.assign(new Error('Requested device not found'), { name: 'NotFoundError' }),
        );
      }
      return Promise.resolve({
        getAudioTracks: () => [audioTrack],
        getVideoTracks: () => [],
      });
    });
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
    const stream = await acquireCallMedia({});
    expect(stream.getAudioTracks()).toHaveLength(1);
    expect(getUserMedia.mock.calls.some((c) => c[0].video === true)).toBe(true);
    expect(getUserMedia.mock.calls.some((c) => c[0].video === false)).toBe(true);
  });
});
