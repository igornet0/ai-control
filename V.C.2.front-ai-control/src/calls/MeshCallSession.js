/** Target Opus audio bitrate (bps) for speech. */
const AUDIO_MAX_BITRATE = 48_000;
const ICE_RESTART_COOLDOWN_MS = 4_000;
const MAX_ICE_RESTARTS = 8;
/** Wait for STUN/TURN before restarting. 8s was killing ICE across NATs. */
const PEER_CONNECT_TIMEOUT_MS = 25_000;
const ICE_GIVE_UP_MS = 60_000;
const OFFER_RETRY_MAX = 6;
const FALLBACK_STUN_URLS = [
  'stun:stun.l.google.com:19302',
  'stun:stun1.l.google.com:19302',
  'stun:stun.cloudflare.com:3478',
];

const inboundTrackListenersWired = new WeakSet();

function normalizeIceServers(fromWelcome) {
  const ice = [];
  for (const raw of fromWelcome) {
    const urls = raw.urls
      .map((u) => String(u).trim())
      .filter((u) => /^(stun|stuns|turn|turns):/i.test(u));
    if (urls.length === 0) continue;
    const entry = { urls };
    const u = raw.username?.trim();
    const c = raw.credential?.trim();
    if (u && c) {
      entry.username = u;
      entry.credential = c;
    }
    ice.push(entry);
  }
  if (ice.length === 0) {
    ice.push({ urls: [...FALLBACK_STUN_URLS] });
    return ice;
  }
  const have = new Set(
    ice.flatMap((s) => (Array.isArray(s.urls) ? s.urls : [s.urls])).map((u) => String(u).toLowerCase()),
  );
  const extra = FALLBACK_STUN_URLS.filter((u) => !have.has(u.toLowerCase()));
  if (extra.length) ice.unshift({ urls: extra });
  return ice;
}

function buildIceServers(fromWelcome) {
  return {
    iceServers: normalizeIceServers(fromWelcome),
    iceCandidatePoolSize: 4,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
  };
}

function isOfferer(selfId, remoteId) {
  return String(selfId) < String(remoteId);
}

function iceStillWorking(pc) {
  const ice = pc.iceConnectionState;
  const conn = pc.connectionState;
  if (ice === 'failed' || conn === 'failed') return false;
  return (
    conn === 'connecting' ||
    ice === 'checking' ||
    ice === 'new' ||
    (pc.iceGatheringState === 'gathering' && ice !== 'disconnected')
  );
}

function iceServersHaveTurn(iceServers) {
  return (iceServers || []).some((s) => {
    const urls = Array.isArray(s.urls) ? s.urls : [s.urls];
    return urls.some((u) => /^turns?:/i.test(String(u || '')));
  });
}

export { isOfferer, iceStillWorking, iceServersHaveTurn };

function preferOpus(pc) {
  try {
    const caps = RTCRtpSender.getCapabilities?.('audio');
    if (!caps?.codecs?.length) return;
    const opus = caps.codecs.filter((c) => /opus/i.test(c.mimeType));
    const rest = caps.codecs.filter((c) => !/opus/i.test(c.mimeType));
    if (opus.length === 0) return;
    for (const tr of pc.getTransceivers()) {
      if (tr.sender.track?.kind === 'audio' || tr.receiver.track?.kind === 'audio') {
        tr.setCodecPreferences?.([...opus, ...rest]);
      }
    }
  } catch {
    /* ignore */
  }
}

async function applyAudioSenderParams(pc) {
  for (const sender of pc.getSenders()) {
    if (sender.track?.kind !== 'audio') continue;
    try {
      const params = sender.getParameters();
      if (!params.encodings?.length) {
        params.encodings = [{}];
      }
      for (const enc of params.encodings) {
        enc.maxBitrate = AUDIO_MAX_BITRATE;
      }
      const anyEnc = params.encodings[0];
      if (anyEnc) anyEnc.dtx = true;
      await sender.setParameters(params);
    } catch {
      /* ignore */
    }
  }
}

export class MeshCallSession {
  constructor(selfId, iceServers, send, hooks = {}) {
    this.selfId = selfId;
    this.send = send;
    this.onPeerState = hooks.onPeerState || null;
    this.onError = hooks.onError || null;
    this.config = buildIceServers(iceServers);
    this.hasTurn = iceServersHaveTurn(this.config.iceServers);
    this.pcs = new Map();
    this.iceQueues = new Map();
    this.remoteCbs = new Map();
    this.iceRestartCounts = new Map();
    this.iceRestartAt = new Map();
    this.offerRetryCounts = new Map();
    this.connectTimers = new Map();
    this.peerStartedAt = new Map();
    this.relayForced = new Set();
    this.localStream = null;
    this.outboundVideoOverride = null;
  }

