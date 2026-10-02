import { useEffect, useState } from 'react';

const SPEAK_THRESHOLD = 0.018;
const SPEAK_HOLD_MS = 220;

/**
 * Detect who is speaking from MediaStreams (local + remotes).
 * @param {MediaStream|null} localStream
 * @param {boolean} localMuted
 * @param {Map<string, MediaStream>} remoteStreams
 * @returns {Set<string>} peer keys: 'local' or remote peer_id
 */
export function useSpeakingDetector(localStream, localMuted, remoteStreams) {
  const [speaking, setSpeaking] = useState(() => new Set());

  useEffect(() => {
    const entries = [];
    if (localStream && !localMuted) {
      entries.push(['local', localStream]);
    }
    for (const [id, stream] of remoteStreams.entries()) {
      entries.push([id, stream]);
    }
    if (entries.length === 0) {
      setSpeaking(new Set());
      return undefined;
    }

    let ctx;
    try {
      ctx = new AudioContext();
    } catch {
      return undefined;
    }

    const analysers = [];
    const lastSpeakAt = new Map();

    for (const [id, stream] of entries) {
      const track = stream.getAudioTracks?.()[0];
      if (!track || track.readyState === 'ended') continue;
      try {
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.4;
        source.connect(analyser);
        analysers.push({ id, analyser, data: new Uint8Array(analyser.fftSize) });
      } catch {
        /* ignore streams without audio */
      }
    }

    if (analysers.length === 0) {
      void ctx.close();
      return undefined;
    }

    let raf = 0;
    const tick = () => {
      const now = performance.now();
      const next = new Set();
      for (const { id, analyser, data } of analysers) {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i += 1) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        if (rms >= SPEAK_THRESHOLD) {
          lastSpeakAt.set(id, now);
        }
        if (now - (lastSpeakAt.get(id) || 0) < SPEAK_HOLD_MS) {
          next.add(id);
        }
      }
      setSpeaking((prev) => {
        if (prev.size === next.size && [...next].every((k) => prev.has(k))) return prev;
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      void ctx.close();
    };
  }, [localStream, localMuted, remoteStreams]);

  return speaking;
}
