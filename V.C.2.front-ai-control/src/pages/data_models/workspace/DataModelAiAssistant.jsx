import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  PaperAirplaneIcon,
  TrashIcon,
  XMarkIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { aiAgentService } from '../../../services/aiAgentService';
import MarkdownContent from '../../../components/MarkdownContent';
import MessageEntityRefs from '../../../components/messaging/MessageEntityRefs';
import { buildEntityRef } from '../../../services/messagingEntityRefs';
import { eventBus } from './core/EventBus.js';
import {
  applyAllCanvasProposals,
  applyCanvasProposal,
  buildCanvasResponseProtocol,
  buildConfigurePromptExtras,
  classifyCanvasPhase,
  classifyDataModelIntent,
  findUnderfilledWidgets,
  parseCanvasAiReply,
  proposalLabel,
  repairRelationshipWidgets,
} from './dataModelCanvasAi.js';
import styles from './DataModelAiAssistant.module.css';

export const DATA_MODEL_CONSTRUCTOR_PROMPT = `
Ты — AI-помощник конструктора моделей данных AiControl (полотно /data-models/:id/edit).

У тебя есть снимок графа (виджеты + settings + связи). Ты можешь НЕ ТОЛЬКО объяснять, но и предлагать конкретные изменения полотна через proposals — пользователь применит их кнопкой «Применить».

## Интерфейс
- Слева — палитра виджетов. Центр — полотно. Справа — свойства. Вверху — сохранить / компиляция / превью DataCode.

## Типы виджетов
1) data-source — sourceType: file, folder, archive, api, database, json, interactive, databridge.
2) data-model — таблицы другой модели.
3) processing-block — blockType: filter | transform | join | aggregate.
4) formula — вычисляемые поля.
5) relationship — FK / связи сущностей.

## Поведение по режимам и фазам
- help / describe / act — как раньше.
- Фаза scaffold: каркас (источники + relationship + связи + опционально processing с ПОЛНЫМИ settings).
- Фаза configure: только update_settings для уже существующих filter/aggregate/transform/join/formula — заполнить условия, метрики, выражения.
- Не оставляй processing-block с одним blockType без filterConditions / aggregateMetrics / expressions.

Связь сущностей (1:N и т.п.) — только виджет relationship + порт-связи источников → relationship. Никогда не соединяй два data-source напрямую.

Не выдумывай id виджетов. Не называй себя DeepSeek/ChatGPT/Claude. Отвечай на русском.
`.trim();

function safeJson(value, maxLen = 1800) {
  try {
    const s = JSON.stringify(value);
    if (s.length <= maxLen) return s;
    return `${s.slice(0, maxLen)}…`;
  } catch {
    return String(value);
  }
}

const DEFAULT_SUGGESTIONS = [
  'Как добавить источник данных?',
  'Как соединить два виджета?',
  'Как настроить join?',
  'Что делает компиляция?',
];

const FAQ_SCOPE = 'data-model';
const PANEL_HEIGHT_KEY = 'data_model_ai_assistant_height';
const PANEL_WIDTH_KEY = 'data_model_ai_assistant_width';
const PANEL_POS_KEY = 'data_model_ai_assistant_pos';
const PANEL_HEIGHT_DEFAULT = 320;
const PANEL_HEIGHT_MIN = 220;
const PANEL_WIDTH_DEFAULT = 380;
const PANEL_WIDTH_MIN = 280;

function readStoredPanelHeight() {
  try {
    const raw = localStorage.getItem(PANEL_HEIGHT_KEY);
    const n = Number(raw);
    if (Number.isFinite(n) && n >= PANEL_HEIGHT_MIN) return Math.round(n);
  } catch {
    /* ignore */
  }
  return PANEL_HEIGHT_DEFAULT;
}

function readStoredPanelWidth() {
  try {
    const raw = localStorage.getItem(PANEL_WIDTH_KEY);
    const n = Number(raw);
    if (Number.isFinite(n) && n >= PANEL_WIDTH_MIN) return Math.round(n);
  } catch {
    /* ignore */
  }
  return PANEL_WIDTH_DEFAULT;
}