  emitPeerState(remoteId) {
    this.onPeerState?.(remoteId, this.getPeerState(remoteId));
  }

  getPeerState(remoteId) {
    const pc = this.pcs.get(remoteId);
    if (!pc) return null;
    return {
      connection: pc.connectionState,
      ice: pc.iceConnectionState,
      signaling: pc.signalingState,
    };
  }

  getAllPeerStates() {
    const out = {};
    for (const id of this.pcs.keys()) {
      out[id] = this.getPeerState(id);
    }
    return out;
  }

  clearConnectTimer(remoteId) {
    const t = this.connectTimers.get(remoteId);
    if (t) window.clearTimeout(t);
    this.connectTimers.delete(remoteId);
  }

  scheduleConnectWatchdog(remoteId) {
    this.clearConnectTimer(remoteId);
    this.connectTimers.set(
      remoteId,
      window.setTimeout(() => {
        const pc = this.pcs.get(remoteId);
        if (!pc || pc.connectionState === 'connected' || pc.connectionState === 'closed') {
          return;
        }
        const started = this.peerStartedAt.get(remoteId) ?? Date.now();
        if (Date.now() - started > ICE_GIVE_UP_MS) {
          this.onError?.(
            `Не удалось установить медиа с участником (${String(remoteId).slice(0, 8)})`,
          );
          return;
        }
        if (iceStillWorking(pc)) {
          this.scheduleConnectWatchdog(remoteId);
          return;
        }
        void this.retryNegotiate(remoteId);
      }, PEER_CONNECT_TIMEOUT_MS),
    );
  }

  setLocalStream(stream) {
    this.localStream = stream;
    for (const pc of this.pcs.values()) {
      this.replaceSenders(pc, stream);
      void applyAudioSenderParams(pc);
      preferOpus(pc);
    }
  }

  replaceSenders(pc, stream) {
    for (const s of [...pc.getSenders()]) {
      if (s.track && (s.track.kind === 'audio' || s.track.kind === 'video')) {
        pc.removeTrack(s);
      }
    }
    this.addLocalMedia(pc, stream);
  }

  addLocalMedia(pc, stream) {
    let audio = false;
    let video = false;
    if (stream) {
      for (const t of stream.getAudioTracks()) {
        pc.addTrack(t, stream);
        audio = true;
      }
      const videoTrack = this.outboundVideoOverride ?? stream.getVideoTracks()[0];
      if (videoTrack) {
        pc.addTrack(videoTrack, new MediaStream([videoTrack]));
        video = true;
      }
    }
    const kinds = new Set(
      pc.getTransceivers().map((tr) => tr.receiver?.track?.kind || tr.sender?.track?.kind),
    );
    if (!audio && !kinds.has('audio')) {
      pc.addTransceiver('audio', { direction: 'recvonly' });
    }
    if (!video && !kinds.has('video')) {
      pc.addTransceiver('video', { direction: 'recvonly' });
    }
  }

  dispose() {
    for (const t of this.connectTimers.values()) {
      window.clearTimeout(t);
    }
    this.connectTimers.clear();
    for (const pc of this.pcs.values()) {
      pc.close();
    }
    this.pcs.clear();
    this.iceQueues.clear();
    this.remoteCbs.clear();
    this.iceRestartCounts.clear();
    this.iceRestartAt.clear();
    this.offerRetryCounts.clear();
    this.peerStartedAt.clear();
    this.relayForced.clear();
    this.outboundVideoOverride = null;
  }

  peerConnectionConfig(remoteId) {
    if (this.relayForced.has(remoteId)) {
      return { ...this.config, iceTransportPolicy: 'relay' };
    }
    return this.config;
  }

