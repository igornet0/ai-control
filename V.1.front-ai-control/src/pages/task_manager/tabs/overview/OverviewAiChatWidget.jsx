import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MarkdownContent from '../../../../components/MarkdownContent';
import MessageEntityRefs from '../../../../components/messaging/MessageEntityRefs';
import EntityAttachPicker from '../../../profile/components/EntityAttachPicker';
import { employeeService } from '../../../../services/employeeService';
import { taskManagerAiService } from '../../../../services/taskManagerAiService';
import { entityRefKey } from '../../../../services/messagingEntityRefs';
import { withEntityAttachFallback } from '../../../../services/aiEntityAttachFallback';
import { OverviewEmpty, OverviewWidget, WidgetIcons } from './OverviewWidget';
import { PaperClipIcon } from '@heroicons/react/24/outline';

function quickPromptsForTier(tier) {
  const base = [
    { id: 'mine', label: 'Мои задачи', prompt: 'Проанализируй мои открытые и просроченные задачи' },
    { id: 'create', label: 'Создать задачу', prompt: 'Предложи создать задачу: уточни у меня название, приоритет и срок, затем верни action create_task' },
  ];
  if (tier === 'management' || tier === 'executive' || tier === 'platform_admin') {
    base.push({
      id: 'dept',
      label: 'Отдел',
      prompt: 'Что просрочено в моём отделе и где перегрузка?',
    });
  }
  if (tier === 'executive' || tier === 'platform_admin') {
    base.push({
      id: 'company',
      label: 'Компания',
      prompt: 'Дай сводку по задачам, проектам и командам компании: риски и рекомендации',
    });
  }
  return base;
}

function ActionCard({ action, index, messageId, busy, onApply, onReject }) {
  const status = action?.status || 'pending';
  const type = action?.type;
  const payload = action?.payload || {};

  let title = 'Действие';
  let details = '';
  if (type === 'create_task') {
    title = 'Создать задачу';
    details = payload.title || 'Без названия';
  } else if (type === 'update_task') {
    title = `Изменить задачу #${payload.task_id ?? '?'}`;
    const fields = payload.fields || {};
    details = Object.entries(fields)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
  }

  return (
    <div className={`ow-ai-action ow-ai-action--${status}`}>
      <div className="ow-ai-action__head">
        <strong>{title}</strong>
        <span className="ow-ai-action__status">{status}</span>
      </div>
      {details && <p className="ow-ai-action__details">{details}</p>}
      {status === 'pending' && (
        <div className="ow-ai-action__btns">
          <button
            type="button"
            className="ow-ai-btn ow-ai-btn--primary"
            disabled={busy}
            onClick={() => onApply(action, index, messageId)}
          >
            Применить
          </button>
          <button
            type="button"
            className="ow-ai-btn ow-ai-btn--secondary"
            disabled={busy}
            onClick={() => onReject(action, index, messageId)}
          >
            Отклонить
          </button>
        </div>
      )}
    </div>
  );
}

