import React, { useCallback, useEffect, useRef, useState } from 'react';
import { adminService } from '../../../services/adminService';
import { employeeService, TEAM_ROLES } from '../../../services/employeeService';
import { teamService } from '../../../services/teamService';
import Avatar from '../../../components/Avatar';
import { AdminIcon } from './AdminIcons';

function extractErrorMessage(error, fallback = 'Ошибка') {
  const detail = error?.response?.data?.detail;
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const first = detail[0];
    if (typeof first === 'string') return first;
    if (first && typeof first === 'object') {
      const msg = first.msg || first.message;
      if (typeof msg === 'string' && msg.trim()) return msg;
    }
    return fallback;
  }
  if (detail && typeof detail === 'object') {
    const msg = detail.msg || detail.message;
    if (typeof msg === 'string' && msg.trim()) return msg;
  }
  if (typeof error?.message === 'string' && error.message.trim()) return error.message;
  return fallback;
}

// ─── Trigger editor ─────────────────────────────────────────────────────────

const TRIGGER_ENTITY_TYPES = [
  { value: 'none', label: '— Без сущности —', icon: '💬' },
  { value: 'task', label: 'Задача прикреплена', icon: '✅' },
  { value: 'project', label: 'Проект прикреплён', icon: '📁' },
  { value: 'document', label: 'Документ прикреплён', icon: '📄' },
  { value: 'file', label: 'Файл прикреплён', icon: '📎' },
];

