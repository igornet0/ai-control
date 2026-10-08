import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { teamService } from '../../../../../services/teamService';
import { CloseIcon } from '../../../components/TaskManagerIcons';
// Та же оболочка и поля, что у окна редактирования проекта — окна выглядят одинаково
import styles from '../../projects/components/EditProjectModal.module.css';
import '../../tmPage.css';

const memberDisplayName = (member) =>
  member.user_name || member.user_email || `User ${member.user_id}`;

const cloneMembers = (list = []) =>
  list.map((member) => ({ ...member }));

const initials = (name) => String(name || '?')
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((part) => part[0])
  .join('')
  .toUpperCase();

const ROLE_OPTIONS = [
  { id: 'member', label: 'Участник' },
  { id: 'manager', label: 'Менеджер' },
];

const EditTeamModal = ({ team, onClose, onSubmit, onMembersChanged, overlayClassName = 'modal-overlay' }) => {
  const [teamData, setTeamData] = useState({
    name: '',
    description: '',
  });
  const [loading, setLoading] = useState(false);
  const [membersLoading, setMembersLoading] = useState(true);
  const [errors, setErrors] = useState({});
  const [members, setMembers] = useState([]);
  const [initialMembers, setInitialMembers] = useState([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberSearchResults, setMemberSearchResults] = useState([]);
  const [memberSearchLoading, setMemberSearchLoading] = useState(false);
  const draftDirtyRef = useRef(false);

  const memberUserIds = useMemo(
    () => new Set(members.map((member) => member.user_id)),
    [members],
  );

  const availableMemberSearchResults = useMemo(
    () => memberSearchResults.filter((user) => !memberUserIds.has(user.id)),
    [memberSearchResults, memberUserIds],
  );

  useEffect(() => {
    if (!team?.id) return;

    let cancelled = false;
    draftDirtyRef.current = false;
    setMembersLoading(true);
    setErrors({});
    setTeamData({
      name: team.name || '',
      description: team.description || '',
    });
    setMembers(cloneMembers(team.members || []));
    setInitialMembers(cloneMembers(team.members || []));

    (async () => {
      try {
        const fullTeam = await teamService.getTeam(team.id);
        if (cancelled || draftDirtyRef.current) return;
        setTeamData({
          name: fullTeam.name || '',
          description: fullTeam.description || '',
        });
        const nextMembers = cloneMembers(fullTeam.members || []);
        setMembers(nextMembers);
        setInitialMembers(cloneMembers(nextMembers));
      } catch (error) {
        console.error('Error loading team members:', error);
      } finally {
        if (!cancelled) setMembersLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [team?.id]);

  useEffect(() => {
    if (memberSearch.length < 2) {
      setMemberSearchResults([]);
      setMemberSearchLoading(false);
      return;
    }
    const timeoutId = setTimeout(async () => {
      try {
        setMemberSearchLoading(true);
        const users = await teamService.searchUsers(memberSearch);
        setMemberSearchResults(users);
      } catch (error) {
        console.error('Error searching users:', error);
        setMemberSearchResults([]);
      } finally {
        setMemberSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [memberSearch]);

  const handleChange = (field, value) => {
    draftDirtyRef.current = true;
    setTeamData((prev) => ({
      ...prev,
      [field]: value,
    }));

    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: '',
      }));
    }
  };

  const handleAddMember = (user) => {
    draftDirtyRef.current = true;
    setMembers((prev) => [
      ...prev,
      {
        id: `pending-${user.id}`,
        user_id: user.id,
        user_name: user.name || user.login || '',
        user_email: user.email || '',
        role: 'member',
        is_active: true,
      },
    ]);
    setMemberSearch('');
    setMemberSearchResults([]);
    if (errors.general) {
      setErrors((prev) => ({ ...prev, general: '' }));
    }
  };

  // Изменения применяются только по «Сохранить» — убранного можно вернуть, подтверждение не нужно
  const handleRemoveMember = (userId) => {
    draftDirtyRef.current = true;
    setMembers((prev) => prev.filter((member) => member.user_id !== userId));
    if (errors.general) {
      setErrors((prev) => ({ ...prev, general: '' }));
    }
  };

  const handleRoleChange = (userId, role) => {
    draftDirtyRef.current = true;
    setMembers((prev) =>
      prev.map((member) =>
        member.user_id === userId ? { ...member, role } : member,
      ),
    );
    if (errors.general) {
      setErrors((prev) => ({ ...prev, general: '' }));
    }
  };

  const syncMembers = async () => {
    const initialByUserId = new Map(
      initialMembers.map((member) => [member.user_id, member]),
    );
    const currentByUserId = new Map(
      members.map((member) => [member.user_id, member]),
    );

    for (const member of initialMembers) {
      if (!currentByUserId.has(member.user_id)) {
        await teamService.removeTeamMember(team.id, member.user_id);
      }
    }

    for (const member of members) {
      const initial = initialByUserId.get(member.user_id);
      if (!initial) {
        await teamService.addTeamMember(team.id, {
          user_id: member.user_id,
          role: member.role || 'member',
        });
        continue;
      }
      if (initial.role !== member.role) {
        await teamService.updateTeamMemberRole(team.id, member.user_id, member.role);
      }
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!teamData.name.trim()) {
      newErrors.name = 'Название команды обязательно';
    }

    if (teamData.name.trim().length > 100) {
      newErrors.name = 'Название команды не должно превышать 100 символов';
    }

    if (teamData.description && teamData.description.length > 500) {
      newErrors.description = 'Описание не должно превышать 500 символов';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      await syncMembers();
      await onSubmit({
        name: teamData.name,
        description: teamData.description || null,
      });
      const updatedTeam = await teamService.getTeam(team.id);
      setMembers(cloneMembers(updatedTeam.members || []));
      setInitialMembers(cloneMembers(updatedTeam.members || []));
      draftDirtyRef.current = false;
      onMembersChanged?.(updatedTeam);
      onClose();
    } catch (error) {
      console.error('Error updating team:', error);
      setErrors({
        general: error.response?.data?.detail || 'Ошибка при обновлении команды',
      });
    } finally {
      setLoading(false);
    }
  };

  const isNested = String(overlayClassName).includes('nested');
  const initialUserIds = useMemo(
    () => new Set(initialMembers.map((member) => member.user_id)),
    [initialMembers],
  );
  const removedMembers = initialMembers.filter((member) => !memberUserIds.has(member.user_id));
  const handleRestoreMember = (member) => {
    draftDirtyRef.current = true;
    setMembers((prev) => [...prev, { ...member }]);
  };

  // Вложенное окно (из формы проекта) закрывает по Esc родитель; самостоятельное — само
  useEffect(() => {
    if (isNested) return undefined;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleEscape = (event) => {
      if (event.key === 'Escape' && !loading) onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isNested, loading, onClose]);

  const searchHint = (() => {
    if (memberSearch.length === 0) return null;
    if (memberSearch.length < 2) return 'Введите минимум 2 символа';
    if (memberSearchLoading) return 'Поиск…';
    if (memberSearchResults.length === 0) return 'Сотрудники не найдены';
    if (availableMemberSearchResults.length === 0) return 'Все найденные сотрудники уже в команде';
    return null;
  })();

  return createPortal(
    <div
      className={styles.overlay}
      style={isNested ? { zIndex: 10010 } : undefined}
      onClick={() => !loading && onClose()}
      role="presentation"
    >
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-team-modal-title"
      >
        <div className={styles.head}>
          <div>
            <h3 id="edit-team-modal-title">{teamData.name || team?.name || 'Команда'}</h3>
            <p className={styles.subtitle}>Редактирование команды</p>
          </div>
          <button type="button" onClick={onClose} className={styles.close} aria-label="Закрыть">
            <XMarkIcon />
          </button>
        </div>

        {errors.general && <div className={styles.error} role="alert">{errors.general}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.body}>
            <div className={styles.section}>
              <p className={styles.sectionTitle}>Основное</p>
              <div className={styles.field}>
                <label htmlFor="edit-team-name">Название <span className={styles.required}>*</span></label>
                <input
                  id="edit-team-name"
                  type="text"
                  value={teamData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className={errors.name ? styles.invalid : ''}
                  placeholder="Например, Backend Core"
                  maxLength={100}
                />
                {errors.name && <span className={styles.hint}>{errors.name}</span>}
              </div>
              <div className={styles.field}>
                <label htmlFor="edit-team-description">Описание</label>
                <textarea
                  id="edit-team-description"
                  value={teamData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  className={errors.description ? styles.invalid : ''}
                  placeholder="Чем занимается команда"
                  rows={3}
                />
                {errors.description && <span className={styles.hint}>{errors.description}</span>}
              </div>
            </div>

            <div className={styles.section}>
              <p className={styles.sectionTitle}>
                Участники
                {!membersLoading && <span className={styles.sectionCount}>{members.length}</span>}
              </p>

              <div className={styles.searchWrap}>
                <MagnifyingGlassIcon />
                <input
                  type="text"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder="Добавить сотрудника — имя или email…"
                  disabled={membersLoading}
                  aria-label="Поиск сотрудника"
                />
                {memberSearch.length >= 2 && !memberSearchLoading && availableMemberSearchResults.length > 0 && (
                  <div className={styles.searchResults}>
                    {availableMemberSearchResults.map((user) => (
                      <button key={user.id} type="button" onClick={() => handleAddMember(user)}>
                        <span className={styles.resultName}>{user.name || user.login}</span>
                        {user.email && <span className={styles.resultMeta}>{user.email}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {searchHint && <p className={styles.hintMuted}>{searchHint}</p>}

              {membersLoading ? (
                <p className={styles.hintMuted}>Загрузка участников…</p>
              ) : members.length > 0 ? (
                <div className={styles.people}>
                  {members.map((member) => {
                    const name = memberDisplayName(member);
                    const isNew = !initialUserIds.has(member.user_id);
                    return (
                      <div key={member.id ?? member.user_id} className={styles.person}>
                        <div className={styles.avatar}>{initials(name)}</div>
                        <div className={styles.personBody}>
                          <strong>
                            {name}
                            {isNew && <span className={styles.newBadge}>новый</span>}
                          </strong>
                          {member.user_email && member.user_email !== name && <em>{member.user_email}</em>}
                        </div>
                        <span className="tm-segmented tm-segmented--sm" role="group" aria-label={`Роль: ${name}`}>
                          {ROLE_OPTIONS.map((option) => (
                            <button
                              key={option.id}
                              type="button"
                              className={`tm-segmented__btn ${member.role === option.id ? 'tm-segmented__btn--active' : ''}`}
                              aria-pressed={member.role === option.id}
                              onClick={() => handleRoleChange(member.user_id, option.id)}
                            >
                              {option.label}
                            </button>
                          ))}
                        </span>
                        <button
                          type="button"
                          className={styles.removePerson}
                          onClick={() => handleRemoveMember(member.user_id)}
                          aria-label={`Убрать ${name} из команды`}
                          title="Убрать из команды"
                        >
                          <CloseIcon size="xs" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className={styles.hintMuted}>В команде пока нет участников — найдите сотрудника выше.</p>
              )}

              {removedMembers.length > 0 && (
                <div className={styles.removedList}>
                  <span className={styles.removedLabel}>Будут убраны:</span>
                  {removedMembers.map((member) => (
                    <button
                      key={member.user_id}
                      type="button"
                      className={styles.removedChip}
                      onClick={() => handleRestoreMember(member)}
                      title="Вернуть в команду"
                    >
                      {memberDisplayName(member)}
                      <span aria-hidden>↺</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className={styles.footer}>
            <span className={styles.footerNote}>Состав и роли применятся после сохранения</span>
            <button type="button" onClick={onClose} className={styles.ghost} disabled={loading}>
              Отмена
            </button>
            <button type="submit" disabled={loading || membersLoading} className={styles.primary}>
              {loading ? 'Сохранение…' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
};

export default EditTeamModal;
