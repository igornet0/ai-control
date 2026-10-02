import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { MeshCallSession } from '../calls/MeshCallSession';
import { SfuCallSession } from '../calls/SfuCallSession';
import { CALL_HANDOFF_CHANNEL, clearCallHandoff, writeCallHandoff, parseCallDisplayName, isSameCallUser } from '../calls/callDisplayName';
import { LocalAudioProcessor } from '../calls/LocalAudioProcessor';
import {
  buildAudioConstraints,
  buildVideoConstraints,
  listCallMediaDevices,
  loadCallMediaPrefs,
  saveCallMediaPref,
  acquireCallMedia,
  mediaErrorMessage,
  isRecoverableMediaError,
} from '../calls/callMediaPrefs';
import { stopCallRingtone } from '../services/callRingtone';
import { alertsTabCoordinator } from '../services/alertsTabCoordinator';
import { getPartyhomeToken, getPartyhomeWsUrl } from '../services/partyhomeBaseUrl';
import {
  getScreenCaptureStream,
  settleAfterDisplayCapture,
  isApplePlatform,
  macScreenCaptureHelp,
} from '../calls/displayCapture';
import {
  AI_LOCK_HEARTBEAT_MS,
  AI_LOCK_TTL_MS,
  applyAiLockEvent,
  canTypeWithAiLock,
  encodeAiChatPayload,
  encodeAiLockEvent,
  newAiLockNonce,
  parseAiChatPayload,
  parseAiLockEvent,
} from '../calls/callAiChatProtocol';

const CallSessionContext = createContext(null);

const WS_PING_INTERVAL_MS = 25_000;
const WS_PONG_STALE_MS = 50_000;
const SIGNALING_RECONNECT_BASE_MS = 500;
const SIGNALING_RECONNECT_MAX_MS = 8_000;
const JOIN_WELCOME_TIMEOUT_MS = 15_000;
const MESH_PEER_WARN_THRESHOLD = 4;
/** After the last remote peer leaves, wait for reconnect of the same user. */
const EMPTY_ROOM_HANGUP_MS = 9_000;
/** During pop-out, remotes briefly see a gap if leave wins the race — keep a longer grace. */
const HANDOFF_EMPTY_ROOM_HANGUP_MS = 10_000;
const RING_TIMEOUT_MS = 45_000;
const SFU_CONNECT_ATTEMPTS = 3;

async function connectSfuWithRetry(sfu, url, token, localMedia, onRemote) {
  let lastErr;
  for (let i = 0; i < SFU_CONNECT_ATTEMPTS; i += 1) {
    try {
      await sfu.connect(url, token, localMedia, onRemote);
      return;
    } catch (e) {
      lastErr = e;
      await new Promise((r) => window.setTimeout(r, 400 * (i + 1)));
    }
  }
  throw lastErr || new Error('SFU connect failed');
}

function parseServerMessage(raw) {
  try {
    const o = JSON.parse(raw);
    if (!o?.type) return null;
    return o;
  } catch {
    return null;
  }
}

export function useCallSession() {
  const ctx = useContext(CallSessionContext);
  if (!ctx) {
    throw new Error('useCallSession must be used within CallSessionProvider');
  }
  return ctx;
}

export function useCallSessionOptional() {
  return useContext(CallSessionContext);
}

