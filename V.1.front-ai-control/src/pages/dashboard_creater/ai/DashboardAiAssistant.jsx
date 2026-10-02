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
import { eventBus } from '../src/core/EventBus.js';
import {
  applyAllDashboardProposals,
  applyDashboardProposal,
  buildDashboardResponseProtocol,
  classifyDashboardIntent,
  needsModelSchema,
  parseDashboardAiReply,
  proposalLabel,
  safeJson,
  serializeDashboardSchema,
  summarizeDashboardSheet,
} from './dashboardCanvasAi.js';
import { getDashboardSchema } from '../../../services/dashboardSqliteSchemaService.js';
import styles from './DashboardAiAssistant.module.css';

export const DASHBOARD_ASSISTANT_PROMPT = `
Ты — AI-помощник дашбордов 2A (конструктор /dashboard/:id/sheet/:sheetId).

У тебя есть снимок листа: виджеты (layout, settings, dataSource, styles), live-значения (если есть), активные фильтры, переменные и список подключённых моделей данных этого дашборда. Также каталог типов виджетов, их settings/styles и гайд по дизайну.
При детальном анализе / привязке полей в снимок может быть добавлена схема таблиц: только имена полей и типы (без строк данных).

## Режимы
- editor: можешь советовать И предлагать изменения полотна через proposals (пользователь жмёт «Применить»).
- viewer: только анализ и советы по данным/фильтрам. proposals всегда []. Не предлагай менять layout.

## Гибрид в editor
- help / describe / analyze → текстовый совет, proposals обычно [].
- act (явные «сделай / добавь / улучши / оформи / скопируй стиль») → JSON с proposals.

## Дизайн и стили
- Умеешь делать красивые виджеты: styles (appearance/typography/borders/shadows) + визуальные цвета в settings.
- На «оформи / сделай красиво» давай act с конкретными update_styles (и update_settings для KPI/chart цветов).
- На «скопируй стиль с этого на остальные» используй copy_styles. Если в фокусе несколько выбранных виджетов — первый источник, остальные цели (если пользователь не указал иначе).
- Сохраняй единый визуальный язык листа; не ломай dataSource и привязки полей.

## Модели и поля
- «какие модели подключены» → блок «Подключённые модели данных».
- Имена/типы полей бери только из блока схемы (если он есть). Не выдумывай поля и не проси строки данных — строк в контексте нет.
- Для bind_field / KPI / chart используй реальные table.field из схемы.

На вопросы «какие виджеты доступны / что умеют» опирайся на каталог типов в протоколе ответа.
Не выдумывай id виджетов и числа, которых нет в снимке.
Не называй себя DeepSeek/ChatGPT/Claude. Отвечай на русском.
`.trim();

const DEFAULT_SUGGESTIONS_EDITOR = [
  'Какие модели подключены?',
  'Какие поля и типы в модели?',
  'Какие виджеты стоит добавить?',
  'Сделай красивый дизайн виджетов',
];

const DEFAULT_SUGGESTIONS_VIEWER = [
  'Проанализируй текущие значения',
  'Что показывают виджеты?',
  'Какие фильтры сейчас активны?',
  'Что можно улучшить в отчёте?',
];

const FAQ_SCOPE = 'dashboard';
const PANEL_HEIGHT_KEY = 'dashboard_ai_assistant_height';
const PANEL_WIDTH_KEY = 'dashboard_ai_assistant_width';
const PANEL_POS_KEY = 'dashboard_ai_assistant_pos';
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

function widgetLabel(widget) {
  if (!widget) return 'Виджет';
  const s = widget.settings || {};
  return (
    s.title
    || widget.title
    || widget.name
    || s.name
    || widget.type
    || `id=${widget.id}`
  );
}

function summarizeAttachedWidgets(widgets) {
  if (!widgets?.length) return '';
  const lines = widgets.map((w, idx) => (
    [
      `- #${idx + 1} id=${w.id}, type=${w.type}, title=${widgetLabel(w)}${idx === 0 ? ' (кандидат в источник стиля)' : ' (кандидат в цель стиля)'}`,
      `  settings=${safeJson(w.settings || {}, 1000)}`,
      w.styles ? `  styles=${safeJson(w.styles, 1200)}` : null,
      w.dataSource != null ? `  dataSource=${safeJson(w.dataSource, 400)}` : null,
    ].filter(Boolean).join('\n')
  ));
  return [
    '## Выбранные пользователем виджеты (фокус запроса)',
    'Если просят перенести дизайн и не указали id явно: первый виджет = source, остальные = targets для copy_styles.',
    ...lines,
  ].join('\n');
}

