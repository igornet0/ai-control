import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  PaperAirplaneIcon,
  TrashIcon,
  XMarkIcon,
  SparklesIcon,
  PaperClipIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import { aiAgentService } from '../../services/aiAgentService';
import MarkdownContent from '../../components/MarkdownContent';
import MessageEntityRefs from '../../components/messaging/MessageEntityRefs';
import EntityAttachPicker from '../profile/components/EntityAttachPicker';
import { documentDisplayTitle } from '../../services/messagingEntityRefs';
import {
  applyAllDocumentProposals,
  applyDocumentProposal,
  buildEditorExtraContext,
  classifyDocumentIntent,
  formatProposalValue,
  parseDocumentAiReply,
  proposalLabel,
  userAllowsFormulaOverwrite,
} from './documentEditorAi';
import { findIncompleteFields, summarizeDocumentContext, loadDocumentAiSnapshot } from './documentAiContext';
import styles from './DocumentAiAssistant.module.css';

const FAQ_SCOPE = 'document-editor';
const PANEL_HEIGHT_KEY = 'document_ai_assistant_height';
const PANEL_WIDTH_KEY = 'document_ai_assistant_width';
const PANEL_POS_KEY = 'document_ai_assistant_pos';
const PANEL_HEIGHT_DEFAULT = 320;
const PANEL_HEIGHT_MIN = 220;
const PANEL_WIDTH_DEFAULT = 380;
const PANEL_WIDTH_MIN = 280;

const DEFAULT_SUGGESTIONS = [
  'Какие поля не заполнены?',
  'Заполни пустые поля',
  'Проверь таблицу',
  'Заполни на основе прикреплённых документов',
];

function readStoredPanelHeight() {
  try {
    const n = Number(localStorage.getItem(PANEL_HEIGHT_KEY));
    if (Number.isFinite(n) && n >= PANEL_HEIGHT_MIN) return Math.round(n);
  } catch {
    /* ignore */
  }
  return PANEL_HEIGHT_DEFAULT;
}

function readStoredPanelWidth() {
  try {
    const n = Number(localStorage.getItem(PANEL_WIDTH_KEY));
    if (Number.isFinite(n) && n >= PANEL_WIDTH_MIN) return Math.round(n);
  } catch {
    /* ignore */
  }
  return PANEL_WIDTH_DEFAULT;
}

