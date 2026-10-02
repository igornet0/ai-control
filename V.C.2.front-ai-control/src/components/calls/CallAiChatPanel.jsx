import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  PaperAirplaneIcon,
  SparklesIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { aiAgentService } from '../../services/aiAgentService';
import MarkdownContent from '../MarkdownContent';
import MessageEntityRefs from '../messaging/MessageEntityRefs';
import { canTypeWithAiLock } from '../../calls/callAiChatProtocol';
import { parseCallDisplayName } from '../../calls/callDisplayName';
import styles from './CallOverlay.module.css';

/**
 * Shared AI chat panel for an active call (visible to all participants).
 */
export default function CallAiChatPanel({
  open,
  onClose,
  partyRoomId,
  aiChatMessages = [],
  aiInputLock,
  selfPeerId,
  selfDisplayName,
  participants = [],
  acquireAiInputLock,
  releaseAiInputLock,
  appendAiChatMessage,
}) {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [agentInfo, setAgentInfo] = useState(null);
  const messagesEndRef = useRef(null);
  const holdingLockRef = useRef(false);
  const textareaRef = useRef(null);

  const historyScope = useMemo(
    () => `call-ai:${partyRoomId || 'none'}`,
    [partyRoomId],
  );

  const selfName = useMemo(
    () => parseCallDisplayName(selfDisplayName).name || selfDisplayName || 'Вы',
    [selfDisplayName],
  );

  const lockHeldByOther = useMemo(() => {
    if (!aiInputLock) return false;
    if (canTypeWithAiLock(aiInputLock, selfPeerId)) return false;
    return true;
  }, [aiInputLock, selfPeerId]);

  const lockLabel = useMemo(() => {
    if (!aiInputLock) return null;
    if (canTypeWithAiLock(aiInputLock, selfPeerId)) {
      return 'Вы пишете…';
    }
    return `Пишет: ${aiInputLock.name || 'участник'}`;
  }, [aiInputLock, selfPeerId]);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    aiAgentService.getAgentInfo()
      .then((info) => {
        if (!cancelled) setAgentInfo(info);
      })
      .catch(() => {
        if (!cancelled) setAgentInfo({ name: 'AI Ассистент' });
      });
    return () => { cancelled = true; };
  }, [open]);

  useEffect(() => {
    if (open) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiChatMessages, open, sending]);

  useEffect(() => () => {
    if (holdingLockRef.current) {
      releaseAiInputLock?.();
      holdingLockRef.current = false;
    }
  }, [releaseAiInputLock]);

  const tryAcquire = useCallback(() => {
    if (!acquireAiInputLock) return false;
    const result = acquireAiInputLock();
    if (result?.ok) {
      holdingLockRef.current = true;
      setError('');
      return true;
    }
    holdingLockRef.current = false;
    if (result?.reason === 'busy') {
      setError(`Поле занято: ${result.lock?.name || 'участник'}`);
    }
    return false;
  }, [acquireAiInputLock]);

  const handleFocus = () => {
    if (lockHeldByOther) {
      setError(`Поле занято: ${aiInputLock?.name || 'участник'}`);
      textareaRef.current?.blur();
      return;
    }
    tryAcquire();
  };

  const handleBlur = () => {
    // Keep lock while sending; otherwise release if input empty
    if (sending) return;
    if (!input.trim() && holdingLockRef.current) {
      releaseAiInputLock?.();
      holdingLockRef.current = false;
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;

    if (!holdingLockRef.current && !tryAcquire()) {
      return;
    }

    setSending(true);
    setError('');
    setInput('');

    appendAiChatMessage?.(
      {
        kind: 'ai_user',
        text,
        authorName: selfName,
        authorPeerId: selfPeerId,
      },
      { broadcast: true },
    );

    try {
      // Drop poisoned local history that taught the model to ask for titles.
      if (/(задач|tasks?|статистик|назван)/i.test(text)) {
        await aiAgentService.clearHistory(historyScope);
      }
      const result = await aiAgentService.sendCallAiChat(text, {
        partyRoomId,
        participants,
        apiKeyId: agentInfo?.api_key_id || null,
        agentName: agentInfo?.name || 'AI Ассистент',
        historyScope,
      });
      let reply = String(result.agent_message?.content || '').trim() || 'Пустой ответ';
      const entityRefs = Array.isArray(result.entity_refs)
        ? result.entity_refs
        : (result.agent_message?._entity_refs || []);
      const looksGeneric =
        /trello|notion|jira|пришлите|скинь(те)?\s+(список|скрин)|не привязан|не подключ|нет доступа к (вашему )?аккаунт|систем(ам|ы) управления проект|как называется проект\/доска/i.test(
          reply,
        );
      const fromDb = Boolean(result?.scope?.source === 'deterministic_task_list' || result?.scope?.source === 'attach');
      if (looksGeneric && !fromDb) {
        reply =
          `${reply}\n\n---\n_Ответ без данных AiControl. Нужен POST /api/v1/call-ai/chat ` +
          `и перезапуск AI API (порт 8003). Обновите страницу (Hard Refresh)._`;
      }
      if (fromDb && !/Источник: задачи из 2А/i.test(reply)) {
        // keep as-is; deterministic already prefixes
      }
      appendAiChatMessage?.(
        {
          kind: 'ai_assistant',
          text: reply,
          authorName: agentInfo?.name || 'AI',
          authorPeerId: null,
          entityRefs,
        },
        { broadcast: true },
      );
    } catch (e) {
      const status = e?.response?.status;
      const detail = e?.response?.data?.detail;
      let msg = typeof detail === 'string' ? detail : 'Не удалось получить ответ AI';
      if (status === 404) {
        msg =
          'Эндпоинт /api/v1/call-ai/chat не найден. Перезапустите AI-сервис (порт 8003) с актуальным кодом.';
      } else if (status === 401 || status === 403) {
        msg = typeof detail === 'string' ? detail : 'Нет доступа к AI (войдите снова).';
      } else if (!e?.response) {
        msg = 'AI API недоступен. Проверьте, что сервис на :8003 запущен.';
      }
      setError(msg);
      appendAiChatMessage?.(
        {
          kind: 'ai_system',
          text: msg,
          authorName: 'Система',
        },
        { broadcast: true },
      );
    } finally {
      setSending(false);
      releaseAiInputLock?.();
      holdingLockRef.current = false;
    }
  };

  const inputBlocked = lockHeldByOther;

  if (!open) return null;

  return (
    <aside className={styles.aiChatPanel} aria-label="Общий AI-чат звонка">
      <div className={styles.aiChatHead}>
        <div className={styles.aiChatTitle}>
          <SparklesIcon />
          <div>
            <strong>{agentInfo?.name || 'AI чат'}</strong>
            <span>Видят все в звонке</span>
          </div>
        </div>
        <button
          type="button"
          className={styles.aiChatIconBtn}
          onClick={() => {
            if (holdingLockRef.current) {
              releaseAiInputLock?.();
              holdingLockRef.current = false;
            }
            onClose?.();
          }}
          title="Закрыть"
          aria-label="Закрыть AI чат"
        >
          <XMarkIcon />
        </button>
      </div>

      {lockLabel && (
        <div
          className={`${styles.aiChatLockBanner} ${lockHeldByOther ? styles.aiChatLockBusy : styles.aiChatLockMine}`}
          role="status"
        >
          {lockLabel}
        </div>
      )}

      <div className={styles.aiChatMessages}>
        {aiChatMessages.length === 0 && !sending && (
          <div className={styles.aiChatEmpty}>
            Общий чат с AI. «мои задачи» / «активные» — покажет названия из БД.
            Пока кто-то пишет — поле занято.
          </div>
        )}
        {aiChatMessages.map((msg) => {
          const isUser = msg.kind === 'ai_user';
          const isSystem = msg.kind === 'ai_system';
          const isMe = isUser && selfPeerId && String(msg.authorPeerId) === String(selfPeerId);
          return (
            <div
              key={msg.id}
              className={`${styles.aiChatBubbleRow} ${isMe || (!isUser && !isSystem) ? styles.aiChatBubbleRowEnd : ''}`}
            >
              <div
                className={[
                  styles.aiChatBubble,
                  isUser ? styles.aiChatBubbleUser : '',
                  !isUser && !isSystem ? styles.aiChatBubbleAgent : '',
                  isSystem ? styles.aiChatBubbleSystem : '',
                ].filter(Boolean).join(' ')}
              >
                {(isUser || isSystem) && (
                  <div className={styles.aiChatAuthor}>
                    {isMe ? 'Вы' : (msg.authorName || (isSystem ? 'Система' : 'Участник'))}
                  </div>
                )}
                <div className={styles.aiChatText}>
                  {isUser || isSystem
                    ? msg.text
                    : <MarkdownContent>{msg.text}</MarkdownContent>}
                </div>
                {!isUser && !isSystem && Array.isArray(msg.entityRefs) && msg.entityRefs.length > 0 && (
                  <MessageEntityRefs entityRefs={msg.entityRefs} />
                )}
              </div>
            </div>
          );
        })}
        {sending && (
          <div className={styles.aiChatBubbleRow}>
            <div className={`${styles.aiChatBubble} ${styles.aiChatBubbleAgent} ${styles.aiChatTyping}`}>
              <span /><span /><span />
            </div>
          </div>
        )}
        {error && <div className={styles.aiChatError}>{error}</div>}
        <div ref={messagesEndRef} />
      </div>

      <div className={styles.aiChatComposer}>
        <textarea
          ref={textareaRef}
          className={styles.aiChatInput}
          rows={2}
          value={input}
          disabled={sending}
          readOnly={inputBlocked}
          placeholder={
            inputBlocked
              ? `Ждём: ${aiInputLock?.name || 'участник'}…`
              : 'Сообщение AI (видят все)…'
          }
          onChange={(e) => {
            if (inputBlocked) return;
            if (!holdingLockRef.current && !tryAcquire()) return;
            setInput(e.target.value);
          }}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
        />
        <button
          type="button"
          className={styles.aiChatSend}
          disabled={!input.trim() || sending || inputBlocked}
          onClick={() => void handleSend()}
          title="Отправить"
        >
          <PaperAirplaneIcon />
        </button>
      </div>
    </aside>
  );
}