  getOrCreatePc(remoteId, onRemoteStream) {
    let pc = this.pcs.get(remoteId);
    if (pc) {
      this.remoteCbs.set(remoteId, onRemoteStream);
      return pc;
    }

    pc = new RTCPeerConnection(this.peerConnectionConfig(remoteId));
    this.pcs.set(remoteId, pc);
    if (!this.iceQueues.has(remoteId)) {
      this.iceQueues.set(remoteId, []);
    }
    this.remoteCbs.set(remoteId, onRemoteStream);

    pc.ontrack = (ev) => {
      const [stream] = ev.streams;
      if (stream?.getTracks().length) {
        onRemoteStream(remoteId, stream);
        for (const t of stream.getTracks()) {
          this.attachInboundTrackListeners(t, pc, remoteId, onRemoteStream);
        }
      } else {
        this.pushInboundMedia(pc, remoteId, onRemoteStream);
      }
      if (ev.track) {
        this.attachInboundTrackListeners(ev.track, pc, remoteId, onRemoteStream);
      }
    };

    pc.onicecandidate = (ev) => {
      if (!ev.candidate) return;
      this.send({
        type: 'ice',
        target: remoteId,
        candidate: {
          candidate: ev.candidate.candidate,
          sdpMid: ev.candidate.sdpMid,
          sdpMLineIndex: ev.candidate.sdpMLineIndex,
        },
      });
    };

    const onConn = () => {
      this.emitPeerState(remoteId);
      if (pc.connectionState === 'connected' || pc.iceConnectionState === 'connected') {
        this.iceRestartCounts.set(remoteId, 0);
        this.offerRetryCounts.set(remoteId, 0);
        this.clearConnectTimer(remoteId);
        this.schedulePushInbound(pc, remoteId, onRemoteStream);
      } else if (pc.connectionState === 'failed') {
        void this.maybeIceRestart(remoteId, pc);
        this.scheduleConnectWatchdog(remoteId);
      } else if (pc.connectionState === 'disconnected') {
        this.scheduleConnectWatchdog(remoteId);
      }
    };
    pc.addEventListener('connectionstatechange', onConn);
    pc.addEventListener('iceconnectionstatechange', onConn);

    this.addLocalMedia(pc, this.localStream);

    preferOpus(pc);
    void applyAudioSenderParams(pc);

    return pc;
  }

  async maybeIceRestart(remoteId, pc) {
    if (pc.connectionState === 'closed' || pc.connectionState === 'connected') return;
    if (pc.connectionState !== 'failed') return;

    if (this.hasTurn && !this.relayForced.has(remoteId)) {
      await this.switchToRelay(remoteId);
      return;
    }

    if (!isOfferer(this.selfId, remoteId)) return;

    const now = Date.now();
    const last = this.iceRestartAt.get(remoteId) ?? 0;
    if (now - last < ICE_RESTART_COOLDOWN_MS) return;

    const count = this.iceRestartCounts.get(remoteId) ?? 0;
    if (count >= MAX_ICE_RESTARTS) {
      this.onError?.(
        `Медиа с участником не восстановилось (${String(remoteId).slice(0, 8)})`,
      );
      return;
    }

    this.iceRestartAt.set(remoteId, now);
    this.iceRestartCounts.set(remoteId, count + 1);

    try {
      await this.waitSignalingStable(pc, 5000);
      if (pc.signalingState !== 'stable') return;
      if (pc.connectionState === 'connected') return;
      const offer = await pc.createOffer({ iceRestart: true });
      await pc.setLocalDescription(offer);
      this.sendSdpOffer(remoteId, pc);
    } catch (e) {
      console.error('ICE restart failed', remoteId, e);
      this.onError?.(e?.message || 'ICE restart failed');
    }
  }

  async switchToRelay(remoteId) {
    if (!this.hasTurn || this.relayForced.has(remoteId)) return;
    this.relayForced.add(remoteId);
    const onRemote = this.remoteCbs.get(remoteId);
    const old = this.pcs.get(remoteId);
    try {
      old?.close();
    } catch {
      /* ignore */
    }
    this.pcs.delete(remoteId);
    this.iceQueues.set(remoteId, []);
    this.clearConnectTimer(remoteId);
    if (!onRemote) return;
    const pc = this.getOrCreatePc(remoteId, onRemote);
    this.peerStartedAt.set(remoteId, Date.now());
    if (isOfferer(this.selfId, remoteId)) {
      try {
        await this.runOffer(remoteId, pc);
      } catch (e) {
        this.onError?.(e?.message || 'TURN relay offer failed');
      }
    }
    this.scheduleConnectWatchdog(remoteId);
  }

