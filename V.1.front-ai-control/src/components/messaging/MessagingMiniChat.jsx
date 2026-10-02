import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowPathIcon,
  ArrowsPointingOutIcon,
  PaperAirplaneIcon,
  PaperClipIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { messagingService } from '../../services/messagingService';
import { AI_ASSISTANT_USER_ID, messageMentionsAi, messagingAiService } from '../../services/messagingAiService';
import { entityRefKey } from '../../services/messagingEntityRefs';
import { useAuth } from '../../context/AuthContext';
import { useMessagingAlerts } from '../../context/MessagingAlertsContext';
import MarkdownContent from '../MarkdownContent';
import MessageEntityRefs from './MessageEntityRefs';
import EntityAttachPicker from '../../pages/profile/components/EntityAttachPicker';
import styles from './MessagingMiniChat.module.css';

function previewText(content, max = 200) {
  const t = String(content || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function roomTitle(room) {
  if (!room) return 'Чат';
  if (room.room_type === 'direct' && room.peer?.name) return room.peer.name;
  return room.name || 'Чат';
}

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export default function MessagingMiniChat({ roomId, focusMessageId, onClose }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    subscribeWs,
    setViewing,
    clearRoomUnread,
    refreshChatUnread,
  } = useMessagingAlerts();
  const [room, setRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [highlightedId, setHighlightedId] = useState(null);
  const [pendingEntityRefs, setPendingEntityRefs] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const listRef = useRef(null);
  const stickBottomRef = useRef(true);
  const roomIdRef = useRef(roomId);

  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);

  const scrollToBottom = useCallback((smooth = false) => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto',
    });
  }, []);

  const scrollToMessage = useCallback((messageId) => {
    if (!messageId || !listRef.current) return false;
    const node = listRef.current.querySelector(`[data-mini-msg-id="${messageId}"]`);
    if (!node) return false;
    node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedId(messageId);
    window.setTimeout(() => {
      setHighlightedId((prev) => (prev === messageId ? null : prev));
    }, 2200);
    return true;
  }, []);

  const loadRoom = useCallback(async () => {
    if (!roomId) return;
    setLoading(true);
    setError('');
    try {
      const rooms = await messagingService.getRooms();
      const found = rooms.find((r) => Number(r.id) === Number(roomId)) || null;
      setRoom(found);
      const { messages: rows } = await messagingService.getMessages(roomId, { limit: 60 });
      const sorted = [...rows].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      setMessages(sorted);
      const last = sorted[sorted.length - 1];
      if (last?.id) {
        try {
          await messagingService.markRoomRead(roomId, last.id);
        } catch {
          // ignore read errors
        }
        clearRoomUnread(roomId);
      }
      requestAnimationFrame(() => {
        if (focusMessageId && scrollToMessage(focusMessageId)) return;
        scrollToBottom(false);
      });
    } catch (err) {
      console.error(err);
      setError('Не удалось загрузить чат');
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [roomId, focusMessageId, clearRoomUnread, scrollToBottom, scrollToMessage]);

  useEffect(() => {
    loadRoom();
  }, [loadRoom]);

  useEffect(() => {
    setViewing('chats', roomId);
    return () => setViewing('none', null);
  }, [roomId, setViewing]);

  useEffect(() => {
    if (!focusMessageId || loading) return undefined;
    const timer = window.setTimeout(() => {
      if (!scrollToMessage(focusMessageId)) {
        stickBottomRef.current = true;
        scrollToBottom(true);
      }
    }, 80);
    return () => window.clearTimeout(timer);
  }, [focusMessageId, loading, messages.length, scrollToMessage, scrollToBottom]);

  useEffect(() => {
    return subscribeWs((payload) => {
      if (!payload?.type || Number(payload.room_id) !== Number(roomIdRef.current)) return;
      if (payload.type === 'message.new' && payload.message) {
        const msg = payload.message;
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        if (stickBottomRef.current) {
          requestAnimationFrame(() => scrollToBottom(true));
        }
        if (msg.author_id !== user?.id) {
          messagingService.markRoomRead(roomIdRef.current, msg.id).catch(() => {});
          clearRoomUnread(roomIdRef.current);
        }
      }
      if (payload.type === 'message.updated' && payload.message) {
        const msg = payload.message;
        setMessages((prev) => prev.map((m) => (m.id === msg.id ? msg : m)));
      }
      if (payload.type === 'message.deleted') {
        const id = payload.message_id ?? payload.message?.id;
        setMessages((prev) => prev.filter((m) => m.id !== id));
      }
    });
  }, [subscribeWs, scrollToBottom, clearRoomUnread, user?.id]);

  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickBottomRef.current = distance < 48;
  };

  const handleSend = async (event) => {
    event.preventDefault();
    const content = text.trim();
    if ((!content && !pendingEntityRefs.length) || !roomId || sending) return;
    setSending(true);
    setError('');
    try {
      const msg = await messagingService.sendMessage(
        roomId,
        content || (pendingEntityRefs.length ? ' ' : ''),
        null,
        [],
        pendingEntityRefs,
      );
      setText('');
      setPendingEntityRefs([]);
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      stickBottomRef.current = true;
      requestAnimationFrame(() => scrollToBottom(true));
      refreshChatUnread();
      if (messageMentionsAi(content)) {
        try {
          const data = await messagingAiService.mention({
            roomId,
            content,
            parentMessageId: msg.id,
          });
          const bot = data?.message;
          if (bot?.id) {
            setMessages((prev) => (prev.some((m) => m.id === bot.id) ? prev : [...prev, bot]));
            stickBottomRef.current = true;
            requestAnimationFrame(() => scrollToBottom(true));
          }
        } catch (aiErr) {
          console.error(aiErr);
          const detail = aiErr?.response?.data?.detail;
          setError(
            typeof detail === 'string' ? detail : 'Не удалось получить ответ @ai',
          );
        }
      }
    } catch (err) {
      console.error(err);
      setError('Не удалось отправить сообщение');
    } finally {
      setSending(false);
    }
  };

  const title = useMemo(() => roomTitle(room), [room]);

  const openFullChat = () => {
    onClose?.();
    navigate('/profile', {
      state: {
        openRoomId: roomId,
        openMessageId: focusMessageId || null,
      },
    });
  };

  return (
    <div className={styles.panel} role="dialog" aria-label={`Мини-чат: ${title}`}>
      <div className={styles.head}>
        <div className={styles.headText}>
          <h3>{title}</h3>
          <p>Мини-чат · без перехода на другую страницу</p>
        </div>
        <div className={styles.headActions}>
          <button
            type="button"
            className={styles.openFullBtn}
            onClick={openFullChat}
            title="Открыть полный чат"
          >
            <ArrowsPointingOutIcon />
            <span>Открыть чат</span>
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={loadRoom}
            aria-label="Обновить"
            title="Обновить"
          >
            <ArrowPathIcon />
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={onClose}
            aria-label="Закрыть"
          >
            <XMarkIcon />
          </button>
        </div>
      </div>

      <div className={styles.list} ref={listRef} onScroll={handleScroll}>
        {loading && <p className={styles.hint}>Загрузка сообщений…</p>}
        {!loading && error && <p className={styles.error}>{error}</p>}
        {!loading && !error && messages.length === 0 && (
          <p className={styles.hint}>Пока нет сообщений</p>
        )}
        {!loading &&
          messages.map((msg) => {
            const mine = msg.author_id === user?.id;
            const isAi = Number(msg.author_id) === AI_ASSISTANT_USER_ID;
            const highlighted = highlightedId === msg.id;
            return (
              <div
                key={msg.id}
                data-mini-msg-id={msg.id}
                className={`${styles.bubbleRow} ${mine ? styles.bubbleRowMine : ''} ${
                  highlighted ? styles.bubbleHighlight : ''
                }`}
              >
                <div className={`${styles.bubble} ${mine ? styles.bubbleMine : ''}`}>
                  {isAi ? (
                    <div className={`${styles.bubbleText} ${styles.bubbleMarkdown}`}>
                      <MarkdownContent>{msg.content || ''}</MarkdownContent>
                    </div>
                  ) : (
                    <p className={styles.bubbleText}>
                      {previewText(msg.content) ||
                        (msg.attachments?.length || msg.entity_refs?.length
                          ? 'Вложение'
                          : 'Сообщение')}
                    </p>
                  )}
                  <MessageEntityRefs entityRefs={msg.entity_refs} />
                  <span className={styles.bubbleTime}>{formatTime(msg.created_at)}</span>
                </div>
              </div>
            );
          })}
      </div>

      <form className={styles.composer} onSubmit={handleSend}>
        {pendingEntityRefs.length > 0 && (
          <div className={styles.pendingRefs}>
            <MessageEntityRefs entityRefs={pendingEntityRefs} />
          </div>
        )}
        <div className={styles.composerRow}>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => setPickerOpen(true)}
            disabled={sending || loading}
            aria-label="Прикрепить объект"
            title="Прикрепить объект"
          >
            <PaperClipIcon />
          </button>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend(e);
              }
            }}
            placeholder="Напишите сообщение… (@ai — вопрос ассистенту)"
            rows={2}
            disabled={sending || loading}
          />
          <button
            type="submit"
            disabled={sending || loading || (!text.trim() && !pendingEntityRefs.length)}
            aria-label="Отправить"
          >
            <PaperAirplaneIcon />
          </button>
        </div>
      </form>
      <EntityAttachPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        selectedKeys={pendingEntityRefs.map(entityRefKey)}
        onSelect={(ref) => {
          setPendingEntityRefs((prev) => {
            const key = entityRefKey(ref);
            if (prev.some((r) => entityRefKey(r) === key)) {
              return prev.filter((r) => entityRefKey(r) !== key);
            }
            return [...prev, ref];
          });
        }}
      />
    </div>
  );
}