function readStoredPanelPos() {
  try {
    const raw = JSON.parse(localStorage.getItem(PANEL_POS_KEY) || 'null');
    if (
      raw
      && Number.isFinite(raw.x)
      && Number.isFinite(raw.y)
    ) {
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

function widgetLabel(widget) {
  if (!widget) return 'Виджет';
  const s = widget.settings || {};
  return (
    widget.title
    || widget.name
    || s.title
    || s.name
    || s.blockType
    || s.sourceType
    || widget.type
    || `id=${widget.id}`
  );
}

function summarizeAttachedWidgets(widgets) {
  if (!widgets?.length) return '';
  const lines = widgets.map((w) => {
    return [
      `- id=${w.id}, type=${w.type}, title=${widgetLabel(w)}`,
      `  settings=${safeJson(w.settings || {}, 1200)}`,
    ].join('\n');
  });
  return [
    '## Выбранные пользователем виджеты (фокус запроса)',
    'Пользователь явно указал эти виджеты. В режиме act меняй их через update_settings / связи / новые блоки.',
    ...lines,
  ].join('\n');
}

function summarizeWorkspace(engine, modelName, modelId) {
  if (!engine?.getState) return 'Снимок графа недоступен (полотно ещё инициализируется).';
  try {
    const state = engine.getState();
    const widgets = Array.isArray(state.widgets) ? state.widgets : [];
    const connections = Array.isArray(state.connections) ? state.connections : [];

    const widgetLines = widgets.map((w) => {
      const s = w.settings || {};
      const fields = Array.isArray(s.interactiveConfig?.table?.fields)
        ? s.interactiveConfig.table.fields.map((f) => f?.name).filter(Boolean)
        : [];
      const tableName = s.interactiveConfig?.table?.name || '';
      return [
        `- id=${w.id}, type=${w.type}, title=${w.title || w.name || s.name || s.title || ''}, x=${w.x}, y=${w.y}`,
        tableName ? `  tableVariable=${tableName}` : null,
        fields.length ? `  columns=[${fields.join(', ')}]` : null,
        `  settings=${safeJson(s, 1400)}`,
      ].filter(Boolean).join('\n');
    });

    const connLines = connections.slice(0, 60).map((c) => {
      const from = c.from || c.source || c.sourceId || c.from_widget_id;
      const to = c.to || c.target || c.targetId || c.to_widget_id;
      return `- id=${c.id || '?'} ${from} → ${to}`;
    });

    return [
      `Модель: «${modelName || 'без имени'}» (id=${modelId ?? 'new'})`,
      `Виджетов: ${widgets.length}`,
      widgetLines.length ? `Виджеты:\n${widgetLines.join('\n')}` : 'Виджетов пока нет.',
      `Связей: ${connections.length}`,
      connLines.length ? `Связи:\n${connLines.join('\n')}` : 'Связей пока нет.',
    ].join('\n');
  } catch (e) {
    return `Не удалось снять снимок графа: ${e?.message || e}`;
  }
}

/** Иконка «выбор элемента» (прямоугольник + курсор). */
function WidgetPickIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 6.2C5 5.26 5.76 4.5 6.7 4.5h9.6c.94 0 1.7.76 1.7 1.7V12"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M5 15.8V6.2M5 15.8c0 .94.76 1.7 1.7 1.7H12"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M13.2 12.1l1.55 9.05 1.95-2.85 3.2 4.15 1.35-1.05-3.25-4.2 3.05-1.55-8.85-3.55z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * Плавающий AI-помощник конструктора моделей данных.
 */
export default function DataModelAiAssistant({
  engineRef,
  modelId,
  modelName,
  onAddWidget = null,
  onPersistWorkspace = null,
  onCompileModel = null,
  onPreviewDatacode = null,
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [agentInfo, setAgentInfo] = useState(null);
  const [faqs, setFaqs] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [pickMode, setPickMode] = useState(false);
  const [attachedWidgets, setAttachedWidgets] = useState([]);
  const [panelHeight, setPanelHeight] = useState(readStoredPanelHeight);
  const [panelWidth, setPanelWidth] = useState(readStoredPanelWidth);
  const [panelPos, setPanelPos] = useState(readStoredPanelPos);
  const [resizingHeight, setResizingHeight] = useState(false);
  const [resizingWidth, setResizingWidth] = useState(false);
  const [movingPanel, setMovingPanel] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const pickModeRef = useRef(false);
  const hostRef = useRef(null);
  const resizeDragRef = useRef(null);
  const widthDragRef = useRef(null);
  const moveDragRef = useRef(null);

  const suggestions = useMemo(() => {
    if (faqs.length) return faqs.map((f) => f.question);
    return DEFAULT_SUGGESTIONS;
  }, [faqs]);

  const faqByQuestion = useMemo(() => {
    const map = new Map();
    for (const f of faqs) {
      map.set(normalizeQuestion(f.question), f);
    }
    return map;
  }, [faqs]);

  const historyScope = useMemo(
    () => `data-model-${modelId || 'draft'}`,
    [modelId]
  );

  useEffect(() => {
    setLoaded(false);
    setMessages([]);
    setAttachedWidgets([]);
    setPickMode(false);
  }, [historyScope]);

  useEffect(() => {
    pickModeRef.current = pickMode;
  }, [pickMode]);

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
      const next = clampPanelPos(
        drag.originX + (e.clientX - drag.startX),
        drag.originY + (e.clientY - drag.startY),
      );
      setPanelPos(next);
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

  const setViewportPickClass = useCallback((enabled) => {
    const viewport = engineRef?.current?.viewport;
    if (!viewport) return;
    viewport.classList.toggle('ai-widget-pick-mode', Boolean(enabled));
  }, [engineRef]);

  useEffect(() => {
    setViewportPickClass(pickMode && open);
    return () => setViewportPickClass(false);
  }, [pickMode, open, setViewportPickClass]);

  useEffect(() => {
    if (!pickMode) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setPickMode(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [pickMode]);

  useEffect(() => {
    const unsub = eventBus.on('widget:selected', ({ widget }) => {
      if (!pickModeRef.current || !widget) return;
      setAttachedWidgets((prev) => {
        const id = String(widget.id);
        if (prev.some((w) => String(w.id) === id)) return prev;
        const snapshot = {
          id: widget.id,
          type: widget.type,
          title: widget.title || widget.name || null,
          name: widget.name || null,
          settings: { ...(widget.settings || {}) },
        };
        return [...prev, snapshot];
      });
    });
    return () => unsub();
  }, []);

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
  }, [messages, open, sending, attachedWidgets]);

  useEffect(() => {
    resizeInput();
  }, [input, resizeInput]);

  const buildExtraContext = useCallback((widgets = attachedWidgets, intent = 'help', phase = 'scaffold') => {
    const graph = summarizeWorkspace(engineRef?.current, modelName, modelId);
    const focus = summarizeAttachedWidgets(widgets);
    const recentModes = messages
      .filter((m) => m.role === 'assistant' && m._intent)
      .slice(-3)
      .map((m) => m._intent);
    const underfilled = findUnderfilledWidgets(engineRef?.current);
    const configureExtra = phase === 'configure'
      ? buildConfigurePromptExtras(engineRef?.current, underfilled)
      : null;
    return [
      DATA_MODEL_CONSTRUCTOR_PROMPT,
      buildCanvasResponseProtocol(intent, phase),
      `## Классификация текущего запроса\nintent=${intent}\nphase=${phase}`
        + (recentModes.length ? `\nНедавние режимы ассистента: ${recentModes.join(' → ')}` : ''),
      configureExtra,
      `## Текущий граф модели\n${graph}`,
      focus || null,
    ].filter(Boolean).join('\n\n');
  }, [engineRef, modelName, modelId, attachedWidgets, messages]);

  const markMessageNeedsConfigure = useCallback((messageId) => {
    const underfilled = findUnderfilledWidgets(engineRef?.current);
    setMessages((prev) => {
      const next = prev.map((m) => (
        m.id === messageId
          ? { ...m, _needs_configure: underfilled.length > 0, _underfilled: underfilled }
          : m
      ));
      aiAgentService.saveMessages(next, historyScope);
      return next;
    });
    return underfilled;
  }, [engineRef, historyScope]);

  const removeAttached = useCallback((id) => {
    setAttachedWidgets((prev) => prev.filter((w) => String(w.id) !== String(id)));
  }, []);

  const persistAfterApply = useCallback(async () => {
    if (typeof onPersistWorkspace !== 'function') return;
    try {
      await onPersistWorkspace();
    } catch (e) {
      setError(e?.message || 'Не удалось сохранить модель после изменений');
    }
  }, [onPersistWorkspace]);

  const handleApplyProposal = useCallback(async (messageId, proposal) => {
    const engine = engineRef?.current;
    if (!engine) {
      setError('Полотно ещё не готово');
      return;
    }
    try {
      const applied = await applyCanvasProposal(engine, proposal, { onAddWidget, modelId });
      if (
        applied?.status === 'applied'
        && (proposal.op === 'add_connection'
          || proposal.op === 'update_settings'
          || (proposal.op === 'add_widget' && (proposal.widget_type || proposal.type) === 'relationship'))
      ) {
        await repairRelationshipWidgets(engine, { modelId });
      }
      setMessages((prev) => {
        const msg = prev.find((m) => m.id === messageId);
        const list = Array.isArray(msg?._proposals) ? msg._proposals : [];
        const nextProps = list.map((p) => (p.id === proposal.id ? applied : p));
        const next = prev.map((m) => (
          m.id === messageId ? { ...m, _proposals: nextProps } : m
        ));
        aiAgentService.saveMessages(next, historyScope);
        return next;
      });
      await persistAfterApply();
      markMessageNeedsConfigure(messageId);
    } catch (e) {
      const errMsg = e?.message || 'Не удалось применить изменение';
      setError(errMsg);
      setMessages((prev) => {
        const msg = prev.find((m) => m.id === messageId);
        const list = Array.isArray(msg?._proposals) ? msg._proposals : [];
        const nextProps = list.map((p) => (
          p.id === proposal.id ? { ...p, status: 'error', _error: errMsg } : p
        ));
        const next = prev.map((m) => (
          m.id === messageId ? { ...m, _proposals: nextProps } : m
        ));
        aiAgentService.saveMessages(next, historyScope);
        return next;
      });
    }
  }, [engineRef, onAddWidget, historyScope, persistAfterApply, modelId, markMessageNeedsConfigure]);

  const handleRejectProposal = useCallback((messageId, proposal) => {
    setMessages((prev) => {
      const msg = prev.find((m) => m.id === messageId);
      const list = Array.isArray(msg?._proposals) ? msg._proposals : [];
      const nextProps = list.map((p) => (
        p.id === proposal.id ? { ...p, status: 'rejected' } : p
      ));
      const next = prev.map((m) => (
        m.id === messageId ? { ...m, _proposals: nextProps } : m
      ));
      aiAgentService.saveMessages(next, historyScope);
      return next;
    });
  }, [historyScope]);

  const handleApplyAllProposals = useCallback(async (messageId, proposals) => {
    const engine = engineRef?.current;
    if (!engine) {
      setError('Полотно ещё не готово');
      return;
    }
    const pending = (proposals || []).filter((p) => !p.status || p.status === 'pending');
    const results = await applyAllCanvasProposals(engine, pending, { onAddWidget, modelId });
    const byId = new Map(results.map((r) => [r.id, r]));
    setMessages((prev) => {
      const msg = prev.find((m) => m.id === messageId);
      const list = Array.isArray(msg?._proposals) ? msg._proposals : [];
      const nextProps = list.map((p) => byId.get(p.id) || p);
      const next = prev.map((m) => (
        m.id === messageId ? { ...m, _proposals: nextProps } : m
      ));
      aiAgentService.saveMessages(next, historyScope);
      return next;
    });
    const anyApplied = results.some((r) => r.status === 'applied');
    if (anyApplied) {
      await persistAfterApply();
      markMessageNeedsConfigure(messageId);
    }
  }, [engineRef, onAddWidget, historyScope, persistAfterApply, modelId, markMessageNeedsConfigure]);

  const handleSend = async (presetText = null, sendOptions = {}) => {
    const text = (presetText ?? input).trim();
    if (!text || sending) return;
    if (!presetText) setInput('');
    setError('');

    const widgetsForSend = attachedWidgets;
    const forcePhase = sendOptions.forcePhase || null;

    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
    const underfilledNow = findUnderfilledWidgets(engineRef?.current);
    const intent = forcePhase === 'configure'
      ? 'act'
      : classifyDataModelIntent(text, {
        previousMode: lastAssistant?._intent || null,
        hasAttachedWidgets: widgetsForSend.length > 0,
      });
    const phase = classifyCanvasPhase(text, {
      forcePhase,
      previousPhase: lastAssistant?._phase || null,
      hasUnderfilledWidgets: underfilledNow.length > 0,
    });

    // FAQ только для help без вложений и без follow-up «сделай сам»
    if (!widgetsForSend.length && intent === 'help' && !forcePhase) {
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
    setPickMode(false);

    const temp = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
      _temp: true,
      _attached_widgets: widgetsForSend,
      _entity_refs: modelId
        ? [buildEntityRef('data_model', modelId, modelName || `Модель #${modelId}`)]
        : [],
      _intent: intent,
      _phase: phase,
    };
    setMessages((prev) => [...prev, temp]);
    setAttachedWidgets([]);

    try {
      const result = await aiAgentService.sendMessage(text, {
        systemPrompt: agentInfo?.system_prompt || null,
        apiKeyId: agentInfo?.api_key_id || null,
        agentName: agentInfo?.name || 'AI Ассистент',
        historyScope,
        skipTriggers: true,
        extraSystemContext: buildExtraContext(widgetsForSend, intent, phase),
      });

      const parsed = parseCanvasAiReply(result.agent_message?.content || '', intent, phase);
      const agentMessage = {
        ...result.agent_message,
        content: parsed.summary || result.agent_message?.content || '',
        _intent: parsed.mode || intent,
        _phase: parsed.phase || phase,
        _proposals: parsed.proposals.length ? parsed.proposals : null,
        _structured: parsed.structured,
        _needs_configure: false,
        _entity_refs:
          modelId && /пришл|ссылк|карточк|attach|send/i.test(text)
            ? [buildEntityRef('data_model', modelId, modelName || `Модель #${modelId}`)]
            : null,
      };

      setMessages((prev) => {
        const filtered = prev.filter((m) => !m._temp);
        const userMsg = result.user_message
          ? {
              ...result.user_message,
              _attached_widgets: widgetsForSend,
              _entity_refs: modelId
                ? [buildEntityRef('data_model', modelId, modelName || `Модель #${modelId}`)]
                : [],
              _intent: intent,
              _phase: phase,
            }
          : null;
        const next = [...filtered, userMsg, agentMessage].filter(Boolean);
        aiAgentService.saveMessages(next, historyScope);
        return next;
      });
    } catch (e) {
      setMessages((prev) => prev.filter((m) => !m._temp));
      setAttachedWidgets(widgetsForSend);
      const detail = e?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Не удалось отправить сообщение');
    } finally {
      setSending(false);
    }
  };

  const handleRequestConfigure = () => {
    const underfilled = findUnderfilledWidgets(engineRef?.current);
    if (!underfilled.length) {
      setError('Все виджеты обработки уже заполнены');
      return;
    }
    const names = underfilled.map((u) => u.name || u.id).join(', ');
    handleSend(
      `Заполни настройки виджетов обработки: ${names}. Используй колонки из источников на полотне.`,
      { forcePhase: 'configure' },
    );
  };

  const handleClear = async () => {
    if (!window.confirm('Очистить историю помощника по этой модели?')) return;
    await aiAgentService.clearHistory(historyScope);
    setMessages([]);
    setAttachedWidgets([]);
    setPickMode(false);
  };

  const handleClose = () => {
    setOpen(false);
    setPickMode(false);
  };

  return (
    <div className={styles.host} ref={hostRef}>
      {!open && (
        <button
          type="button"
          className={styles.fab}
          onClick={() => setOpen(true)}
          title="AI помощник конструктора"
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
          aria-label="AI помощник модели данных"
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
                <span>
                  {pickMode
                    ? 'Кликните виджеты на полотне…'
                    : 'Помощник конструктора моделей'}
                </span>
              </div>
            </div>
            <div className={styles.headActions}>
              <button
                type="button"
                className={`${styles.iconBtn} ${pickMode ? styles.iconBtnActive : ''}`}
                onClick={() => setPickMode((v) => !v)}
                title={pickMode ? 'Выключить выбор виджетов' : 'Выбрать виджеты на полотне'}
                aria-pressed={pickMode}
                aria-label="Режим выбора виджетов"
              >
                <WidgetPickIcon />
              </button>
              <button type="button" className={styles.iconBtn} onClick={handleClear} title="Очистить">
                <TrashIcon />
              </button>
              <button type="button" className={styles.iconBtn} onClick={handleClose} title="Закрыть">
                <XMarkIcon />
              </button>
            </div>
          </div>

          {pickMode && (
            <div className={styles.pickBanner} role="status">
              Интерактивный режим: кликайте виджеты на полотне, затем опишите, что сделать
              (связать, изменить свойства, добавить обработку). Esc — выход.
            </div>
          )}

          <div className={styles.messages}>
            {messages.length === 0 && !sending && (
              <div className={styles.empty}>
                <p>Спросите, как добавить виджет, настроить связь, фильтр, join или скомпилировать модель.</p>
                <div className={styles.suggestions}>
                  {suggestions.map((q) => (
                    <button key={q} type="button" className={styles.suggestion} onClick={() => handleSend(q)}>
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              const chips = msg._attached_widgets || [];
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
                    {chips.length > 0 && (
                      <div className={styles.bubbleChips}>
                        {chips.map((w) => (
                          <span key={w.id} className={styles.bubbleChip}>{widgetLabel(w)}</span>
                        ))}
                      </div>
                    )}
                    {Array.isArray(msg._entity_refs) && msg._entity_refs.length > 0 && (
                      <MessageEntityRefs entityRefs={msg._entity_refs} />
                    )}
                    {!isUser && msg._intent && (
                      <div className={styles.intentBadge} data-intent={msg._intent}>
                        {msg._intent === 'act' ? 'изменения' : msg._intent === 'describe' ? 'описание' : 'помощь'}
                        {msg._phase ? ` · ${msg._phase === 'configure' ? 'заполнение' : 'каркас'}` : ''}
                      </div>
                    )}
                    <div className={styles.bubbleText}>
                      {isUser ? msg.content : <MarkdownContent>{msg.content}</MarkdownContent>}
                    </div>
                    {proposals.length > 0 && (
                      <div className={styles.proposals}>
                        <div className={styles.proposalsHead}>
                          <span>Предложения для полотна ({proposals.length})</span>
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
                          return (
                            <div key={p.id} className={styles.proposalCard}>
                              <div className={styles.proposalField}>{proposalLabel(p)}</div>
                              {p.reason && <div className={styles.proposalReason}>{p.reason}</div>}
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
                        <div className={styles.followupLabel}>Изменения сохранены. Дальше:</div>
                        <div className={styles.followupBtns}>
                          {(msg._needs_configure || (msg._underfilled && msg._underfilled.length > 0)) && (
                            <button
                              type="button"
                              className={styles.followupBtnPrimary}
                              disabled={sending}
                              onClick={handleRequestConfigure}
                            >
                              Заполнить настройки обработки
                              {msg._underfilled?.length ? ` (${msg._underfilled.length})` : ''}
                            </button>
                          )}
                          {typeof onPreviewDatacode === 'function' && (
                            <button
                              type="button"
                              className={styles.followupBtn}
                              onClick={() => onPreviewDatacode()}
                            >
                              Превью / тестовая сборка
                            </button>
                          )}
                          {typeof onCompileModel === 'function' && (
                            <button
                              type="button"
                              className={styles.followupBtnPrimary}
                              onClick={() => onCompileModel()}
                            >
                              Скомпилировать модель
                            </button>
                          )}
                          {typeof onPersistWorkspace === 'function' && (
                            <button
                              type="button"
                              className={styles.followupBtn}
                              onClick={() => onPersistWorkspace()}
                            >
                              Сохранить ещё раз
                            </button>
                          )}
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

          {attachedWidgets.length > 0 && (
            <div className={styles.attachBar}>
              {attachedWidgets.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  className={styles.attachChip}
                  onClick={() => removeAttached(w.id)}
                  title="Убрать из контекста"
                >
                  <span>{widgetLabel(w)}</span>
                  <XMarkIcon />
                </button>
              ))}
            </div>
          )}

          <div className={styles.composer}>
            <button
              type="button"
              className={`${styles.pickBtn} ${pickMode ? styles.pickBtnActive : ''}`}
              onClick={() => setPickMode((v) => !v)}
              title={pickMode ? 'Выключить выбор виджетов' : 'Выбрать виджеты на полотне'}
              aria-pressed={pickMode}
            >
              <WidgetPickIcon />
            </button>
            <textarea
              ref={textareaRef}
              className={styles.input}
              value={input}
              rows={1}
              placeholder={
                attachedWidgets.length
                  ? 'Что сделать с выбранными виджетами?'
                  : pickMode
                    ? 'Выберите виджеты, затем напишите запрос…'
                    : 'Спросить про конструктор…'
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
        </div>
      )}
    </div>
  );
}