function readStoredPanelPos() {
  try {
    const raw = JSON.parse(localStorage.getItem(PANEL_POS_KEY) || 'null');
    if (raw && Number.isFinite(raw.x) && Number.isFinite(raw.y)) {
      return { x: Math.round(raw.x), y: Math.round(raw.y) };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function persistPanelPos(pos) {
  try {
    localStorage.setItem(PANEL_POS_KEY, JSON.stringify(pos));
  } catch {
    /* ignore */
  }
}

function persistPanelHeight(h) {
  try {
    localStorage.setItem(PANEL_HEIGHT_KEY, String(h));
  } catch {
    /* ignore */
  }
}

function persistPanelWidth(w) {
  try {
    localStorage.setItem(PANEL_WIDTH_KEY, String(w));
  } catch {
    /* ignore */
  }
}

function normalizeQuestion(q) {
  return String(q || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export default function DocumentAiAssistant({
  documentId,
  documentTitle = '',
  kindName = '',
  number = '',
  templateId = null,
  templateVersion = null,
  fieldsList = [],
  fieldData = {},
  sheetBlocks = null,
  isTableDocument = false,
  placeholderVars = null,
  onApplyFieldData,
  onApplyTitle = null,
  onSave = null,
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [agentInfo, setAgentInfo] = useState(null);
  const [faqs, setFaqs] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [panelHeight, setPanelHeight] = useState(readStoredPanelHeight);
  const [panelWidth, setPanelWidth] = useState(readStoredPanelWidth);
  const [panelPos, setPanelPos] = useState(readStoredPanelPos);
  const [resizingHeight, setResizingHeight] = useState(false);
  const [resizingWidth, setResizingWidth] = useState(false);
  const [movingPanel, setMovingPanel] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [sourceDocs, setSourceDocs] = useState([]); // { id, title, summary }
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const hostRef = useRef(null);
  const resizeDragRef = useRef(null);
  const widthDragRef = useRef(null);
  const moveDragRef = useRef(null);
  const fieldDataRef = useRef(fieldData);
  const titleRef = useRef(documentTitle);

  fieldDataRef.current = fieldData;
  titleRef.current = documentTitle;

  const suggestions = useMemo(() => {
    if (faqs.length) return faqs.map((f) => f.question);
    return DEFAULT_SUGGESTIONS;
  }, [faqs]);

  const faqByQuestion = useMemo(() => {
    const map = new Map();
    for (const f of faqs) map.set(normalizeQuestion(f.question), f);
    return map;
  }, [faqs]);

  const historyScope = useMemo(
    () => `document-${documentId || 'draft'}`,
    [documentId],
  );

  useEffect(() => {
    setLoaded(false);
    setMessages([]);
    setSourceDocs([]);
  }, [historyScope]);

  const sourceDocKeys = useMemo(
    () => sourceDocs.map((d) => `document:${d.id}`),
    [sourceDocs],
  );

  const handleSourceSelect = useCallback(async (ref) => {
    if (ref?.type !== 'document' || ref.id == null) return;
    const key = `document:${ref.id}`;
    if (Number(ref.id) === Number(documentId)) return;

    const exists = sourceDocs.some((d) => String(d.id) === String(ref.id));
    if (exists) {
      setSourceDocs((prev) => prev.filter((d) => String(d.id) !== String(ref.id)));
      return;
    }

    try {
      const snap = await loadDocumentAiSnapshot(ref.id);
      setSourceDocs((prev) => [...prev, {
        id: ref.id,
        title: documentDisplayTitle(snap.doc) || ref.title || `Документ #${ref.id}`,
        summary: snap.summary,
      }]);
      if (!input.trim()) {
        setInput('Заполни текущий документ на основе прикреплённых документов-источников');
      }
    } catch {
      setError('Не удалось загрузить документ-источник');
    }
  }, [documentId, sourceDocs, input]);

  const removeSourceDoc = useCallback((id) => {
    setSourceDocs((prev) => prev.filter((d) => String(d.id) !== String(id)));
  }, []);

  const clampPanelHeight = useCallback((next) => {
    const hostH = hostRef.current?.clientHeight || window.innerHeight;
    const maxH = Math.max(PANEL_HEIGHT_MIN, hostH - 24);
    return Math.round(Math.min(maxH, Math.max(PANEL_HEIGHT_MIN, next)));
  }, []);

  const clampPanelWidth = useCallback((next) => {
    const hostW = hostRef.current?.clientWidth || window.innerWidth;
    const maxW = Math.max(PANEL_WIDTH_MIN, hostW - 24);
    return Math.round(Math.min(maxW, Math.max(PANEL_WIDTH_MIN, next)));
  }, []);

  const clampPanelPos = useCallback((x, y, height = panelHeight, width = panelWidth) => {
    const host = hostRef.current;
    const hostW = host?.clientWidth || window.innerWidth;
    const hostH = host?.clientHeight || window.innerHeight;
    const maxX = Math.max(8, hostW - width - 8);
    const maxY = Math.max(8, hostH - height - 8);
    return {
      x: Math.round(Math.min(maxX, Math.max(8, x))),
      y: Math.round(Math.min(maxY, Math.max(8, y))),
    };
  }, [panelHeight, panelWidth]);

  const ensurePanelPos = useCallback(() => {
    if (panelPos) return panelPos;
    const host = hostRef.current;
    const hostW = host?.clientWidth || window.innerWidth;
    const hostH = host?.clientHeight || window.innerHeight;
    const next = clampPanelPos(
      hostW - panelWidth - 16,
      hostH - panelHeight - 16,
      panelHeight,
      panelWidth,
    );
    setPanelPos(next);
    persistPanelPos(next);
    return next;
  }, [panelPos, panelHeight, panelWidth, clampPanelPos]);

  useEffect(() => {
    if (open) ensurePanelPos();
  }, [open, ensurePanelPos]);

  useEffect(() => {
    const onResize = () => {
      setPanelWidth((w) => clampPanelWidth(w));
      setPanelHeight((h) => clampPanelHeight(h));
      setPanelPos((p) => {
        if (!p) return p;
        const next = clampPanelPos(p.x, p.y);
        if (next.x === p.x && next.y === p.y) return p;
        persistPanelPos(next);
        return next;
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [clampPanelPos, clampPanelHeight, clampPanelWidth]);

  const startResizeHeight = useCallback((e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const pos = ensurePanelPos();
    resizeDragRef.current = {
      startY: e.clientY,
      startHeight: panelHeight,
      startTop: pos.y,
    };
    setResizingHeight(true);
  }, [panelHeight, ensurePanelPos]);

  const startResizeWidth = useCallback((e, edge = 'e') => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const pos = ensurePanelPos();
    widthDragRef.current = {
      edge,
      startX: e.clientX,
      startWidth: panelWidth,
      startLeft: pos.x,
    };
    setResizingWidth(true);
  }, [panelWidth, ensurePanelPos]);

  const startMovePanel = useCallback((e) => {
    if (e.button !== 0) return;
    if (e.target?.closest?.('button')) return;
    e.preventDefault();
    const pos = ensurePanelPos();
    moveDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: pos.x,
      originY: pos.y,
    };
    setMovingPanel(true);
  }, [ensurePanelPos]);

  useEffect(() => {
    if (!resizingHeight) return undefined;
    const onMove = (e) => {
      const drag = resizeDragRef.current;
      if (!drag) return;
      const nextH = clampPanelHeight(drag.startHeight + (drag.startY - e.clientY));
      const delta = nextH - drag.startHeight;
      setPanelHeight(nextH);
      setPanelPos((prev) => {
        const x = prev?.x ?? 8;
        return clampPanelPos(x, drag.startTop - delta, nextH);
      });
    };
    const onUp = () => {
      setResizingHeight(false);
      resizeDragRef.current = null;
      setPanelHeight((h) => {
        const clamped = clampPanelHeight(h);
        persistPanelHeight(clamped);
        return clamped;
      });
      setPanelPos((p) => {
        if (!p) return p;
        const next = clampPanelPos(p.x, p.y);
        persistPanelPos(next);
        return next;
      });
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [resizingHeight, clampPanelHeight, clampPanelPos]);

  useEffect(() => {
    if (!resizingWidth) return undefined;
    const onMove = (e) => {
      const drag = widthDragRef.current;
      if (!drag) return;
      if (drag.edge === 'w') {
        const rawW = drag.startWidth + (drag.startX - e.clientX);
        const nextW = clampPanelWidth(rawW);
        const delta = nextW - drag.startWidth;
        setPanelWidth(nextW);
        setPanelPos((prev) => {
          const y = prev?.y ?? 8;
          return clampPanelPos(drag.startLeft - delta, y, panelHeight, nextW);
        });
      } else {
        const nextW = clampPanelWidth(drag.startWidth + (e.clientX - drag.startX));
        setPanelWidth(nextW);
        setPanelPos((prev) => {
          if (!prev) return prev;
          return clampPanelPos(prev.x, prev.y, panelHeight, nextW);
        });
      }
    };
    const onUp = () => {
      setResizingWidth(false);
      widthDragRef.current = null;
      setPanelWidth((w) => {
        const clamped = clampPanelWidth(w);
        persistPanelWidth(clamped);
        return clamped;
      });
      setPanelPos((p) => {
        if (!p) return p;
        const next = clampPanelPos(p.x, p.y);
        persistPanelPos(next);
        return next;
      });
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [resizingWidth, clampPanelWidth, clampPanelPos, panelHeight]);

  useEffect(() => {
    if (!movingPanel) return undefined;
    const onMove = (e) => {
      const drag = moveDragRef.current;
      if (!drag) return;
      setPanelPos(clampPanelPos(
        drag.originX + (e.clientX - drag.startX),
        drag.originY + (e.clientY - drag.startY),
      ));
    };
    const onUp = () => {
      setMovingPanel(false);
      moveDragRef.current = null;
      setPanelPos((p) => {
        if (!p) return p;
        const next = clampPanelPos(p.x, p.y);
        persistPanelPos(next);
        return next;
      });
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [movingPanel, clampPanelPos]);

  const resizeInput = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, []);

  useEffect(() => {
    if (!open || loaded) return;
    let cancelled = false;
    (async () => {
      try {
        const [info, history, faqList] = await Promise.all([
          aiAgentService.getAgentInfo().catch(() => ({ name: 'AI Ассистент' })),
          aiAgentService.getHistory(historyScope).catch(() => ({ messages: [] })),
          aiAgentService.listFaqs(FAQ_SCOPE).catch(() => []),
        ]);
        if (cancelled) return;
        setAgentInfo(info);
        setMessages(history.messages || []);
        setFaqs(Array.isArray(faqList) ? faqList : []);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [open, loaded, historyScope]);

  useEffect(() => {
    if (open) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open, sending]);

  useEffect(() => {
    resizeInput();
  }, [input, resizeInput]);

  const snapshotArgs = useMemo(() => ({
    documentId,
    documentTitle,
    kindName,
    number,
    templateId,
    templateVersion,
    fieldsList,
    fieldData,
    sheetBlocks,
    isTableDocument,
    placeholderVars,
  }), [
    documentId, documentTitle, kindName, number, templateId, templateVersion,
    fieldsList, fieldData, sheetBlocks, isTableDocument, placeholderVars,
  ]);

  const applyOptions = useMemo(() => ({
    fieldsList,
    sheetBlocks,
    title: documentTitle,
  }), [fieldsList, sheetBlocks, documentTitle]);

  const commitFieldState = useCallback((nextData, nextTitle) => {
    if (typeof onApplyFieldData === 'function') onApplyFieldData(nextData);
    if (nextTitle != null && typeof onApplyTitle === 'function') onApplyTitle(nextTitle);
    fieldDataRef.current = nextData;
    if (nextTitle != null) titleRef.current = nextTitle;
  }, [onApplyFieldData, onApplyTitle]);

  const handleApplyProposal = useCallback((messageId, proposal) => {
    const allowFormulaOverwrite = messages.find((m) => m.id === messageId)?._allow_formula_overwrite;
    try {
      const applied = applyDocumentProposal(fieldDataRef.current, proposal, {
        ...applyOptions,
        title: titleRef.current,
        allowFormulaOverwrite,
      });
      commitFieldState(applied.fieldData, applied.title);
      setMessages((prev) => {
        const next = prev.map((m) => {
          if (m.id !== messageId) return m;
          const list = Array.isArray(m._proposals) ? m._proposals : [];
          return {
            ...m,
            _proposals: list.map((p) => (p.id === proposal.id ? { ...p, status: 'applied' } : p)),
          };
        });
        aiAgentService.saveMessages(next, historyScope);
        return next;
      });
    } catch (e) {
      const errMsg = e?.message || 'Не удалось применить изменение';
      setError(errMsg);
      setMessages((prev) => {
        const next = prev.map((m) => {
          if (m.id !== messageId) return m;
          const list = Array.isArray(m._proposals) ? m._proposals : [];
          return {
            ...m,
            _proposals: list.map((p) => (
              p.id === proposal.id ? { ...p, status: 'error', _error: errMsg } : p
            )),
          };
        });
        aiAgentService.saveMessages(next, historyScope);
        return next;
      });
    }
  }, [applyOptions, commitFieldState, historyScope, messages]);

  const handleRejectProposal = useCallback((messageId, proposal) => {
    setMessages((prev) => {
      const next = prev.map((m) => {
        if (m.id !== messageId) return m;
        const list = Array.isArray(m._proposals) ? m._proposals : [];
        return {
          ...m,
          _proposals: list.map((p) => (p.id === proposal.id ? { ...p, status: 'rejected' } : p)),
        };
      });
      aiAgentService.saveMessages(next, historyScope);
      return next;
    });
  }, [historyScope]);

  const handleApplyAllProposals = useCallback((messageId, proposals) => {
    const allowFormulaOverwrite = messages.find((m) => m.id === messageId)?._allow_formula_overwrite;
    const pending = (proposals || []).filter((p) => !p.status || p.status === 'pending');
    const { fieldData: nextData, title, results } = applyAllDocumentProposals(
      fieldDataRef.current,
      pending,
      { ...applyOptions, title: titleRef.current, allowFormulaOverwrite },
    );
    const byId = new Map(results.map((r) => [r.id, r]));
    const anyApplied = results.some((r) => r.status === 'applied');
    if (anyApplied) commitFieldState(nextData, title);
    setMessages((prev) => {
      const next = prev.map((m) => {
        if (m.id !== messageId) return m;
        const list = Array.isArray(m._proposals) ? m._proposals : [];
        return { ...m, _proposals: list.map((p) => byId.get(p.id) || p) };
      });
      aiAgentService.saveMessages(next, historyScope);
      return next;
    });
  }, [applyOptions, commitFieldState, historyScope, messages]);

  const handleSend = async (presetText = null, sendOptions = {}) => {
    const text = (presetText ?? input).trim();
    if (!text || sending) return;
    if (!presetText) setInput('');
    setError('');

    const sourcesForSend = sourceDocs;
    const hasSources = sourcesForSend.length > 0;
    const allowFormulaOverwrite = userAllowsFormulaOverwrite(text);

    const intent = sendOptions.forceAct || hasSources
      ? 'act'
      : classifyDocumentIntent(text, { forceAct: sendOptions.forceAct, hasSources });

    if (intent === 'help' && !sendOptions.forceAct && !hasSources) {
      let faq = faqByQuestion.get(normalizeQuestion(text));
      if (!faq) {
        try {
          const found = await aiAgentService.listFaqs(FAQ_SCOPE, text);
          if (found?.[0]?.answer) faq = found[0];
        } catch {
          /* fallback to model */
        }
      }
      if (faq?.answer) {
        const result = aiAgentService.appendFaqExchange(text, faq.answer, historyScope);
        setMessages((prev) => [...prev, result.user_message, result.agent_message]);
        return;
      }
    }

    setSending(true);
    const temp = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
      _temp: true,
      _intent: intent,
      _source_docs: hasSources
        ? sourcesForSend.map((d) => ({ id: d.id, title: d.title }))
        : null,
    };
    setMessages((prev) => [...prev, temp]);

    try {
      const extraSystemContext = buildEditorExtraContext({
        intent,
        fillFromSources: hasSources,
        documentSnapshot: summarizeDocumentContext(snapshotArgs),
        sourceDocuments: sourcesForSend,
      });
      const result = await aiAgentService.sendMessage(text, {
        systemPrompt: agentInfo?.system_prompt || null,
        apiKeyId: agentInfo?.api_key_id || null,
        agentName: agentInfo?.name || 'AI Ассистент',
        historyScope,
        skipTriggers: true,
        extraSystemContext,
      });

      const parsed = parseDocumentAiReply(result.agent_message?.content || '', intent);
      const agentMessage = {
        ...result.agent_message,
        content: parsed.summary || result.agent_message?.content || '',
        _intent: parsed.mode || intent,
        _proposals: parsed.proposals.length ? parsed.proposals : null,
        _structured: parsed.structured,
        _allow_formula_overwrite: allowFormulaOverwrite,
        _entity_refs: Array.isArray(result.agent_message?._entity_refs)
          ? result.agent_message._entity_refs
          : null,
      };

      setMessages((prev) => {
        const filtered = prev.filter((m) => !m._temp);
        const userMsg = result.user_message
          ? {
              ...result.user_message,
              _intent: intent,
              _source_docs: hasSources
                ? sourcesForSend.map((d) => ({ id: d.id, title: d.title }))
                : null,
            }
          : null;
        const next = [...filtered, userMsg, agentMessage].filter(Boolean);
        aiAgentService.saveMessages(next, historyScope);
        return next;
      });
      setSourceDocs([]);
    } catch (e) {
      setMessages((prev) => prev.filter((m) => !m._temp));
      const detail = e?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Не удалось отправить сообщение');
    } finally {
      setSending(false);
    }
  };

  const handleSuggestionClick = useCallback((q) => {
    if (q.includes('прикреплённых') && !sourceDocs.length) {
      setAttachOpen(true);
      setInput(q);
      return;
    }
    if (q.includes('прикреплённых')) {
      handleSend(q, { forceAct: true });
      return;
    }
    handleSend(q);
  }, [sourceDocs.length, handleSend]);

  const handleFillEmpty = () => {
    const incomplete = findIncompleteFields({ fieldsList, fieldData, sheetBlocks });
    if (!incomplete.length) {
      setError('Пустых полей не найдено');
      return;
    }
    const names = incomplete.map((f) => f.field).join(', ');
    handleSend(
      `Заполни пустые поля: ${names}. Используй смысл уже заполненных значений и тип поля.`,
      { forceAct: true },
    );
  };

  const handleClear = async () => {
    if (!window.confirm('Очистить историю помощника по этому документу?')) return;
    await aiAgentService.clearHistory(historyScope);
    setMessages([]);
    setSourceDocs([]);
  };

  return (
    <div className={styles.host} ref={hostRef} onClick={(e) => e.stopPropagation()}>
      {!open && (
        <button
          type="button"
          className={`${styles.fab} ${isTableDocument ? styles.fabTable : ''}`}
          onClick={() => setOpen(true)}
          title="AI помощник документа"
          aria-label="Открыть AI помощника"
        >
          <span className={styles.fabLabel}>AI</span>
          <SparklesIcon className={styles.fabIcon} />
        </button>
      )}

      {open && panelPos && (
        <div
          className={`${styles.panel} ${(resizingHeight || resizingWidth) ? styles.panelResizing : ''} ${movingPanel ? styles.panelMoving : ''}`}
          style={{
            height: panelHeight,
            width: panelWidth,
            left: panelPos.x,
            top: panelPos.y,
          }}
          role="dialog"
          aria-label="AI помощник документа"
        >
          <div
            className={styles.resizeHandle}
            onMouseDown={startResizeHeight}
            role="separator"
            aria-orientation="horizontal"
            aria-label="Изменить высоту чата"
            title="Потяните, чтобы изменить высоту"
          />
          <div
            className={styles.resizeHandleW}
            onMouseDown={(e) => startResizeWidth(e, 'w')}
            role="separator"
            aria-orientation="vertical"
            aria-label="Изменить ширину чата"
            title="Потяните, чтобы изменить ширину"
          />
          <div
            className={styles.resizeHandleE}
            onMouseDown={(e) => startResizeWidth(e, 'e')}
            role="separator"
            aria-orientation="vertical"
            aria-label="Изменить ширину чата"
            title="Потяните, чтобы изменить ширину"
          />
          <div
            className={`${styles.head} ${movingPanel ? styles.headDragging : ''}`}
            onMouseDown={startMovePanel}
            title="Потяните, чтобы переместить чат"
          >
            <div className={styles.headTitle}>
              <SparklesIcon className={styles.headIcon} />
              <div>
                <strong>{agentInfo?.name || 'AI Ассистент'}</strong>
                <span>Помощник редактора документов</span>
              </div>
            </div>
            <div className={styles.headActions}>
              <button type="button" className={styles.iconBtn} onClick={handleClear} title="Очистить">
                <TrashIcon />
              </button>
              <button type="button" className={styles.iconBtn} onClick={() => setOpen(false)} title="Закрыть">
                <XMarkIcon />
              </button>
            </div>
          </div>

          <div className={styles.messages}>
            {messages.length === 0 && !sending && (
              <div className={styles.empty}>
                <p>Проанализирую поля, предложу правки. Прикрепите документы-источники — заполню текущий на их основе.</p>
                <div className={styles.suggestions}>
                  {suggestions.map((q) => (
                    <button
                      key={q}
                      type="button"
                      className={styles.suggestion}
                      onClick={() => handleSuggestionClick(q)}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              const proposals = Array.isArray(msg._proposals) ? msg._proposals : [];
              const pending = proposals.filter((p) => !p.status || p.status === 'pending');
              const appliedCount = proposals.filter((p) => p.status === 'applied').length;
              const showFollowup = !isUser && proposals.length > 0 && pending.length === 0 && appliedCount > 0;
              return (
                <div
                  key={msg.id}
                  className={`${styles.bubbleRow} ${isUser ? styles.bubbleRowUser : styles.bubbleRowAgent}`}
                >
                  <div className={`${styles.bubble} ${isUser ? styles.bubbleUser : styles.bubbleAgent}`}>
                    {!isUser && msg._intent && (
                      <div className={styles.intentBadge} data-intent={msg._intent === 'analyze' ? 'describe' : msg._intent}>
                        {msg._intent === 'act' ? 'изменения' : msg._intent === 'analyze' ? 'анализ' : 'помощь'}
                      </div>
                    )}
                    {isUser && Array.isArray(msg._source_docs) && msg._source_docs.length > 0 && (
                      <div className={styles.bubbleChips}>
                        {msg._source_docs.map((d) => (
                          <span key={d.id} className={styles.bubbleChip}>
                            <DocumentTextIcon className={styles.bubbleChipIcon} />
                            {d.title}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className={styles.bubbleText}>
                      {isUser ? msg.content : <MarkdownContent>{msg.content}</MarkdownContent>}
                    </div>
                    {!isUser && Array.isArray(msg._entity_refs) && msg._entity_refs.length > 0 && (
                      <MessageEntityRefs entityRefs={msg._entity_refs} />
                    )}
                    {proposals.length > 0 && (
                      <div className={styles.proposals}>
                        <div className={styles.proposalsHead}>
                          <span>Предложения ({proposals.length})</span>
                          {pending.length > 1 && (
                            <button
                              type="button"
                              className={styles.proposalApplyAll}
                              onClick={() => handleApplyAllProposals(msg.id, proposals)}
                            >
                              Применить все ({pending.length})
                            </button>
                          )}
                        </div>
                        {proposals.map((p) => {
                          const status = p.status || 'pending';
                          const preview = formatProposalValue(p);
                          return (
                            <div key={p.id} className={styles.proposalCard}>
                              <div className={styles.proposalField}>{proposalLabel(p)}</div>
                              {p.reason && <div className={styles.proposalReason}>{p.reason}</div>}
                              {preview ? <pre className={styles.proposalPreview}>{preview}</pre> : null}
                              {p._error && <div className={styles.proposalError}>{p._error}</div>}
                              {status === 'pending' ? (
                                <div className={styles.proposalActions}>
                                  <button
                                    type="button"
                                    className={styles.proposalApply}
                                    onClick={() => handleApplyProposal(msg.id, p)}
                                  >
                                    Применить
                                  </button>
                                  <button
                                    type="button"
                                    className={styles.proposalReject}
                                    onClick={() => handleRejectProposal(msg.id, p)}
                                  >
                                    Отклонить
                                  </button>
                                </div>
                              ) : (
                                <div className={`${styles.proposalStatus} ${styles[`proposalStatus_${status}`] || ''}`}>
                                  {status === 'applied' ? 'Применено' : status === 'rejected' ? 'Отклонено' : 'Ошибка'}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {showFollowup && (
                      <div className={styles.followupActions}>
                        <div className={styles.followupLabel}>Изменения в редакторе. Дальше:</div>
                        <div className={styles.followupBtns}>
                          {typeof onSave === 'function' && (
                            <button
                              type="button"
                              className={styles.followupBtnPrimary}
                              onClick={() => onSave()}
                            >
                              Сохранить документ
                            </button>
                          )}
                          <button
                            type="button"
                            className={styles.followupBtn}
                            disabled={sending}
                            onClick={handleFillEmpty}
                          >
                            Заполнить оставшиеся пустые
                          </button>
                        </div>
                      </div>
                    )}
                    <div className={styles.bubbleMeta}>{formatTime(msg.created_at)}</div>
                  </div>
                </div>
              );
            })}

            {sending && (
              <div className={`${styles.bubbleRow} ${styles.bubbleRowAgent}`}>
                <div className={`${styles.bubble} ${styles.bubbleAgent} ${styles.typing}`}>
                  <span /><span /><span />
                </div>
              </div>
            )}

            {error && <div className={styles.error}>{error}</div>}
            <div ref={messagesEndRef} />
          </div>

          {sourceDocs.length > 0 && (
            <div className={styles.attachBar}>
              {sourceDocs.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className={styles.attachChip}
                  onClick={() => removeSourceDoc(d.id)}
                  title="Убрать из контекста"
                >
                  <DocumentTextIcon className={styles.attachChipIcon} />
                  <span>{d.title}</span>
                  <XMarkIcon />
                </button>
              ))}
            </div>
          )}

          <div className={styles.composer}>
            <button
              type="button"
              className={`${styles.pickBtn} ${attachOpen || sourceDocs.length ? styles.pickBtnActive : ''}`}
              onClick={() => setAttachOpen(true)}
              title="Прикрепить документы-источники"
              aria-label="Прикрепить документы"
              disabled={sending}
            >
              <PaperClipIcon />
            </button>
            <textarea
              ref={textareaRef}
              className={styles.input}
              value={input}
              rows={1}
              placeholder={
                sourceDocs.length
                  ? 'Попросите заполнить документ на основе источников…'
                  : 'Спросить про документ или попросить заполнить поля…'
              }
              disabled={sending}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <button
              type="button"
              className={styles.sendBtn}
              disabled={!input.trim() || sending}
              onClick={() => handleSend()}
              title="Отправить"
            >
              <PaperAirplaneIcon />
            </button>
          </div>

          <EntityAttachPicker
            open={attachOpen}
            onClose={() => setAttachOpen(false)}
            onSelect={handleSourceSelect}
            selectedKeys={sourceDocKeys}
            allowedTabs={null}
            excludeDocumentIds={[documentId]}
          />
        </div>
      )}
    </div>
  );
}
