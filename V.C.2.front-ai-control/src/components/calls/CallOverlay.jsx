import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowsPointingInIcon,
  ArrowsPointingOutIcon,
  ArrowTopRightOnSquareIcon,
  BugAntIcon,
  Cog6ToothIcon,
  MicrophoneIcon,
  MinusIcon,
  PhoneXMarkIcon,
  SparklesIcon,
  VideoCameraIcon,
  VideoCameraSlashIcon,
} from '@heroicons/react/24/solid';
import { useCallSession } from '../../context/CallSessionContext';
import { parseCallDisplayName } from '../../calls/callDisplayName';
import { useCallPanelDrag } from '../../calls/useCallPanelDrag';
import { useSpeakingDetector } from '../../calls/useSpeakingDetector';
import CallMediaSettings from './CallMediaSettings';
import CallBugReportModal from './CallBugReportModal';
import CallPeerContextMenu, { getEffectivePeerVolume, getPeerPref } from './CallPeerContextMenu';
import CallAiChatPanel from './CallAiChatPanel';
import styles from './CallOverlay.module.css';

// ── Helpers ──────────────────────────────────────────────────────────────────

function initials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

// ── Video components ─────────────────────────────────────────────────────────

function LocalVideo({ stream }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    el.srcObject = stream;
    void el.play().catch(() => {});
    return () => {
      el.srcObject = null;
    };
  }, [stream]);
  return (
    <video
      ref={ref}
      className={`${styles.tileVideo} ${styles.tileVideoLocal}`}
      autoPlay
      playsInline
      muted
    />
  );
}

function RemoteCallAudio({ stream, volume, sinkId }) {
  const audioRef = useRef(null);
  const graphRef = useRef(null);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return undefined;
    el.srcObject = stream || null;
    if (stream?.getAudioTracks?.().length) {
      void el.play().catch(() => {});
    }
    if (sinkId && typeof el.setSinkId === 'function') {
      void el.setSinkId(sinkId).catch(() => {});
    }
    return () => {
      el.srcObject = null;
    };
  }, [stream, sinkId]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return undefined;
    const v = Number(volume);
    const level = Number.isFinite(v) ? v : 1;
    if (level <= 1) {
      el.volume = Math.min(1, Math.max(0, level));
      if (graphRef.current?.gain) {
        graphRef.current.gain.gain.value = 1;
      }
      return undefined;
    }
    el.volume = 1;
    try {
      if (!graphRef.current) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return undefined;
        const ctx = new Ctx();
        const source = ctx.createMediaElementSource(el);
        const gain = ctx.createGain();
        source.connect(gain);
        gain.connect(ctx.destination);
        graphRef.current = { ctx, source, gain };
      }
      graphRef.current.gain.gain.value = level;
      if (graphRef.current.ctx.state === 'suspended') {
        void graphRef.current.ctx.resume();
      }
    } catch {
      /* createMediaElementSource can only run once per element */
    }
    return undefined;
  }, [volume]);

  return <audio ref={audioRef} autoPlay playsInline />;
}

function RemoteVideo({ stream }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    el.srcObject = stream;
    void el.play().catch(() => {});
    return () => {
      el.srcObject = null;
    };
  }, [stream]);
  return <video ref={ref} className={styles.tileVideo} autoPlay playsInline muted />;
}

// ── VideoTile ─────────────────────────────────────────────────────────────────

