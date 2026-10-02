import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  PaperAirplaneIcon,
  TrashIcon,
  PaperClipIcon,
  XMarkIcon,
  CheckIcon,
  ClipboardDocumentListIcon,
  DocumentTextIcon,
  DocumentDuplicateIcon,
  ChartBarIcon,
  LinkIcon,
} from '@heroicons/react/24/outline';
import { aiAgentService } from '../../../services/aiAgentService';
import { taskService } from '../../../services/taskService';
import {
  buildEntityRef,
  getEntityRefLabel,
  openEntityRef,
} from '../../../services/messagingEntityRefs';
import Avatar from '../../../components/Avatar';
import EntityAttachPicker from './EntityAttachPicker';
import MarkdownContent from '../../../components/MarkdownContent';
import {
  applyCreateDocumentProposal,
  classifyDocumentIntent,
  formatProposalValue,
  parseDocumentAiReply,
  proposalLabel as documentProposalLabel,
  buildEditorExtraContext,
  userAllowsFormulaOverwrite,
} from '../../documents/documentEditorAi';
import {
  loadDocumentAiSnapshot,
  loadTemplateAiSnapshot,
} from '../../documents/documentAiContext';
import styles from './AiAgentChat.module.css';

function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

const ENTITY_REF_ICONS = {
  document: DocumentTextIcon,
  template: DocumentDuplicateIcon,
  task: ClipboardDocumentListIcon,
  dashboard: ChartBarIcon,
  dashboard_sheet: ChartBarIcon,
};

function entityLabel(type, caseForm = 'nom') {
  if (type === 'task') return caseForm === 'acc' ? 'задачу' : 'Задача';
  if (type === 'document') return caseForm === 'acc' ? 'документ' : 'Документ';
  if (type === 'template') return caseForm === 'acc' ? 'шаблон' : 'Шаблон';
  if (type === 'dashboard') return caseForm === 'acc' ? 'дашборд' : 'Дашборд';
  return type;
}

function entityRefKey(ref) {
  return `${ref.type}:${ref.id}${ref.dashboard_id ? `:${ref.dashboard_id}` : ''}`;
}

/** Разбор текста и вложений (в т.ч. старый формат `[Задача: …]\\nтекст`). */
function parseMessageDisplay(msg) {
  let text = String(msg?.content || '');
  let refs = Array.isArray(msg?._entity_refs) ? [...msg._entity_refs] : [];

  const legacy = text.match(/^\[(Задача|Документ|Дашборд):\s*(.+?)\]\n([\s\S]*)$/);
  if (legacy) {
    const typeMap = { Задача: 'task', Документ: 'document', Дашборд: 'dashboard' };
    const type = typeMap[legacy[1]] || 'task';
    text = legacy[3];
    if (!refs.length) {
      refs = [{
        type,
        id: msg._entity_id || null,
        title: legacy[2],
      }];
    }
  }

  if (!refs.length && msg?._entity_type && msg?._entity_id != null) {
    refs = [{
      type: msg._entity_type,
      id: msg._entity_id,
      title: msg._entity_title || entityLabel(msg._entity_type),
    }];
  }

  return { text, refs: refs.filter((r) => r && r.type) };
}

