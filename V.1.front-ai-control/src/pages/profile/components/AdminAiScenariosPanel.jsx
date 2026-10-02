import React, { useCallback, useEffect, useRef, useState } from 'react';
import { adminService } from '../../../services/adminService';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PROVIDERS = [
  { value: '', label: '— Из настроек —' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'mistral', label: 'Mistral' },
  { value: 'groq', label: 'Groq' },
];

const ENTITY_TYPES = [
  { value: '', label: '— без сущности —' },
  { value: 'task', label: 'Задача (task)', fields: ['title', 'description', 'priority', 'status'] },
  { value: 'project', label: 'Проект (project)', fields: ['title', 'description', 'priority', 'status'] },
  { value: 'file', label: 'Файл (file)', fields: [] },
];

const SCENARIO_TEMPLATES = [
  {
    key: 'chat',
    icon: '💬',
    label: 'Обычный чат',
    description: 'Базовый ассистент для ответов на вопросы сотрудников',
    name: 'Общий ассистент',
    systemPrompt: 'Ты — полезный корпоративный ИИ-ассистент. Отвечай на вопросы пользователя чётко, профессионально и по делу. Используй только достоверную информацию.',
    returnProposals: false,
    entityType: '',
    userPromptTemplate: '',
    provider: '',
    model: '',
  },
  {
    key: 'task_analysis',
    icon: '✅',
    label: 'Анализ задачи',
    description: 'Анализирует задачу и предлагает улучшения полей',
    name: 'Анализ задачи',
    systemPrompt: `Ты — опытный менеджер проектов и аналитик. Проанализируй задачу и верни JSON:
{
  "summary": "<краткий анализ задачи, что хорошо, что можно улучшить>",
  "proposals": [
    {"field_name": "<поле из: title, description, priority, status>", "original_value": "<текущее значение>", "proposed_value": "<предлагаемое значение>", "reason": "<обоснование>"}
  ]
}
Предлагай только реально полезные изменения. Не изменяй поля без необходимости.`,
    returnProposals: true,
    entityType: 'task',
    userPromptTemplate: 'Проанализируй задачу и предложи улучшения.',
    provider: '',
    model: '',
  },
  {
    key: 'project_review',
    icon: '📁',
    label: 'Ревью проекта',
    description: 'Анализирует проект и предлагает корректировки',
    name: 'Ревью проекта',
    systemPrompt: `Ты — бизнес-аналитик с опытом в управлении проектами. Изучи проект и верни JSON:
{
  "summary": "<анализ состояния проекта, риски и рекомендации>",
  "proposals": [
    {"field_name": "<поле из: title, description, priority, status>", "original_value": "<текущее>", "proposed_value": "<предлагаемое>", "reason": "<почему>"}
  ]
}`,
    returnProposals: true,
    entityType: 'project',
    userPromptTemplate: 'Проведи ревью проекта и предложи улучшения.',
    provider: '',
    model: '',
  },
  {
    key: 'summarize',
    icon: '📝',
    label: 'Суммаризация',
    description: 'Создаёт краткое резюме из длинного текста',
    name: 'Суммаризатор',
    systemPrompt: 'Ты — эксперт по сжатию информации. Создай краткое, структурированное резюме переданного текста. Сохрани все ключевые факты и выводы. Используй маркированные списки где уместно.',
    returnProposals: false,
    entityType: '',
    userPromptTemplate: 'Создай краткое резюме:\n\n{message}',
    provider: '',
    model: '',
  },
  {
    key: 'translate',
    icon: '🌐',
    label: 'Перевод',
    description: 'Переводит текст на нужный язык',
    name: 'Переводчик',
    systemPrompt: 'Ты — профессиональный переводчик. Переводи текст точно, сохраняя стиль и тон оригинала. Не добавляй пояснений, только перевод.',
    returnProposals: false,
    entityType: '',
    userPromptTemplate: 'Переведи на русский:\n\n{message}',
    provider: '',
    model: '',
  },
  {
    key: 'code_review',
    icon: '💻',
    label: 'Code Review',
    description: 'Анализирует код и предлагает улучшения',
    name: 'Code Reviewer',
    systemPrompt: `Ты — Senior Software Engineer. Проведи code review переданного кода.
Верни структурированный анализ:
- Критические ошибки (если есть)
- Потенциальные баги
- Проблемы производительности
- Предложения по улучшению архитектуры
- Соответствие best practices`,
    returnProposals: false,
    entityType: '',
    userPromptTemplate: 'Проведи code review:\n\n```\n{message}\n```',
    provider: '',
    model: '',
  },
];