export function OverviewAiChatWidget({ model, cardId = 'ai-chat' }) {
  const [tier, setTier] = useState('employee');
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [pendingEntityRefs, setPendingEntityRefs] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const bottomRef = useRef(null);

  const prompts = useMemo(() => quickPromptsForTier(tier), [tier]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ctx = await employeeService.getContext();
        if (!cancelled) setTier(ctx?.tier || 'employee');
      } catch {
        if (!cancelled) setTier('employee');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadConversations = useCallback(async (preferId = null) => {
    setLoadingList(true);
    setError('');
    try {
      let list = await taskManagerAiService.listConversations('task_manager');
      if (!list.length) {
        const created = await taskManagerAiService.createConversation('Общий');
        list = [created];
      }
      setConversations(list);
      const nextId = preferId && list.some((c) => c.id === preferId)
        ? preferId
        : (activeId && list.some((c) => c.id === activeId) ? activeId : list[0].id);
      setActiveId(nextId);
    } catch (err) {
      setError(taskManagerAiService.formatError(err, 'Не удалось загрузить чаты'));
    } finally {
      setLoadingList(false);
    }
  }, [activeId]);

  useEffect(() => {
    loadConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      setLoadingMessages(true);
      setError('');
      try {
        const rows = await taskManagerAiService.listMessages(activeId);
        if (!cancelled) setMessages(rows);
      } catch (err) {
        if (!cancelled) {
          setError(taskManagerAiService.formatError(err, 'Не удалось загрузить сообщения'));
          setMessages([]);
        }
      } finally {
        if (!cancelled) setLoadingMessages(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
  }, [messages, sending]);

  const handleCreateTab = async () => {
    try {
      const created = await taskManagerAiService.createConversation('Новый чат');
      setConversations((prev) => [created, ...prev]);
      setActiveId(created.id);
      setMessages([]);
    } catch (err) {
      setError(taskManagerAiService.formatError(err, 'Не удалось создать чат'));
    }
  };

  const handleDeleteTab = async (id, e) => {
    e?.stopPropagation?.();
    if (!window.confirm('Удалить эту переписку?')) return;
    try {
      await taskManagerAiService.deleteConversation(id);
      const next = conversations.filter((c) => c.id !== id);
      setConversations(next);
      if (activeId === id) {
        if (next.length) {
          setActiveId(next[0].id);
        } else {
          const created = await taskManagerAiService.createConversation('Общий');
          setConversations([created]);
          setActiveId(created.id);
          setMessages([]);
        }
      }
    } catch (err) {
      setError(taskManagerAiService.formatError(err, 'Не удалось удалить чат'));
    }
  };

  const startRename = (conv, e) => {
    e?.stopPropagation?.();
    setEditingId(conv.id);
    setEditTitle(conv.title || '');
  };

  const commitRename = async () => {
    if (!editingId) return;
    const title = editTitle.trim() || 'Чат';
    try {
      const updated = await taskManagerAiService.renameConversation(editingId, title);
      setConversations((prev) => prev.map((c) => (c.id === editingId ? updated : c)));
    } catch (err) {
      setError(taskManagerAiService.formatError(err, 'Не удалось переименовать'));
    } finally {
      setEditingId(null);
    }
  };

  const sendText = async (text) => {
    const content = String(text || '').trim();
    if ((!content && !pendingEntityRefs.length) || !activeId || sending) return;
    setSending(true);
    setError('');
    setInput('');
    try {
      let message = content;
      if (pendingEntityRefs.length) {
        const labels = pendingEntityRefs
          .map((r) => `${r.type} #${r.id} «${r.title}»`)
          .join(', ');
        message = content
          ? `${content}\n\n[прикреплено: ${labels}]`
          : `Пришли карточку: ${labels}`;
      }
      const res = await taskManagerAiService.sendMessage(activeId, message);
      setPendingEntityRefs([]);
      const assistant = withEntityAttachFallback(
        res.assistant_message,
        message,
        messages
      );
      setMessages((prev) => [...prev, res.user_message, assistant]);
      const list = await taskManagerAiService.listConversations('task_manager');
      setConversations(list);
    } catch (err) {
      setError(taskManagerAiService.formatError(err, 'Не удалось отправить сообщение'));
    } finally {
      setSending(false);
    }
  };

  const patchMessage = (message) => {
    if (!message) return;
    setMessages((prev) => prev.map((m) => (m.id === message.id ? message : m)));
  };

  const handleApply = async (action, index, messageId) => {
    setActionBusy(true);
    setError('');
    try {
      const res = await taskManagerAiService.applyAction(action, {
        messageId,
        actionIndex: index,
      });
      if (res.message) patchMessage(res.message);
      else {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== messageId) return m;
            const actions = [...(m.meta?.actions || [])];
            if (actions[index]) actions[index] = { ...actions[index], status: 'applied', result: res.result };
            return { ...m, meta: { ...(m.meta || {}), actions } };
          })
        );
      }
      await model?.reloadTasks?.({ silent: true });
    } catch (err) {
      setError(taskManagerAiService.formatError(err, 'Не удалось применить действие'));
    } finally {
      setActionBusy(false);
    }
  };

  const handleReject = async (action, index, messageId) => {
    setActionBusy(true);
    setError('');
    try {
      const res = await taskManagerAiService.rejectAction(action, {
        messageId,
        actionIndex: index,
      });
      if (res.message) patchMessage(res.message);
      else {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== messageId) return m;
            const actions = [...(m.meta?.actions || [])];
            if (actions[index]) actions[index] = { ...actions[index], status: 'rejected' };
            return { ...m, meta: { ...(m.meta || {}), actions } };
          })
        );
      }
    } catch (err) {
      setError(taskManagerAiService.formatError(err, 'Не удалось отклонить действие'));
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <OverviewWidget
      cardId={cardId}
      accent="cyan"
      icon={WidgetIcons.aiChat}
      title="AI чат"
      subtitle="Переписки по темам · создание и правка задач"
      className="overview-widget--ai-chat overview-widget--fill"
    >
      <div className="ow-ai-chat">
        <div className="ow-ai-chat__tabs">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              className={`ow-ai-chat__tab ${activeId === conv.id ? 'ow-ai-chat__tab--active' : ''}`}
              onClick={() => setActiveId(conv.id)}
              role="tab"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setActiveId(conv.id);
                }
              }}
            >
              {editingId === conv.id ? (
                <input
                  className="ow-ai-chat__tab-input"
                  value={editTitle}
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      commitRename();
                    }
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                />
              ) : (
                <span className="ow-ai-chat__tab-title" title={conv.title}>
                  {conv.title || 'Чат'}
                </span>
              )}
              <button
                type="button"
                className="ow-ai-chat__tab-btn"
                title="Переименовать"
                onClick={(e) => startRename(conv, e)}
              >
                ✎
              </button>
              <button
                type="button"
                className="ow-ai-chat__tab-btn"
                title="Удалить"
                onClick={(e) => handleDeleteTab(conv.id, e)}
              >
                ×
              </button>
            </div>
          ))}
          <button type="button" className="ow-ai-chat__tab-add" onClick={handleCreateTab} title="Новая переписка">
            +
          </button>
        </div>

        <div className="ow-ai-chat__prompts">
          {prompts.map((p) => (
            <button
              key={p.id}
              type="button"
              className="ow-ai-chip"
              disabled={sending || !activeId}
              onClick={() => sendText(p.prompt)}
            >
              {p.label}
            </button>
          ))}
        </div>

        {error && <div className="ow-ai-error">{error}</div>}

        <div className="ow-ai-chat__messages">
          {(loadingList || loadingMessages) && messages.length === 0 ? (
            <OverviewEmpty iconKey="loading" text="Загрузка…" />
          ) : messages.length === 0 ? (
            <OverviewEmpty iconKey="empty" text="Начните новую тему или выберите быстрый запрос" />
          ) : (
            messages.map((m) => (
              <div key={m.id} className={`ow-ai-msg ow-ai-msg--${m.role}`}>
                <div className="ow-ai-msg__bubble">
                  {m.role === 'assistant' ? (
                    <MarkdownContent>{m.content}</MarkdownContent>
                  ) : (
                    <p>{m.content}</p>
                  )}
                  {Array.isArray(m.meta?.entity_refs) && m.meta.entity_refs.length > 0 && (
                    <MessageEntityRefs entityRefs={m.meta.entity_refs} />
                  )}
                </div>
                {m.role === 'assistant' && Array.isArray(m.meta?.actions) && m.meta.actions.length > 0 && (
                  <div className="ow-ai-msg__actions">
                    {m.meta.actions.map((action, idx) => (
                      <ActionCard
                        key={action.id || idx}
                        action={action}
                        index={idx}
                        messageId={m.id}
                        busy={actionBusy}
                        onApply={handleApply}
                        onReject={handleReject}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
          {sending && <div className="ow-ai-msg ow-ai-msg--assistant"><div className="ow-ai-msg__bubble">Думаю…</div></div>}
          <div ref={bottomRef} />
        </div>

        <form
          className="ow-ai-chat__composer"
          onSubmit={(e) => {
            e.preventDefault();
            sendText(input);
          }}
        >
          {pendingEntityRefs.length > 0 && (
            <MessageEntityRefs entityRefs={pendingEntityRefs} />
          )}
          <button
            type="button"
            className="ow-ai-btn ow-ai-btn--secondary"
            disabled={sending || !activeId}
            onClick={() => setPickerOpen(true)}
            title="Прикрепить объект"
            aria-label="Прикрепить объект"
          >
            <PaperClipIcon className="w-4 h-4" />
          </button>
          <input
            className="form-input text-sm ow-ai-chat__input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Спросите про задачи или пришлите карточку…"
            disabled={sending || !activeId}
          />
          <button
            type="submit"
            className="ow-ai-btn ow-ai-btn--primary"
            disabled={sending || (!input.trim() && !pendingEntityRefs.length) || !activeId}
          >
            Отправить
          </button>
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
    </OverviewWidget>
  );
}

export default OverviewAiChatWidget;