function VideoTile({
  peerId,
  name,
  stream,
  isLocal,
  speaking,
  isScreenShare,
  isSpotlight,
  isThumb,
  camOff,
  videoHidden,
  volume,
  sinkId,
  onRemoteContextMenu,
}) {
  const showVideo = stream && (!camOff || isScreenShare) && !videoHidden;
  const tileClass = [
    styles.tile,
    isSpotlight && styles.tileSpotlight,
    isThumb && styles.tileThumb,
    speaking && styles.tileSpeaking,
    isScreenShare && styles.tileScreenShare,
    videoHidden && styles.tileVideoHidden,
  ]
    .filter(Boolean)
    .join(' ');

  const handleContextMenu = !isLocal && onRemoteContextMenu
    ? (e) => {
        e.preventDefault();
        e.stopPropagation();
        onRemoteContextMenu(e, { peerId, name, isScreenShare });
      }
    : undefined;

  return (
    <div className={tileClass} onContextMenu={handleContextMenu}>
      {/* Screen share badge */}
      {isScreenShare && (
        <div className={styles.tileSharingBadge}>
          <span>🖥</span>
          Экран
        </div>
      )}

      {/* Video or avatar placeholder */}
      {showVideo ? (
        isLocal ? (
          <LocalVideo stream={stream} />
        ) : (
          <RemoteVideo stream={stream} />
        )
      ) : (
        <div className={styles.tilePlaceholder}>
          <div className={styles.tileAvatar}>{initials(name)}</div>
          {!isThumb && (
            <span className={styles.tileAvatarLabel}>
              {videoHidden
                ? isScreenShare
                  ? 'Экран скрыт'
                  : 'Камера скрыта'
                : isLocal
                  ? 'Камера выключена'
                  : 'Нет видео'}
            </span>
          )}
        </div>
      )}

      {/* Label row */}
      <div className={styles.tileLabel}>
        <span className={styles.tileLabelText}>
          {name}
          {isLocal && (
            <span style={{ opacity: 0.55, marginLeft: 4, fontWeight: 400, fontSize: '0.85em' }}>
              (вы)
            </span>
          )}
        </span>
        {speaking && (
          <div className={styles.tileSpeakingIcon} aria-hidden>
            <span />
            <span />
            <span />
          </div>
        )}
      </div>

      {/* Audio for remote peers */}
      {!isLocal && stream && !isScreenShare && (
        <RemoteCallAudio stream={stream} volume={volume} sinkId={sinkId} />
      )}
    </div>
  );
}

// ── Participant roster hook ───────────────────────────────────────────────────

function useParticipantRoster({
  expectedMembers,
  peerNames,
  selfUserId,
  selfDisplayName,
  speakingPeerKeys,
}) {
  return useMemo(() => {
    const peerByUserId = new Map();
    const orphanPeers = [];
    for (const [peerId, rawName] of peerNames.entries()) {
      const parsed = parseCallDisplayName(rawName);
      if (parsed.userId != null) {
        peerByUserId.set(parsed.userId, { peerId, name: parsed.name });
      } else {
        orphanPeers.push({ peerId, name: parsed.name });
      }
    }

    const selfParsed = parseCallDisplayName(selfDisplayName);
    const selfId = selfUserId ?? selfParsed.userId;
    const selfName = selfParsed.name || 'Вы';

    const speakingUserIds = new Set();
    if (speakingPeerKeys.has('local') && selfId != null) {
      speakingUserIds.add(selfId);
    }
    for (const [peerId, rawName] of peerNames.entries()) {
      if (!speakingPeerKeys.has(peerId)) continue;
      const parsed = parseCallDisplayName(rawName);
      if (parsed.userId != null) speakingUserIds.add(parsed.userId);
    }

    const seen = new Set();
    const rows = [];

    const pushMember = (member) => {
      const id = Number(member.id);
      if (!Number.isFinite(id) || seen.has(id)) return;
      seen.add(id);
      const isSelf = selfId != null && id === selfId;
      const connected = isSelf || peerByUserId.has(id);
      const peer = peerByUserId.get(id);
      rows.push({
        key: `u-${id}`,
        userId: id,
        name: member.name || peer?.name || `User ${id}`,
        connected,
        isSelf,
        speaking: speakingUserIds.has(id) || (isSelf && speakingPeerKeys.has('local')),
        peerId: peer?.peerId || (isSelf ? 'local' : null),
      });
    };

    for (const m of expectedMembers || []) {
      pushMember(m);
    }
    if (selfId != null && !seen.has(selfId)) {
      pushMember({ id: selfId, name: selfName });
    }

    for (const [userId, peer] of peerByUserId.entries()) {
      if (seen.has(userId)) continue;
      seen.add(userId);
      rows.push({
        key: `u-${userId}`,
        userId,
        name: peer.name,
        connected: true,
        isSelf: false,
        speaking: speakingUserIds.has(userId),
        peerId: peer.peerId,
      });
    }

    for (const orphan of orphanPeers) {
      rows.push({
        key: `p-${orphan.peerId}`,
        userId: null,
        name: orphan.name,
        connected: true,
        isSelf: false,
        speaking: speakingPeerKeys.has(orphan.peerId),
        peerId: orphan.peerId,
      });
    }

    rows.sort((a, b) => {
      if (a.isSelf !== b.isSelf) return a.isSelf ? -1 : 1;
      if (a.connected !== b.connected) return a.connected ? -1 : 1;
      return String(a.name).localeCompare(String(b.name), 'ru');
    });

    return rows;
  }, [expectedMembers, peerNames, selfDisplayName, selfUserId, speakingPeerKeys]);
}

