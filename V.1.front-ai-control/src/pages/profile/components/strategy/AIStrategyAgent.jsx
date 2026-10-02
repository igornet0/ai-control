import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  PaperAirplaneIcon,
  SparklesIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import styles from '../../../documents/DocumentAiAssistant.module.css';
import { ProposalCard } from './StrategyPrimitives';
import { buildLocalAgentReply, goalsAggregate } from './strategyUtils';
import { parseProposalFromAiText, prepareAgentDisplayText, bindProposalToDepartment } from './agentReplyFormat';
import { aiAgentService } from '../../../../services/aiAgentService';
import MarkdownContent from '../../../../components/MarkdownContent';

const PANEL_HEIGHT_KEY = 'strategy_ai_assistant_height';
const PANEL_WIDTH_KEY = 'strategy_ai_assistant_width';
const PANEL_POS_KEY = 'strategy_ai_assistant_pos';
const PANEL_HEIGHT_DEFAULT = 420;
const PANEL_HEIGHT_MIN = 220;
const PANEL_WIDTH_DEFAULT = 380;
const PANEL_WIDTH_MIN = 280;

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

function buildQuickActions(hasStrategy) {
  return [
    {
      id: 'create',
      label: hasStrategy ? 'Улучшить стратегию' : 'Создать стратегию',
      prompt: hasStrategy
        ? 'Улучши стратегию компании и предложи недостающие цели'
        : 'Создай стратегию развития компании на следующий квартал',
    },
    { id: 'weak', label: 'Найти слабые места', prompt: 'Найди слабые места и bottlenecks в стратегии' },
    { id: 'goals', label: 'Предложить цели', prompt: 'Предложи цели компании' },
    { id: 'depts', label: 'Проверить отделы', prompt: 'Проверь цели отделов и связи с company goals' },
    { id: 'kpi', label: 'Сформировать KPI', prompt: 'Сформируй KPI' },
    { id: 'plan', label: 'План действий', prompt: 'Создай план действий на следующий период' },
  ];
}

/**
 * Floating AI Strategy Agent — same widget UX as Document / Data Model assistants.
 */
