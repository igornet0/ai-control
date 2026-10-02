import axios from 'axios';
import { getApiBaseUrl } from './apiBaseUrl';
import { getAvatarUrl } from '../utils/getAvatarUrl';
import { refreshAccessToken, getAccessToken } from './tokenRefresh';

/**
 * Базовый URL AI-сервиса.
 * Prod: nginx проксирует /ai-api/ → aic_ai (порт 8003)
 * Dev:  VITE_AI_API_URL или fallback на основной apiBase + /ai-api
 */
function getAiApiBaseUrl() {
  const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};
  if (env.VITE_AI_API_URL) return String(env.VITE_AI_API_URL).replace(/\/$/, '');
  const base = getApiBaseUrl();
  return `${base}/ai-api`;
}

const aiApi = axios.create({
  baseURL: getAiApiBaseUrl(),
  timeout: 60000,
});

aiApi.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

aiApi.interceptors.response.use(
  (r) => r,
  async (error) => {
    if (error.response?.status === 401) {
      const orig = error.config || {};
      if (!orig._retry) {
        orig._retry = true;
        const newToken = await refreshAccessToken();
        if (newToken) {
          orig.headers = orig.headers || {};
          orig.headers.Authorization = `Bearer ${newToken}`;
          return aiApi(orig);
        }
      }
    }
    return Promise.reject(error);
  }
);

/**
 * Локальное хранилище истории сообщений агента.
 * Используется пока бэкенд не имеет персистентной истории.
 */
const HISTORY_KEY = 'ai_agent_chat_history';
const MAX_HISTORY = 50;

function historyKeyFor(scope) {
  if (!scope || scope === 'default') return HISTORY_KEY;
  return `${HISTORY_KEY}__${String(scope)}`;
}

function loadHistory(scope = 'default') {
  try {
    return JSON.parse(localStorage.getItem(historyKeyFor(scope)) || '[]');
  } catch {
    return [];
  }
}

function saveHistory(messages, scope = 'default') {
  const trimmed = messages.slice(-MAX_HISTORY);
  try {
    localStorage.setItem(historyKeyFor(scope), JSON.stringify(trimmed));
  } catch {}
}

let _msgIdCounter = Date.now();
function nextId() {
  return ++_msgIdCounter;
}