function intentBadgeLabel(intent) {
  if (intent === 'act') return 'изменения';
  if (intent === 'describe') return 'описание';
  if (intent === 'analyze') return 'анализ';
  return 'помощь';
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
 * Плавающий AI-помощник дашборда (editor + viewer).
 */
export default function DashboardAiAssistant({
  engineRef,
  dashboardId,
  sheetId,
  dashboardName,
  mode = 'editor',
  shareToken = null,
  onPersist = null,
}) {
  const surface = mode === 'viewer' ? 'viewer' : 'editor';
  const canMutate = surface === 'editor';

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

  const defaultSuggestions = surface === 'viewer'
    ? DEFAULT_SUGGESTIONS_VIEWER
    : DEFAULT_SUGGESTIONS_EDITOR;

  const suggestions = useMemo(() => {
    if (faqs.length) return faqs.map((f) => f.question);
    return defaultSuggestions;
  }, [faqs, defaultSuggestions]);

  const faqByQuestion = useMemo(() => {
    const map = new Map();
    for (const f of faqs) {
      map.set(normalizeQuestion(f.question), f);
    }
    return map;
  }, [faqs]);

  const historyScope = useMemo(() => {
    const base = `dashboard-${dashboardId || 'draft'}-sheet-${sheetId || 'none'}`;
    return shareToken ? `${base}-share-${String(shareToken).slice(0, 12)}` : base;
  }, [dashboardId, sheetId, shareToken]);

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
        persistPanelPos(p);
        return p;
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
    const viewport = typeof document !== 'undefined'
      ? document.getElementById('viewport')
      : null;
    if (!viewport) return;
    viewport.classList.toggle('ai-widget-pick-mode', Boolean(enabled));
  }, []);

  useEffect(() => {
    setViewportPickClass(pickMode && open && canMutate);
    return () => setViewportPickClass(false);
  }, [pickMode, open, canMutate, setViewportPickClass]);

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
        return [...prev, {
          id: widget.id,
          type: widget.type,
          title: widgetTitleSafe(widget),
          settings: { ...(widget.settings || {}) },
          styles: widget.styles && typeof widget.styles === 'object'
            ? { ...widget.styles }
            : {},
          dataSource: widget.dataSource != null ? widget.dataSource : null,
        }];
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

  const buildExtraContext = useCallback((widgets = attachedWidgets, intent = 'help', opts = {}) => {
    const includeModelSchema = Boolean(opts.includeModelSchema);
    const sheet = summarizeDashboardSheet(engineRef?.current, {
      dashboardName,
      dashboardId,
      sheetId,
      includeLive: true,
      includeModelSchema,
      modelSchema: opts.modelSchema ?? engineRef?.current?.__dashboardModelSchema ?? null,
    });
    const focus = summarizeAttachedWidgets(widgets);
    return [
      DASHBOARD_ASSISTANT_PROMPT,
      `## Поверхность\nsurface=${surface}`,
      buildDashboardResponseProtocol(intent, surface),
      `## Классификация текущего запроса\nintent=${intent}`,
      includeModelSchema
        ? '## Схема моделей\nВ снимке ниже — только имена таблиц/полей и типы. Строк данных нет.'
        : null,
      '## Снимок текущего листа',
      sheet,
      focus || null,
    ].filter(Boolean).join('\n\n');
  }, [attachedWidgets, engineRef, dashboardName, dashboardId, sheetId, surface]);

  const ensureModelSchema = useCallback(async (force = false) => {
    const engine = engineRef?.current;
    if (!dashboardId) return null;
    if (!force && engine?.__dashboardModelSchema) {
      return engine.__dashboardModelSchema;
    }
    try {
      const raw = await getDashboardSchema(dashboardId);
      const serialized = serializeDashboardSchema(raw);
      if (engine) engine.__dashboardModelSchema = serialized;
      return serialized;
    } catch (e) {
      console.warn('[DashboardAiAssistant] model schema load failed', e);
      return engine?.__dashboardModelSchema || null;
    }
  }, [dashboardId, engineRef]);

  const persistAfterApply = useCallback(async () => {
    if (typeof onPersist === 'function') {
      try {
        await onPersist();
      } catch (e) {
        console.warn('[DashboardAiAssistant] persist failed', e);
      }
    }
  }, [onPersist]);

  const removeAttached = useCallback((id) => {
    setAttachedWidgets((prev) => prev.filter((w) => String(w.id) !== String(id)));
  }, []);

  const handleApplyProposal = useCallback(async (messageId, proposal) => {
    if (!canMutate) {
      setError('В режиме просмотра нельзя применять изменения layout');
      return;
    }
    const engine = engineRef?.current;
    if (!engine) {
      setError('Полотно ещё не готово');
      return;
    }
    let result;
    try {
      result = await applyDashboardProposal(engine, proposal);
    } catch (e) {
      result = { ...proposal, status: 'error', _error: e?.message || String(e) };
    }
    setMessages((prev) => {
      const msg = prev.find((m) => m.id === messageId);
      const list = Array.isArray(msg?._proposals) ? msg._proposals : [];
      const nextProps = list.map((p) => (p.id === proposal.id ? result : p));
      const next = prev.map((m) => (
        m.id === messageId ? { ...m, _proposals: nextProps } : m
      ));
      aiAgentService.saveMessages(next, historyScope);
      return next;
    });
    if (result.status === 'applied') await persistAfterApply();
  }, [canMutate, engineRef, historyScope, persistAfterApply]);

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
    if (!canMutate) {
      setError('В режиме просмотра нельзя применять изменения layout');
      return;
    }
    const engine = engineRef?.current;
    if (!engine) {
      setError('Полотно ещё не готово');
      return;
    }
    const pending = (proposals || []).filter((p) => !p.status || p.status === 'pending');
    const results = await applyAllDashboardProposals(engine, pending);
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
    if (results.some((r) => r.status === 'applied')) await persistAfterApply();
  }, [canMutate, engineRef, historyScope, persistAfterApply]);

  const handleSend = async (presetText = null) => {
    const text = (presetText ?? input).trim();
    if (!text || sending) return;
    if (!presetText) setInput('');
    setError('');

    const widgetsForSend = attachedWidgets;
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
    const intent = classifyDashboardIntent(text, {
      previousMode: lastAssistant?._intent || null,
      hasAttachedWidgets: widgetsForSend.length > 0,
      surface,
    });

    if (!widgetsForSend.length && (intent === 'help' || (surface === 'viewer' && intent === 'analyze'))) {
      let faq = faqByQuestion.get(normalizeQuestion(text));
      if (!faq) {
        try {
          const found = await aiAgentService.listFaqs(FAQ_SCOPE, text);
          if (found?.[0]?.answer) faq = found[0];
        } catch {
          /* fallback to model */
        }
      }
      if (faq?.answer && intent === 'help') {
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
      _entity_refs: dashboardId
        ? [buildEntityRef('dashboard', dashboardId, dashboardName || `Дашборд #${dashboardId}`)]
        : [],
      _intent: intent,
    };
    setMessages((prev) => [...prev, temp]);
    setAttachedWidgets([]);

    try {
      const wantSchema = needsModelSchema(text, { intent });
      let modelSchema = null;
      if (wantSchema) {
        modelSchema = await ensureModelSchema(false);
      }
      const result = await aiAgentService.sendMessage(text, {
        systemPrompt: agentInfo?.system_prompt || null,
        apiKeyId: agentInfo?.api_key_id || null,
        agentName: agentInfo?.name || 'AI Ассистент',
        historyScope,
        skipTriggers: true,
        surface: 'dashboard_canvas',
        extraSystemContext: buildExtraContext(widgetsForSend, intent, {
          includeModelSchema: wantSchema,
          modelSchema,
        }),
      });

      const parsed = parseDashboardAiReply(
        result.agent_message?.content || '',
        intent,
        surface,
      );
      const serverRefs = Array.isArray(result.agent_message?._entity_refs)
        ? result.agent_message._entity_refs
        : null;
      const agentMessage = {
        ...result.agent_message,
        content: parsed.summary || result.agent_message?.content || '',
        _intent: parsed.mode || intent,
        _proposals: parsed.proposals.length ? parsed.proposals : null,
        _structured: parsed.structured,
        _entity_refs: serverRefs?.length
          ? serverRefs
          : (dashboardId && /пришл|ссылк|карточк|attach|send/i.test(text)
            ? [buildEntityRef('dashboard', dashboardId, dashboardName || `Дашборд #${dashboardId}`)]
            : null),
      };

      setMessages((prev) => {
        const filtered = prev.filter((m) => !m._temp);
        const userMsg = result.user_message
          ? {
              ...result.user_message,
              _attached_widgets: widgetsForSend,
              _entity_refs: dashboardId
                ? [buildEntityRef('dashboard', dashboardId, dashboardName || `Дашборд #${dashboardId}`)]
                : [],
              _intent: intent,
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

  const handleClear = async () => {
    if (!window.confirm('Очистить историю помощника по этому листу?')) return;
    await aiAgentService.clearHistory(historyScope);
    setMessages([]);
    setAttachedWidgets([]);
    setPickMode(false);
  };

  const handleClose = () => {
    setOpen(false);
    setPickMode(false);
  };

  const subtitle = surface === 'viewer'
    ? (pickMode ? 'Кликните виджеты…' : 'Анализ дашборда')
    : (pickMode ? 'Кликните виджеты на полотне…' : 'Конструктор дашборда');

  return (
    <div className={styles.host} ref={hostRef}>
      {!open && (
        <button
          type="button"
          className={`${styles.fab} ${surface === 'editor' ? styles.fabEditorOffset : ''}`}
          onClick={() => setOpen(true)}
          title="AI помощник дашборда"
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
          aria-label="AI помощник дашборда"
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
          />
          <div
            className={styles.resizeHandleE}
            onMouseDown={(e) => startResizeWidth(e, 'e')}
            role="separator"
            aria-orientation="vertical"
            aria-label="Изменить ширину чата"
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
                <span>{subtitle}</span>
              </div>
            </div>
            <div className={styles.headActions}>
              {canMutate && (
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
              )}
              <button type="button" className={styles.iconBtn} onClick={handleClear} title="Очистить">
                <TrashIcon />
              </button>
              <button type="button" className={styles.iconBtn} onClick={handleClose} title="Закрыть">
                <XMarkIcon />
              </button>
            </div>
          </div>

          {pickMode && canMutate && (
            <div className={styles.pickBanner} role="status">
              Выберите виджеты на полотне, затем опишите, что сделать. Esc — выход.
            </div>
          )}

          <div className={styles.messages}>
            {messages.length === 0 && !sending && (
              <div className={styles.empty}>
                <p>
                  {surface === 'viewer'
                    ? 'Спросите про значения виджетов, фильтры или попросите совет по данным.'
                    : 'Спросите, как настроить виджеты, или попросите улучшить layout.'}
                </p>
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
              const proposals = canMutate && Array.isArray(msg._proposals) ? msg._proposals : [];
              const pending = proposals.filter((p) => !p.status || p.status === 'pending');
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
                        {intentBadgeLabel(msg._intent)}
                      </div>
                    )}
                    <div className={styles.bubbleText}>
                      {isUser ? msg.content : <MarkdownContent>{msg.content}</MarkdownContent>}
                    </div>
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
            {canMutate && (
              <button
                type="button"
                className={`${styles.pickBtn} ${pickMode ? styles.pickBtnActive : ''}`}
                onClick={() => setPickMode((v) => !v)}
                title={pickMode ? 'Выключить выбор виджетов' : 'Выбрать виджеты на полотне'}
                aria-pressed={pickMode}
              >
                <WidgetPickIcon />
              </button>
            )}
            <textarea
              ref={textareaRef}
              className={styles.input}
              value={input}
              rows={1}
              placeholder={
                surface === 'viewer'
                  ? 'Спросить про данные и фильтры…'
                  : attachedWidgets.length
                    ? 'Что сделать с выбранными виджетами?'
                    : 'Спросить про дашборд…'
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

function widgetTitleSafe(widget) {
  const s = widget?.settings || {};
  return s.title || widget?.title || widget?.name || null;
}
