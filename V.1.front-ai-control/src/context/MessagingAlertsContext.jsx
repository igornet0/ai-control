import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAuth } from './AuthContext';
import { messagingService } from '../services/messagingService';
import { getMessagingWsUrl } from '../services/messagingBaseUrl';
import {
  ensureBrowserPermission,
  showBrowserNotification,
} from '../services/browserNotifications';
import {
  startCallRingtone,
  stopCallRingtone,
  unlockCallRingtone,
} from '../services/callRingtone';
import {
  playMessageSound,
  unlockMessageSound,
} from '../services/messageNotificationSound';
import { parseCallPartyRoomId } from '../services/messagingEntityRefs';
import {
  alertsTabCoordinator,
  isAlertsPresenter,
} from '../services/alertsTabCoordinator';
import { isEmbeddedShell } from '../utils/embeddedShell';
import {
  MMM_OPEN_MAIL_EVENT,
  MMM_OPEN_ROOM_EVENT,
  requestOpenRoom,
} from '../services/messagingNavigation';

const MessagingAlertsContext = createContext(null);

export function useMessagingAlerts() {
  const ctx = useContext(MessagingAlertsContext);
  if (!ctx) {
    throw new Error('useMessagingAlerts must be used within MessagingAlertsProvider');
  }
  return ctx;
}