  async retryNegotiate(remoteId) {
    const pc = this.pcs.get(remoteId);
    if (!pc || pc.connectionState === 'connected' || pc.connectionState === 'closed') {
      return;
    }
    if (iceStillWorking(pc)) {
      this.scheduleConnectWatchdog(remoteId);
      return;
    }
    if (!isOfferer(this.selfId, remoteId)) {
      this.scheduleConnectWatchdog(remoteId);
      return;
    }
    const n = (this.offerRetryCounts.get(remoteId) ?? 0) + 1;
    if (n > OFFER_RETRY_MAX) {
      this.onError?.(
        `Не удалось установить медиа с участником (${String(remoteId).slice(0, 8)})`,
      );
      return;
    }
    this.offerRetryCounts.set(remoteId, n);
    if (this.hasTurn && !this.relayForced.has(remoteId) && n >= 2) {
      await this.switchToRelay(remoteId);
      return;
    }
    try {
      await this.waitSignalingStable(pc, 4000);
      if (pc.connectionState === 'connected' || pc.connectionState === 'closed') return;
      if (pc.signalingState !== 'stable') {
        this.scheduleConnectWatchdog(remoteId);
        return;
      }
      const offer = await pc.createOffer({ iceRestart: n > 1 });
      await pc.setLocalDescription(offer);
      this.sendSdpOffer(remoteId, pc);
    } catch (e) {
      console.error('offer retry failed', remoteId, e);
    }
    this.scheduleConnectWatchdog(remoteId);
  }

  pushInboundMedia(pc, remoteId, onRemoteStream) {
    const ms = new MediaStream();
    for (const r of pc.getReceivers()) {
      const t = r.track;
      if (t && (t.kind === 'audio' || t.kind === 'video')) {
        ms.addTrack(t);
      }
    }
    if (ms.getTracks().length === 0) return;
    onRemoteStream(remoteId, ms);
  }

  attachInboundTrackListeners(track, pc, remoteId, onRemoteStream) {
    if (inboundTrackListenersWired.has(track)) return;
    inboundTrackListenersWired.add(track);
    const push = () => this.pushInboundMedia(pc, remoteId, onRemoteStream);
    track.addEventListener('unmute', push);
    track.addEventListener('mute', push);
    track.addEventListener('ended', push);
  }

  schedulePushInbound(pc, remoteId, onRemoteStream) {
    queueMicrotask(() => this.pushInboundMedia(pc, remoteId, onRemoteStream));
  }

  async ensurePeer(remoteId, onRemoteStream) {
    if (remoteId === this.selfId) return;
    const existed = this.pcs.has(remoteId);
    if (!this.peerStartedAt.has(remoteId)) {
      this.peerStartedAt.set(remoteId, Date.now());
    }
    this.getOrCreatePc(remoteId, onRemoteStream);
    if (!existed && isOfferer(this.selfId, remoteId)) {
      const peerPc = this.pcs.get(remoteId);
      await this.runOffer(remoteId, peerPc);
    }
    this.scheduleConnectWatchdog(remoteId);
  }

  removePeer(remoteId) {
    const pc = this.pcs.get(remoteId);
    if (pc) {
      pc.close();
      this.pcs.delete(remoteId);
    }
    this.iceQueues.delete(remoteId);
    this.remoteCbs.delete(remoteId);
    this.iceRestartCounts.delete(remoteId);
    this.iceRestartAt.delete(remoteId);
    this.offerRetryCounts.delete(remoteId);
    this.peerStartedAt.delete(remoteId);
    this.relayForced.delete(remoteId);
    this.clearConnectTimer(remoteId);
  }

  async handleSignal(msg, onRemoteStream) {
    if (msg.type === 'sdp') {
      await this.handleSdp(msg, onRemoteStream);
    } else if (msg.type === 'ice') {
      await this.handleIce(msg);
    }
  }

  async flushIce(remoteId, pc) {
    const q = this.iceQueues.get(remoteId);
    if (!q?.length) return;
    for (const c of q) {
      try {
        await pc.addIceCandidate(c);
      } catch {
        /* ignore */
      }
    }
    this.iceQueues.set(remoteId, []);
  }

  async handleIce(msg) {
    const remoteId = msg.from;
    const pc = this.pcs.get(remoteId);
    const init = {
      candidate: msg.candidate.candidate,
      sdpMid: msg.candidate.sdpMid ?? undefined,
      sdpMLineIndex: msg.candidate.sdpMLineIndex ?? undefined,
    };
    if (!pc || !pc.remoteDescription) {
      const q = this.iceQueues.get(remoteId) ?? [];
      q.push(init);
      this.iceQueues.set(remoteId, q);
      return;
    }
    try {
      await pc.addIceCandidate(init);
    } catch {
      /* ignore */
    }
  }