const METHOD_TEMPLATES = [
  {
    key: 'ask',
    icon: '❓',
    label: 'Вопрос-ответ',
    description: 'Простой метод для Q&A',
    slug: 'ask',
    name: 'Ответ на вопрос',
    systemPrompt: 'Ты — полезный ИИ-ассистент. Отвечай на вопросы пользователя точно и лаконично.',
    access_level: 'authenticated',
  },
  {
    key: 'generate_description',
    icon: '✍️',
    label: 'Генерация описания',
    description: 'Создаёт описание для задачи или проекта',
    slug: 'generate-description',
    name: 'Генерация описания',
    systemPrompt: 'Ты — бизнес-аналитик. Создай чёткое, профессиональное описание на основе краткого заголовка или тезисов пользователя.',
    access_level: 'authenticated',
  },
  {
    key: 'admin_report',
    icon: '📊',
    label: 'Административный отчёт',
    description: 'Генерирует отчёт (только для администраторов)',
    slug: 'admin-report',
    name: 'Генерация отчёта',
    systemPrompt: 'Ты — аналитик данных. Создай структурированный аналитический отчёт на основе переданных данных. Используй таблицы и маркированные списки.',
    access_level: 'admin',
  },
];

// backward compat alias
const SCHEMA_TEMPLATES = {
  analysis: SCENARIO_TEMPLATES.find((t) => t.key === 'task_analysis'),
  chat: SCENARIO_TEMPLATES.find((t) => t.key === 'chat'),
  review: SCENARIO_TEMPLATES.find((t) => t.key === 'project_review'),
};

function slugify(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

const EMPTY_SCENARIO = {
  name: '',
  description: '',
  system_prompt: '',
  user_prompt_template: '',
  provider: '',
  model: '',
  parameters: { temperature: null, max_tokens: null, top_p: null },
  is_active: true,
};

const EMPTY_METHOD = {
  slug: '',
  name: '',
  description: '',
  system_prompt: '',
  user_prompt_template: '',
  provider: '',
  model: '',
  parameters: { temperature: null, max_tokens: null, top_p: null },
  is_active: true,
  access_level: 'authenticated',
};

// ─── Schema Flow Diagram ──────────────────────────────────────────────────────

function SchemaFlowNode({ icon, label, sublabel, color, style }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        ...style,
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 14,
          background: `${color}22`,
          border: `1.5px solid ${color}55`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 22,
        }}
      >
        {icon}
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, color, textAlign: 'center' }}>{label}</div>
      {sublabel && (
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textAlign: 'center', maxWidth: 80 }}>
          {sublabel}
        </div>
      )}
    </div>
  );
}

function Arrow({ label }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap' }}>{label}</div>
      <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 16, lineHeight: 1 }}>→</div>
    </div>
  );
}

function ScenarioFlowDiagram({ scenario, entityType }) {
  const et = ENTITY_TYPES.find((e) => e.value === entityType);
  const hasEntity = !!entityType;
  const hasProposals = scenario._returnProposals;

  return (
    <div
      style={{
        padding: '16px 20px',
        background: 'rgba(0,0,0,0.25)',
        borderRadius: 14,
        border: '1px solid rgba(255,255,255,0.07)',
        overflowX: 'auto',
      }}
    >
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 12, fontWeight: 600, letterSpacing: '0.05em' }}>
        СХЕМА ЗАПРОСА
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'nowrap', minWidth: 500 }}>
        <SchemaFlowNode icon="👤" label="Пользователь" sublabel="message" color="#60a5fa" />
        <Arrow label="отправляет" />
        <SchemaFlowNode icon="🎯" label="Сценарий" sublabel={scenario.name || '—'} color="#a78bfa" />
        {hasEntity && (
          <>
            <Arrow label="загружает" />
            <SchemaFlowNode icon={entityType === 'task' ? '✅' : entityType === 'project' ? '📁' : '📄'} label={et?.label || entityType} sublabel={`editable: ${et?.fields?.join(', ') || '—'}`} color="#34d399" />
          </>
        )}
        <Arrow label="→ AI" />
        <SchemaFlowNode
          icon={scenario.provider === 'openai' ? '🤖' : scenario.provider === 'deepseek' ? '🔵' : scenario.provider === 'anthropic' ? '🟠' : '🧠'}
          label={scenario.provider || 'провайдер'}
          sublabel={scenario.model || 'default model'}
          color="#f59e0b"
        />
        <Arrow label="отвечает" />
        {hasProposals ? (
          <SchemaFlowNode icon="📋" label="Предложения" sublabel="proposals[]" color="#f472b6" />
        ) : (
          <SchemaFlowNode icon="💬" label="Ответ" sublabel="text" color="#60a5fa" />
        )}
        {hasProposals && (
          <>
            <Arrow label="сохраняет" />
            <SchemaFlowNode icon="🗄️" label="ai_proposals" sublabel="apply / reject" color="#94a3b8" />
          </>
        )}
      </div>
    </div>
  );
}