function TriggerEditor({ triggers, onChange, scenarios }) {
  const addTrigger = () => {
    onChange([...triggers, { id: Date.now(), keywords: '', scenario_id: '', entity_type: 'none', return_proposals: false }]);
  };

  const removeTrigger = (id) => onChange(triggers.filter((t) => t.id !== id));

  const updateTrigger = (id, patch) =>
    onChange(triggers.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  const inputStyle = {
    background: 'rgba(0,0,0,0.3)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 7,
    padding: '6px 10px',
    color: 'var(--color-text-primary)',
    fontSize: 12,
    width: '100%',
    boxSizing: 'border-box',
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.75)' }}>
          🎯 Триггеры сценариев
        </div>
        <button
          onClick={addTrigger}
          style={{ fontSize: 11, padding: '4px 12px', borderRadius: 7, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc', cursor: 'pointer' }}
        >
          + Добавить триггер
        </button>
      </div>

      {triggers.length === 0 && (
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', textAlign: 'center', padding: '12px 0' }}>
          Нет триггеров — агент отвечает обычным чатом (только системный промпт агента).
          Добавьте триггер со сценарием: без ключевых слов = для всех сообщений.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {triggers.map((t, idx) => {
          const entityOpt = TRIGGER_ENTITY_TYPES.find((e) => e.value === (t.entity_type || 'none')) || TRIGGER_ENTITY_TYPES[0];
          return (
            <div key={t.id} style={{ padding: '12px 14px', background: 'rgba(0,0,0,0.2)', borderRadius: 10, border: '1px solid rgba(99,102,241,0.15)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>ТРИГГЕР {idx + 1}</div>
                <div style={{ flex: 1 }} />
                <button onClick={() => removeTrigger(t.id)} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 5, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', cursor: 'pointer' }}>✕</button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 3 }}>СЦЕНАРИЙ</label>
                  <select style={{ ...inputStyle, cursor: 'pointer' }} value={t.scenario_id || ''} onChange={(e) => updateTrigger(t.id, { scenario_id: e.target.value })}>
                    <option value="">— Выберите сценарий —</option>
                    {scenarios.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 3 }}>ТРИГЕР ПО СУЩНОСТИ</label>
                  <select style={{ ...inputStyle, cursor: 'pointer' }} value={t.entity_type || 'none'} onChange={(e) => updateTrigger(t.id, { entity_type: e.target.value })}>
                    {TRIGGER_ENTITY_TYPES.map((opt) => <option key={opt.value} value={opt.value}>{opt.icon} {opt.label}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 3 }}>
                  КЛЮЧЕВЫЕ СЛОВА (через запятую, опционально)
                </label>
                <input
                  style={inputStyle}
                  value={t.keywords || ''}
                  onChange={(e) => updateTrigger(t.id, { keywords: e.target.value })}
                  placeholder="анализ, задача, помоги с..."
                />
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 3 }}>
                  Если заполнено — сценарий запускается только когда сообщение содержит одно из слов
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={() => updateTrigger(t.id, { return_proposals: !t.return_proposals })}
                  style={{
                    width: 34, height: 18, borderRadius: 9,
                    background: t.return_proposals ? 'rgba(244,114,182,0.3)' : 'rgba(255,255,255,0.08)',
                    border: `1.5px solid ${t.return_proposals ? 'rgba(244,114,182,0.5)' : 'rgba(255,255,255,0.12)'}`,
                    cursor: 'pointer', position: 'relative', flexShrink: 0,
                  }}
                >
                  <div style={{ width: 12, height: 12, borderRadius: '50%', position: 'absolute', top: 1, left: t.return_proposals ? 17 : 1, transition: 'left 0.15s', background: t.return_proposals ? '#f472b6' : 'rgba(255,255,255,0.3)' }} />
                </button>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
                  {t.return_proposals ? '📋 Возвращать proposals (JSON)' : '💬 Текстовый ответ'}
                </span>
              </div>

              {t.scenario_id && (
                <div style={{ marginTop: 10, padding: '8px 10px', background: 'rgba(99,102,241,0.07)', borderRadius: 7, border: '1px solid rgba(99,102,241,0.15)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
                    <span>👤 сообщение</span>
                    {t.keywords && <><span>→</span><span style={{ color: '#a78bfa' }}>🔑 "{t.keywords.split(',')[0].trim()}…"</span></>}
                    {t.entity_type && t.entity_type !== 'none' && <><span>→</span><span style={{ color: '#34d399' }}>{entityOpt.icon} {entityOpt.label}</span></>}
                    <span>→</span>
                    <span style={{ color: '#a5b4fc' }}>🎯 {scenarios.find((s) => String(s.id) === String(t.scenario_id))?.name || 'сценарий'}</span>
                    <span>→</span>
                    <span style={{ color: t.return_proposals ? '#f472b6' : '#60a5fa' }}>{t.return_proposals ? '📋 proposals' : '💬 ответ'}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const POSITION_OPTIONS = TEAM_ROLES.filter((r) => r !== 'Guest');

const DEFAULT_ACCESS = { mode: 'all', user_ids: [], team_ids: [], team_roles: [] };

function normalizeAccess(raw) {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_ACCESS };
  return {
    mode: raw.mode === 'restricted' ? 'restricted' : 'all',
    user_ids: Array.isArray(raw.user_ids) ? raw.user_ids.map(Number).filter((id) => id > 0) : [],
    team_ids: Array.isArray(raw.team_ids) ? raw.team_ids.map(Number).filter((id) => id > 0) : [],
    team_roles: Array.isArray(raw.team_roles) ? raw.team_roles.filter(Boolean) : [],
  };
}

function toggleId(list, id) {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

function SearchableChecklist({ items, selectedIds, onToggle, placeholder, disabled }) {
  const [query, setQuery] = useState('');
  const selected = new Set(selectedIds);
  const filtered = query.trim()
    ? items.filter((i) => i.label.toLowerCase().includes(query.trim().toLowerCase()))
    : items;

  return (
    <div>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full px-2.5 py-1.5 rounded-lg text-sm mb-2"
        style={{
          background: 'rgba(0,0,0,0.3)',
          border: '1px solid rgba(255,255,255,0.08)',
          color: 'var(--color-text-primary)',
        }}
      />
      <div
        className="rounded-lg overflow-y-auto"
        style={{
          maxHeight: 160,
          background: 'rgba(0,0,0,0.2)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {filtered.length === 0 ? (
          <div className="px-3 py-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Ничего не найдено
          </div>
        ) : (
          filtered.map((item) => (
            <label
              key={item.id}
              className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-white/5"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <input
                type="checkbox"
                checked={selected.has(item.id)}
                disabled={disabled}
                onChange={() => onToggle(item.id)}
              />
              {item.label}
            </label>
          ))
        )}
      </div>
    </div>
  );
}

export default function AdminAiAgentPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(null);

  const [enabled, setEnabled] = useState(false);
  const [name, setName] = useState('AI Ассистент');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [avatarPath, setAvatarPath] = useState(null);
  const [access, setAccess] = useState(DEFAULT_ACCESS);

  const [employees, setEmployees] = useState([]);
  const [teams, setTeams] = useState([]);
  const [scenarios, setScenarios] = useState([]);
  const [triggers, setTriggers] = useState([]);
  const [apiKeys, setApiKeys] = useState([]);
  const [selectedApiKeyId, setSelectedApiKeyId] = useState(null);

  const avatarInputRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [cfg, empList, teamList, scList, keyList] = await Promise.all([
        adminService.getAiAgentConfig().catch(() => null),
        employeeService.getEmployees().catch(() => []),
        teamService.getTeams().catch(() => []),
        adminService.listAiScenarios().catch(() => []),
        adminService.listAiApiKeys().catch(() => []),
      ]);
      const localCfgRaw = localStorage.getItem('ai_agent_config');
      const localCfg = localCfgRaw ? JSON.parse(localCfgRaw) : null;
      const effective = cfg || localCfg;
      if (effective) {
        setEnabled(Boolean(effective.enabled));
        setName(effective.name || 'AI Ассистент');
        setSystemPrompt(effective.system_prompt || '');
        setAvatarPath(effective.avatar_path || null);
        setAccess(normalizeAccess(effective.access));
      }
      const localAvatar = localStorage.getItem('ai_agent_avatar_preview');
      if (localAvatar && !effective?.avatar_path) setAvatarPreview(localAvatar);
      setEmployees(Array.isArray(empList) ? empList : []);
      const tList = Array.isArray(teamList) ? teamList : (Array.isArray(teamList?.items) ? teamList.items : []);
      setTeams(tList);
      const scArr = Array.isArray(scList) ? scList : (Array.isArray(scList?.items) ? scList.items : []);
      setScenarios(scArr);
      const keyArr = Array.isArray(keyList) ? keyList : (Array.isArray(keyList?.items) ? keyList.items : []);
      setApiKeys(keyArr);
      // Load saved triggers and api_key_id from config or localStorage
      const savedTriggers = effective?.triggers || JSON.parse(localStorage.getItem('ai_agent_triggers') || '[]');
      setTriggers(savedTriggers);
      setSelectedApiKeyId(effective?.api_key_id || null);
    } catch {
      // эндпоинт ещё не реализован — работаем с дефолтами
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    setSaving(true);
    setError('');
    setOk('');
    try {
      await adminService.saveAiAgentConfig({ enabled, name, system_prompt: systemPrompt, access, triggers, api_key_id: selectedApiKeyId });
      localStorage.setItem('ai_agent_triggers', JSON.stringify(triggers));
      setOk('Настройки AI агента сохранены');
    } catch (e) {
      const status = e?.response?.status;
      if (status === 404 || status === 405) {
        // Эндпоинт ещё не реализован на бэкенде — сохраняем в localStorage как временное решение
        localStorage.setItem('ai_agent_config', JSON.stringify({ enabled, name, system_prompt: systemPrompt, access, triggers, api_key_id: selectedApiKeyId }));
        localStorage.setItem('ai_agent_triggers', JSON.stringify(triggers));
        setOk('Настройки сохранены локально (бэкенд эндпоинт в разработке)');
      } else {
        setError(extractErrorMessage(e, 'Ошибка сохранения'));
      }
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const localUrl = URL.createObjectURL(file);
    setAvatarPreview(localUrl);
    setAvatarUploading(true);
    setError('');
    try {
      const result = await adminService.uploadAiAgentAvatar(file);
      setAvatarPath(result.avatar_path || null);
      setOk('Аватар загружен');
    } catch (e) {
      const status = e?.response?.status;
      if (status === 404 || status === 405) {
        // Превью уже установлено — сохраняем как data URL локально
        const reader = new FileReader();
        reader.onload = (ev) => {
          localStorage.setItem('ai_agent_avatar_preview', ev.target.result);
          setOk('Аватар выбран локально (загрузка на сервер в разработке)');
        };
        reader.readAsDataURL(file);
      } else {
        setError(extractErrorMessage(e, 'Ошибка загрузки аватара'));
        setAvatarPreview(null);
      }
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleDeleteAvatar = async () => {
    setError('');
    setOk('');
    try {
      await adminService.deleteAiAgentAvatar();
      setAvatarPath(null);
      setAvatarPreview(null);
      localStorage.removeItem('ai_agent_avatar_preview');
      setOk('Аватар удалён');
    } catch (e) {
      const status = e?.response?.status;
      if (status === 404 || status === 405) {
        setAvatarPath(null);
        setAvatarPreview(null);
        localStorage.removeItem('ai_agent_avatar_preview');
        setOk('Аватар удалён локально');
      } else {
        setError('Не удалось удалить аватар');
      }
    }
  };

  const patchAccess = (patch) => setAccess((prev) => ({ ...prev, ...patch }));

  const employeeItems = employees
    .filter((e) => e.team_role !== 'Guest')
    .map((e) => ({
      id: e.id,
      label: [e.name, e.email || e.login].filter(Boolean).join(' — ') || `ID ${e.id}`,
    }));

  const teamItems = teams.map((t) => ({ id: t.id, label: t.name || `Команда ${t.id}` }));

  const currentAvatarUrl = avatarPreview || avatarPath;
  const restricted = access.mode === 'restricted';

  if (loading) {
    return (
      <div
        className="rounded-2xl p-6 border animate-slideInLeft"
        style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center gap-2" style={{ color: 'var(--color-text-secondary)' }}>
          <div className="w-4 h-4 rounded-full border-2 border-violet-400/40 border-t-violet-400 animate-spin" />
          <span className="text-sm">Загрузка AI агента…</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl p-6 border animate-slideInLeft"
      style={{
        background: 'linear-gradient(135deg, rgba(139,92,246,0.1) 0%, rgba(59,130,246,0.05) 100%)',
        borderColor: 'rgba(139,92,246,0.25)',
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(139,92,246,0.3)]">
            <svg className="w-5 h-5 text-violet-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              AI Агент в чатах
            </h3>
            <p className="text-sm mt-1 leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
              Встроенный ИИ-помощник доступен сотрудникам в разделе чатов. Настройте имя, аватар и права доступа.
            </p>
          </div>
        </div>
        <label className="flex items-center gap-3 cursor-pointer shrink-0">
          <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {enabled ? 'Включён' : 'Выключен'}
          </span>
          <div className="relative">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="sr-only" />
            <div
              className="w-10 h-5 rounded-full transition-all"
              style={{ background: enabled ? 'rgba(139,92,246,0.8)' : 'rgba(255,255,255,0.1)' }}
            />
            <div
              className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-all"
              style={{ transform: enabled ? 'translateX(20px)' : 'translateX(0)' }}
            />
          </div>
        </label>
      </div>

      <div className="space-y-5">
        {/* Аватар + имя */}
        <div className="flex items-start gap-5">
          {/* Аватар */}
          <div className="shrink-0">
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center relative overflow-hidden"
              style={{ background: 'rgba(139,92,246,0.15)', border: '2px dashed rgba(139,92,246,0.35)' }}
            >
              {currentAvatarUrl ? (
                <Avatar
                  src={currentAvatarUrl}
                  name="AI"
                  preset="avatar_lg"
                  className="w-full h-full"
                  rounded="lg"
                  alt="AI агент"
                />
              ) : (
                <svg className="w-8 h-8" style={{ color: 'rgba(139,92,246,0.5)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
                </svg>
              )}
              {avatarUploading && (
                <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
                  <div className="w-6 h-6 rounded-full border-2 border-violet-400/40 border-t-violet-400 animate-spin" />
                </div>
              )}
            </div>
            <div className="flex gap-1.5 mt-2">
              <button
                type="button"
                disabled={avatarUploading}
                onClick={() => avatarInputRef.current?.click()}
                className="flex-1 text-xs px-2 py-1 rounded-lg transition-all hover:brightness-110"
                style={{ background: 'rgba(139,92,246,0.2)', color: '#c4b5fd' }}
              >
                {currentAvatarUrl ? 'Заменить' : 'Загрузить'}
              </button>
              {currentAvatarUrl && (
                <button
                  type="button"
                  onClick={handleDeleteAvatar}
                  className="text-xs px-2 py-1 rounded-lg transition-all hover:brightness-110"
                  style={{ background: 'rgba(239,68,68,0.15)', color: '#fca5a5' }}
                >
                  ✕
                </button>
              )}
            </div>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleAvatarChange}
            />
          </div>

          {/* Имя + системный промпт */}
          <div className="flex-1 space-y-3">
            <div>
              <label className="block text-xs font-medium uppercase tracking-wide mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                Имя агента
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="AI Ассистент"
                className="w-full px-3 py-2 rounded-xl text-sm"
                style={{
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(139,92,246,0.25)',
                  color: 'var(--color-text-primary)',
                }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium uppercase tracking-wide mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                Системный промпт
              </label>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="Опишите, как агент должен себя вести, какие задачи решать…"
                rows={4}
                className="w-full px-3 py-2 rounded-xl text-sm resize-none"
                style={{
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(139,92,246,0.25)',
                  color: 'var(--color-text-primary)',
                }}
              />
            </div>
          </div>
        </div>

        {/* API Ключ */}
        <div
          className="rounded-xl p-4"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <h4 className="font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>API Ключ</h4>
          <p className="text-xs mb-3 leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            Ключ из Базы данных, который будет использоваться для запросов к AI. Добавьте ключи в разделе «AI Сценарии → API Ключи».
          </p>
          <select
            value={selectedApiKeyId ?? ''}
            onChange={(e) => setSelectedApiKeyId(e.target.value ? Number(e.target.value) : null)}
            className="w-full px-3 py-2 rounded-xl text-sm"
            style={{
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(139,92,246,0.25)',
              color: 'var(--color-text-primary)',
            }}
          >
            <option value="">— Первый активный ключ для провайдера —</option>
            {apiKeys.filter(k => k.is_active !== false).map(k => (
              <option key={k.id} value={k.id}>
                {k.label} ({k.provider})
              </option>
            ))}
          </select>
          {apiKeys.length === 0 && (
            <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
              ℹ️ Нет активных ключей. Добавьте их в «AI Сценарии и методы → API Ключи»
            </p>
          )}
        </div>

        {/* Права доступа */}
        <div
          className="rounded-xl p-4"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <h4 className="font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>Права доступа</h4>
          <p className="text-xs mb-3 leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            Кто может открыть чат с AI агентом. Администраторы платформы имеют доступ всегда.
          </p>

          <div className="flex flex-col gap-2 mb-3">
            {[
              { value: 'all', title: 'Все сотрудники', desc: 'Любой сотрудник (кроме гостей) может общаться с агентом.' },
              { value: 'restricted', title: 'Только выбранные', desc: 'Доступ по сотрудникам, командам или должностям.' },
            ].map(({ value, title, desc }) => (
              <label key={value} className="flex items-start gap-2.5 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="ai-agent-access"
                  checked={access.mode === value}
                  onChange={() => patchAccess({ mode: value })}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium block" style={{ color: 'var(--color-text-primary)' }}>{title}</span>
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{desc}</span>
                </span>
              </label>
            ))}
          </div>

          {restricted && (
            <div className="grid gap-4 md:grid-cols-3 mt-3">
              <div>
                <div className="text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Сотрудники</div>
                <SearchableChecklist
                  items={employeeItems}
                  selectedIds={access.user_ids}
                  placeholder="Поиск…"
                  onToggle={(id) => patchAccess({ user_ids: toggleId(access.user_ids, id) })}
                />
              </div>
              <div>
                <div className="text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Команды</div>
                <SearchableChecklist
                  items={teamItems}
                  selectedIds={access.team_ids}
                  placeholder="Поиск…"
                  onToggle={(id) => patchAccess({ team_ids: toggleId(access.team_ids, id) })}
                />
              </div>
              <div>
                <div className="text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Должности</div>
                <div
                  className="rounded-lg overflow-y-auto"
                  style={{
                    maxHeight: 180,
                    background: 'rgba(0,0,0,0.2)',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  {POSITION_OPTIONS.map((role) => (
                    <label
                      key={role}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-white/5"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      <input
                        type="checkbox"
                        checked={access.team_roles.includes(role)}
                        onChange={() => patchAccess({ team_roles: toggleId(access.team_roles, role) })}
                      />
                      {role}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Scenario triggers */}
        <div
          className="rounded-xl p-4"
          style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)' }}
        >
          <TriggerEditor triggers={triggers} onChange={setTriggers} scenarios={scenarios} />
          {scenarios.length === 0 && (
            <div style={{ marginTop: 8, fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
              ℹ️ Сначала создайте сценарии в блоке «AI Сценарии и методы» выше
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-400 rounded-xl px-3 py-2" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
            <AdminIcon name="error" size="sm" />
            {error}
          </div>
        )}
        {ok && (
          <div className="flex items-center gap-2 text-sm text-emerald-400 rounded-xl px-3 py-2" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}>
            <AdminIcon name="success" size="sm" />
            {ok}
          </div>
        )}

        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="px-5 py-2 rounded-xl text-sm font-medium transition-all hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
            style={{
              background: 'linear-gradient(135deg, rgba(139,92,246,0.8), rgba(99,102,241,0.8))',
              color: '#fff',
              boxShadow: '0 4px 15px rgba(139,92,246,0.25)',
            }}
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                Сохранение…
              </span>
            ) : 'Сохранить AI агента'}
          </button>
        </div>
      </div>
    </div>
  );
}