  async handleSdp(msg, onRemoteStream) {
    const remoteId = msg.from;
    if (!this.peerStartedAt.has(remoteId)) {
      this.peerStartedAt.set(remoteId, Date.now());
    }
    const pc = this.getOrCreatePc(remoteId, onRemoteStream);
    const sdpType = msg.sdp_type === 'offer' ? 'offer' : 'answer';
    const polite = !isOfferer(this.selfId, remoteId);

    try {
      if (sdpType === 'offer') {
        const colliding = pc.signalingState !== 'stable';
        if (colliding) {
          if (!polite) {
            return;
          }
          try {
            await pc.setLocalDescription({ type: 'rollback' });
          } catch {
            this.onError?.('Конфликт SDP — браузер не поддерживает rollback');
            return;
          }
        }
        await pc.setRemoteDescription({ type: 'offer', sdp: msg.sdp });
        await this.flushIce(remoteId, pc);
        preferOpus(pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.send({
          type: 'sdp',
          target: remoteId,
          sdp: pc.localDescription?.sdp ?? answer.sdp ?? '',
          sdp_type: 'answer',
        });
        void applyAudioSenderParams(pc);
        this.schedulePushInbound(pc, remoteId, onRemoteStream);
      } else {
        await pc.setRemoteDescription({ type: 'answer', sdp: msg.sdp });
        await this.flushIce(remoteId, pc);
        this.schedulePushInbound(pc, remoteId, onRemoteStream);
      }
    } catch (e) {
      console.error('setRemoteDescription failed', remoteId, e);
      this.onError?.(e?.message || 'Не удалось применить SDP');
      return;
    }
    if (pc.connectionState !== 'connected') {
      this.scheduleConnectWatchdog(remoteId);
    }
  }

  async runOffer(remoteId, pc) {
    preferOpus(pc);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this.sendSdpOffer(remoteId, pc);
    void applyAudioSenderParams(pc);
  }

  async renegotiate(remoteId, pc) {
    if (!isOfferer(this.selfId, remoteId)) return;
    await this.waitSignalingStable(pc);
    if (pc.signalingState !== 'stable') return;
    try {
      preferOpus(pc);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.sendSdpOffer(remoteId, pc);
      void applyAudioSenderParams(pc);
      await this.waitSignalingStable(pc);
    } catch (e) {
      console.error('renegotiate failed', remoteId, e);
    }
  }

  waitSignalingStable(pc, timeoutMs = 20000) {
    if (pc.signalingState === 'stable') return Promise.resolve();
    return new Promise((resolve) => {
      const t = window.setTimeout(() => resolve(), timeoutMs);
      const fn = () => {
        if (pc.signalingState === 'stable' || pc.connectionState === 'closed') {
          window.clearTimeout(t);
          pc.removeEventListener('signalingstatechange', fn);
          resolve();
        }
      };
      pc.addEventListener('signalingstatechange', fn);
      fn();
    });
  }

  sendSdpOffer(remoteId, pc) {
    const sdp = pc.localDescription?.sdp;
    if (!sdp) return;
    this.send({
      type: 'sdp',
      target: remoteId,
      sdp,
      sdp_type: 'offer',
    });
  }

  async replaceVideoTrack(track, isScreenShare = false) {
    this.outboundVideoOverride = isScreenShare && track ? track : null;

    for (const [remoteId, pc] of this.pcs.entries()) {
      let sender = pc.getSenders().find((s) => s.track?.kind === 'video');
      if (!sender) {
        const tr = pc.getTransceivers().find((t) => t.sender?.track?.kind === 'video');
        sender = tr?.sender;
      }
      if (!sender) {
        if (track) {
          const ms = new MediaStream([track]);
          pc.addTrack(track, ms);
          await this.renegotiate(remoteId, pc);
        }
        continue;
      }
      await sender.replaceTrack(track);
    }
  }

  async replaceAudioTrack(track) {
    for (const [remoteId, pc] of this.pcs.entries()) {
      let sender = pc.getSenders().find((s) => s.track?.kind === 'audio');
      if (!sender) {
        const tr = pc.getTransceivers().find((t) => t.sender?.track?.kind === 'audio');
        sender = tr?.sender;
      }
      if (!sender) {
        if (track) {
          const ms = new MediaStream([track]);
          pc.addTrack(track, ms);
          await this.renegotiate(remoteId, pc);
        }
        continue;
      }
      await sender.replaceTrack(track);
    }
  }
}