// ── Spotlight layout builder ──────────────────────────────────────────────────

function useSpotlightLayout({ localTile, remoteTiles, screenSharing }) {
  return useMemo(() => {
    const all = [localTile, ...remoteTiles];
    if (all.length === 0) return { spotlight: null, thumbs: [] };

    // Screen share always goes to spotlight
    if (screenSharing && localTile) {
      return { spotlight: { ...localTile, isScreenShare: true }, thumbs: remoteTiles };
    }

    // 1 participant: solo
    if (all.length === 1) return { spotlight: all[0], thumbs: [] };

    // first remote is spotlight, rest + local are thumbs
    const [spotRemote, ...restRemotes] = remoteTiles;
    if (spotRemote) {
      return { spotlight: spotRemote, thumbs: [localTile, ...restRemotes] };
    }

    return { spotlight: all[0], thumbs: [] };
  }, [localTile, remoteTiles, screenSharing]);
}

// ── ScreenShare icon (inline SVG) ─────────────────────────────────────────────

function MonitorShareIcon({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M2 3.993A1 1 0 0 1 2.992 3h18.016c.548 0 .992.445.992.993v14.014a1 1 0 0 1-.992.993H2.992A.993.993 0 0 1 2 18.007V3.993ZM4 5v12h16V5H4Zm7 12h2v2H9v-2h2Zm1-3.586-4.243-4.243 1.415-1.414L12 10.999l3.828-3.828 1.415 1.414L13 12.414V13.5l-.5.5-.5-.5v-1.086Z" />
    </svg>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CallOverlay({ forceFullscreen = false }) {
  const {
    active,
    status,
    error,
    localStream,
    remoteStreams,
    peerNames,
    muted,
    camOff,
    screenSharing,
    mediaMode,
    meshPeerWarning,
    expectedMembers,
    selfUserId,
    selfDisplayName,
    layoutMode,
    peerStates = new Map(),
    leave,
    toggleMute,
    toggleCamera,
    toggleScreenShare,
    toggleLayoutMode,
    minimizeCall,
    restoreCallPanel,
    popOutCall,
    collectCallDiagnostics,
    audioInputId,
    videoInputId,
    audioOutputId,
    outputVolume,
    mediaDevices,
    setAudioInputDevice,
    setVideoInputDevice,
    setAudioOutputDevice,
    setOutputVolume,
    partyRoomId,
    aiChatMessages,
    aiInputLock,
    selfPeerId,
    acquireAiInputLock,
    releaseAiInputLock,
    appendAiChatMessage,
  } = useCallSession();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [peerPrefs, setPeerPrefs] = useState(() => new Map());
  const [peerContextMenu, setPeerContextMenu] = useState(null);
  const panelRef = useRef(null);

  const speaking = useSpeakingDetector(localStream, muted, remoteStreams);
  const roster = useParticipantRoster({
    expectedMembers,
    peerNames,
    selfUserId,
    selfDisplayName,
    speakingPeerKeys: speaking,
  });

  const docked = !forceFullscreen && layoutMode === 'docked';
  const minimized = !forceFullscreen && layoutMode === 'minimized';
  const floating = docked || minimized;

  const PANEL_W = docked ? 400 : 64;
  const PANEL_H = docked ? 560 : 64;

  const { panelStyle, dragging, startDrag, consumeDragClick } = useCallPanelDrag({
    enabled: floating,
    panelRef,
    panelWidth: PANEL_W,
    panelHeight: minimized ? 64 : PANEL_H,
  });
  const selfParsed = parseCallDisplayName(selfDisplayName);
  const selfId = selfUserId ?? selfParsed.userId;
  const selfName = selfParsed.name || 'Вы';

  const remotes = [...remoteStreams.entries()].filter(([id]) => {
    const raw = peerNames.get(id);
    if (!raw) return true;
    const parsed = parseCallDisplayName(raw);
    if (selfId != null && parsed.userId != null && parsed.userId === selfId) return false;
    return true;
  });

  const localTile = {
    id: 'local',
    name: selfName,
    stream: localStream,
    isLocal: true,
    speaking: speaking.has('local'),
    camOff,
  };

  const remoteTilesList = remotes.map(([id, stream]) => ({
    id,
    name: parseCallDisplayName(peerNames.get(id)).name || id.slice(0, 8),
    stream,
    isLocal: false,
    speaking: speaking.has(id),
    camOff: false,
  }));

  const { spotlight, thumbs } = useSpotlightLayout({
    localTile,
    remoteTiles: remoteTilesList,
    screenSharing,
  });

  const isTeamCall = (expectedMembers?.length || 0) > 2 || roster.length > 2;
  const onlineCount = roster.filter((r) => r.connected).length;
  const anyoneSpeaking = speaking.size > 0;

  const patchPeerPref = useCallback((peerId, patch) => {
    setPeerPrefs((prev) => {
      const next = new Map(prev);
      const current = getPeerPref(prev, peerId);
      next.set(peerId, { ...current, ...patch });
      return next;
    });
  }, []);

  const openPeerContextMenu = useCallback((e, { peerId, name, isScreenShare }) => {
    setPeerContextMenu({
      peerId,
      name,
      isScreenShare: Boolean(isScreenShare),
      x: e.clientX,
      y: e.clientY,
    });
  }, []);

  const closePeerContextMenu = useCallback(() => {
    setPeerContextMenu(null);
  }, []);

  const handlePeerVolumeChange = useCallback((peerId, volume) => {
    patchPeerPref(peerId, { volume });
  }, [patchPeerPref]);

  const handleTogglePeerVideoHidden = useCallback((peerId) => {
    setPeerPrefs((prev) => {
      const next = new Map(prev);
      const current = getPeerPref(prev, peerId);
      next.set(peerId, { ...current, videoHidden: !current.videoHidden });
      return next;
    });
  }, []);

  const tilePropsForRemote = useCallback(
    (tile) => ({
      peerId: tile.id,
      videoHidden: getPeerPref(peerPrefs, tile.id).videoHidden,
      volume: getEffectivePeerVolume(peerPrefs, tile.id, outputVolume),
      sinkId: audioOutputId,
      onRemoteContextMenu: openPeerContextMenu,
    }),
    [peerPrefs, outputVolume, audioOutputId, openPeerContextMenu]
  );

  const tilePropsForLocal = useMemo(
    () => ({
      peerId: 'local',
      videoHidden: false,
      volume: outputVolume,
      sinkId: audioOutputId,
      onRemoteContextMenu: null,
    }),
    [outputVolume, audioOutputId]
  );

  const mediaReady = (row) => {
    if (row.isSelf) return true;
    if (mediaMode === 'sfu') return remoteStreams.has(row.peerId);
    return peerStates?.get?.(row.peerId)?.connection === 'connected';
  };

  const retryPlayback = () => {
    panelRef.current?.querySelectorAll('audio, video').forEach((el) => {
      void el.play?.().catch(() => {});
    });
  };

  if (!active) return null;

  if (minimized) {
    return (
      <div
        className={`${styles.root} ${styles.rootMinimized}`}
        style={panelStyle}
        role="dialog"
        aria-label="Видеозвонок (свёрнут)"
      >
        <button
          ref={panelRef}
          type="button"
          className={[
            styles.minimizedBtn,
            anyoneSpeaking ? styles.minimizedBtnSpeaking : '',
            dragging ? styles.minimizedBtnDragging : '',
          ]
            .filter(Boolean)
            .join(' ')}
          onPointerDown={startDrag}
          onClick={() => {
            if (consumeDragClick()) return;
            restoreCallPanel();
          }}
          title={`Видеозвонок · ${onlineCount} онлайн · нажмите, чтобы развернуть`}
        >
          <span className={styles.minimizedIcon} aria-hidden>🎙</span>
          <span className={styles.minimizedCount}>{onlineCount}</span>
        </button>
        <div className={styles.hiddenMedia} aria-hidden>
          {remotes.map(([id, stream]) => (
            <RemoteCallAudio
              key={id}
              stream={stream}
              volume={getEffectivePeerVolume(peerPrefs, id, outputVolume)}
              sinkId={audioOutputId}
            />
          ))}
        </div>
        <CallPeerContextMenu
          menu={peerContextMenu}
          prefs={peerPrefs}
          onClose={closePeerContextMenu}
          onVolumeChange={handlePeerVolumeChange}
          onToggleVideoHidden={handleTogglePeerVideoHidden}
        />
      </div>
    );
  }

  return (
    <div
      className={`${styles.root} ${docked ? styles.rootDocked : styles.rootFullscreen}`}
      style={docked ? panelStyle : undefined}
      role="dialog"
      aria-label="Видеозвонок"
      onPointerDown={retryPlayback}
    >
      <div
        ref={panelRef}
        data-call-panel
        className={`${styles.panel} ${docked ? styles.panelDocked : ''} ${dragging ? styles.panelDragging : ''}`}
      >
        {/* ── Header ── */}
        <header
          className={`${styles.head} ${docked ? styles.headDraggable : ''}`}
          onPointerDown={docked ? startDrag : undefined}
        >
          <div className={styles.headMain}>
            <div className={styles.headLogo} aria-hidden>🎙</div>
            <span className={styles.headTitle}>Видеозвонок</span>
            <span className={styles.meta}>
              <span className={styles.metaDot} />
              {status === 'connecting'
                ? 'Подключение…'
                : `${onlineCount}${isTeamCall ? ` / ${roster.length}` : ''} онлайн`}
              {' · '}
              {mediaMode === 'sfu' ? 'SFU' : 'P2P'}
            </span>
            {screenSharing && (
              <span className={styles.sharingBadge}>
                <span className={styles.sharingDot} />
                Демонстрация экрана
              </span>
            )}
          </div>
          <div className={styles.headActions}>
            {!forceFullscreen && (
              <>
                <button
                  type="button"
                  className={styles.iconBtn}
                  onClick={minimizeCall}
                  title="Свернуть в кнопку"
                >
                  <MinusIcon />
                </button>
                <button
                  type="button"
                  className={styles.iconBtn}
                  onClick={toggleLayoutMode}
                  title={docked ? 'Развернуть' : 'Свернуть'}
                >
                  {docked ? <ArrowsPointingOutIcon /> : <ArrowsPointingInIcon />}
                </button>
                <button
                  type="button"
                  className={styles.iconBtn}
                  onClick={popOutCall}
                  title="Отдельное окно"
                >
                  <ArrowTopRightOnSquareIcon />
                </button>
              </>
            )}
          </div>
        </header>

        {/* ── Warnings ── */}
        {meshPeerWarning && mediaMode === 'mesh' && (
          <p className={styles.warn}>
            ⚠ Много участников без LiveKit — качество может снизиться.
          </p>
        )}
        {error && (
          <div className={styles.errorRow}>
            <p className={styles.error}>{error}</p>
            <button
              type="button"
              className={styles.reportBtn}
              onClick={() => setReportOpen(true)}
            >
              <BugAntIcon />
              Сообщить об ошибке
            </button>
          </div>
        )}

        {/* ── Body ── */}
        <div className={`${styles.body} ${aiChatOpen ? styles.bodyWithAiChat : ''}`}>
          {/* Video area */}
          <div className={styles.videoArea}>
            {/* Spotlight tile */}
            {spotlight && (
              <div className={styles.spotlightWrap}>
                <VideoTile
                  name={spotlight.name}
                  stream={spotlight.stream}
                  isLocal={spotlight.isLocal}
                  speaking={spotlight.speaking}
                  isScreenShare={spotlight.isScreenShare}
                  isSpotlight
                  camOff={spotlight.camOff}
                  {...(spotlight.isLocal ? tilePropsForLocal : tilePropsForRemote(spotlight))}
                />
              </div>
            )}

            {/* Thumbnail strip */}
            {thumbs.length > 0 && !docked && (
              <div className={styles.thumbStrip}>
                {thumbs.map((t) => (
                  <VideoTile
                    key={t.id}
                    name={t.name}
                    stream={t.stream}
                    isLocal={t.isLocal}
                    speaking={t.speaking}
                    isThumb
                    camOff={t.camOff}
                    {...(t.isLocal ? tilePropsForLocal : tilePropsForRemote(t))}
                  />
                ))}
              </div>
            )}

            {/* Docked: simple grid */}
            {docked && (
              <div className={styles.grid}>
                {[localTile, ...remoteTilesList].map((t) => (
                  <VideoTile
                    key={t.id}
                    name={t.name}
                    stream={t.stream}
                    isLocal={t.isLocal}
                    speaking={t.speaking}
                    camOff={t.camOff}
                    {...(t.isLocal ? tilePropsForLocal : tilePropsForRemote(t))}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Roster sidebar */}
          {!docked && (
            <aside className={styles.roster} aria-label="Участники звонка">
              <div className={styles.rosterTitle}>Участники</div>
              <ul className={styles.rosterList}>
                {roster.map((row) => (
                  <li
                    key={row.key}
                    className={[
                      styles.rosterItem,
                      row.connected ? styles.rosterConnected : styles.rosterPending,
                      row.speaking ? styles.rosterSpeaking : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <span className={styles.rosterAvatar} aria-hidden>
                      {initials(row.name)}
                    </span>
                    <span className={styles.rosterMeta}>
                      <span className={styles.rosterName}>
                        {row.name}
                        {row.isSelf ? ' (вы)' : ''}
                      </span>
                      <span className={styles.rosterStatus}>
                        {row.isSelf
                          ? 'Вы'
                          : mediaReady(row)
                            ? row.speaking
                              ? '🎤 Говорит'
                              : 'В звонке'
                            : row.connected
                              ? 'Подключение…'
                              : 'Не подключён'}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </aside>
          )}

          <CallAiChatPanel
            open={aiChatOpen}
            onClose={() => setAiChatOpen(false)}
            partyRoomId={partyRoomId}
            aiChatMessages={aiChatMessages}
            aiInputLock={aiInputLock}
            selfPeerId={selfPeerId}
            selfDisplayName={selfDisplayName}
            participants={[
              ...(selfUserId
                ? [{ user_id: selfUserId, name: parseCallDisplayName(selfDisplayName).name }]
                : []),
              ...[...peerNames.entries()].map(([, raw]) => {
                const p = parseCallDisplayName(raw);
                return { user_id: p.userId, name: p.name };
              }),
            ]}
            acquireAiInputLock={acquireAiInputLock}
            releaseAiInputLock={releaseAiInputLock}
            appendAiChatMessage={appendAiChatMessage}
          />
        </div>

        {/* ── Settings ── */}
        {settingsOpen && (
          <CallMediaSettings
            mediaDevices={mediaDevices}
            audioInputId={audioInputId}
            videoInputId={videoInputId}
            audioOutputId={audioOutputId}
            outputVolume={outputVolume}
            onAudioInput={(id) => void setAudioInputDevice(id)}
            onVideoInput={(id) => void setVideoInputDevice(id)}
            onAudioOutput={setAudioOutputDevice}
            onOutputVolume={setOutputVolume}
          />
        )}

        {/* ── Controls ── */}
        <footer className={styles.controls}>
          <button
            type="button"
            className={`${styles.ctrlBtn} ${muted ? styles.ctrlBtnOff : ''}`}
            onClick={toggleMute}
            title={muted ? 'Включить микрофон' : 'Выключить микрофон'}
          >
            <MicrophoneIcon />
            <span>{muted ? 'Mic выкл.' : 'Микрофон'}</span>
          </button>

          <button
            type="button"
            className={`${styles.ctrlBtn} ${camOff ? styles.ctrlBtnOff : ''}`}
            onClick={toggleCamera}
            title={camOff ? 'Включить камеру' : 'Выключить камеру'}
          >
            {camOff ? <VideoCameraSlashIcon /> : <VideoCameraIcon />}
            <span>{camOff ? 'Cam выкл.' : 'Камера'}</span>
          </button>

          {toggleScreenShare && (
            <button
              type="button"
              className={`${styles.ctrlBtn} ${screenSharing ? styles.ctrlBtnSharing : ''}`}
              onClick={() => void toggleScreenShare()}
              title={screenSharing ? 'Остановить демонстрацию' : 'Показать экран'}
            >
              <MonitorShareIcon />
              <span>{screenSharing ? 'Стоп экран' : 'Экран'}</span>
            </button>
          )}

          <div className={styles.ctrlDivider} />

          <button
            type="button"
            className={`${styles.ctrlBtn} ${settingsOpen ? styles.ctrlBtnActive : ''}`}
            onClick={() => setSettingsOpen((open) => !open)}
            title="Настройки устройств"
          >
            <Cog6ToothIcon />
            <span>Устройства</span>
          </button>

          <button
            type="button"
            className={styles.ctrlBtn}
            onClick={() => setReportOpen(true)}
            title="Сообщить об ошибке"
          >
            <BugAntIcon />
            <span>Баг-репорт</span>
          </button>

          <button
            type="button"
            className={`${styles.ctrlBtn} ${aiChatOpen ? styles.ctrlBtnActive : ''}`}
            onClick={() => setAiChatOpen((v) => !v)}
            title="Общий AI-чат звонка"
          >
            <SparklesIcon />
            <span>AI</span>
          </button>

          <div className={styles.ctrlDivider} />

          <button
            type="button"
            className={`${styles.ctrlBtn} ${styles.ctrlBtnHangup}`}
            onClick={leave}
            title="Завершить"
          >
            <PhoneXMarkIcon />
            <span>Завершить</span>
          </button>
        </footer>

        <CallBugReportModal
          open={reportOpen}
          onClose={() => setReportOpen(false)}
          collectDiagnostics={collectCallDiagnostics}
          captureRoot={panelRef}
        />

        <CallPeerContextMenu
          menu={peerContextMenu}
          prefs={peerPrefs}
          onClose={closePeerContextMenu}
          onVolumeChange={handlePeerVolumeChange}
          onToggleVideoHidden={handleTogglePeerVideoHidden}
        />
      </div>
    </div>
  );
}