function parseKeywords(raw) {
  return String(raw || '')
    .split(',')
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Выбор триггера для сообщения.
 * Приоритет: ключевые слова → сущность → дефолтный (без слов и entity).
 */
export function matchAgentTrigger(text, triggers, entityType = 'none') {
  const list = Array.isArray(triggers) ? triggers : [];
  const normalized = String(text || '').toLowerCase();
  const entity = entityType || 'none';

  const withScenario = list.filter((t) => t && t.scenario_id);

  for (const t of withScenario) {
    const keywords = parseKeywords(t.keywords);
    if (!keywords.length) continue;
    const entityOk = !t.entity_type || t.entity_type === 'none' || t.entity_type === entity;
    if (!entityOk) continue;
    if (keywords.some((k) => normalized.includes(k))) return t;
  }

  if (entity !== 'none') {
    for (const t of withScenario) {
      if (parseKeywords(t.keywords).length) continue;
      if (t.entity_type === entity) return t;
    }
  }

  for (const t of withScenario) {
    if (parseKeywords(t.keywords).length) continue;
    if (!t.entity_type || t.entity_type === 'none') return t;
  }

  return null;
}

function buildSystemPrompt(systemPrompt, agentName, extraSystemContext = null) {
  const parts = [];
  if (systemPrompt) parts.push(String(systemPrompt).trim());
  if (extraSystemContext) parts.push(String(extraSystemContext).trim());
  const name = agentName || 'AI Ассистент';
  parts.push(
    `Ты — «${name}», ассистент платформы 2A. `
      + 'Никогда не представляйся как DeepSeek, ChatGPT, Claude, Grok или другую стороннюю модель. '
      + 'Не упоминай компанию-провайдера API. Следуй инструкциям выше в первую очередь.'
  );
  return parts.filter(Boolean).join('\n\n');
}

export const aiAgentService = {
  /**
   * Публичный конфиг агента для текущего пользователя.
   * GET /api/ai-agent/ — сервер проверяет enabled + access.
   * Без доступа: enabled=false (чат не показываем).
   * localStorage админа сюда не подмешиваем — иначе у всех «чужой» черновик.
   */
  async getAgentInfo() {
    try {
      const { default: api } = await import('./api');
      const response = await api.get('/api/ai-agent/');
      const data = response.data || {};
      const allowed = data.allowed !== false && data.enabled !== false;
      return {
        enabled: Boolean(allowed),
        allowed: Boolean(allowed),
        name: data.name || 'AI Ассистент',
        avatar_path: data.avatar_path || null,
        system_prompt: data.system_prompt ?? null,
        api_key_id: data.api_key_id ?? null,
        triggers: Array.isArray(data.triggers) ? data.triggers : [],
      };
    } catch {
      return {
        enabled: false,
        allowed: false,
        name: 'AI Ассистент',
        avatar_path: null,
        system_prompt: null,
        api_key_id: null,
        triggers: [],
      };
    }
  },

  /**
   * FAQ-ответы для пресетов ассистента (без вызова модели).
   * @param {string} scope e.g. 'data-model'
   * @param {string} [question] если задан — точный поиск по нормализованному вопросу
   */
  async listFaqs(scope = 'data-model', question = null) {
    const { default: api } = await import('./api');
    const params = { scope };
    if (question) params.q = question;
    const { data } = await api.get('/api/ai-faqs/', { params });
    return Array.isArray(data) ? data : [];
  },

  /**
   * Записать пару user/assistant в историю без LLM (кэшированный FAQ).
   */
  appendFaqExchange(question, answer, historyScope = 'default') {
    const history = loadHistory(historyScope);
    const now = new Date().toISOString();
    const userMsg = {
      id: nextId(),
      role: 'user',
      content: String(question || ''),
      created_at: now,
      _faq: true,
    };
    const agentMsg = {
      id: nextId(),
      role: 'assistant',
      content: String(answer || ''),
      created_at: now,
      _faq: true,
    };
    const updated = [...history, userMsg, agentMsg];
    saveHistory(updated, historyScope);
    return { user_message: userMsg, agent_message: agentMsg };
  },

  /**
   * Получить историю из localStorage.
   */
  async getHistory(scope = 'default') {
    const messages = loadHistory(scope);
    return { messages };
  },

  /**
   * Отправить сообщение.
   * Если сработал триггер — запускает сценарий /api/v1/scenarios/{id}/run,
   * иначе обычный чат /api/v1/chat с system_prompt агента.
   */
  async sendMessage(content, options = {}) {
    const {
      systemPrompt = null,
      apiKeyId = null,
      agentName = null,
      triggers = [],
      entityType = 'none',
      entityId = null,
      entityContext = null,
      forceProposals = false,
      entityRefs = null,
      historyScope = 'default',
      skipTriggers = false,
      extraSystemContext = null,
      surface = null,
    } = options || {};

    const history = loadHistory(historyScope);

    const userMsg = {
      id: nextId(),
      role: 'user',
      content,
      created_at: new Date().toISOString(),
      _entity_refs: Array.isArray(entityRefs) && entityRefs.length ? entityRefs : null,
    };

    const trigger = skipTriggers ? null : matchAgentTrigger(content, triggers, entityType);
    let data;

    if (trigger?.scenario_id) {
      const payload = {
        message: content,
        return_proposals: Boolean(trigger.return_proposals) || forceProposals,
      };
      if (apiKeyId != null) payload.api_key_id = apiKeyId;
      if (entityType && entityType !== 'none' && entityId != null) {
        payload.entity_type = entityType;
        payload.entity_id = Number(entityId);
        // При прикреплённой сущности всегда просим proposals
        payload.return_proposals = true;
      } else if (trigger.entity_type && trigger.entity_type !== 'none' && entityId != null) {
        payload.entity_type = trigger.entity_type;
        payload.entity_id = Number(entityId);
        payload.return_proposals = true;
      }

      const res = await aiApi.post(`/api/v1/scenarios/${trigger.scenario_id}/run`, payload);
      data = res.data;

      // AnalysisResponseSchema: content may be in summary
      if (!data.content && data.summary) data = { ...data, content: data.summary };
    } else if (entityType && entityType !== 'none' && entityId != null && entityContext) {
      // Нет сценария — анализ через chat с контекстом сущности и JSON-proposals
      const editable = Array.isArray(entityContext._editable_fields)
        ? entityContext._editable_fields
        : [];
      const ctxLines = Object.entries(entityContext)
        .filter(([k]) => !k.startsWith('_'))
        .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
        .join('\n');
      const analysisSystem = [
        buildSystemPrompt(systemPrompt, agentName, extraSystemContext),
        `Проанализируй прикреплённую сущность (${entityType} #${entityId}).`,
        `Контекст:\n${ctxLines}`,
        editable.length
          ? `Верни ТОЛЬКО JSON вида {"summary":"...","proposals":[{"field_name":"...","original_value":"...","proposed_value":"...","reason":"..."}]}. field_name только из: ${editable.join(', ')}.`
          : 'Верни JSON {"summary":"...","proposals":[]}.',
      ].filter(Boolean).join('\n\n');

      const apiMessages = [
        { role: 'system', content: analysisSystem },
        { role: 'user', content },
      ];
      const payload = { messages: apiMessages };
      if (apiKeyId != null) payload.api_key_id = apiKeyId;
      if (surface) payload.surface = surface;
      const res = await aiApi.post('/api/v1/chat', payload);
      data = res.data;
      // Try parse proposals from content
      try {
        const parsed = JSON.parse(data.content || '');
        if (parsed && (parsed.summary || parsed.proposals)) {
          data = {
            content: parsed.summary || data.content,
            summary: parsed.summary || '',
            proposals: (parsed.proposals || []).map((p) => ({
              ...p,
              _local: true,
              entity_type: entityType,
              entity_id: Number(entityId),
            })),
          };
        }
      } catch {
        /* plain text reply */
      }
    } else {
      const apiMessages = [];
      const sys = buildSystemPrompt(systemPrompt, agentName, extraSystemContext);
      if (sys) apiMessages.push({ role: 'system', content: sys });

      // Не тащим старую «личность» модели из истории — только короткий контекст диалога
      const contextMessages = history.slice(-10);
      for (const m of contextMessages) {
        if (m.role === 'system') continue;
        apiMessages.push({ role: m.role, content: m.content });
      }
      apiMessages.push({ role: 'user', content });

      const payload = { messages: apiMessages };
      if (apiKeyId != null) payload.api_key_id = apiKeyId;
      if (surface) payload.surface = surface;

      const res = await aiApi.post('/api/v1/chat', payload);
      data = res.data;
    }

    const agentMsg = {
      id: nextId(),
      role: 'assistant',
      content: data.content || data.summary || '',
      created_at: new Date().toISOString(),
      _scenario_id: trigger?.scenario_id || null,
      _proposals: Array.isArray(data.proposals)
        ? data.proposals.map((p) => ({ ...p, status: p.status || 'pending' }))
        : null,
      _entity_type: entityType !== 'none' ? entityType : null,
      _entity_id: entityId != null ? Number(entityId) : null,
      _entity_refs: Array.isArray(data.entity_refs) && data.entity_refs.length
        ? data.entity_refs
        : null,
    };

    const updated = [...history, userMsg, agentMsg];
    saveHistory(updated, historyScope);

    return { user_message: userMsg, agent_message: agentMsg, trigger };
  },

  async applyProposal(proposal, fallbackEntity = null) {
    if (proposal?.id && !proposal._local) {
      const { data } = await aiApi.post(`/api/v1/proposals/${proposal.id}/apply`);
      return data;
    }

    // Локальные proposals (без записи в ai_proposals) — применяем через основной API
    const entityType = proposal.entity_type || fallbackEntity?.type;
    const entityId = proposal.entity_id || fallbackEntity?.id;
    const field = proposal.field_name;
    const value = proposal.proposed_value;
    const isDocumentOp = entityType === 'document' && proposal?.op && proposal.op !== 'create_document';
    if (!entityType || entityId == null || (!field && !isDocumentOp)) {
      throw new Error('Недостаточно данных для применения изменения');
    }

    if (entityType === 'task') {
      const { taskService } = await import('./taskService');
      await taskService.updateTask(entityId, { [field]: value });
    } else if (entityType === 'document') {
      const { documentService } = await import('./documentService');
      if (proposal?.op && proposal.op !== 'create_document') {
        const { persistDocumentFieldProposal } = await import('../pages/documents/documentEditorAi');
        await persistDocumentFieldProposal(proposal, entityId, {
          fieldsList: fallbackEntity?.fieldsList,
          sheetBlocks: fallbackEntity?.sheetBlocks,
          allowFormulaOverwrite: proposal._allow_formula_overwrite
            ?? fallbackEntity?.allowFormulaOverwrite,
        });
      } else if (field === 'field_data' || (typeof field === 'string' && field.startsWith('field.'))) {
        const doc = await documentService.getDocument(entityId);
        const data = { ...(doc.field_data || {}) };
        const parsed = (() => {
          if (value == null || typeof value !== 'string') return value;
          const s = value.trim();
          if ((s.startsWith('{') && s.endsWith('}')) || (s.startsWith('[') && s.endsWith(']'))) {
            try { return JSON.parse(s); } catch { return value; }
          }
          return value;
        })();
        if (field === 'field_data') {
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            Object.assign(data, parsed);
          }
        } else {
          data[field.slice(6)] = parsed;
        }
        await documentService.updateDocument(entityId, { field_data: data });
      } else {
        await documentService.updateDocument(entityId, { [field]: value });
      }
    } else {
      throw new Error(`Тип «${entityType}» не поддерживает применение изменений из чата`);
    }

    return { ...proposal, status: 'applied' };
  },

  async rejectProposal(proposal) {
    if (proposal?.id && !proposal._local) {
      const { data } = await aiApi.post(`/api/v1/proposals/${proposal.id}/reject`);
      return data;
    }
    return { ...proposal, status: 'rejected' };
  },

  async applyAllProposals(proposals, fallbackEntity = null) {
    const results = [];
    for (const p of proposals || []) {
      if (p.status && p.status !== 'pending') continue;
      try {
        results.push(await this.applyProposal(p, fallbackEntity));
      } catch (e) {
        results.push({ ...p, status: 'error', _error: e?.message || String(e) });
      }
    }
    return results;
  },

  /**
   * Обновить proposals у сообщения в истории (статусы applied/rejected).
   */
  updateMessageProposals(messageId, proposals, historyScope = 'default') {
    const history = loadHistory(historyScope);
    const next = history.map((m) => (
      m.id === messageId ? { ...m, _proposals: proposals } : m
    ));
    saveHistory(next, historyScope);
    return next;
  },

  /**
   * Перезаписать всю историю (после правок статусов в UI).
   */
  saveMessages(messages, historyScope = 'default') {
    saveHistory(Array.isArray(messages) ? messages : [], historyScope);
  },

  /**
   * Очистить историю.
   */
  async clearHistory(historyScope = 'default') {
    saveHistory([], historyScope);
    return {};
  },

  /**
   * Call AI chat with ACL-scoped task snapshot (server-side).
   * @param {string} content
   * @param {{
   *   partyRoomId?: string|null,
   *   participants?: Array<{user_id?: number|null, name?: string}>,
   *   apiKeyId?: number|null,
   *   historyScope?: string,
   *   target?: string|null,
   *   employeeId?: number|null,
   *   departmentId?: number|null,
   *   teamId?: number|null,
   *   projectId?: number|null,
   * }} [options]
   */
  async sendCallAiChat(content, options = {}) {
    const {
      partyRoomId = null,
      participants = [],
      apiKeyId = null,
      historyScope = 'default',
      target = null,
      employeeId = null,
      departmentId = null,
      teamId = null,
      projectId = null,
      agentName = 'AI Ассистент',
    } = options || {};

    const history = loadHistory(historyScope);
    const userMsg = {
      id: nextId(),
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    };

    const contextMessages = history
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-8)
      .map((m) => ({ role: m.role, content: String(m.content || '') }));

    const payload = {
      content,
      party_room_id: partyRoomId || null,
      participants: (participants || []).map((p) => ({
        user_id: p.user_id ?? p.userId ?? null,
        name: p.name || null,
      })),
      history: contextMessages,
    };
    if (apiKeyId != null) payload.api_key_id = apiKeyId;
    if (target) payload.target = target;
    if (employeeId != null) payload.employee_id = employeeId;
    if (departmentId != null) payload.department_id = departmentId;
    if (teamId != null) payload.team_id = teamId;
    if (projectId != null) payload.project_id = projectId;

    const res = await aiApi.post('/api/v1/call-ai/chat', payload);
    const data = res.data || {};
    const reply = String(data.content || '').trim() || 'Пустой ответ';

    const agentMsg = {
      id: nextId(),
      role: 'assistant',
      content: reply,
      created_at: new Date().toISOString(),
      _scope: data.scope || null,
      _entity_refs: Array.isArray(data.entity_refs) ? data.entity_refs : [],
      _agent: agentName,
    };
    const updated = [...history, userMsg, agentMsg];
    saveHistory(updated, historyScope);
    return {
      user_message: userMsg,
      agent_message: agentMsg,
      scope: data.scope || null,
      entity_refs: Array.isArray(data.entity_refs) ? data.entity_refs : [],
      provider: data.provider,
      model: data.model,
    };
  },

  getAvatarUrl(path) {
    return getAvatarUrl(path);
  },
};