// ─── Parameter Input ──────────────────────────────────────────────────────────

function ParamInput({ label, value, onChange, min, max, step = 0.1, placeholder }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>{label}</label>
      <input
        type="number"
        value={value ?? ''}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        style={{
          background: 'rgba(0,0,0,0.3)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 8,
          padding: '6px 10px',
          color: 'var(--color-text-primary)',
          fontSize: 13,
          width: '100%',
        }}
      />
    </div>
  );
}

// ─── Scenario Form ────────────────────────────────────────────────────────────

function ScenarioForm({ initial, onSave, onCancel, apiKeys = [] }) {
  const [form, setForm] = useState({
    ...EMPTY_SCENARIO,
    ...initial,
    parameters: { temperature: null, max_tokens: null, top_p: null, ...(initial?.parameters || {}) },
    _entityType: initial?._entityType || '',
    _returnProposals: initial?._returnProposals || false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('basic');

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setParam = (k, v) => setForm((f) => ({ ...f, parameters: { ...f.parameters, [k]: v } }));

  const applyTemplate = (tpl) => {
    if (!tpl) return;
    setForm((f) => ({
      ...f,
      name: f.name || tpl.name || f.name,
      system_prompt: tpl.systemPrompt,
      user_prompt_template: tpl.userPromptTemplate ?? f.user_prompt_template,
      provider: tpl.provider ?? f.provider,
      model: tpl.model ?? f.model,
      _returnProposals: tpl.returnProposals,
      _entityType: tpl.entityType,
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Укажите название'); return; }
    if (!form.system_prompt.trim()) { setError('Системный промпт обязателен'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description || null,
        system_prompt: form.system_prompt,
        user_prompt_template: form.user_prompt_template || null,
        provider: form.provider || null,
        model: form.model || null,
        parameters: {
          ...(form.parameters.temperature != null ? { temperature: form.parameters.temperature } : {}),
          ...(form.parameters.max_tokens != null ? { max_tokens: form.parameters.max_tokens } : {}),
          ...(form.parameters.top_p != null ? { top_p: form.parameters.top_p } : {}),
        },
        is_active: form.is_active,
      };
      await onSave(payload, form._entityType, form._returnProposals);
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    background: 'rgba(0,0,0,0.3)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: '8px 12px',
    color: 'var(--color-text-primary)',
    fontSize: 13,
    width: '100%',
    boxSizing: 'border-box',
  };

  const tabStyle = (active) => ({
    padding: '6px 14px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    background: active ? 'rgba(139,92,246,0.25)' : 'transparent',
    color: active ? '#a78bfa' : 'rgba(255,255,255,0.45)',
    border: active ? '1px solid rgba(139,92,246,0.4)' : '1px solid transparent',
    transition: 'all 0.15s',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6 }}>
        {['basic', 'prompt', 'schema', 'params'].map((t) => (
          <button key={t} style={tabStyle(activeTab === t)} onClick={() => setActiveTab(t)}>
            {{ basic: 'Основное', prompt: 'Промпты', schema: 'Схема', params: 'Параметры' }[t]}
          </button>
        ))}
      </div>

      {activeTab === 'basic' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600, display: 'block', marginBottom: 4 }}>НАЗВАНИЕ *</label>
            <input style={inputStyle} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Например: Анализ задачи" />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600, display: 'block', marginBottom: 4 }}>ОПИСАНИЕ</label>
            <input style={inputStyle} value={form.description || ''} onChange={(e) => set('description', e.target.value)} placeholder="Краткое описание (необязательно)" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600, display: 'block', marginBottom: 4 }}>ПРОВАЙДЕР</label>
              <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.provider || ''} onChange={(e) => set('provider', e.target.value)}>
                {PROVIDERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600, display: 'block', marginBottom: 4 }}>МОДЕЛЬ</label>
              <input style={inputStyle} value={form.model || ''} onChange={(e) => set('model', e.target.value)} placeholder="deepseek-chat / gpt-4o..." />
            </div>
          </div>
          {apiKeys.length > 0 && (
            <div>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600, display: 'block', marginBottom: 4 }}>API КЛЮЧ (из БД)</label>
              <select style={{ ...inputStyle, cursor: 'pointer' }} value={form._apiKeyId || ''} onChange={(e) => set('_apiKeyId', e.target.value ? Number(e.target.value) : null)}>
                <option value="">— Из настроек сервера —</option>
                {apiKeys.map((k) => <option key={k.id} value={k.id}>{k.label} ({k.provider})</option>)}
              </select>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => set('is_active', !form.is_active)}
              style={{
                width: 40, height: 22, borderRadius: 11,
                background: form.is_active ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.1)',
                border: `1.5px solid ${form.is_active ? 'rgba(52,211,153,0.5)' : 'rgba(255,255,255,0.15)'}`,
                cursor: 'pointer', position: 'relative', transition: 'all 0.2s',
              }}
            >
              <div style={{
                width: 14, height: 14, borderRadius: '50%', position: 'absolute', top: 2,
                left: form.is_active ? 22 : 2, transition: 'left 0.2s',
                background: form.is_active ? '#34d399' : 'rgba(255,255,255,0.3)',
              }} />
            </button>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{form.is_active ? 'Активен' : 'Отключён'}</span>
          </div>
        </div>
      )}

      {activeTab === 'prompt' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>СИСТЕМНЫЙ ПРОМПТ *</label>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {SCENARIO_TEMPLATES.map((t) => (
                  <button key={t.key} onClick={() => applyTemplate(t)} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', color: '#a78bfa', cursor: 'pointer' }}>
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              style={{ ...inputStyle, minHeight: 200, resize: 'vertical', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.6 }}
              value={form.system_prompt}
              onChange={(e) => set('system_prompt', e.target.value)}
              placeholder="Ты — полезный ИИ-ассистент..."
            />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600, display: 'block', marginBottom: 4 }}>
              ШАБЛОН ПОЛЬЗОВАТЕЛЬСКОГО ЗАПРОСА
              <span style={{ fontWeight: 400, marginLeft: 6 }}>— используй {'{variable}'} для подстановки</span>
            </label>
            <textarea
              style={{ ...inputStyle, minHeight: 80, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
              value={form.user_prompt_template || ''}
              onChange={(e) => set('user_prompt_template', e.target.value)}
              placeholder="Проанализируй: {message}"
            />
          </div>
        </div>
      )}

      {activeTab === 'schema' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600, display: 'block', marginBottom: 4 }}>ТИП СУЩНОСТИ</label>
              <select style={{ ...inputStyle, cursor: 'pointer' }} value={form._entityType || ''} onChange={(e) => set('_entityType', e.target.value)}>
                {ENTITY_TYPES.map((et) => <option key={et.value} value={et.value}>{et.label}</option>)}
              </select>
              {form._entityType && (
                <div style={{ marginTop: 6, fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                  Редактируемые поля: {ENTITY_TYPES.find((e) => e.value === form._entityType)?.fields?.join(', ') || '—'}
                </div>
              )}
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600, display: 'block', marginBottom: 4 }}>ТИП ОТВЕТА</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                {[
                  { v: false, label: 'Текстовый ответ', icon: '💬' },
                  { v: true, label: 'JSON с предложениями (proposals)', icon: '📋' },
                ].map((opt) => (
                  <label key={String(opt.v)} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                    <input type="radio" name="returnProposals" checked={form._returnProposals === opt.v} onChange={() => set('_returnProposals', opt.v)} style={{ accentColor: '#a78bfa' }} />
                    <span style={{ color: 'rgba(255,255,255,0.8)' }}>{opt.icon} {opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <ScenarioFlowDiagram scenario={form} entityType={form._entityType} />
          {form._returnProposals && (
            <div style={{ padding: '12px 14px', background: 'rgba(244,114,182,0.07)', borderRadius: 10, border: '1px solid rgba(244,114,182,0.2)' }}>
              <div style={{ fontSize: 12, color: '#f472b6', fontWeight: 600, marginBottom: 4 }}>📋 Режим Proposals</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
                Модель должна вернуть JSON в формате: <code style={{ background: 'rgba(0,0,0,0.3)', padding: '1px 5px', borderRadius: 4 }}>{"{ summary, proposals[] }"}</code>.<br />
                Proposals сохраняются в БД. Пользователи могут применить или отклонить каждое предложение через кнопки в чате.
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'params' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: -4 }}>
            Оставьте пустым — будут применены дефолтные настройки провайдера
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <ParamInput label="Temperature" value={form.parameters.temperature} onChange={(v) => setParam('temperature', v)} min={0} max={2} step={0.1} placeholder="0.7" />
            <ParamInput label="Max Tokens" value={form.parameters.max_tokens} onChange={(v) => setParam('max_tokens', v)} min={1} max={32000} step={1} placeholder="2048" />
            <ParamInput label="Top P" value={form.parameters.top_p} onChange={(v) => setParam('top_p', v)} min={0} max={1} step={0.05} placeholder="0.95" />
          </div>
        </div>
      )}

      {error && (
        <div style={{ color: '#f87171', fontSize: 12, padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: 8 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
        <button onClick={onCancel} style={{ padding: '8px 18px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)', fontSize: 13, cursor: 'pointer' }}>
          Отмена
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ padding: '8px 20px', borderRadius: 8, background: saving ? 'rgba(139,92,246,0.2)' : 'rgba(139,92,246,0.3)', border: '1px solid rgba(139,92,246,0.5)', color: '#c4b5fd', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}
        >
          {saving ? 'Сохранение…' : 'Сохранить'}
        </button>
      </div>
    </div>
  );
}

// ─── Method Form ──────────────────────────────────────────────────────────────

function MethodForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState({
    ...EMPTY_METHOD,
    ...initial,
    parameters: { temperature: null, max_tokens: null, top_p: null, ...(initial?.parameters || {}) },
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setParam = (k, v) => setForm((f) => ({ ...f, parameters: { ...f.parameters, [k]: v } }));

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Укажите название'); return; }
    if (!form.slug.trim()) { setError('Укажите slug'); return; }
    if (!form.system_prompt.trim()) { setError('Системный промпт обязателен'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = {
        slug: form.slug.trim(),
        name: form.name.trim(),
        description: form.description || null,
        system_prompt: form.system_prompt,
        user_prompt_template: form.user_prompt_template || null,
        provider: form.provider || null,
        model: form.model || null,
        parameters: {
          ...(form.parameters.temperature != null ? { temperature: form.parameters.temperature } : {}),
          ...(form.parameters.max_tokens != null ? { max_tokens: form.parameters.max_tokens } : {}),
          ...(form.parameters.top_p != null ? { top_p: form.parameters.top_p } : {}),
        },
        is_active: form.is_active,
        access_level: form.access_level,
      };
      await onSave(payload);
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    background: 'rgba(0,0,0,0.3)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: '8px 12px',
    color: 'var(--color-text-primary)',
    fontSize: 13,
    width: '100%',
    boxSizing: 'border-box',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600, display: 'block', marginBottom: 4 }}>НАЗВАНИЕ *</label>
          <input style={inputStyle} value={form.name} onChange={(e) => { set('name', e.target.value); if (!form.id) set('slug', slugify(e.target.value)); }} placeholder="Имя метода" />
        </div>
        <div>
          <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600, display: 'block', marginBottom: 4 }}>SLUG *</label>
          <input style={inputStyle} value={form.slug} onChange={(e) => set('slug', slugify(e.target.value))} placeholder="my-method" />
        </div>
      </div>
      <div>
        <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600, display: 'block', marginBottom: 4 }}>СИСТЕМНЫЙ ПРОМПТ *</label>
        <textarea style={{ ...inputStyle, minHeight: 140, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }} value={form.system_prompt} onChange={(e) => set('system_prompt', e.target.value)} placeholder="Ты — полезный ИИ-ассистент..." />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <div>
          <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600, display: 'block', marginBottom: 4 }}>ПРОВАЙДЕР</label>
          <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.provider || ''} onChange={(e) => set('provider', e.target.value)}>
            {PROVIDERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600, display: 'block', marginBottom: 4 }}>МОДЕЛЬ</label>
          <input style={inputStyle} value={form.model || ''} onChange={(e) => set('model', e.target.value)} placeholder="deepseek-chat..." />
        </div>
        <div>
          <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600, display: 'block', marginBottom: 4 }}>ДОСТУП</label>
          <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.access_level} onChange={(e) => set('access_level', e.target.value)}>
            <option value="authenticated">Все пользователи</option>
            <option value="admin">Только администраторы</option>
          </select>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <ParamInput label="Temperature" value={form.parameters.temperature} onChange={(v) => setParam('temperature', v)} min={0} max={2} step={0.1} placeholder="0.7" />
        <ParamInput label="Max Tokens" value={form.parameters.max_tokens} onChange={(v) => setParam('max_tokens', v)} min={1} max={32000} step={1} placeholder="2048" />
        <ParamInput label="Top P" value={form.parameters.top_p} onChange={(v) => setParam('top_p', v)} min={0} max={1} step={0.05} placeholder="0.95" />
      </div>
      {error && <div style={{ color: '#f87171', fontSize: 12, padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: 8 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={{ padding: '8px 18px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)', fontSize: 13, cursor: 'pointer' }}>Отмена</button>
        <button onClick={handleSave} disabled={saving} style={{ padding: '8px 20px', borderRadius: 8, background: 'rgba(99,102,241,0.3)', border: '1px solid rgba(99,102,241,0.5)', color: '#a5b4fc', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
          {saving ? 'Сохранение…' : 'Сохранить'}
        </button>
      </div>
    </div>
  );
}

// ─── API Keys Panel ───────────────────────────────────────────────────────────

function ApiKeysPanel({ keys, onReload }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ provider: 'openai', label: '', api_key: '', base_url: '' });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState('');

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleCreate = async () => {
    if (!form.label.trim() || !form.api_key.trim()) { setError('Заполните название и ключ'); return; }
    setSaving(true); setError('');
    try {
      await adminService.createAiApiKey({ ...form, base_url: form.base_url || null });
      setShowForm(false);
      setForm({ provider: 'openai', label: '', api_key: '', base_url: '' });
      onReload();
    } catch (e) {
      setError(e?.response?.data?.detail || e.message);
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    try { await adminService.deleteAiApiKey(id); onReload(); } catch {}
    setDeletingId(null);
  };

  const handleToggle = async (key) => {
    try { await adminService.updateAiApiKey(key.id, { is_active: !key.is_active }); onReload(); } catch {}
  };

  const inputStyle = { background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '7px 11px', color: 'var(--color-text-primary)', fontSize: 12, width: '100%', boxSizing: 'border-box' };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>API КЛЮЧИ ПРОВАЙДЕРОВ</div>
        <button onClick={() => setShowForm(!showForm)} style={{ fontSize: 11, padding: '4px 12px', borderRadius: 7, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc', cursor: 'pointer' }}>
          + Добавить ключ
        </button>
      </div>

      {showForm && (
        <div style={{ padding: '12px 14px', background: 'rgba(0,0,0,0.2)', borderRadius: 10, border: '1px solid rgba(99,102,241,0.25)', marginBottom: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div>
              <label style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 3 }}>ПРОВАЙДЕР</label>
              <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.provider} onChange={(e) => set('provider', e.target.value)}>
                {PROVIDERS.filter((p) => p.value).map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 3 }}>НАЗВАНИЕ</label>
              <input style={inputStyle} value={form.label} onChange={(e) => set('label', e.target.value)} placeholder="Мой OpenAI ключ" />
            </div>
          </div>
          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 3 }}>API KEY *</label>
            <input style={inputStyle} type="password" value={form.api_key} onChange={(e) => set('api_key', e.target.value)} placeholder="sk-..." />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 3 }}>BASE URL (опционально)</label>
            <input style={inputStyle} value={form.base_url} onChange={(e) => set('base_url', e.target.value)} placeholder="https://api.openai.com/v1" />
          </div>
          {error && <div style={{ color: '#f87171', fontSize: 11, marginBottom: 8 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button onClick={() => setShowForm(false)} style={{ fontSize: 11, padding: '5px 12px', borderRadius: 7, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}>Отмена</button>
            <button onClick={handleCreate} disabled={saving} style={{ fontSize: 11, padding: '5px 12px', borderRadius: 7, background: 'rgba(99,102,241,0.25)', border: '1px solid rgba(99,102,241,0.4)', color: '#a5b4fc', fontWeight: 600, cursor: 'pointer' }}>{saving ? '…' : 'Сохранить'}</button>
          </div>
        </div>
      )}

      {keys.length === 0 ? (
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '16px 0' }}>Ключей нет</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {keys.map((k) => (
            <div key={k.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: 9, border: '1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: k.is_active ? '#34d399' : 'rgba(255,255,255,0.2)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>{k.label}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>{k.provider}{k.base_url ? ` · ${k.base_url}` : ''}</div>
              </div>
              <button onClick={() => handleToggle(k)} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 5, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>
                {k.is_active ? 'Откл.' : 'Вкл.'}
              </button>
              <button onClick={() => handleDelete(k.id)} disabled={deletingId === k.id} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 5, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', cursor: 'pointer' }}>
                {deletingId === k.id ? '…' : 'Удалить'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export default function AdminAiScenariosPanel() {
  const [tab, setTab] = useState('scenarios');
  const [scenarios, setScenarios] = useState([]);
  const [methods, setMethods] = useState([]);
  const [apiKeys, setApiKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [editScenario, setEditScenario] = useState(null); // null=hidden, {}=new, obj=edit
  const [editMethod, setEditMethod] = useState(null);
  const [deletingScenario, setDeletingScenario] = useState(null);
  const [deletingMethod, setDeletingMethod] = useState(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [sc, me, ak] = await Promise.allSettled([
        adminService.listAiScenarios(),
        adminService.listAiMethods(),
        adminService.listAiApiKeys(),
      ]);
      const toArray = (v) => (Array.isArray(v) ? v : Array.isArray(v?.items) ? v.items : []);
      setScenarios(sc.status === 'fulfilled' ? toArray(sc.value) : []);
      setMethods(me.status === 'fulfilled' ? toArray(me.value) : []);
      setApiKeys(ak.status === 'fulfilled' ? toArray(ak.value) : []);
      if (sc.status === 'rejected' && me.status === 'rejected') setError('Не удалось загрузить данные AI сервиса');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Scenario actions
  const handleSaveScenario = async (payload, _entityType, _returnProposals) => {
    if (editScenario?.id) {
      await adminService.updateAiScenario(editScenario.id, payload);
    } else {
      await adminService.createAiScenario(payload);
    }
    setEditScenario(null);
    loadAll();
  };

  const handleDeleteScenario = async (id) => {
    setDeletingScenario(id);
    try { await adminService.deleteAiScenario(id); loadAll(); } catch {}
    setDeletingScenario(null);
  };

  // Method actions
  const handleSaveMethod = async (payload) => {
    if (editMethod?.id) {
      await adminService.updateAiMethod(editMethod.id, payload);
    } else {
      await adminService.createAiMethod(payload);
    }
    setEditMethod(null);
    loadAll();
  };

  const handleDeleteMethod = async (id) => {
    setDeletingMethod(id);
    try { await adminService.deleteAiMethod(id); loadAll(); } catch {}
    setDeletingMethod(null);
  };

  // ─── Styles ───
  const panelStyle = {
    borderRadius: 18,
    padding: 24,
    border: '1px solid rgba(99,102,241,0.2)',
    background: 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(59,130,246,0.04) 100%)',
    marginBottom: 24,
  };

  const tabBtnStyle = (active) => ({
    padding: '7px 16px',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    background: active ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.04)',
    color: active ? '#a5b4fc' : 'rgba(255,255,255,0.45)',
    border: active ? '1px solid rgba(99,102,241,0.4)' : '1px solid rgba(255,255,255,0.07)',
    transition: 'all 0.15s',
  });

  const cardStyle = {
    padding: '12px 14px',
    background: 'rgba(0,0,0,0.2)',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.07)',
  };

  const badgeStyle = (color) => ({
    fontSize: 10,
    padding: '2px 7px',
    borderRadius: 5,
    background: `${color}22`,
    border: `1px solid ${color}44`,
    color,
    fontWeight: 600,
    whiteSpace: 'nowrap',
  });

  return (
    <div style={panelStyle}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 22 }}>🧠</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)' }}>AI Сценарии и методы</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>Управление схемами запросов, промптами и API ключами</div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
            {scenarios.length} сценариев · {methods.length} методов
          </div>
          <button onClick={loadAll} style={{ fontSize: 18, background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.35)', lineHeight: 1 }} title="Обновить">↻</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        <button style={tabBtnStyle(tab === 'scenarios')} onClick={() => setTab('scenarios')}>Сценарии</button>
        <button style={tabBtnStyle(tab === 'methods')} onClick={() => setTab('methods')}>Методы API</button>
        <button style={tabBtnStyle(tab === 'keys')} onClick={() => setTab('keys')}>API Ключи</button>
      </div>

      {error && (
        <div style={{ fontSize: 12, color: '#f87171', padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: 8, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '30px 0', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Загрузка…</div>
      ) : (
        <>
          {/* ── Scenarios ── */}
          {tab === 'scenarios' && (
            <div>
              {editScenario !== null ? (
                <div style={cardStyle}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.7)', marginBottom: 14 }}>
                    {editScenario.id ? '✏️ Редактировать сценарий' : '✨ Новый сценарий'}
                  </div>
                  <ScenarioForm
                    initial={editScenario}
                    apiKeys={apiKeys}
                    onSave={handleSaveScenario}
                    onCancel={() => setEditScenario(null)}
                  />
                </div>
              ) : (
                <>
                  {/* Template gallery */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600, marginBottom: 8, letterSpacing: '0.05em' }}>ГОТОВЫЕ ШАБЛОНЫ</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 7 }}>
                      {SCENARIO_TEMPLATES.map((t) => (
                        <button
                          key={t.key}
                          onClick={() => setEditScenario({ name: t.name, system_prompt: t.systemPrompt, user_prompt_template: t.userPromptTemplate, provider: t.provider, model: t.model, is_active: true, _returnProposals: t.returnProposals, _entityType: t.entityType })}
                          style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 10, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', cursor: 'pointer', transition: 'all 0.15s' }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(99,102,241,0.15)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(99,102,241,0.08)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.2)'; }}
                        >
                          <div style={{ fontSize: 18, marginBottom: 4 }}>{t.icon}</div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#a5b4fc', marginBottom: 2 }}>{t.label}</div>
                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', lineHeight: 1.4 }}>{t.description}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => setEditScenario({})}
                    style={{ marginBottom: 12, width: '100%', padding: '10px', borderRadius: 10, background: 'rgba(99,102,241,0.1)', border: '1.5px dashed rgba(99,102,241,0.3)', color: '#a5b4fc', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}
                  >
                    + Создать пустой сценарий
                  </button>

                  {scenarios.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px 0', color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>
                      Сценариев пока нет
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {scenarios.map((s) => (
                        <div key={s.id} style={cardStyle}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>{s.name}</span>
                                <span style={badgeStyle(s.is_active ? '#34d399' : '#94a3b8')}>{s.is_active ? 'активен' : 'выкл'}</span>
                                {s.provider && <span style={badgeStyle('#60a5fa')}>{s.provider}</span>}
                                {s.model && <span style={badgeStyle('#a78bfa')}>{s.model}</span>}
                              </div>
                              {s.description && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>{s.description}</div>}
                              {/* Mini flow preview */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>👤 → Сценарий</span>
                                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>→</span>
                                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>🧠 {s.provider || 'AI'}</span>
                                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>→</span>
                                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>💬 ответ</span>
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                              <button onClick={() => setEditScenario(s)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 7, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc', cursor: 'pointer' }}>✏️</button>
                              <button onClick={() => handleDeleteScenario(s.id)} disabled={deletingScenario === s.id} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 7, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', cursor: 'pointer' }}>
                                {deletingScenario === s.id ? '…' : '🗑️'}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Methods ── */}
          {tab === 'methods' && (
            <div>
              {editMethod !== null ? (
                <div style={cardStyle}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.7)', marginBottom: 14 }}>
                    {editMethod.id ? '✏️ Редактировать метод' : '✨ Новый метод'}
                  </div>
                  <MethodForm initial={editMethod} onSave={handleSaveMethod} onCancel={() => setEditMethod(null)} />
                </div>
              ) : (
                <>
                  {/* Method template gallery */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600, marginBottom: 8, letterSpacing: '0.05em' }}>ГОТОВЫЕ ШАБЛОНЫ МЕТОДОВ</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 7 }}>
                      {METHOD_TEMPLATES.map((t) => (
                        <button
                          key={t.key}
                          onClick={() => setEditMethod({ slug: t.slug, name: t.name, system_prompt: t.systemPrompt, access_level: t.access_level, is_active: true })}
                          style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 10, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', cursor: 'pointer', transition: 'all 0.15s' }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(59,130,246,0.15)'; e.currentTarget.style.borderColor = 'rgba(59,130,246,0.4)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(59,130,246,0.08)'; e.currentTarget.style.borderColor = 'rgba(59,130,246,0.2)'; }}
                        >
                          <div style={{ fontSize: 18, marginBottom: 4 }}>{t.icon}</div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#60a5fa', marginBottom: 2 }}>{t.label}</div>
                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', lineHeight: 1.4 }}>{t.description}</div>
                          {t.access_level === 'admin' && <div style={{ marginTop: 4, fontSize: 9, color: '#f59e0b', fontWeight: 700 }}>🔒 Только admin</div>}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => setEditMethod({})}
                    style={{ marginBottom: 12, width: '100%', padding: '10px', borderRadius: 10, background: 'rgba(59,130,246,0.1)', border: '1.5px dashed rgba(59,130,246,0.3)', color: '#60a5fa', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}
                  >
                    + Создать пустой метод API
                  </button>
                  {methods.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px 0', color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>Методов пока нет</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {methods.map((m) => (
                        <div key={m.id} style={cardStyle}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>{m.name}</span>
                                <span style={badgeStyle('#94a3b8')}>{m.slug}</span>
                                <span style={badgeStyle(m.is_active ? '#34d399' : '#94a3b8')}>{m.is_active ? 'активен' : 'выкл'}</span>
                                <span style={badgeStyle(m.access_level === 'admin' ? '#f59e0b' : '#60a5fa')}>{m.access_level === 'admin' ? '🔒 admin' : '👥 all'}</span>
                              </div>
                              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                                {m.route_path} · {m.provider || 'default provider'}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                              <button onClick={() => setEditMethod(m)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 7, background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: '#60a5fa', cursor: 'pointer' }}>✏️</button>
                              <button onClick={() => handleDeleteMethod(m.id)} disabled={deletingMethod === m.id} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 7, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', cursor: 'pointer' }}>
                                {deletingMethod === m.id ? '…' : '🗑️'}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── API Keys ── */}
          {tab === 'keys' && (
            <ApiKeysPanel keys={apiKeys} onReload={loadAll} />
          )}
        </>
      )}
    </div>
  );
}
