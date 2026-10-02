import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  MagnifyingGlassIcon,
  TrashIcon,
  UserPlusIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { sheetService } from '../../../services/sheetService';
import styles from './TemplateAccessModal.module.css';

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

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function subjectTypeLabel(type) {
  return SUBJECT_TYPES.find((item) => item.id === type)?.label || type;
}

/**
 * Who can see this sheet. Empty grant list = everyone with dashboard access.
 */
export default function SheetAccessModal({ sheet, open, onClose, onAccessChange }) {
  const sheetId = sheet?.id;
  const [accesses, setAccesses] = useState([]);
  const [loadingAccess, setLoadingAccess] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);
  const [pendingKey, setPendingKey] = useState(null);
  const [subjectType, setSubjectType] = useState('user');
  const [subjectId, setSubjectId] = useState('');
  const [options, setOptions] = useState({ departments: [], teams: [], team_roles: [] });
  const searchSeq = useRef(0);

  const loadAccesses = useCallback(async () => {
    if (!open || !sheetId) return;
    setLoadingAccess(true);
    try {
      const items = await sheetService.listSheetAccess(sheetId);
      setAccesses(Array.isArray(items) ? items : []);
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Не удалось загрузить права');
    } finally {
      setLoadingAccess(false);
    }
  }, [open, sheetId]);

  useEffect(() => {
    void loadAccesses();
  }, [loadAccesses]);

  useEffect(() => {
    if (!open || !sheetId) return undefined;
    let cancelled = false;
    sheetService.getSheetAccessOptions(sheetId).then((data) => {
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
  }, [open, sheetId]);

  useEffect(() => {
    if (!open || subjectType !== 'user') return undefined;
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
        const users = await sheetService.searchSheetAccessUsers(sheetId, term);
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
  }, [query, sheetId, open, accesses, subjectType]);

  if (!open) return null;

  const notifyRestricted = (nextAccesses) => {
    onAccessChange?.(sheetId, (Array.isArray(nextAccesses) ? nextAccesses : []).length > 0);
  };

  const applyGrant = async (payload, pending) => {
    setPendingKey(pending);
    setError(null);
    try {
      const granted = await sheetService.grantSheetAccess(sheetId, payload);
      setAccesses((prev) => {
        const rest = prev.filter((item) => item.id !== granted.id);
        const next = [granted, ...rest.filter((item) => (
          item.subject_type !== granted.subject_type
          || Number(item.subject_id) !== Number(granted.subject_id)
          || String(item.subject_key || '') !== String(granted.subject_key || '')
        ))];
        notifyRestricted(next);
        return next;
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
      { subject_type: 'user', subject_id: user.id, user_id: user.id },
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
      void applyGrant({ subject_type: 'team_role', subject_key: subjectId }, `team_role:${subjectId}`);
      return;
    }
    const id = Number(subjectId);
    if (!id) {
      setError(subjectType === 'team' ? 'Выберите команду' : 'Выберите отдел');
      return;
    }
    void applyGrant({ subject_type: subjectType, subject_id: id }, `${subjectType}:${id}`);
  };

  const handleRevoke = async (access) => {
    try {
      await sheetService.revokeSheetAccess(sheetId, access.id);
      setAccesses((prev) => {
        const next = prev.filter((item) => item.id !== access.id);
        notifyRestricted(next);
        return next;
      });
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
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="sheet-access-title">
        <header className={styles.head}>
          <div>
            <p className={styles.kicker}>Лист</p>
            <h3 id="sheet-access-title">Кто видит лист</h3>
            <p className={styles.subtitle}>
              «{sheet?.name || ''}» — пустой список значит лист виден всем, у кого есть доступ к панели.
              Если добавить людей или группы — лист увидят только они (плюс владелец и редакторы).
            </p>
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Закрыть">
            <XMarkIcon />
          </button>
        </header>

        {error ? <div className={styles.error}>{String(error)}</div> : null}

        <section className={styles.section}>
          <div className={styles.sectionTitle}>Выдать просмотр</div>

          <div className={styles.typePills}>
            {SUBJECT_TYPES.map((type) => (
              <button
                key={type.id}
                type="button"
                className={subjectType === type.id ? styles.typeActive : ''}
                onClick={() => {
                  setSubjectType(type.id);
                  setSubjectId('');
                  setQuery('');
                  setResults([]);
                }}
              >
                {type.label}
              </button>
            ))}
          </div>

          {subjectType === 'user' ? (
            <div className={styles.searchWrap}>
              <MagnifyingGlassIcon />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Найти сотрудника по имени, логину или email"
              />
              {(searching || results.length > 0) && query.trim().length >= 2 && (
                <div className={styles.searchResults}>
                  {searching && results.length === 0 && <div className={styles.emptyHint}>Поиск…</div>}
                  {results.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      disabled={pendingKey === `user:${user.id}`}
                      onClick={() => handleGrantUser(user)}
                    >
                      <span className={styles.avatar}>{initials(userLabel(user))}</span>
                      <span>
                        {userLabel(user)}
                        {user.email ? <small>{user.email}</small> : null}
                      </span>
                      <UserPlusIcon />
                    </button>
                  ))}
                  {!searching && results.length === 0 && (
                    <div className={styles.emptyHint}>Пользователи не найдены</div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className={styles.addRow}>
              <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                <option value="">Выберите {subjectTypeLabel(subjectType).toLowerCase()}</option>
                {subjectOptions.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
              <button type="button" className={styles.addBtn} onClick={handleAddSubject}>
                Добавить
              </button>
            </div>
          )}
        </section>

        <section className={styles.section}>
          <div className={styles.sectionTitle}>
            Ограничение
            {accesses.length > 0 ? <span>{accesses.length}</span> : null}
          </div>
          {loadingAccess ? <p className={styles.emptyHint}>Загрузка списка…</p> : null}
          {!loadingAccess && accesses.length === 0 ? (
            <p className={styles.emptyHint}>Список пуст — лист виден всем с доступом к панели.</p>
          ) : null}
          <ul className={styles.grantList}>
            {accesses.map((access) => (
              <li key={access.id} className={styles.grantItem}>
                <span className={styles.avatar}>{initials(grantLabel(access))}</span>
                <div className={styles.grantCopy}>
                  <strong>{grantLabel(access)}</strong>
                  <small>{subjectTypeLabel(access.subject_type || 'user')}</small>
                </div>
                <button
                  type="button"
                  className={styles.revoke}
                  onClick={() => handleRevoke(access)}
                  title="Отозвать"
                  aria-label="Отозвать"
                >
                  <TrashIcon />
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
