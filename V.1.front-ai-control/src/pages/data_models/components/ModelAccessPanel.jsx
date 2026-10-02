import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MagnifyingGlassIcon, TrashIcon, UserPlusIcon } from '@heroicons/react/24/outline';
import { dataModelService } from '../../../services/dataModelService';

const ACCESS_LEVELS = [
  { value: 'view', label: 'Просмотр' },
  { value: 'edit', label: 'Редактирование' },
];

const SUBJECT_TYPES = [
  { id: 'user', label: 'Пользователь' },
  { id: 'team_role', label: 'Роль' },
  { id: 'team', label: 'Команда' },
  { id: 'department', label: 'Отдел' },
];

function userLabel(user) {
  if (!user) return '';
  return user.name || user.login || user.email || `Пользователь ${user.id}`;
}

function grantLabel(access) {
  if (access.subject_name) return access.subject_name;
  if (access.subject_type === 'team_role') return access.subject_key || 'Роль';
  if (access.user) return userLabel(access.user);
  if (access.subject_type === 'user') return `Пользователь ${access.subject_id || access.user_id}`;
  return `#${access.subject_id || access.subject_key || access.id}`;
}

function Toggle({ checked, disabled, onChange, label, hint }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="text-sm font-medium text-gray-200">{label}</div>
        {hint ? <p className="text-xs text-gray-400 mt-1 max-w-md">{hint}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border transition-colors ${
          checked ? 'bg-blue-500 border-blue-400' : 'bg-gray-600 border-gray-500'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span
          className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform mt-px ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}

const ModelAccessPanel = ({ modelId, model, isOwner, onModelChange }) => {
  const [savingFlags, setSavingFlags] = useState(false);
  const [accesses, setAccesses] = useState([]);
  const [loadingAccess, setLoadingAccess] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);
  const [pendingKey, setPendingKey] = useState(null);
  const [subjectType, setSubjectType] = useState('user');
  const [subjectId, setSubjectId] = useState('');
  const [accessLevel, setAccessLevel] = useState('view');
  const [options, setOptions] = useState({ departments: [], teams: [], team_roles: [] });
  const searchSeq = useRef(0);

  const loadAccesses = useCallback(async () => {
    if (!isOwner || !modelId) return;
    setLoadingAccess(true);
    try {
      const items = await dataModelService.listDataModelAccess(modelId);
      setAccesses(Array.isArray(items) ? items : []);
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Не удалось загрузить права доступа');
    } finally {
      setLoadingAccess(false);
    }
  }, [isOwner, modelId]);

  useEffect(() => {
    void loadAccesses();
  }, [loadAccesses]);

  useEffect(() => {
    if (!isOwner || !modelId) return undefined;
    let cancelled = false;
    dataModelService.getDataModelAccessOptions(modelId).then((data) => {
      if (cancelled) return;
      setOptions({
        departments: data?.departments || [],
        teams: data?.teams || [],
        team_roles: data?.team_roles || [],
      });
    }).catch(() => {
      if (!cancelled) setOptions({ departments: [], teams: [], team_roles: [] });
    });
    return () => {
      cancelled = true;
    };
  }, [isOwner, modelId]);

  useEffect(() => {
    if (!isOwner || subjectType !== 'user') return undefined;
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      setSearching(false);
      return undefined;
    }
    const seq = ++searchSeq.current;
    setSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const users = await dataModelService.searchDataModelAccessUsers(modelId, term);
        if (searchSeq.current !== seq) return;
        const grantedIds = new Set(
          accesses
            .filter((item) => (item.subject_type || 'user') === 'user')
            .map((item) => Number(item.subject_id || item.user_id)),
        );
        setResults((Array.isArray(users) ? users : []).filter((u) => !grantedIds.has(Number(u.id))));
      } catch {
        if (searchSeq.current === seq) setResults([]);
      } finally {
        if (searchSeq.current === seq) setSearching(false);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, modelId, isOwner, accesses, subjectType]);

  const handleToggle = async (field, value) => {
    if (!isOwner || savingFlags) return;
    setSavingFlags(true);
    setError(null);
    try {
      const updated = await dataModelService.updateDataModel(modelId, { [field]: value });
      onModelChange?.({ ...model, ...updated, is_owner: true, can_edit: true, can_manage_access: true });
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Не удалось сохранить настройку');
    } finally {
      setSavingFlags(false);
    }
  };

  const applyGrant = async (payload, pending) => {
    setPendingKey(pending);
    setError(null);
    try {
      const granted = await dataModelService.grantDataModelAccess(modelId, payload);
      setAccesses((prev) => {
        const rest = prev.filter((item) => item.id !== granted.id);
        return [granted, ...rest.filter((item) => (
          item.subject_type !== granted.subject_type
          || Number(item.subject_id) !== Number(granted.subject_id)
          || String(item.subject_key || '') !== String(granted.subject_key || '')
        ))];
      });
      setQuery('');
      setResults([]);
      setSubjectId('');
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Не удалось выдать доступ');
    } finally {
      setPendingKey(null);
    }
  };

  const handleGrantUser = (user) => {
    if (!user?.id) return;
    void applyGrant(
      { subject_type: 'user', subject_id: user.id, user_id: user.id, access_level: accessLevel },
      `user:${user.id}`,
    );
  };

  const handleAddSubject = () => {
    if (subjectType === 'user') return;
    if (subjectType === 'team_role') {
      if (!subjectId) {
        setError('Выберите роль');
        return;
      }
      void applyGrant(
        { subject_type: 'team_role', subject_key: subjectId, access_level: accessLevel },
        `team_role:${subjectId}`,
      );
      return;
    }
    const id = Number(subjectId);
    if (!id) {
      setError(subjectType === 'team' ? 'Выберите команду' : 'Выберите отдел');
      return;
    }
    void applyGrant(
      { subject_type: subjectType, subject_id: id, access_level: accessLevel },
      `${subjectType}:${id}`,
    );
  };

  const handleLevelChange = async (access, nextLevel) => {
    try {
      const updated = await dataModelService.updateDataModelAccess(modelId, access.id, {
        access_level: nextLevel,
      });
      setAccesses((prev) => prev.map((item) => (item.id === access.id ? { ...item, ...updated } : item)));
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Не удалось изменить уровень доступа');
    }
  };

  const handleRevoke = async (access) => {
    try {
      await dataModelService.revokeDataModelAccess(modelId, access.id);
      setAccesses((prev) => prev.filter((item) => item.id !== access.id));
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Не удалось отозвать доступ');
    }
  };

  const subjectOptions = subjectType === 'team_role'
    ? options.team_roles
    : subjectType === 'team'
      ? options.teams
      : options.departments;

  return (
    <div className="p-6 border border-gray-600 rounded-lg">
      <h3 className="text-lg font-semibold mb-4">Права доступа</h3>
      <div className="space-y-5">
        <Toggle
          checked={Boolean(model?.is_public)}
          disabled={!isOwner || savingFlags}
          onChange={(value) => handleToggle('is_public', value)}
          label="Публичная модель"
          hint="Публичную модель видят все пользователи в списке и могут подключать её таблицы в своих моделях."
        />
        <Toggle
          checked={Boolean(model?.is_active)}
          disabled={!isOwner || savingFlags}
          onChange={(value) => handleToggle('is_active', value)}
          label="Активная"
          hint="Неактивная модель скрыта для всех, кроме владельца — даже если она публичная или выданы права."
        />

        {!isOwner && (
          <p className="text-sm text-gray-400">
            Изменять публикацию и список получателей может только владелец модели.
          </p>
        )}

        {isOwner && (
          <div className="pt-2 border-t border-gray-700 space-y-3">
            <div>
              <div className="text-sm font-medium text-gray-200 mb-1">Кому доступна модель</div>
              <p className="text-xs text-gray-400 mb-3">
                Добавьте пользователей, роли (TeamRole), команды или отделы.
                Просмотр — открыть и подключить таблицы, редактирование — менять рабочую область.
              </p>
              <div className="flex flex-wrap gap-2 mb-3">
                <select
                  className="rounded-md bg-gray-800 border border-gray-600 text-sm text-gray-100 px-2 py-2"
                  value={subjectType}
                  onChange={(e) => {
                    setSubjectType(e.target.value);
                    setSubjectId('');
                    setQuery('');
                    setResults([]);
                  }}
                >
                  {SUBJECT_TYPES.map((type) => (
                    <option key={type.id} value={type.id}>{type.label}</option>
                  ))}
                </select>
                <select
                  className="rounded-md bg-gray-800 border border-gray-600 text-sm text-gray-100 px-2 py-2"
                  value={accessLevel}
                  onChange={(e) => setAccessLevel(e.target.value)}
                >
                  {ACCESS_LEVELS.map((level) => (
                    <option key={level.value} value={level.value}>{level.label}</option>
                  ))}
                </select>
              </div>

              {subjectType === 'user' ? (
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Поиск по имени, логину или email"
                    className="w-full rounded-md bg-gray-800 border border-gray-600 pl-9 pr-3 py-2 text-sm text-gray-100 placeholder:text-gray-500"
                  />
                  {(searching || results.length > 0) && query.trim().length >= 2 && (
                    <div className="absolute z-20 mt-1 w-full rounded-md border border-gray-600 bg-gray-900 shadow-lg max-h-56 overflow-auto">
                      {searching && results.length === 0 && (
                        <div className="px-3 py-2 text-xs text-gray-400">Поиск…</div>
                      )}
                      {results.map((user) => (
                        <button
                          key={user.id}
                          type="button"
                          disabled={pendingKey === `user:${user.id}`}
                          onClick={() => handleGrantUser(user)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-800 flex items-center justify-between gap-2"
                        >
                          <span>
                            <span className="text-gray-100">{userLabel(user)}</span>
                            {user.email ? (
                              <span className="block text-xs text-gray-400">{user.email}</span>
                            ) : null}
                          </span>
                          <UserPlusIcon className="h-4 w-4 text-gray-400" />
                        </button>
                      ))}
                      {!searching && results.length === 0 && (
                        <div className="px-3 py-2 text-xs text-gray-400">Пользователи не найдены</div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <select
                    className="flex-1 min-w-[16rem] rounded-md bg-gray-800 border border-gray-600 text-sm text-gray-100 px-2 py-2"
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                  >
                    <option value="">Выберите…</option>
                    {subjectOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>{opt.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={Boolean(pendingKey)}
                    onClick={handleAddSubject}
                  >
                    Добавить
                  </button>
                </div>
              )}
            </div>

            {loadingAccess ? (
              <p className="text-xs text-gray-400">Загрузка списка доступа…</p>
            ) : accesses.length === 0 ? (
              <p className="text-xs text-gray-500">Пока никому не выдан доступ.</p>
            ) : (
              <ul className="space-y-2">
                {accesses.map((access) => (
                  <li
                    key={access.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-gray-700 bg-gray-800/40 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="text-sm text-gray-100 truncate">{grantLabel(access)}</div>
                      <div className="text-xs text-gray-400 truncate">
                        {SUBJECT_TYPES.find((t) => t.id === (access.subject_type || 'user'))?.label || access.subject_type}
                        {!access.is_active ? ' · отключён' : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        className="rounded-md bg-gray-800 border border-gray-600 text-xs text-gray-100 px-2 py-1"
                        value={access.access_level}
                        onChange={(e) => handleLevelChange(access, e.target.value)}
                      >
                        {ACCESS_LEVELS.map((level) => (
                          <option key={level.value} value={level.value}>
                            {level.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => handleRevoke(access)}
                        className="p-1.5 rounded-md text-gray-400 hover:text-red-400 hover:bg-red-500/10"
                        title="Отозвать доступ"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {error ? <p className="text-sm text-red-400">{error}</p> : null}
      </div>
    </div>
  );
};

export default ModelAccessPanel;