function previewText(content, max = 80) {
  const t = String(content || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function roomTitle(room) {
  if (!room) return 'Чат';
  if (room.room_type === 'direct' && room.peer?.name) return room.peer.name;
  return room.name || 'Чат';
}

function messageHasCallInvite(msg) {
  const refs = msg?.entity_refs;
  if (!Array.isArray(refs)) return false;
  return refs.some((ref) => ref?.type === 'call');
}

function extractCallInvite(msg) {
  const refs = msg?.entity_refs;
  if (!Array.isArray(refs)) return null;
  const ref = refs.find((r) => r?.type === 'call');
  if (!ref) return null;
  const partyRoomId = parseCallPartyRoomId(ref.url);
  if (!partyRoomId) return null;
  return {
    partyRoomId,
    title: ref.title || 'Видеозвонок',
  };
}

function messagePreview(msg, room) {
  if (messageHasCallInvite(msg)) {
    return 'Входящий видеозвонок — откройте чат, чтобы присоединиться';
  }
  const text = previewText(msg?.content, 80);
  if (text) return text;
  const refs = msg?.entity_refs;
  if (Array.isArray(refs) && refs.length > 0) {
    const first = refs[0];
    if (first?.title) return previewText(first.title, 80);
    return 'Новое вложение / ссылка';
  }
  if (Array.isArray(msg?.attachments) && msg.attachments.length > 0) {
    return 'Вложение';
  }
  if (room?.room_type === 'notification') return 'Новое уведомление';
  return 'Новое сообщение';
}

function sumUnread(map) {
  return Object.values(map).reduce((acc, n) => acc + (Number(n) || 0), 0);
}

export function MessagingAlertsProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const [unreadByRoom, setUnreadByRoom] = useState({});
  const [unreadMailCount, setUnreadMailCount] = useState(0);
  const [roomsById, setRoomsById] = useState({});
  const [chatToasts, setChatToasts] = useState([]);
  const [miniChat, setMiniChat] = useState({
    open: false,
    roomId: null,
    focusMessageId: null,
  });
  const [incomingCall, setIncomingCall] = useState(null);
  const listenersRef = useRef(new Set());
  const wsRef = useRef(null);
  const reconnectRef = useRef(null);
  const userIdRef = useRef(user?.id);
  const viewingRef = useRef({ surface: 'none', roomId: null });
  const knownMailIdsRef = useRef(new Set());
  const unreadByRoomRef = useRef(unreadByRoom);
  const roomsByIdRef = useRef(roomsById);
  const incomingCallRef = useRef(incomingCall);

  useEffect(() => {
    userIdRef.current = user?.id;
  }, [user?.id]);
  useEffect(() => {
    unreadByRoomRef.current = unreadByRoom;
  }, [unreadByRoom]);
  useEffect(() => {
    roomsByIdRef.current = roomsById;
  }, [roomsById]);
  useEffect(() => {
    incomingCallRef.current = incomingCall;
  }, [incomingCall]);

  const setViewing = useCallback((surface, roomId = null) => {
    viewingRef.current = { surface: surface || 'none', roomId: roomId || null };
  }, []);

  const subscribeWs = useCallback((fn) => {
    listenersRef.current.add(fn);
    return () => {
      listenersRef.current.delete(fn);
    };
  }, []);

  const dismissChatToast = useCallback((toastId) => {
    setChatToasts((prev) => prev.filter((t) => t.id !== toastId));
  }, []);

  const pushChatToast = useCallback((toast) => {
    const id =
      toast.id ||
      `toast-${toast.roomId}-${toast.messageId || Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 7)}`;
    setChatToasts((prev) => {
      const next = prev.filter(
        (t) => !(t.roomId === toast.roomId && t.messageId === toast.messageId)
      );
      return [...next, { ...toast, id }].slice(-3);
    });
  }, []);

  const openMiniChat = useCallback((roomId, messageId = null) => {
    const id = Number(roomId);
    if (!id) return;
    const focus =
      messageId != null && Number(messageId) > 0 ? Number(messageId) : null;
    setMiniChat({ open: true, roomId: id, focusMessageId: focus });
    setChatToasts((prev) => prev.filter((t) => Number(t.roomId) !== id));
  }, []);

  const closeMiniChat = useCallback(() => {
    setMiniChat({ open: false, roomId: null, focusMessageId: null });
  }, []);

  const dismissIncomingCall = useCallback((opts = {}) => {
    const prev = incomingCallRef.current;
    incomingCallRef.current = null;
    stopCallRingtone();
    setIncomingCall(null);
    if (!opts.silent && prev?.partyRoomId) {
      alertsTabCoordinator.broadcastCallConsumed(prev.partyRoomId, {
        roomId: prev.roomId,
      });
    }
  }, []);

  const presentIncomingCall = useCallback((invite) => {
    if (!invite?.partyRoomId || !invite?.roomId) return;
    if (alertsTabCoordinator.getActivePartyRoomId() === String(invite.partyRoomId)) {
      return;
    }
    incomingCallRef.current = invite;
    setIncomingCall(invite);
    startCallRingtone();
  }, []);

  const hydrateUnreadFromRooms = useCallback((rooms) => {
    const list = Array.isArray(rooms) ? rooms : [];
    setRoomsById((prev) => {
      const next = { ...prev };
      list.forEach((room) => {
        if (room?.id) next[room.id] = room;
      });
      return next;
    });
    setUnreadByRoom((prev) => {
      const next = { ...prev };
      const ids = new Set();
      list.forEach((room) => {
        if (!room?.id) return;
        ids.add(Number(room.id));
        next[room.id] = Number(room.unread_count) || 0;
      });
      Object.keys(next).forEach((key) => {
        if (!ids.has(Number(key))) delete next[key];
      });
      return next;
    });
  }, []);

  const clearRoomUnread = useCallback((roomId) => {
    if (!roomId) return;
    setUnreadByRoom((prev) => {
      if (!prev[roomId]) return prev;
      const next = { ...prev };
      delete next[roomId];
      return next;
    });
  }, []);

  const incrementRoomUnread = useCallback((roomId) => {
    if (!roomId) return;
    setUnreadByRoom((prev) => ({
      ...prev,
      [roomId]: (Number(prev[roomId]) || 0) + 1,
    }));
  }, []);

  const refreshMailUnread = useCallback(async ({ announce = true } = {}) => {
    try {
      const items = await messagingService.getInboxMail({ limit: 50 });
      const unread = items.filter((row) => !row.is_read);
      setUnreadMailCount(unread.length);
      const known = knownMailIdsRef.current;
      if (announce && known.size > 0) {
        const fresh = unread.filter((row) => !known.has(row.id));
        if (fresh.length > 0) {
          const viewingMail =
            viewingRef.current.surface === 'mail' &&
            (typeof document === 'undefined' || !document.hidden);
          if (!viewingMail && isAlertsPresenter()) {
            const latest = fresh[0];
            playMessageSound();
            showBrowserNotification(
              latest.subject || 'Новое письмо',
              `От ${latest.from_name || latest.from_email || 'коллеги'}`,
              {
                tag: `mmm-mail-${latest.id}`,
                onClick: () => {
                  window.dispatchEvent(new CustomEvent(MMM_OPEN_MAIL_EVENT));
                },
              }
            );
          }
        }
      }
      knownMailIdsRef.current = new Set(items.map((row) => row.id));
      return unread.length;
    } catch {
      return 0;
    }
  }, []);

  const refreshChatUnread = useCallback(async () => {
    try {
      const rooms = await messagingService.getRooms();
      hydrateUnreadFromRooms(rooms);
      return rooms;
    } catch {
      return [];
    }
  }, [hydrateUnreadFromRooms]);

  const dispatchPayload = useCallback((payload) => {
    listenersRef.current.forEach((fn) => {
      try {
        fn(payload);
      } catch {
        // listener errors must not break the bus
      }
    });
  }, []);

  const handleBusPayload = useCallback((payload) => {
    if (!payload?.type) return;
    dispatchPayload(payload);

    if (payload.type !== 'message.new' || !payload.message) return;
    const msg = payload.message;
    const roomId = Number(payload.room_id);
    const mine = Number(msg.author_id) === Number(userIdRef.current);
    if (mine || !roomId) return;

    const room = roomsByIdRef.current[roomId] || roomsByIdRef.current[String(roomId)];
    const isCall = messageHasCallInvite(msg);
    const callInvite = isCall ? extractCallInvite(msg) : null;
    const isSystemNotify = room?.room_type === 'notification';
    const presenter = isAlertsPresenter();

    const viewing = viewingRef.current;
    const viewingRoomId = Number(viewing.roomId) || null;
    const tabVisible = typeof document === 'undefined' || !document.hidden;
    const lookingAtRoom =
      viewing.surface === 'chats' &&
      viewingRoomId === roomId &&
      tabVisible;

    if (!lookingAtRoom) {
      incrementRoomUnread(roomId);
    }

    if (!presenter) return;

    if (callInvite) {
      presentIncomingCall({
        roomId,
        messageId: msg.id,
        partyRoomId: callInvite.partyRoomId,
        title: `${roomTitle(room)} · ${callInvite.title}`,
      });
    }

    // Calls and system notification-room alerts always surface in the OS tray.
    // Regular chat/mail-adjacent messages notify unless the user is already
    // watching that exact room with the tab focused.
    const shouldBrowserNotify = isCall || isSystemNotify || !lookingAtRoom;
    if (!shouldBrowserNotify) return;

    const title = isCall
      ? `Видеозвонок · ${roomTitle(room)}`
      : isSystemNotify
        ? 'Уведомление'
        : roomTitle(room);
    const preview = messagePreview(msg, room);

    if (!lookingAtRoom) {
      pushChatToast({
        roomId,
        messageId: msg.id,
        title,
        preview,
        durationMs: isCall ? 12000 : 9000,
      });
    }

    if (!isCall) {
      playMessageSound();
    }

    showBrowserNotification(title, preview, {
      tag: isCall ? `mmm-call-${roomId}` : `mmm-chat-${roomId}-${msg.id}`,
      requireInteraction: isCall,
      onClick: () => {
        requestOpenRoom(roomId, { messageId: msg.id });
      },
    });
  }, [dispatchPayload, incrementRoomUnread, presentIncomingCall, pushChatToast]);

  const handleBusPayloadRef = useRef(handleBusPayload);
  useEffect(() => {
    handleBusPayloadRef.current = handleBusPayload;
  }, [handleBusPayload]);

  useEffect(() => {
    const onOpenRoom = (event) => {
      const roomId = event.detail?.roomId;
      const messageId = event.detail?.messageId ?? null;
      if (!roomId) return;
      openMiniChat(roomId, messageId);
    };
    window.addEventListener(MMM_OPEN_ROOM_EVENT, onOpenRoom);
    return () => window.removeEventListener(MMM_OPEN_ROOM_EVENT, onOpenRoom);
  }, [openMiniChat]);

  useEffect(() => {
    return alertsTabCoordinator.subscribeMessages((data) => {
      if (data?.type !== 'call-consumed') return;
      const id = String(data.partyRoomId || '');
      if (!id) return;
      const current = incomingCallRef.current;
      if (!current || String(current.partyRoomId) !== id) return;
      dismissIncomingCall({ silent: true });
    });
  }, [dismissIncomingCall]);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      setUnreadByRoom({});
      setUnreadMailCount(0);
      setRoomsById({});
      setChatToasts([]);
      setMiniChat({ open: false, roomId: null, focusMessageId: null });
      incomingCallRef.current = null;
      setIncomingCall(null);
      stopCallRingtone();
      knownMailIdsRef.current = new Set();
      alertsTabCoordinator.stop();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return undefined;
    }

    if (isEmbeddedShell()) {
      return undefined;
    }

    alertsTabCoordinator.start();

    let cancelled = false;
    refreshChatUnread();
    refreshMailUnread({ announce: false });
    void ensureBrowserPermission();

    const unlockOnGesture = () => {
      unlockCallRingtone();
      unlockMessageSound();
    };
    window.addEventListener('pointerdown', unlockOnGesture, { once: true, passive: true });
    window.addEventListener('keydown', unlockOnGesture, { once: true });

    const connect = () => {
      if (cancelled) return;
      const url = getMessagingWsUrl();
      if (!url.includes('token=') || url.endsWith('token=')) return;
      try {
        const ws = new WebSocket(url);
        ws.onopen = () => {
          if (!cancelled) refreshChatUnread();
        };
        ws.onmessage = (event) => {
          try {
            handleBusPayloadRef.current(JSON.parse(event.data));
          } catch {
            // ignore malformed frames
          }
        };
        ws.onclose = () => {
          if (cancelled) return;
          reconnectRef.current = setTimeout(connect, 2500);
        };
        wsRef.current = ws;
      } catch {
        reconnectRef.current = setTimeout(connect, 4000);
      }
    };

    connect();
    const mailPoll = setInterval(() => {
      refreshMailUnread({ announce: true });
    }, 20000);

    return () => {
      cancelled = true;
      clearInterval(mailPoll);
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      window.removeEventListener('pointerdown', unlockOnGesture);
      window.removeEventListener('keydown', unlockOnGesture);
      alertsTabCoordinator.stop();
      stopCallRingtone();
    };
  }, [isAuthenticated, user?.id, refreshChatUnread, refreshMailUnread]);

  const unreadChatCount = useMemo(() => sumUnread(unreadByRoom), [unreadByRoom]);
  const unreadTotal = unreadChatCount + unreadMailCount;

  const value = useMemo(
    () => ({
      unreadByRoom,
      unreadChatCount,
      unreadMailCount,
      unreadTotal,
      setViewing,
      subscribeWs,
      hydrateUnreadFromRooms,
      clearRoomUnread,
      incrementRoomUnread,
      setUnreadMailCount,
      refreshMailUnread,
      refreshChatUnread,
      requestBrowserPermission: ensureBrowserPermission,
      chatToasts,
      pushChatToast,
      dismissChatToast,
      miniChat,
      openMiniChat,
      closeMiniChat,
      incomingCall,
      dismissIncomingCall,
      presentIncomingCall,
    }),
    [
      unreadByRoom,
      unreadChatCount,
      unreadMailCount,
      unreadTotal,
      setViewing,
      subscribeWs,
      hydrateUnreadFromRooms,
      clearRoomUnread,
      incrementRoomUnread,
      refreshMailUnread,
      refreshChatUnread,
      chatToasts,
      pushChatToast,
      dismissChatToast,
      miniChat,
      openMiniChat,
      closeMiniChat,
      incomingCall,
      dismissIncomingCall,
      presentIncomingCall,
    ]
  );

  return (
    <MessagingAlertsContext.Provider value={value}>
      {children}
    </MessagingAlertsContext.Provider>
  );
}