export function CallSessionProvider({ children }) {
  const [status, setStatus] = useState('idle'); // idle | connecting | active | error
  const [error, setError] = useState(null);
  const [partyRoomId, setPartyRoomId] = useState(null);
  const [chatRoomId, setChatRoomId] = useState(null);
  const [mediaMode, setMediaMode] = useState('mesh');
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const screenStreamRef = useRef(null);
  const [peerNames, setPeerNames] = useState(() => new Map());
  const [remoteStreams, setRemoteStreams] = useState(() => new Map());
  const [localStream, setLocalStream] = useState(null);
  const [meshPeerWarning, setMeshPeerWarning] = useState(false);
  const [peerStates, setPeerStates] = useState(() => new Map());
  const [expectedMembers, setExpectedMembers] = useState([]);
  const [selfUserId, setSelfUserId] = useState(null);
  const [selfDisplayName, setSelfDisplayName] = useState('');
  /** fullscreen | docked | minimized */
  const [layoutMode, setLayoutMode] = useState('fullscreen');
  const initialPrefs = loadCallMediaPrefs();
  const [audioInputId, setAudioInputIdState] = useState(initialPrefs.audioInputId);
  const [videoInputId, setVideoInputIdState] = useState(initialPrefs.videoInputId);
  const [audioOutputId, setAudioOutputIdState] = useState(initialPrefs.audioOutputId);
  const [micGain, setMicGainState] = useState(initialPrefs.micGain);
  const [outputVolume, setOutputVolumeState] = useState(initialPrefs.outputVolume);
  const [mediaDevices, setMediaDevices] = useState({
    audioInputs: [],
    videoInputs: [],
    audioOutputs: [],
  });
  /** @type {[Array<{id:string,kind:string,text:string,authorName:string,authorPeerId:string|null,ts:number,fromPeerId?:string}>, Function]} */
  const [aiChatMessages, setAiChatMessages] = useState([]);
  /** @type {[null|{ peerId: string, name: string, nonce: string, expiresAt: number }, Function]} */
  const [aiInputLock, setAiInputLock] = useState(null);
  const [selfPeerId, setSelfPeerId] = useState(null);

  const wsRef = useRef(null);
  const sessionRef = useRef(null);
  const localStreamRef = useRef(null);
  const signalChain = useRef(Promise.resolve());
  const pingTimerRef = useRef(null);
  const selfPeerIdRef = useRef(null);
  const hadRemotePeersRef = useRef(false);
  const emptyRoomTimerRef = useRef(null);
  const leaveRef = useRef(null);
  const skipEmptyHangupRef = useRef(false);
  const handoffGraceRef = useRef(false);
  const migratingOutRef = useRef(false);
  const peerNamesRef = useRef(new Map());
  const joinWaitersRef = useRef([]);
  const selfDisplayNameRef = useRef('');
  const rawStreamRef = useRef(null);
  const audioProcessorRef = useRef(new LocalAudioProcessor());
  const mutedRef = useRef(false);
  const camOffRef = useRef(false);
  const micGainRef = useRef(initialPrefs.micGain);
  const audioInputIdRef = useRef(initialPrefs.audioInputId);
  const videoInputIdRef = useRef(initialPrefs.videoInputId);
  const intentionalLeaveRef = useRef(false);
  const reconnectTimerRef = useRef(null);
  const reconnectAttemptRef = useRef(0);
  const outboxRef = useRef([]);
  const lastPongRef = useRef(Date.now());
  const callJoinArgsRef = useRef(null);
  const welcomeTimerRef = useRef(null);
  const bindCallSocketRef = useRef(null);
  const reconnectSignalingRef = useRef(null);
  const deviceWarningRef = useRef(null);
  const signalingJoinedRef = useRef(false);
  const ringTimerRef = useRef(null);
  const aiInputLockRef = useRef(null);
  const aiLockNonceRef = useRef(null);
  const aiLockHeartbeatRef = useRef(null);

  const clearRingTimer = useCallback(() => {
    if (ringTimerRef.current != null) {
      window.clearTimeout(ringTimerRef.current);
      ringTimerRef.current = null;
    }
  }, []);

  const clearEmptyRoomTimer = useCallback(() => {
    if (emptyRoomTimerRef.current != null) {
      window.clearTimeout(emptyRoomTimerRef.current);
      emptyRoomTimerRef.current = null;
    }
  }, []);

  const settleJoinWaiters = useCallback((err = null) => {
    const waiters = joinWaitersRef.current;
    joinWaitersRef.current = [];
    for (const w of waiters) {
      if (err) w.reject(err);
      else w.resolve();
    }
  }, []);

  const scheduleHangupIfEmpty = useCallback(() => {
    clearEmptyRoomTimer();
    if (!hadRemotePeersRef.current || skipEmptyHangupRef.current) return;
    const delay = handoffGraceRef.current ? HANDOFF_EMPTY_ROOM_HANGUP_MS : EMPTY_ROOM_HANGUP_MS;
    emptyRoomTimerRef.current = window.setTimeout(() => {
      emptyRoomTimerRef.current = null;
      handoffGraceRef.current = false;
      leaveRef.current?.();
    }, delay);
  }, [clearEmptyRoomTimer]);

  const scheduleRingTimeout = useCallback(() => {
    clearRingTimer();
    ringTimerRef.current = window.setTimeout(() => {
      ringTimerRef.current = null;
      setError('Никто не ответил');
      leaveRef.current?.();
    }, RING_TIMEOUT_MS);
  }, [clearRingTimer]);

  const enqueueSignal = useCallback((fn) => {
    signalChain.current = signalChain.current.then(fn).catch((e) => {
      console.error('[call] signal', e);
    });
  }, []);

  const onRemoteStream = useCallback((id, stream) => {
    setRemoteStreams((prev) => {
      const next = new Map(prev);
      if (!stream || stream.getTracks().length === 0) {
        next.delete(id);
      } else {
        next.set(id, stream);
      }
      return next;
    });
  }, []);

  const setPeerNamesBoth = useCallback((updater) => {
    setPeerNames((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      peerNamesRef.current = next;
      return next;
    });
  }, []);

  const send = useCallback((msg) => {
    const ws = wsRef.current;
    const canSendNow =
      ws &&
      ws.readyState === WebSocket.OPEN &&
      (signalingJoinedRef.current ||
        msg?.type === 'join' ||
        msg?.type === 'ping' ||
        msg?.type === 'leave');
    if (canSendNow) {
      try {
        ws.send(JSON.stringify(msg));
      } catch {
        /* ignore */
      }
      return;
    }
    if (!msg || msg.type === 'leave' || msg.type === 'ping' || msg.type === 'join') return;
    outboxRef.current.push(msg);
  }, []);

  const flushOutbox = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const queued = outboxRef.current.splice(0, outboxRef.current.length);
    for (const msg of queued) {
      try {
        ws.send(JSON.stringify(msg));
      } catch {
        /* ignore */
      }
    }
  }, []);

  const stopAiLockHeartbeat = useCallback(() => {
    if (aiLockHeartbeatRef.current != null) {
      window.clearInterval(aiLockHeartbeatRef.current);
      aiLockHeartbeatRef.current = null;
    }
  }, []);

  const setAiInputLockBoth = useCallback((next) => {
    aiInputLockRef.current = next;
    setAiInputLock(next);
  }, []);

  const clearAiChatState = useCallback(() => {
    stopAiLockHeartbeat();
    aiLockNonceRef.current = null;
    setAiInputLockBoth(null);
    setAiChatMessages([]);
  }, [setAiInputLockBoth, stopAiLockHeartbeat]);

  const startAiLockHeartbeat = useCallback(() => {
    stopAiLockHeartbeat();
    aiLockHeartbeatRef.current = window.setInterval(() => {
      const nonce = aiLockNonceRef.current;
      const lock = aiInputLockRef.current;
      const selfId = selfPeerIdRef.current;
      if (!nonce || !lock || String(lock.peerId) !== String(selfId)) {
        stopAiLockHeartbeat();
        return;
      }
      const now = Date.now();
      setAiInputLockBoth({ ...lock, expiresAt: now + AI_LOCK_TTL_MS });
      send({ type: 'call_event', event: encodeAiLockEvent('heartbeat', nonce) });
    }, AI_LOCK_HEARTBEAT_MS);
  }, [send, setAiInputLockBoth, stopAiLockHeartbeat]);

  const acquireAiInputLock = useCallback(() => {
    const selfId = selfPeerIdRef.current;
    if (!selfId) return { ok: false, reason: 'not_joined' };
    const now = Date.now();
    const lock = aiInputLockRef.current;
    if (lock && lock.expiresAt > now && String(lock.peerId) !== String(selfId)) {
      return { ok: false, reason: 'busy', lock };
    }
    if (lock && String(lock.peerId) === String(selfId) && lock.expiresAt > now) {
      setAiInputLockBoth({ ...lock, expiresAt: now + AI_LOCK_TTL_MS });
      startAiLockHeartbeat();
      return { ok: true, lock: aiInputLockRef.current };
    }
    const nonce = newAiLockNonce();
    const name =
      parseCallDisplayName(selfDisplayNameRef.current).name
      || selfDisplayNameRef.current
      || 'Участник';
    const next = {
      peerId: String(selfId),
      name,
      nonce,
      expiresAt: now + AI_LOCK_TTL_MS,
    };
    aiLockNonceRef.current = nonce;
    setAiInputLockBoth(next);
    send({ type: 'call_event', event: encodeAiLockEvent('acquire', nonce, name) });
    startAiLockHeartbeat();
    return { ok: true, lock: next };
  }, [send, setAiInputLockBoth, startAiLockHeartbeat]);

  const releaseAiInputLock = useCallback(() => {
    const selfId = selfPeerIdRef.current;
    const lock = aiInputLockRef.current;
    const nonce = aiLockNonceRef.current || lock?.nonce;
    stopAiLockHeartbeat();
    if (lock && selfId && String(lock.peerId) === String(selfId)) {
      setAiInputLockBoth(null);
      if (nonce) {
        send({ type: 'call_event', event: encodeAiLockEvent('release', nonce) });
      }
    } else if (!lock || lock.expiresAt <= Date.now()) {
      setAiInputLockBoth(null);
    }
    aiLockNonceRef.current = null;
  }, [send, setAiInputLockBoth, stopAiLockHeartbeat]);

  const appendAiChatMessage = useCallback((message, { broadcast = false } = {}) => {
    if (!message?.text && message?.kind !== 'ai_system') return null;
    const selfId = selfPeerIdRef.current;
    const envelope = {
      kind: message.kind,
      id: message.id,
      text: message.text,
      authorName: message.authorName
        || parseCallDisplayName(selfDisplayNameRef.current).name
        || selfDisplayNameRef.current
        || 'Участник',
      authorPeerId: message.authorPeerId != null ? message.authorPeerId : selfId,
      ts: message.ts || Date.now(),
      entityRefs: Array.isArray(message.entityRefs) ? message.entityRefs : [],
    };
    const encoded = encodeAiChatPayload(envelope);
    const parsed = parseAiChatPayload(encoded);
    setAiChatMessages((prev) => {
      if (prev.some((m) => m.id === parsed.id)) return prev;
      return [...prev, { ...parsed, fromPeerId: selfId || 'me' }];
    });
    if (broadcast) {
      send({ type: 'chat', text: encoded });
    }
    return parsed;
  }, [send]);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current != null) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (welcomeTimerRef.current != null) {
      window.clearTimeout(welcomeTimerRef.current);
      welcomeTimerRef.current = null;
    }
  }, []);

  const stopPing = useCallback(() => {
    if (pingTimerRef.current != null) {
      window.clearInterval(pingTimerRef.current);
      pingTimerRef.current = null;
    }
  }, []);

  const startPing = useCallback(() => {
    stopPing();
    lastPongRef.current = Date.now();
    pingTimerRef.current = window.setInterval(() => {
      if (Date.now() - lastPongRef.current > WS_PONG_STALE_MS) {
        try {
          wsRef.current?.close();
        } catch {
          /* ignore */
        }
        return;
      }
      send({ type: 'ping', nonce: String(Date.now()) });
    }, WS_PING_INTERVAL_MS);
  }, [send, stopPing]);

  const leave = useCallback((opts = {}) => {
    if (!opts.forRejoin) {
      intentionalLeaveRef.current = true;
    }
    clearEmptyRoomTimer();
    clearReconnectTimer();
    clearRingTimer();
    hadRemotePeersRef.current = false;
    skipEmptyHangupRef.current = false;
    handoffGraceRef.current = false;
    migratingOutRef.current = false;
    signalingJoinedRef.current = false;
    stopPing();
    if (opts.forRejoin) {
      joinWaitersRef.current = [];
    } else {
      settleJoinWaiters(new Error('Call left'));
    }
    const ws = wsRef.current;
    wsRef.current = null;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ type: 'leave' }));
      } catch {
        /* ignore */
      }
    }
    try {
      ws?.close();
    } catch {
      /* ignore */
    }
    sessionRef.current?.dispose();
    sessionRef.current = null;
    audioProcessorRef.current.detach();
    rawStreamRef.current?.getTracks().forEach((t) => {
      try {
        t.stop();
      } catch {
        /* ignore */
      }
    });
    rawStreamRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => {
      try {
        t.stop();
      } catch {
        /* ignore */
      }
    });
    localStreamRef.current = null;
    setLocalStream(null);
    setRemoteStreams(new Map());
    setPeerNames(new Map());
    setPeerStates(new Map());
    peerNamesRef.current = new Map();
    setPartyRoomId(null);
    setChatRoomId(null);
    setExpectedMembers([]);
    setSelfUserId(null);
    setSelfDisplayName('');
    selfDisplayNameRef.current = '';
    alertsTabCoordinator.setActivePartyRoomId(null);
    setLayoutMode('fullscreen');
    setStatus('idle');
    setError(null);
    setMediaMode('mesh');
    setMuted(false);
    setCamOff(false);
    mutedRef.current = false;
    camOffRef.current = false;
    setMeshPeerWarning(false);
    selfPeerIdRef.current = null;
    setSelfPeerId(null);
    deviceWarningRef.current = null;
    outboxRef.current = [];
    clearAiChatState();
    if (!opts.forRejoin) {
      callJoinArgsRef.current = null;
    }
  }, [clearAiChatState, clearEmptyRoomTimer, clearReconnectTimer, clearRingTimer, settleJoinWaiters, stopPing]);

  leaveRef.current = leave;

  const scheduleSignalingReconnect = useCallback(() => {
    if (intentionalLeaveRef.current || migratingOutRef.current) return;
    if (reconnectTimerRef.current != null) return;
    const attempt = reconnectAttemptRef.current;
    reconnectAttemptRef.current = attempt + 1;
    const delay = Math.min(
      SIGNALING_RECONNECT_MAX_MS,
      SIGNALING_RECONNECT_BASE_MS * 2 ** Math.min(attempt, 4),
    );
    setError(
      attempt === 0
        ? 'Связь с сигналингом потеряна, переподключение…'
        : `Переподключение к звонку… (попытка ${attempt + 1})`,
    );
    reconnectTimerRef.current = window.setTimeout(() => {
      reconnectTimerRef.current = null;
      void reconnectSignalingRef.current?.();
    }, delay);
  }, []);

  const openCallSocket = useCallback(
    (roomId) =>
      new Promise((resolve, reject) => {
        const token = getPartyhomeToken();
        const ws = new WebSocket(getPartyhomeWsUrl(roomId, token));
        const onOpen = () => {
          cleanup();
          resolve(ws);
        };
        const onError = () => {
          cleanup();
          reject(new Error('WebSocket connection failed'));
        };
        const cleanup = () => {
          ws.removeEventListener('open', onOpen);
          ws.removeEventListener('error', onError);
        };
        ws.addEventListener('open', onOpen);
        ws.addEventListener('error', onError);
      }),
    [],
  );

  const reconnectSignaling = useCallback(async () => {
    if (intentionalLeaveRef.current) return;
    const args = callJoinArgsRef.current;
    const stream = localStreamRef.current;
    if (!args?.partyRoomId || !stream) return;
    try {
      const prev = wsRef.current;
      wsRef.current = null;
      try {
        prev?.close();
      } catch {
        /* ignore */
      }
      const ws = await openCallSocket(args.partyRoomId);
      if (intentionalLeaveRef.current) {
        try {
          ws.close();
        } catch {
          /* ignore */
        }
        return;
      }
      wsRef.current = ws;
      lastPongRef.current = Date.now();
      signalingJoinedRef.current = false;
      startPing();
      bindCallSocketRef.current?.(ws, {
        stream,
        displayName: args.displayName,
        skipSelfDuplicates: true,
        isReconnect: true,
      });
      send({ type: 'join', display_name: args.displayName || 'User' });
    } catch {
      scheduleSignalingReconnect();
    }
  }, [openCallSocket, scheduleSignalingReconnect, send, startPing]);

  reconnectSignalingRef.current = reconnectSignaling;

  /** Free camera/mic so the pop-out window can acquire devices; stay in signaling until leave(). */
  const releaseLocalMediaForHandoff = useCallback(async () => {
    const stream = localStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          /* ignore */
        }
      });
    }
    audioProcessorRef.current.detach();
    rawStreamRef.current?.getTracks().forEach((t) => {
      try {
        t.stop();
      } catch {
        /* ignore */
      }
    });
    rawStreamRef.current = null;
    localStreamRef.current = null;
    setLocalStream(null);
    const session = sessionRef.current;
    if (session instanceof SfuCallSession) {
      try {
        await session.unpublishLocal();
      } catch {
        /* ignore */
      }
    } else if (session instanceof MeshCallSession) {
      try {
        session.setLocalStream(null);
      } catch {
        /* ignore */
      }
    }
  }, []);

  const refreshMediaDevices = useCallback(async () => {
    try {
      const next = await listCallMediaDevices();
      setMediaDevices(next);
      return next;
    } catch {
      return { audioInputs: [], videoInputs: [], audioOutputs: [] };
    }
  }, []);

  const replacePublishedAudio = useCallback(async (track) => {
    const session = sessionRef.current;
    if (!session || !track) return;
    if (typeof session.replaceAudioTrack === 'function') {
      await session.replaceAudioTrack(track);
      return;
    }
    if (typeof session.setLocalStream === 'function') {
      await session.setLocalStream(localStreamRef.current);
    }
  }, []);

  const replacePublishedVideo = useCallback(async (track) => {
    const session = sessionRef.current;
    if (!session || !track) return;
    if (typeof session.replaceVideoTrack === 'function') {
      await session.replaceVideoTrack(track);
      return;
    }
    if (typeof session.setLocalStream === 'function') {
      await session.setLocalStream(localStreamRef.current);
    }
  }, []);

  const toggleScreenShare = useCallback(async () => {
    const session = sessionRef.current;
    if (!session) return;

    if (screenSharing) {
      // Stop sharing — restore camera
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
      const camTrack = localStreamRef.current?.getVideoTracks()[0] ?? null;
      if (camTrack && typeof session.replaceVideoTrack === 'function') {
        await session.replaceVideoTrack(camTrack, false);
      }
      setScreenSharing(false);
      return;
    }

    try {
      const scr = await getScreenCaptureStream();
      screenStreamRef.current = scr;
      const vt = scr.getVideoTracks()[0];
      if (!vt) {
        scr.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
        return;
      }
      try { vt.contentHint = 'detail'; } catch { /* ignore */ }
      const shareStartedAt = Date.now();
      vt.onended = () => {
        setScreenSharing(false);
        const camTrack = localStreamRef.current?.getVideoTracks()[0] ?? null;
        if (camTrack && typeof session.replaceVideoTrack === 'function') {
          void session.replaceVideoTrack(camTrack, false);
        }
        screenStreamRef.current?.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
        if (isApplePlatform() && Date.now() - shareStartedAt < 3000) {
          console.warn('[screen-share] capture failure on macOS:', macScreenCaptureHelp());
        }
      };
      await settleAfterDisplayCapture();
      if (typeof session.replaceVideoTrack === 'function') {
        await session.replaceVideoTrack(vt, true);
      }
      setScreenSharing(true);
    } catch (e) {
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
      console.error('[screen-share] failed:', e?.message ?? e);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenSharing]);

  const applyPublishedStream = useCallback((stream) => {
    localStreamRef.current = stream;
    setLocalStream(stream);
    const session = sessionRef.current;
    if (session instanceof MeshCallSession || session instanceof SfuCallSession) {
      session.setLocalStream?.(stream);
    }
  }, []);

  const startLocalMedia = useCallback(async () => {
    let stream;
    try {
      stream = await acquireCallMedia({
        audioInputId: audioInputIdRef.current,
        videoInputId: videoInputIdRef.current,
      });
    } catch (e) {
      if (e?.name === 'NotAllowedError' || e?.name === 'PermissionDeniedError') {
        throw e;
      }
      if (!isRecoverableMediaError(e)) throw e;
      stream = new MediaStream();
      deviceWarningRef.current = mediaErrorMessage(e);
      setError(deviceWarningRef.current);
    }
    rawStreamRef.current = stream;
    const rawAudio = stream.getAudioTracks()[0] || null;
    const processedAudio = rawAudio
      ? await audioProcessorRef.current.attach(rawAudio, micGainRef.current)
      : null;
    if (processedAudio) processedAudio.enabled = !mutedRef.current;
    if (!stream.getVideoTracks().length) {
      camOffRef.current = true;
      setCamOff(true);
    } else {
      stream.getVideoTracks().forEach((t) => {
        t.enabled = !camOffRef.current;
      });
    }
    const published = new MediaStream([
      ...(processedAudio ? [processedAudio] : []),
      ...stream.getVideoTracks(),
    ]);
    applyPublishedStream(published);
    const usedAudio = stream.getAudioTracks()[0]?.getSettings?.().deviceId;
    const usedVideo = stream.getVideoTracks()[0]?.getSettings?.().deviceId;
    if (usedAudio) {
      audioInputIdRef.current = usedAudio;
      setAudioInputIdState(usedAudio);
      saveCallMediaPref('audioInputId', usedAudio);
    } else if (audioInputIdRef.current) {
      audioInputIdRef.current = '';
      setAudioInputIdState('');
      saveCallMediaPref('audioInputId', '');
    }
    if (usedVideo) {
      videoInputIdRef.current = usedVideo;
      setVideoInputIdState(usedVideo);
      saveCallMediaPref('videoInputId', usedVideo);
    } else if (videoInputIdRef.current) {
      videoInputIdRef.current = '';
      setVideoInputIdState('');
      saveCallMediaPref('videoInputId', '');
    }
    void refreshMediaDevices();
    return published;
  }, [applyPublishedStream, refreshMediaDevices]);

  useEffect(() => {
    if (status !== 'connecting' && status !== 'active') return undefined;
    const onChange = () => {
      void refreshMediaDevices();
    };
    navigator.mediaDevices?.addEventListener?.('devicechange', onChange);
    void refreshMediaDevices();
    return () => {
      navigator.mediaDevices?.removeEventListener?.('devicechange', onChange);
    };
  }, [refreshMediaDevices, status]);

  const joinCall = useCallback(
    async ({
      partyRoomId: roomId,
      displayName,
      chatRoomId: chatId = null,
      expectedMembers: members = [],
      selfUserId: uid = null,
      /** Same-user tabs (including pop-out) are always de-duplicated. */
      skipSelfDuplicates = true,
    }) => {
      if (!roomId) throw new Error('partyRoomId required');
      alertsTabCoordinator.broadcastCallConsumed(roomId);
      stopCallRingtone();
      leave({ forRejoin: true });
      intentionalLeaveRef.current = false;
      reconnectAttemptRef.current = 0;
      outboxRef.current = [];
      callJoinArgsRef.current = {
        partyRoomId: roomId,
        displayName,
        skipSelfDuplicates,
      };
      setStatus('connecting');
      deviceWarningRef.current = null;
      setError(null);
      setPartyRoomId(roomId);
      alertsTabCoordinator.setActivePartyRoomId(roomId);
      setChatRoomId(chatId);
      setExpectedMembers(Array.isArray(members) ? members : []);
      setSelfUserId(uid != null ? Number(uid) : parseCallDisplayName(displayName).userId);
      setSelfDisplayName(displayName || 'User');
      selfDisplayNameRef.current = displayName || 'User';
      setLayoutMode('fullscreen');
      setPeerNames(new Map());
      peerNamesRef.current = new Map();
      setRemoteStreams(new Map());
      setPeerStates(new Map());
      clearAiChatState();
      setSelfPeerId(null);
      hadRemotePeersRef.current = false;
      signalingJoinedRef.current = false;
      clearEmptyRoomTimer();
      clearRingTimer();

      const joinDone = new Promise((resolve, reject) => {
        joinWaitersRef.current.push({ resolve, reject });
      });

      let stream;
      try {
        stream = await startLocalMedia();
      } catch (e) {
        setStatus('error');
        setError(mediaErrorMessage(e));
        settleJoinWaiters(e instanceof Error ? e : new Error(String(e)));
        throw e;
      }

      let ws;
      try {
        ws = await openCallSocket(roomId);
      } catch (e) {
        setError(e?.message || 'Не удалось подключиться к сигналингу, повтор…');
        scheduleSignalingReconnect();
        await joinDone;
        return;
      }
      if (intentionalLeaveRef.current) {
        try {
          ws.close();
        } catch {
          /* ignore */
        }
        return;
      }
      wsRef.current = ws;
      lastPongRef.current = Date.now();

      const isDuplicateSelfPeer = (peerDisplayName) =>
        isSameCallUser(peerDisplayName, selfDisplayNameRef.current);

      const selfDupPeerIds = new Set();

      const meshHooks = {
        onError: (message) => {
          if (message) setError(String(message));
        },
        onPeerState: (id, state) => {
          setPeerStates((prev) => {
            const next = new Map(prev);
            if (!state) next.delete(id);
            else next.set(id, state);
            return next;
          });
        },
      };

      const attachSocket = (socket, { stream: localMedia, isReconnect = false }) => {
        if (welcomeTimerRef.current != null) {
          window.clearTimeout(welcomeTimerRef.current);
        }
        welcomeTimerRef.current = window.setTimeout(() => {
          welcomeTimerRef.current = null;
          try {
            socket.close();
          } catch {
            /* ignore */
          }
        }, JOIN_WELCOME_TIMEOUT_MS);

        socket.onmessage = (ev) => {
          const msg = parseServerMessage(String(ev.data));
          if (!msg) return;

          if (msg.type === 'pong') {
            lastPongRef.current = Date.now();
            return;
          }

          if (msg.type === 'welcome') {
            if (welcomeTimerRef.current != null) {
              window.clearTimeout(welcomeTimerRef.current);
              welcomeTimerRef.current = null;
            }
            reconnectAttemptRef.current = 0;
            signalingJoinedRef.current = true;
            flushOutbox();
            if (isReconnect) {
              sessionRef.current?.dispose();
              sessionRef.current = null;
              setError(deviceWarningRef.current);
            }
            selfPeerIdRef.current = msg.peer_id;
            setSelfPeerId(msg.peer_id || null);
            const names = new Map();
            const mediaPeers = [];
            for (const p of msg.peers || []) {
              if (isDuplicateSelfPeer(p.display_name)) {
                selfDupPeerIds.add(p.peer_id);
                continue;
              }
              names.set(p.peer_id, p.display_name);
              mediaPeers.push(p);
            }
            setPeerNamesBoth(names);
            if (names.size > 0) {
              hadRemotePeersRef.current = true;
              clearEmptyRoomTimer();
              clearRingTimer();
            } else if (!isReconnect) {
              scheduleRingTimeout();
            }

            const media = msg.media;
            const useSfu = media?.mode === 'sfu' && media?.url && media?.token;

            const onRemote = (id, remoteStream) => {
              if (selfDupPeerIds.has(id)) return;
              onRemoteStream(id, remoteStream);
            };

            setStatus('active');
            settleJoinWaiters();

            if (useSfu) {
              setMediaMode('sfu');
              const sfu = new SfuCallSession();
              sfu.setConnectionHandler((ev) => {
                if (ev === 'reconnecting') {
                  setError('Переподключение медиа (SFU)…');
                } else if (ev === 'reconnected') {
                  setError(deviceWarningRef.current);
                } else if (ev === 'disconnected' && !intentionalLeaveRef.current) {
                  setError('SFU отключился, восстанавливаем связь…');
                  scheduleSignalingReconnect();
                }
              });
              sessionRef.current = sfu;
              enqueueSignal(async () => {
                try {
                  await connectSfuWithRetry(sfu, media.url, media.token, localMedia, onRemote);
                  setError(deviceWarningRef.current);
                } catch (e) {
                  console.warn('[call] SFU failed', e);
                  sfu.dispose();
                  sessionRef.current = null;
                  setStatus('error');
                  setError('Не удалось подключиться к медиа-серверу. Повтор…');
                  scheduleSignalingReconnect();
                }
              });
            } else {
              setMediaMode('mesh');
              const mesh = new MeshCallSession(
                msg.peer_id,
                msg.iceServers || [],
                send,
                meshHooks,
              );
              mesh.setLocalStream(localMedia);
              sessionRef.current = mesh;
              enqueueSignal(async () => {
                for (const p of mediaPeers) {
                  await mesh.ensurePeer(p.peer_id, onRemote);
                }
                if (mediaPeers.length >= MESH_PEER_WARN_THRESHOLD) {
                  setMeshPeerWarning(true);
                }
                setError(deviceWarningRef.current);
              });
            }
            return;
          }

          if (msg.type === 'peer_joined') {
            if (isDuplicateSelfPeer(msg.peer?.display_name)) {
              selfDupPeerIds.add(msg.peer.peer_id);
              return;
            }
            clearEmptyRoomTimer();
            clearRingTimer();
            hadRemotePeersRef.current = true;

            const incomingParsed = parseCallDisplayName(msg.peer.display_name);
            const staleIds = [];
            if (incomingParsed.userId != null) {
              for (const [pid, raw] of peerNamesRef.current.entries()) {
                if (parseCallDisplayName(raw).userId === incomingParsed.userId) {
                  staleIds.push(pid);
                }
              }
            }
            for (const oldId of staleIds) {
              const session = sessionRef.current;
              if (session instanceof MeshCallSession) {
                session.removePeer(oldId);
              }
            }
            if (staleIds.length) {
              setRemoteStreams((prev) => {
                const next = new Map(prev);
                for (const id of staleIds) next.delete(id);
                return next;
              });
            }

            setPeerNamesBoth((prev) => {
              const next = new Map(prev);
              for (const id of staleIds) next.delete(id);
              next.set(msg.peer.peer_id, msg.peer.display_name);
              return next;
            });
            if (migratingOutRef.current) return;
            const session = sessionRef.current;
            if (session instanceof MeshCallSession) {
              enqueueSignal(() => session.ensurePeer(msg.peer.peer_id, onRemoteStream));
              if (peerNamesRef.current.size >= MESH_PEER_WARN_THRESHOLD && mediaMode === 'mesh') {
                setMeshPeerWarning(true);
              }
            }
            return;
          }

          if (msg.type === 'peer_left') {
            selfDupPeerIds.delete(msg.peer_id);
            const leftId = String(msg.peer_id || '');
            if (
              aiInputLockRef.current
              && String(aiInputLockRef.current.peerId) === leftId
            ) {
              stopAiLockHeartbeat();
              aiLockNonceRef.current = null;
              setAiInputLockBoth(null);
            }
            setPeerNamesBoth((prev) => {
              const next = new Map(prev);
              next.delete(msg.peer_id);
              setPeerStates((states) => {
                const ns = new Map(states);
                ns.delete(msg.peer_id);
                return ns;
              });
              if (next.size === 0) {
                scheduleHangupIfEmpty();
              } else {
                clearEmptyRoomTimer();
              }
              return next;
            });
            setRemoteStreams((prev) => {
              const next = new Map(prev);
              next.delete(msg.peer_id);
              return next;
            });
            const session = sessionRef.current;
            if (session instanceof MeshCallSession) {
              session.removePeer(msg.peer_id);
            }
            return;
          }

          if (msg.type === 'chat') {
            const payload = parseAiChatPayload(msg.text);
            if (!payload) return;
            setAiChatMessages((prev) => {
              if (prev.some((m) => m.id === payload.id)) return prev;
              return [...prev, { ...payload, fromPeerId: msg.from }];
            });
            return;
          }

          if (msg.type === 'call_event') {
            const lockParsed = parseAiLockEvent(msg.event);
            if (lockParsed) {
              const selfId = selfPeerIdRef.current;
              const prev = aiInputLockRef.current;
              const next = applyAiLockEvent(prev, lockParsed, msg.from);
              // Remote acquire while we held lock → yield
              if (
                prev
                && selfId
                && String(prev.peerId) === String(selfId)
                && next
                && String(next.peerId) !== String(selfId)
              ) {
                stopAiLockHeartbeat();
                aiLockNonceRef.current = null;
              }
              if (next && String(next.peerId) === String(selfId)) {
                aiLockNonceRef.current = next.nonce;
              }
              setAiInputLockBoth(next);
              return;
            }
            const ev = String(msg.event || '').toLowerCase();
            if (ev === 'declined') {
              setError('Собеседник отклонил звонок');
              leaveRef.current?.();
            } else if (ev === 'ringing_timeout') {
              setError('Никто не ответил');
              leaveRef.current?.();
            }
            return;
          }

          if (msg.type === 'sdp' || msg.type === 'ice') {
            if (selfDupPeerIds.has(msg.from) || migratingOutRef.current) return;
            const session = sessionRef.current;
            if (session instanceof MeshCallSession) {
              enqueueSignal(() => session.handleSignal(msg, onRemoteStream));
            }
            return;
          }

          if (msg.type === 'error') {
            const text = msg.message || 'Ошибка сигналинга';
            setError(text);
            if (joinWaitersRef.current.length) {
              setStatus('error');
              settleJoinWaiters(new Error(text));
            }
          }
        };

        socket.onclose = () => {
          if (intentionalLeaveRef.current || migratingOutRef.current) return;
          if (wsRef.current !== socket) return;
          signalingJoinedRef.current = false;
          scheduleSignalingReconnect();
        };
      };

      bindCallSocketRef.current = attachSocket;
      attachSocket(ws, { stream, isReconnect: false });
      send({ type: 'join', display_name: displayName || 'User' });
      startPing();

      await joinDone;
    },
    [
      clearAiChatState,
      clearEmptyRoomTimer,
      clearRingTimer,
      enqueueSignal,
      flushOutbox,
      leave,
      mediaMode,
      onRemoteStream,
      openCallSocket,
      scheduleHangupIfEmpty,
      scheduleRingTimeout,
      scheduleSignalingReconnect,
      send,
      setAiInputLockBoth,
      setPeerNamesBoth,
      settleJoinWaiters,
      startLocalMedia,
      startPing,
      stopAiLockHeartbeat,
    ]
  );

  const collectCallDiagnostics = useCallback(() => {
    const session = sessionRef.current;
    const peerStates =
      session instanceof MeshCallSession && typeof session.getAllPeerStates === 'function'
        ? session.getAllPeerStates()
        : {};
    const peers = [...peerNamesRef.current.entries()].map(([id, name]) => ({
      id,
      name,
      webrtc: peerStates[id] || null,
    }));
    return {
      at: new Date().toISOString(),
      partyRoomId,
      mediaMode,
      status,
      error,
      selfPeerId: selfPeerIdRef.current,
      peers,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    };
  }, [error, mediaMode, partyRoomId, status]);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !muted;
    mutedRef.current = next;
    stream.getAudioTracks().forEach((t) => {
      t.enabled = !next;
    });
    rawStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = !next;
    });
    setMuted(next);
  }, [muted]);

  const toggleCamera = useCallback(async () => {
    const turningOff = !camOffRef.current;
    if (turningOff) {
      camOffRef.current = true;
      setCamOff(true);
      const dropVideo = (stream) => {
        if (!stream) return;
        stream.getVideoTracks().forEach((t) => {
          try {
            stream.removeTrack(t);
          } catch {
            /* ignore */
          }
          try {
            t.stop();
          } catch {
            /* ignore */
          }
        });
      };
      dropVideo(rawStreamRef.current);
      dropVideo(localStreamRef.current);
      if (localStreamRef.current) {
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
      }
      await replacePublishedVideo(null);
      return;
    }
    try {
      const capture = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: buildVideoConstraints(videoInputIdRef.current),
      });
      const newVideo = capture.getVideoTracks()[0];
      if (!newVideo) throw new Error('Камера не найдена');
      const oldRaw = rawStreamRef.current;
      oldRaw?.getVideoTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          /* ignore */
        }
      });
      rawStreamRef.current = new MediaStream([
        ...(oldRaw?.getAudioTracks() || []),
        newVideo,
      ]);
      const published = localStreamRef.current || new MediaStream();
      published.getVideoTracks().forEach((t) => {
        published.removeTrack(t);
        try {
          t.stop();
        } catch {
          /* ignore */
        }
      });
      published.addTrack(newVideo);
      localStreamRef.current = published;
      setLocalStream(new MediaStream(published.getTracks()));
      camOffRef.current = false;
      setCamOff(false);
      await replacePublishedVideo(newVideo);
      void refreshMediaDevices();
    } catch (e) {
      camOffRef.current = true;
      setCamOff(true);
      setError(mediaErrorMessage(e));
    }
  }, [refreshMediaDevices, replacePublishedVideo]);

  const setAudioInputDevice = useCallback(
    async (deviceId) => {
      audioInputIdRef.current = deviceId || '';
      setAudioInputIdState(deviceId || '');
      saveCallMediaPref('audioInputId', deviceId || '');
      if (!localStreamRef.current) return;
      const capture = await navigator.mediaDevices.getUserMedia({
        audio: buildAudioConstraints(deviceId),
        video: false,
      });
      const rawAudio = capture.getAudioTracks()[0];
      if (!rawAudio) return;
      const oldRaw = rawStreamRef.current;
      const nextRaw = new MediaStream([
        rawAudio,
        ...(oldRaw?.getVideoTracks() || []),
      ]);
      oldRaw?.getAudioTracks().forEach((t) => t.stop());
      capture.getVideoTracks().forEach((t) => t.stop());
      rawStreamRef.current = nextRaw;
      const processed = await audioProcessorRef.current.attach(rawAudio, micGainRef.current);
      if (processed) processed.enabled = !mutedRef.current;
      const published = localStreamRef.current;
      published.getAudioTracks().forEach((t) => {
        published.removeTrack(t);
        try {
          t.stop();
        } catch {
          /* ignore */
        }
      });
      if (processed) published.addTrack(processed);
      setLocalStream(new MediaStream(published.getTracks()));
      localStreamRef.current = published;
      await replacePublishedAudio(processed);
      void refreshMediaDevices();
    },
    [refreshMediaDevices, replacePublishedAudio]
  );

  const setVideoInputDevice = useCallback(
    async (deviceId) => {
      videoInputIdRef.current = deviceId || '';
      setVideoInputIdState(deviceId || '');
      saveCallMediaPref('videoInputId', deviceId || '');
      if (!localStreamRef.current) return;
      const capture = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: buildVideoConstraints(deviceId),
      });
      const newVideo = capture.getVideoTracks()[0];
      if (!newVideo) return;
      newVideo.enabled = !camOffRef.current;
      const oldRaw = rawStreamRef.current;
      const nextRaw = new MediaStream([
        ...(oldRaw?.getAudioTracks() || []),
        newVideo,
      ]);
      oldRaw?.getVideoTracks().forEach((t) => t.stop());
      capture.getAudioTracks().forEach((t) => t.stop());
      rawStreamRef.current = nextRaw;
      const published = localStreamRef.current;
      published.getVideoTracks().forEach((t) => {
        published.removeTrack(t);
        try {
          t.stop();
        } catch {
          /* ignore */
        }
      });
      published.addTrack(newVideo);
      setLocalStream(new MediaStream(published.getTracks()));
      localStreamRef.current = published;
      await replacePublishedVideo(newVideo);
      void refreshMediaDevices();
    },
    [refreshMediaDevices, replacePublishedVideo]
  );

  const setAudioOutputDevice = useCallback((deviceId) => {
    setAudioOutputIdState(deviceId || '');
    saveCallMediaPref('audioOutputId', deviceId || '');
  }, []);

  const setMicGain = useCallback((value) => {
    const next = Number(value);
    if (!Number.isFinite(next)) return;
    micGainRef.current = next;
    setMicGainState(next);
    saveCallMediaPref('micGain', next);
    audioProcessorRef.current.setGain(next);
  }, []);

  const setOutputVolume = useCallback((value) => {
    const next = Number(value);
    if (!Number.isFinite(next)) return;
    setOutputVolumeState(next);
    saveCallMediaPref('outputVolume', next);
  }, []);

  const toggleLayoutMode = useCallback(() => {
    setLayoutMode((prev) => {
      if (prev === 'minimized') return 'docked';
      return prev === 'docked' ? 'fullscreen' : 'docked';
    });
  }, []);

  const minimizeCall = useCallback(() => {
    setLayoutMode('minimized');
  }, []);

  const restoreCallPanel = useCallback(() => {
    setLayoutMode((prev) => (prev === 'minimized' ? 'docked' : prev));
  }, []);

  const popOutCall = useCallback(() => {
    if (!partyRoomId) return;

    let handoffId;
    try {
      handoffId = writeCallHandoff({
        partyRoomId,
        chatRoomId,
        displayName: selfDisplayName,
        selfUserId,
        expectedMembers,
      });
    } catch {
      setError('Не удалось открыть отдельное окно');
      return;
    }

    const qs = new URLSearchParams({
      room: String(partyRoomId),
      hid: String(handoffId),
    });
    if (selfDisplayName) qs.set('name', selfDisplayName);
    const url = `${window.location.origin}/call?${qs.toString()}`;
    const features =
      'popup=yes,width=1100,height=760,menubar=no,toolbar=no,location=no,status=no';
    const popup = window.open(url, 'aicontrol-call', features);
    if (!popup) {
      clearCallHandoff();
      setError('Разрешите всплывающие окна, чтобы вынести звонок');
      return;
    }
    try {
      popup.focus();
    } catch {
      /* ignore */
    }

    // Keep this tab in the call until the popup has joined — otherwise remotes
    // see peer_left / empty room and auto-hangup.
    let settled = false;
    let channel = null;
    const cleanup = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      try {
        channel?.removeEventListener('message', onMessage);
        channel?.close();
      } catch {
        /* ignore */
      }
    };

    const onMessage = (event) => {
      const data = event?.data;
      if (!data || data.handoffId !== handoffId) return;
      if (data.type === 'popout-need-media') {
        // Free camera/mic for the popup; stay in signaling until popout-ready.
        migratingOutRef.current = true;
        void releaseLocalMediaForHandoff().then(() => {
          try {
            channel?.postMessage({ type: 'media-released', handoffId });
          } catch {
            /* ignore */
          }
        });
        return;
      }
      if (data.type === 'popout-ready') {
        cleanup();
        skipEmptyHangupRef.current = true;
        handoffGraceRef.current = true;
        leave();
        return;
      }
      if (data.type === 'popout-failed') {
        cleanup();
        migratingOutRef.current = false;
        clearCallHandoff();
        setError(data.message || 'Не удалось перенести звонок в отдельное окно');
        void startLocalMedia().catch((e) => setError(mediaErrorMessage(e)));
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          scheduleSignalingReconnect();
        }
        return;
      }
    };

    try {
      channel = new BroadcastChannel(CALL_HANDOFF_CHANNEL);
      channel.addEventListener('message', onMessage);
    } catch {
      // Fallback: poll for handoff key removal + short delay, then leave.
      // Prefer keeping call in main if BroadcastChannel missing.
      cleanup();
      clearCallHandoff();
      setError('Браузер не поддерживает перенос звонка в отдельное окно');
      try {
        popup.close();
      } catch {
        /* ignore */
      }
      return;
    }

    const timeoutId = window.setTimeout(() => {
      if (settled) return;
      cleanup();
      migratingOutRef.current = false;
      clearCallHandoff();
      setError('Отдельное окно не подключилось вовремя — звонок остаётся здесь');
      void startLocalMedia().catch((e) => setError(mediaErrorMessage(e)));
      try {
        popup.close();
      } catch {
        /* ignore */
      }
    }, 25000);
  }, [
    chatRoomId,
    expectedMembers,
    leave,
    partyRoomId,
    releaseLocalMediaForHandoff,
    scheduleSignalingReconnect,
    selfDisplayName,
    selfUserId,
    startLocalMedia,
  ]);

  const value = useMemo(
    () => ({
      status,
      error,
      partyRoomId,
      chatRoomId,
      mediaMode,
      muted,
      camOff,
      screenSharing,
      peerNames,
      remoteStreams,
      localStream,
      meshPeerWarning,
      peerStates,
      expectedMembers,
      selfUserId,
      selfDisplayName,
      layoutMode,
      audioInputId,
      videoInputId,
      audioOutputId,
      micGain,
      outputVolume,
      mediaDevices,
      active: status === 'connecting' || status === 'active' || status === 'error',
      joinCall,
      leave,
      toggleMute,
      toggleCamera,
      toggleScreenShare,
      setAudioInputDevice,
      setVideoInputDevice,
      setAudioOutputDevice,
      setMicGain,
      setOutputVolume,
      refreshMediaDevices,
      setLayoutMode,
      toggleLayoutMode,
      minimizeCall,
      restoreCallPanel,
      popOutCall,
      collectCallDiagnostics,
      aiChatMessages,
      aiInputLock,
      acquireAiInputLock,
      releaseAiInputLock,
      appendAiChatMessage,
      canTypeAiChat: canTypeWithAiLock(aiInputLock, selfPeerId),
      selfPeerId,
    }),
    [
      status,
      error,
      partyRoomId,
      chatRoomId,
      mediaMode,
      muted,
      camOff,
      screenSharing,
      toggleScreenShare,
      peerNames,
      remoteStreams,
      localStream,
      meshPeerWarning,
      peerStates,
      expectedMembers,
      selfUserId,
      selfDisplayName,
      layoutMode,
      audioInputId,
      videoInputId,
      audioOutputId,
      micGain,
      outputVolume,
      mediaDevices,
      joinCall,
      leave,
      toggleMute,
      toggleCamera,
      setAudioInputDevice,
      setVideoInputDevice,
      setAudioOutputDevice,
      setMicGain,
      setOutputVolume,
      refreshMediaDevices,
      toggleLayoutMode,
      minimizeCall,
      restoreCallPanel,
      popOutCall,
      collectCallDiagnostics,
      aiChatMessages,
      aiInputLock,
      acquireAiInputLock,
      releaseAiInputLock,
      appendAiChatMessage,
      selfPeerId,
    ]
  );

  return (
    <CallSessionContext.Provider value={value}>{children}</CallSessionContext.Provider>
  );
}