function MessageEntityRefs({ entityRefs }) {
  if (!entityRefs?.length) return null;
  return (
    <div className={styles.messageEntityRefs}>
      {entityRefs.map((ref, idx) => {
        const Icon = ENTITY_REF_ICONS[ref.type] || LinkIcon;
        const canOpen = ref.id != null;
        return (
          <button
            key={entityRefKey(ref) || `ref-${idx}`}
            type="button"
            className={styles.entityRefCard}
            disabled={!canOpen}
            onClick={(e) => {
              e.stopPropagation();
              if (canOpen) openEntityRef(ref);
            }}
            title={canOpen ? `Открыть: ${ref.title || ''}` : (ref.title || '')}
          >
            <Icon />
            <span className={styles.entityRefBody}>
              <span className={styles.entityRefKind}>{getEntityRefLabel(ref)}</span>
              <span className={styles.entityRefTitle}>{ref.title || `#${ref.id}`}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function AgentAvatar({ avatarPath, avatarPreview, name }) {
  const src = avatarPreview || avatarPath;
  if (src) {
    return (
      <Avatar
        src={src}
        name={name || 'AI'}
        preset="avatar_sm"
        className={styles.agentAvatar}
        imgClassName={styles.agentAvatarImg}
        rounded="lg"
        alt={name || 'AI'}
      />
    );
  }
  return (
    <span className={styles.agentAvatar}>
      <svg className={styles.agentAvatarIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
      </svg>
    </span>
  );
}

function ProposalsBlock({ message, onProposalsChange }) {
  const proposals = Array.isArray(message._proposals) ? message._proposals : [];
  const [busyId, setBusyId] = useState(null);
  const [local, setLocal] = useState(() =>
    proposals.map((p) => ({ ...p, status: p.status || 'pending' }))
  );

  useEffect(() => {
    setLocal(proposals.map((p) => ({ ...p, status: p.status || 'pending' })));
  }, [message.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!local.length) return null;

  const pending = local.filter((p) => !p.status || p.status === 'pending');
  const isDocumentProtocol = Boolean(message._document_protocol);

  const commit = (next) => {
    setLocal(next);
    onProposalsChange?.(message.id, next);
  };

  const patchOne = (idOrIdx, patch) => {
    const next = local.map((p, idx) => {
      const key = p.id ?? `l-${idx}`;
      if ((p.id != null && p.id === idOrIdx) || key === idOrIdx) {
        return { ...p, ...patch };
      }
      return p;
    });
    commit(next);
  };

  const fallbackEntity = {
    type: message._entity_type,
    id: message._apply_document_id || message._entity_id,
    fieldsList: message._fields_list,
    sheetBlocks: message._sheet_blocks,
    allowFormulaOverwrite: message._allow_formula_overwrite,
  };

  const handleApply = async (p, idx) => {
    const key = p.id ?? `l-${idx}`;
    setBusyId(key);
    try {
      if (p.op === 'create_document') {
        const applied = await applyCreateDocumentProposal(p);
        patchOne(p.id ?? key, {
          status: 'applied',
          created_document: applied.created_document,
        });
      } else {
        await aiAgentService.applyProposal(p, fallbackEntity);
        patchOne(p.id ?? key, { status: 'applied' });
      }
    } catch (e) {
      patchOne(p.id ?? key, { status: 'error', _error: e?.message || 'Ошибка' });
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (p, idx) => {
    const key = p.id ?? `l-${idx}`;
    setBusyId(key);
    try {
      await aiAgentService.rejectProposal(p);
      patchOne(p.id ?? key, { status: 'rejected' });
    } catch {
      patchOne(p.id ?? key, { status: 'rejected' });
    } finally {
      setBusyId(null);
    }
  };

  const handleApplyAll = async () => {
    setBusyId('all');
    try {
      const next = [...local];
      const order = next
        .map((p, idx) => ({ p, idx }))
        .sort((a, b) => {
          const aCreate = a.p.op === 'create_document' ? 0 : 1;
          const bCreate = b.p.op === 'create_document' ? 0 : 1;
          return aCreate - bCreate;
        });
      for (const { p, idx } of order) {
        if (p.status && p.status !== 'pending') continue;
        try {
          if (p.op === 'create_document') {
            const applied = await applyCreateDocumentProposal(p);
            next[idx] = { ...p, status: 'applied', created_document: applied.created_document };
          } else {
            await aiAgentService.applyProposal(p, fallbackEntity);
            next[idx] = { ...p, status: 'applied' };
          }
        } catch (e) {
          next[idx] = { ...p, status: 'error', _error: e?.message || 'Ошибка' };
        }
      }
      commit(next);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className={styles.proposals}>
      <div className={styles.proposalsHead}>
        <span>Предложения изменений</span>
        {pending.length > 1 && (
          <button
            type="button"
            className={styles.proposalApplyAll}
            disabled={busyId === 'all'}
            onClick={handleApplyAll}
          >
            Применить все ({pending.length})
          </button>
        )}
      </div>
      {local.map((p, idx) => {
        const key = p.id ?? `l-${idx}`;
        const status = p.status || 'pending';
        const created = p.created_document;
        const label = isDocumentProtocol || p.op
          ? documentProposalLabel(p)
          : (p.field_name || 'поле');
        const preview = isDocumentProtocol || p.op
          ? formatProposalValue(p)
          : p.proposed_value;
        return (
          <div key={key} className={styles.proposalCard}>
            <div className={styles.proposalField}>{label}</div>
            {p.reason && <div className={styles.proposalReason}>{p.reason}</div>}
            <div className={styles.proposalDiff}>
              {p.original_value != null && (
                <div className={styles.proposalOld}>
                  <span>Было</span>
                  <pre>{p.original_value ?? '—'}</pre>
                </div>
              )}
              <div className={styles.proposalNew}>
                <span>{p.op === 'create_document' ? 'Поля нового документа' : 'Станет'}</span>
                <pre>{preview || '—'}</pre>
              </div>
            </div>
            {p._error && <div className={styles.proposalReason}>{p._error}</div>}
            {created?.id != null && (
              <a
                className={styles.createdDocLink}
                href={`/documents?document=${created.id}`}
              >
                Открыть в редакторе: {created.title || created.number || `#${created.id}`}
              </a>
            )}
            {status === 'pending' ? (
              <div className={styles.proposalActions}>
                <button
                  type="button"
                  className={styles.proposalApply}
                  disabled={busyId != null}
                  onClick={() => handleApply(p, idx)}
                >
                  <CheckIcon width={14} height={14} />
                  {p.op === 'create_document' ? 'Создать документ' : 'Применить'}
                </button>
                <button
                  type="button"
                  className={styles.proposalReject}
                  disabled={busyId != null}
                  onClick={() => handleReject(p, idx)}
                >
                  Отклонить
                </button>
              </div>
            ) : (
              <div className={`${styles.proposalStatus} ${styles[`proposalStatus_${status}`] || ''}`}>
                {status === 'applied'
                  ? (p.op === 'create_document' ? 'Документ создан' : 'Применено')
                  : status === 'rejected' ? 'Отклонено' : status}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function AiAgentChat({ user }) {
  const [agentInfo, setAgentInfo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [typingDots, setTypingDots] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [attachments, setAttachments] = useState([]); // [{ type, id, title, context, ref, summary, fieldsList, sheetBlocks }]
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const selectedAttachKeys = useMemo(
    () => attachments.map((a) => `${a.type}:${a.id}`),
    [attachments]
  );

  const resizeComposer = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const max = 140; // sync with CSS max-height
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [info, history] = await Promise.all([
        aiAgentService.getAgentInfo().catch(() => ({ name: 'AI Ассистент', avatar_path: null, enabled: false })),
        aiAgentService.getHistory().catch(() => ({ messages: [] })),
      ]);
      setAgentInfo(info);
      setMessages(history.messages || []);
    } catch (e) {
      setError('Не удалось загрузить чат с AI агентом');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!loading) scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  useEffect(() => {
    resizeComposer();
  }, [input, resizeComposer]);

  const handleEntitySelect = useCallback(async (ref) => {
    if (!ref?.type || ref.id == null) return;
    const key = `${ref.type}:${ref.id}`;

    const exists = attachments.some((a) => `${a.type}:${a.id}` === key);
    if (exists) {
      setAttachments((prev) => prev.filter((a) => `${a.type}:${a.id}` !== key));
      return;
    }

    let context = null;
    let summary = '';
    let fieldsList;
    let sheetBlocks;
    if (ref.type === 'task') {
      try {
        const full = await taskService.getTask(ref.id).catch(() => null);
        context = {
          _entity_type: 'task',
          _entity_id: ref.id,
          _editable_fields: ['title', 'description', 'priority', 'status'],
          title: full?.title || ref.title,
          description: full?.description || '',
          status: full?.status,
          priority: full?.priority,
        };
      } catch {
        context = {
          _entity_type: 'task',
          _entity_id: ref.id,
          _editable_fields: ['title', 'description', 'priority', 'status'],
          title: ref.title,
        };
      }
    } else if (ref.type === 'document') {
      try {
        const snap = await loadDocumentAiSnapshot(ref.id);
        context = {
          _entity_type: 'document',
          _entity_id: ref.id,
          _editable_fields: ['title', 'field_data', ...((snap.fieldsList || []).map((f) => `field.${f.name}`))],
          title: snap.doc?.title || ref.title || '',
          number: snap.doc?.number || '',
        };
        summary = snap.summary;
        fieldsList = snap.fieldsList;
        sheetBlocks = snap.sheetBlocks;
      } catch {
        context = {
          _entity_type: 'document',
          _entity_id: ref.id,
          _editable_fields: ['title', 'field_data'],
          title: ref.title || '',
        };
      }
    } else if (ref.type === 'template') {
      try {
        const snap = await loadTemplateAiSnapshot(ref.id);
        summary = snap.summary;
        fieldsList = snap.fieldsList;
        context = {
          _entity_type: 'template',
          _entity_id: ref.id,
          title: snap.template?.name || ref.title || '',
        };
      } catch {
        context = {
          _entity_type: 'template',
          _entity_id: ref.id,
          title: ref.title || '',
        };
      }
    }

    setAttachments((prev) => {
      if (prev.some((a) => `${a.type}:${a.id}` === key)) return prev;
      return [...prev, {
        type: ref.type,
        id: ref.id,
        title: ref.title || entityLabel(ref.type),
        context,
        summary,
        fieldsList,
        sheetBlocks,
        ref: buildEntityRef(ref.type, ref.id, ref.title, {
          dashboardId: ref.dashboard_id,
          url: ref.url,
        }),
      }];
    });

    if (!input.trim()) {
      if (ref.type === 'template') {
        setInput('Создай документ по этому шаблону на основе прикреплённых документов. Рассчитай и заполни поля.');
      } else if (ref.type === 'document') {
        setInput('Проанализируй поля документа, укажи незаполненные и предложи значения');
      } else if (ref.type === 'task') {
        setInput('Проанализируй задачу и предложи, что можно улучшить');
      }
    }
  }, [attachments, input]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setSending(true);
    setError('');

    const currentAttachments = attachments;
    const entityRefs = currentAttachments.length
      ? currentAttachments.map((a) => a.ref || buildEntityRef(a.type, a.id, a.title))
      : null;

    const tempUserMsg = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
      _entity_refs: entityRefs,
      _temp: true,
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    setTypingDots(true);
    scrollToBottom();

    const docs = currentAttachments.filter((a) => a.type === 'document');
    const templates = currentAttachments.filter((a) => a.type === 'template');
    const tasks = currentAttachments.filter((a) => a.type === 'task');
    const useDocumentProtocol = docs.length > 0 || templates.length > 0;
    const singleTask = !useDocumentProtocol && tasks.length === 1 ? tasks[0] : null;

    try {
      let result;
      if (useDocumentProtocol) {
        const allowFormulaOverwrite = userAllowsFormulaOverwrite(text);
        const intent = classifyDocumentIntent(text, {
          forceAct: templates.length > 0,
          hasSources: docs.length > 0,
        });
        const extraSystemContext = buildEditorExtraContext({
          intent,
          allowCreate: templates.length > 0,
          documentSnapshot: docs.length === 1 && templates.length === 0 ? docs[0].summary : null,
          sourceDocuments: (docs.length > 1 || templates.length > 0)
            ? docs.map((d) => d.summary).filter(Boolean)
            : [],
          templates: templates.map((t) => t.summary).filter(Boolean),
        });
        result = await aiAgentService.sendMessage(text, {
          systemPrompt: agentInfo?.system_prompt || null,
          apiKeyId: agentInfo?.api_key_id || null,
          agentName: agentInfo?.name || 'AI Ассистент',
          skipTriggers: true,
          extraSystemContext,
          entityRefs,
        });
        const parsed = parseDocumentAiReply(result.agent_message?.content || '', intent);
        const applyDocId = docs.length === 1 && templates.length === 0 ? docs[0].id : null;
        const defaultTemplateId = templates.length === 1 ? templates[0].id : null;
        const proposals = parsed.proposals.map((p) => ({
          ...p,
          _local: true,
          template_id: p.op === 'create_document' && p.template_id == null && defaultTemplateId != null
            ? defaultTemplateId
            : p.template_id,
          entity_type: applyDocId != null ? 'document' : p.entity_type,
          entity_id: applyDocId != null ? applyDocId : p.entity_id,
        }));
        result = {
          ...result,
          agent_message: {
            ...result.agent_message,
            content: parsed.summary || result.agent_message?.content || '',
            _proposals: proposals.length ? proposals : null,
            _document_protocol: true,
            _entity_type: applyDocId != null ? 'document' : null,
            _entity_id: applyDocId,
            _apply_document_id: applyDocId,
            _fields_list: applyDocId != null ? docs[0].fieldsList : null,
            _sheet_blocks: applyDocId != null ? docs[0].sheetBlocks : null,
            _allow_formula_overwrite: allowFormulaOverwrite,
          },
        };
      } else {
        const analyzable = Boolean(singleTask);
        result = await aiAgentService.sendMessage(text, {
          systemPrompt: agentInfo?.system_prompt || null,
          apiKeyId: agentInfo?.api_key_id || null,
          agentName: agentInfo?.name || 'AI Ассистент',
          triggers: agentInfo?.triggers || [],
          entityType: analyzable ? singleTask.type : 'none',
          entityId: analyzable ? singleTask.id : null,
          entityContext: analyzable ? singleTask.context : null,
          forceProposals: Boolean(analyzable),
          entityRefs,
        });
      }
      setMessages((prev) => {
        const filtered = prev.filter((m) => !m._temp);
        const next = [...filtered, result.user_message, result.agent_message].filter(Boolean);
        aiAgentService.saveMessages(next);
        return next;
      });
      setAttachments([]);
    } catch (e) {
      setMessages((prev) => prev.filter((m) => !m._temp));
      const detail = e?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Не удалось отправить сообщение');
    } finally {
      setSending(false);
      setTypingDots(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleProposalsChange = useCallback((messageId, nextProposals) => {
    setMessages((prev) => {
      const updated = prev.map((m) => (
        m.id === messageId ? { ...m, _proposals: nextProposals } : m
      ));
      aiAgentService.saveMessages(updated);
      return updated;
    });
  }, []);

  const handleClear = async () => {
    if (!window.confirm('Очистить историю переписки с AI агентом?')) return;
    try {
      await aiAgentService.clearHistory();
      setMessages([]);
    } catch (e) {
      setError('Не удалось очистить историю');
    }
  };

  if (loading) {
    return (
      <div className={styles.loadingWrap}>
        <div className={styles.loadingSpinner} />
        <span>Загрузка AI агента…</span>
      </div>
    );
  }

  if (!agentInfo?.enabled) {
    return (
      <div className={styles.loadingWrap}>
        <span>AI ассистент недоступен для вашего аккаунта</span>
      </div>
    );
  }

  const agentName = agentInfo?.name || 'AI Ассистент';
  const agentAvatarPath = agentInfo?.avatar_path;
  const agentAvatarPreview = agentInfo?._avatar_preview || null;

  return (
    <div className={styles.root}>
      <div className={styles.head}>
        <AgentAvatar avatarPath={agentAvatarPath} avatarPreview={agentAvatarPreview} name={agentName} />
        <div className={styles.headInfo}>
          <span className={styles.headName}>{agentName}</span>
          <span className={styles.headStatus}>
            <span className={styles.headStatusDot} />
            AI · всегда онлайн
          </span>
        </div>
        <button type="button" className={styles.clearBtn} onClick={handleClear} title="Очистить историю">
          <TrashIcon className={styles.clearIcon} />
        </button>
      </div>

      <div className={styles.messages}>
        {messages.length === 0 && !typingDots && (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
              </svg>
            </div>
            <strong>Привет! Я {agentName}</strong>
            <p>Прикрепите документы и шаблон — проанализирую поля или создам новый документ</p>
          </div>
        )}

        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          const { text, refs } = parseMessageDisplay(msg);
          return (
            <div key={msg.id} className={`${styles.bubbleRow} ${isUser ? styles.bubbleRowUser : styles.bubbleRowAgent}`}>
              {!isUser && <AgentAvatar avatarPath={agentAvatarPath} avatarPreview={agentAvatarPreview} name={agentName} />}
              <div className={`${styles.bubble} ${isUser ? styles.bubbleUser : styles.bubbleAgent}`}>
                {text ? (
                  <div className={styles.bubbleText}>
                    {isUser ? text : <MarkdownContent>{text}</MarkdownContent>}
                  </div>
                ) : null}
                <MessageEntityRefs entityRefs={refs} />
                {!isUser && (
                  <ProposalsBlock
                    message={msg}
                    onProposalsChange={handleProposalsChange}
                  />
                )}
                <div className={styles.bubbleMeta}>{formatTime(msg.created_at)}</div>
              </div>
            </div>
          );
        })}

        {typingDots && (
          <div className={`${styles.bubbleRow} ${styles.bubbleRowAgent}`}>
            <AgentAvatar avatarPath={agentAvatarPath} avatarPreview={agentAvatarPreview} name={agentName} />
            <div className={`${styles.bubble} ${styles.bubbleAgent} ${styles.typingBubble}`}>
              <span className={styles.dot} />
              <span className={styles.dot} />
              <span className={styles.dot} />
            </div>
          </div>
        )}

        {error && <div className={styles.errorBanner}>{error}</div>}
        <div ref={messagesEndRef} />
      </div>

      {attachments.length > 0 && (
        <div className={styles.attachChipRow}>
          {attachments.map((item) => {
            const ChipIcon = ENTITY_REF_ICONS[item.type] || LinkIcon;
            return (
              <button
                key={`${item.type}:${item.id}`}
                type="button"
                className={styles.entityRefCard}
                onClick={() => item.ref && openEntityRef(item.ref)}
                title={`Открыть: ${item.title}`}
              >
                <ChipIcon />
                <span className={styles.entityRefBody}>
                  <span className={styles.entityRefKind}>{entityLabel(item.type)}</span>
                  <span className={styles.entityRefTitle}>{item.title}</span>
                </span>
              </button>
            );
          })}
          <button
            type="button"
            className={styles.attachChipClear}
            onClick={() => setAttachments([])}
            title="Открепить все"
          >
            <XMarkIcon width={14} height={14} />
          </button>
        </div>
      )}

      <div className={styles.composer}>
        <div className={styles.attachWrap}>
          <button
            type="button"
            className={`${styles.attachBtn} ${attachOpen || attachments.length ? styles.attachBtnActive : ''}`}
            title="Прикрепить из проекта"
            disabled={sending}
            onClick={() => setAttachOpen(true)}
          >
            <PaperClipIcon className={styles.attachIcon} />
          </button>
        </div>

        <textarea
          ref={textareaRef}
          className={styles.composerInput}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onInput={resizeComposer}
          onKeyDown={handleKeyDown}
          placeholder={attachments.length ? 'Спросить про прикреплённые объекты…' : `Написать ${agentName}…`}
          rows={1}
          disabled={sending}
        />
        <button
          type="button"
          className={styles.sendBtn}
          onClick={handleSend}
          disabled={!input.trim() || sending}
          title="Отправить (Enter)"
        >
          {sending ? (
            <span className={styles.sendSpinner} />
          ) : (
            <PaperAirplaneIcon className={styles.sendIcon} />
          )}
        </button>
      </div>

      <EntityAttachPicker
        open={attachOpen}
        onClose={() => setAttachOpen(false)}
        onSelect={handleEntitySelect}
        selectedKeys={selectedAttachKeys}
      />
    </div>
  );
}
