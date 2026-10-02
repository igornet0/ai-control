import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCallSession } from '../../context/CallSessionContext';
import {
  CALL_HANDOFF_CHANNEL,
  clearCallHandoff,
  peekCallHandoff,
} from '../../calls/callDisplayName';
import CallOverlay from './CallOverlay';
import styles from './CallPopoutPage.module.css';

/** Shared across StrictMode remounts in the same popup document. */
let popoutJoinPromise = null;
let popoutJoinHandoffId = null;

const MEDIA_RELEASE_TIMEOUT_MS = 8_000;
const POPOUT_READY_GRACE_MS = 800;

function notifyOpener(message) {
  try {
    const channel = new BroadcastChannel(CALL_HANDOFF_CHANNEL);
    channel.postMessage(message);
    window.setTimeout(() => {
      try {
        channel.close();
      } catch {
        /* ignore */
      }
    }, 500);
  } catch {
    /* ignore */
  }
}

function waitForMediaReleased(handoffId) {
  return new Promise((resolve) => {
    let channel = null;
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      try {
        channel?.removeEventListener('message', onMessage);
        channel?.close();
      } catch {
        /* ignore */
      }
      resolve(ok);
    };
    const onMessage = (event) => {
      const data = event?.data;
      if (!data || data.handoffId !== handoffId) return;
      if (data.type === 'media-released') finish(true);
    };
    const timer = window.setTimeout(() => finish(false), MEDIA_RELEASE_TIMEOUT_MS);
    try {
      channel = new BroadcastChannel(CALL_HANDOFF_CHANNEL);
      channel.addEventListener('message', onMessage);
      channel.postMessage({ type: 'popout-need-media', handoffId });
    } catch {
      finish(false);
    }
  });
}

function resolveHandoff(searchParams) {
  const fromStorage = peekCallHandoff();
  if (fromStorage) return fromStorage;

  const room = String(searchParams.get('room') || '').trim();
  const hid = String(searchParams.get('hid') || '').trim();
  const name = String(searchParams.get('name') || '').trim();
  if (!room) return null;
  return {
    partyRoomId: room,
    handoffId: hid || `url-${room}`,
    chatRoomId: null,
    displayName: name ? decodeURIComponent(name) : 'User',
    selfUserId: null,
    expectedMembers: [],
  };
}

export default function CallPopoutPage() {
  const [searchParams] = useSearchParams();
  const { joinCall, leave, active, status } = useCallSession();
  const [bootError, setBootError] = useState('');
  const [booting, setBooting] = useState(true);
  const handoffIdRef = useRef(null);
  const readySentRef = useRef(false);
  const wasActiveRef = useRef(false);

  useEffect(() => {
    let ignore = false;

    const run = async () => {
      const payload = resolveHandoff(searchParams);
      if (!payload?.partyRoomId) {
        if (!ignore) {
          setBooting(false);
          setBootError('Нет данных звонка. Откройте окно из чата кнопкой «Отдельное окно».');
        }
        return;
      }

      handoffIdRef.current = payload.handoffId;

      // Reuse in-flight join from StrictMode first mount — do not abort it.
      if (popoutJoinHandoffId === payload.handoffId && popoutJoinPromise) {
        try {
          await popoutJoinPromise;
        } catch {
          /* handled below via status / bootError on the owner path */
        }
        if (!ignore) {
          setBooting(false);
          setBootError('');
        }
        return;
      }

      popoutJoinHandoffId = payload.handoffId;
      popoutJoinPromise = (async () => {
        await waitForMediaReleased(payload.handoffId);
        await joinCall({
          partyRoomId: payload.partyRoomId,
          chatRoomId: payload.chatRoomId ?? null,
          displayName: payload.displayName || 'User',
          selfUserId: payload.selfUserId ?? null,
          expectedMembers: payload.expectedMembers || [],
          skipSelfDuplicates: true,
        });
        await new Promise((r) => window.setTimeout(r, POPOUT_READY_GRACE_MS));
      })();

      try {
        await popoutJoinPromise;
        clearCallHandoff();
        if (!ignore) {
          setBootError('');
          setBooting(false);
        }
      } catch (e) {
        clearCallHandoff();
        popoutJoinPromise = null;
        popoutJoinHandoffId = null;
        const message = e?.message || 'Не удалось подключиться к звонку';
        // Initial leave() inside joinCall can reject a racing waiter; ignore if we ended up active.
        if (message === 'Call left') {
          if (!ignore) {
            setBooting(false);
          }
          return;
        }
        if (!ignore) {
          setBootError(message);
          setBooting(false);
        }
        notifyOpener({
          type: 'popout-failed',
          handoffId: payload.handoffId,
          message,
        });
      } finally {
        if (popoutJoinHandoffId === payload.handoffId) {
          popoutJoinPromise = null;
        }
      }
    };

    void run();

    const onUnload = () => {
      leave();
      popoutJoinPromise = null;
      popoutJoinHandoffId = null;
    };
    window.addEventListener('beforeunload', onUnload);
    return () => {
      ignore = true;
      window.removeEventListener('beforeunload', onUnload);
      // Do not leave() or cancel join — StrictMode remount must keep the session.
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- join once per popup load
  }, []);

  // Notify opener only after the call is actually active (never on a cancelled/empty boot).
  useEffect(() => {
    if (readySentRef.current) return;
    if (status !== 'active' || !handoffIdRef.current) return;
    readySentRef.current = true;
    const t = window.setTimeout(() => {
      notifyOpener({
        type: 'popout-ready',
        handoffId: handoffIdRef.current,
      });
    }, POPOUT_READY_GRACE_MS);
    return () => window.clearTimeout(t);
  }, [status]);

  // Close only after a real connected call ended — not during connecting→idle races.
  useEffect(() => {
    if (status === 'active') {
      wasActiveRef.current = true;
      return;
    }
    if (!wasActiveRef.current) return;
    if (status === 'idle' || status === 'error') {
      try {
        window.close();
      } catch {
        /* ignore */
      }
    }
  }, [status]);

  const showBootError = Boolean(bootError) && !active && status !== 'connecting';

  return (
    <div className={styles.page}>
      {showBootError && (
        <div className={styles.bootError}>
          <p>{bootError}</p>
          <button type="button" onClick={() => window.close()}>
            Закрыть окно
          </button>
        </div>
      )}
      {(booting || status === 'connecting') && !active && !showBootError && (
        <div className={styles.bootError}>
          <p>Подключение к звонку…</p>
        </div>
      )}
      <CallOverlay forceFullscreen />
    </div>
  );
}
