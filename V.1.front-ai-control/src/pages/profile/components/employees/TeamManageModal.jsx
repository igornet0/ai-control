import React, { useEffect, useState } from 'react';
import { MagnifyingGlassIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { teamService } from '../../../../services/teamService';
import { formatApiError } from '../../../../utils/formatApiError';
import styles from './TeamManageModal.module.css';

const MEMBERSHIP_ROLES = [
  { value: 'manager', label: 'Менеджер' },
  { value: 'member', label: 'Участник' },
];

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export default function TeamManageModal({ teamId, departments, departmentId = null, onClose, onUpdated }) {
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', description: '', department_id: '' });
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [saving, setSaving] = useState(false);

  const loadTeam = async () => {
    setLoading(true);
    try {
      const data = await teamService.getTeam(teamId);
      setTeam(data);
      setForm({
        name: data.name,
        description: data.description || '',
        department_id: data.department_id ? String(data.department_id) : '',
      });
    } catch (err) {
      alert(formatApiError(err, 'Ошибка загрузки команды'));
      onClose();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeam();
  }, [teamId]);

  useEffect(() => {
    if (search.length < 2) {
      setSearchResults([]);
      return undefined;
    }
    const timer = setTimeout(async () => {
      try {
        const params = departmentId ? { department_id: departmentId } : {};
        const users = await teamService.searchUsers(search, params);
        const memberIds = new Set((team?.members || []).map((m) => m.user_id));
        setSearchResults((users || []).filter((u) => !memberIds.has(u.id)));
      } catch {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search, departmentId, team?.members]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await teamService.updateTeam(teamId, {
        name: form.name,
        description: form.description || null,
        department_id: form.department_id ? Number(form.department_id) : null,
      });
      await loadTeam();
      onUpdated();
    } catch (err) {
      alert(formatApiError(err, 'Ошибка сохранения'));
    } finally {
      setSaving(false);
    }
  };

  const handleAddMember = async (userId) => {
    try {
      await teamService.addTeamMember(teamId, { user_id: userId, role: 'member' });
      setSearch('');
      setSearchResults([]);
      await loadTeam();
      onUpdated();
    } catch (err) {
      alert(formatApiError(err, 'Ошибка добавления участника'));
    }
  };

  const handleRoleChange = async (userId, role) => {
    try {
      await teamService.updateTeamMemberRole(teamId, userId, role);
      await loadTeam();
    } catch (err) {
      alert(formatApiError(err, 'Ошибка изменения роли'));
      await loadTeam();
    }
  };

  const handleRemoveMember = async (userId, userName) => {
    if (!window.confirm(`Удалить «${userName}» из команды?`)) return;
    try {
      await teamService.removeTeamMember(teamId, userId);
      await loadTeam();
      onUpdated();
    } catch (err) {
      alert(formatApiError(err, 'Ошибка удаления участника'));
    }
  };

  const handleDeleteTeam = async () => {
    if (!window.confirm(`Удалить команду «${team?.name}»?`)) return;
    try {
      await teamService.deleteTeam(teamId);
      onUpdated();
      onClose();
    } catch (err) {
      alert(formatApiError(err, 'Ошибка удаления команды'));
    }
  };

  if (loading || !team) {
    return (
      <div className={styles.overlay}>
        <p className={styles.loading}>Загрузка...</p>
      </div>
    );
  }

  const memberCount = team.members?.length || 0;

  return (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className={styles.head}>
          <div>
            <p className={styles.kicker}>Команда</p>
            <h3>{team.name}</h3>
            <p className={styles.subtitle}>
              Настройки, отдел и состав. Изменения сразу применяются к участникам.
            </p>
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Закрыть">
            <XMarkIcon />
          </button>
        </div>

        <div className={styles.form}>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Название"
          />
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Описание"
            rows={2}
          />
          <select
            value={form.department_id}
            onChange={(e) => setForm({ ...form, department_id: e.target.value })}
          >
            <option value="">Без отдела</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <button type="button" className={styles.saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? 'Сохранение…' : 'Сохранить команду'}
          </button>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            Участники
            <span>{memberCount}</span>
          </div>
          <div className={styles.members}>
            {memberCount === 0 ? (
              <p className={styles.empty}>Пока никого нет — найдите сотрудника ниже</p>
            ) : (
              (team.members || []).map((m) => (
                <div key={m.id} className={styles.member}>
                  <div className={styles.avatar}>{initials(m.user_name)}</div>
                  <div className={styles.memberBody}>
                    <strong>{m.user_name}</strong>
                    <em>{m.user_email}</em>
                  </div>
                  <select
                    className={styles.memberRole}
                    value={m.role}
                    onChange={(e) => handleRoleChange(m.user_id, e.target.value)}
                  >
                    {MEMBERSHIP_ROLES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className={styles.remove}
                    onClick={() => handleRemoveMember(m.user_id, m.user_name)}
                    aria-label="Удалить участника"
                  >
                    <TrashIcon />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>Добавить сотрудника</div>
          <div className={styles.searchWrap}>
            <MagnifyingGlassIcon />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Имя или email…"
            />
            {searchResults.length > 0 && (
              <div className={styles.searchResults}>
                {searchResults.map((u) => (
                  <button key={u.id} type="button" onClick={() => handleAddMember(u.id)}>
                    {u.name} — {u.email}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.ghost} onClick={onClose}>
            Закрыть
          </button>
          <button type="button" className={styles.danger} onClick={handleDeleteTeam}>
            Удалить команду
          </button>
        </div>
      </div>
    </div>
  );
}