export default function AIStrategyAgent({
  context,
  focusDept = null,
  pendingPrompt = null,
  onConsumePrompt,
  onApplyProposal,
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [applying, setApplying] = useState(false);
  const [pendingProposal, setPendingProposal] = useState(null);
  const [agentMode, setAgentMode] = useState('local');
  const [panelHeight, setPanelHeight] = useState(readStoredPanelHeight);
  const [panelWidth, setPanelWidth] = useState(readStoredPanelWidth);
  const [panelPos, setPanelPos] = useState(readStoredPanelPos);
  const [resizingHeight, setResizingHeight] = useState(false);
  const [resizingWidth, setResizingWidth] = useState(false);
  const [movingPanel, setMovingPanel] = useState(false);

  const threadRef = useRef(null);
  const textareaRef = useRef(null);
  const hostRef = useRef(null);
  const resizeDragRef = useRef(null);
  const widthDragRef = useRef(null);
  const moveDragRef = useRef(null);
  const agentInfoRef = useRef(null);
  const contextRef = useRef(context);
  const focusRef = useRef(focusDept);
  const busyRef = useRef(false);

  contextRef.current = context;
  focusRef.current = focusDept;

  const hasStrategy = Boolean(context?.company?.id);
  const quickActions = useMemo(() => buildQuickActions(hasStrategy), [hasStrategy]);
  const agg = goalsAggregate(context?.company?.goals);

  useEffect(() => {
    aiAgentService
      .getAgentInfo()
      .then((info) => {
        agentInfoRef.current = info;
        setAgentMode(info?.enabled ? 'live' : 'local');
      })
      .catch(() => setAgentMode('local'));
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

  const ask = useCallback(async (raw) => {
    const text = String(raw || '').trim();
    if (!text || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setOpen(true);
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: text }]);

    const ctx = contextRef.current || {};
    const dept = focusRef.current;
    let reply = buildLocalAgentReply(text, {
      company: ctx.company,
      departments: ctx.departments,
      deptStrategies: ctx.deptStrategies,
      focusDept: dept,
      companyProfile: ctx.companyProfile,
      companyContextText: ctx.companyContextText,
    });
    let usedLive = false;

    try {
      const info = agentInfoRef.current;
      if (info?.enabled) {
        const strategyContext = {
          companyContext: ctx.companyContextText || null,
          company: ctx.company
            ? {
                id: ctx.company.id,
                title: ctx.company.title,
                description: ctx.company.description,
                goals: (ctx.company.goals || []).map((g) => ({
                  title: g.title,
                  status: g.status,
                  due_date: g.due_date,
                })),
              }
            : null,
          focusDepartment: dept
            ? {
                id: dept.id,
                name: dept.name,
                hasStrategy: Boolean(ctx.deptStrategies?.[dept.id]),
                strategy: ctx.deptStrategies?.[dept.id]
                  ? {
                      motivation: ctx.deptStrategies[dept.id].motivation,
                      role_description: ctx.deptStrategies[dept.id].role_description,
                      scope: ctx.deptStrategies[dept.id].scope,
                      goals: (ctx.deptStrategies[dept.id].goals || []).map((g) => ({
                        title: g.title,
                        status: g.status,
                        due_date: g.due_date,
                      })),
                    }
                  : null,
              }
            : null,
          insights: (ctx.insights || []).slice(0, 4).map((i) => `${i.title}: ${i.body}`),
        };
        const res = await aiAgentService.sendMessage(text, {
          historyScope: `strategy:${dept?.id || 'company'}`,
          systemPrompt: info.system_prompt,
          apiKeyId: info.api_key_id,
          agentName: info.name || 'AI Strategy Agent',
          triggers: info.triggers,
          skipTriggers: true,
          extraSystemContext: [
            'Ты AI Strategy Agent платформы 2A.',
            'Не меняй данные сам — только предлагай. Пользователь подтверждает apply.',
            'Используй Company Profile и текущую стратегию. Не выдумывай факты о компании.',
            'Отвечай кратко структурированным Markdown (заголовки ##, списки, **жирный**). Без огромных простыней.',
            'В конце добавь ОДИН fenced-блок ```json с объектом или массивом предложений для apply.',
            dept
              ? `Сейчас анализ отдела id=${dept.id} «${dept.name}». Обязательно верни type:"department_strategy" с departmentId:${dept.id}.`
              : 'Если предложение для компании — type:"company_strategy" или "add_goals".',
            'Форматы JSON:',
            '{"type":"department_strategy","departmentId":123,"motivation":"...","role_description":"...","scope":"...","goals":[{"title":"...","description":"...","due_date":"YYYY-MM-DD","status":"planned","actions":[{"title":"..."}]}]}',
            '{"type":"add_goals","strategyType":"department"|"company","departmentId":123,"goals":[{"title":"...","due_date":null,"actions":[{"title":"..."}]}]}',
            '{"type":"company_strategy","title":"...","description":"...","goals":[{"title":"..."}],"mergeGoals":true}',
            'Не дублируй JSON в тексте ответа — только в блоке ```json.',
            `Контекст:\n${JSON.stringify(strategyContext, null, 2)}`,
          ].join('\n'),
        });
        const agentText = res?.agent_message?.content || res?.content;
        if (agentText) {
          usedLive = true;
          reply = {
            text: prepareAgentDisplayText(agentText),
            proposal: bindProposalToDepartment(
              parseProposalFromAiText(agentText, reply.proposal),
              dept
            ),
          };
        }
      }
    } catch {
      // keep local reply
    }

    setAgentMode(usedLive ? 'live' : agentInfoRef.current?.enabled ? 'live-fallback' : 'local');
    const finalProposal = bindProposalToDepartment(reply.proposal || null, dept);
    setMessages((m) => [
      ...m,
      {
        role: 'assistant',
        content: reply.text,
        format: usedLive || /[*#`]/.test(reply.text || '') ? 'markdown' : 'text',
      },
    ]);
    setPendingProposal(finalProposal);
    busyRef.current = false;
    setBusy(false);
  }, []);

  useEffect(() => {
    if (!pendingPrompt) return undefined;
    setOpen(true);
    ask(pendingPrompt);
    onConsumePrompt?.();
    return undefined;
  }, [pendingPrompt, ask, onConsumePrompt]);

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages, pendingProposal, busy, open]);

  async function applyProposal() {
    if (!pendingProposal || !onApplyProposal) return;
    setApplying(true);
    try {
      await onApplyProposal(pendingProposal);
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: 'Изменения применены. Стратегия обновлена.', format: 'text' },
      ]);
      setPendingProposal(null);
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: `Не удалось применить: ${err?.message || 'ошибка'}`,
          format: 'text',
        },
      ]);
    } finally {
      setApplying(false);
    }
  }

  const agentLabel = focusDept
    ? `AI Agent — ${focusDept.name}`
    : 'AI Strategy Agent';

  const modeLabel =
    agentMode === 'live'
      ? 'Онлайн AI'
      : agentMode === 'live-fallback'
        ? 'Локально · AI недоступен'
        : 'Локальный аналитик';

  const statusLine = hasStrategy
    ? `${modeLabel} · ${agg.progress}% · ${agg.total} цел.`
    : `${modeLabel} · стратегия не задана`;

  const clearChat = () => {
    setMessages([]);
    setPendingProposal(null);
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={styles.host}
      ref={hostRef}
      style={{ position: 'fixed', inset: 0, zIndex: 80 }}
      onClick={(e) => e.stopPropagation()}
    >
      {!open && (
        <button
          type="button"
          className={`${styles.fab} ${styles.fabTable}`}
          onClick={() => setOpen(true)}
          title="AI Strategy Agent"
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
          aria-label="AI Strategy Agent"
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
                <strong>{agentLabel}</strong>
                <span>{statusLine}</span>
              </div>
            </div>
            <div className={styles.headActions}>
              {messages.length > 0 && (
                <button type="button" className={styles.iconBtn} title="Очистить" onClick={clearChat}>
                  <TrashIcon />
                </button>
              )}
              <button type="button" className={styles.iconBtn} title="Закрыть" onClick={() => setOpen(false)}>
                <XMarkIcon />
              </button>
            </div>
          </div>

          <div className={styles.messages} ref={threadRef}>
            {messages.length === 0 && !busy && (
              <div className={styles.empty}>
                Анализирую стратегию и отделы. Предлагаю изменения — запись только после подтверждения.
                <div className={styles.suggestions}>
                  {quickActions.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      className={styles.suggestion}
                      disabled={busy}
                      onClick={() => ask(a.prompt)}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div
                key={`${msg.role}-${idx}`}
                className={`${styles.bubbleRow} ${msg.role === 'user' ? styles.bubbleRowUser : styles.bubbleRowAgent}`}
              >
                <div className={`${styles.bubble} ${msg.role === 'user' ? styles.bubbleUser : styles.bubbleAgent}`}>
                  <div className={styles.bubbleText}>
                    {msg.role === 'assistant' ? (
                      <MarkdownContent>{msg.content}</MarkdownContent>
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              </div>
            ))}

            <ProposalCard
              proposal={pendingProposal}
              applying={applying}
              onApply={applyProposal}
              onCancel={() => setPendingProposal(null)}
            />

            {busy && (
              <div className={styles.typing} aria-label="AI печатает">
                <span /><span /><span />
              </div>
            )}
          </div>

          <form
            className={styles.composer}
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
          >
            <textarea
              ref={textareaRef}
              className={styles.input}
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                hasStrategy
                  ? 'Почему прогресс низкий? Что добавить?'
                  : 'Чем заняться компании в следующем квартале?'
              }
              disabled={busy}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  ask(input);
                }
              }}
            />
            <button
              type="submit"
              className={styles.sendBtn}
              disabled={busy || !input.trim()}
              aria-label="Отправить"
            >
              <PaperAirplaneIcon />
            </button>
          </form>
        </div>
      )}
    </div>,
    document.body
  );
}
