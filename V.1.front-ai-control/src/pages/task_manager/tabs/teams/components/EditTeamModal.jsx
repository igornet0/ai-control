import React, { useState, useEffect, useMemo, useRef } from 'react';
import { teamService } from '../../../../../services/teamService';
import { CloseIcon } from '../../../components/TaskManagerIcons';
import './CreateTeamModal.css';

const memberDisplayName = (member) =>
  member.user_name || member.user_email || `User ${member.user_id}`;

const cloneMembers = (list = []) =>
  list.map((member) => ({ ...member }));

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

  const handleRemoveMember = (userId, userName) => {
    if (!window.confirm(`Удалить «${userName}» из команды?`)) return;
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

  return (
    <div className={overlayClassName} onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Редактировать команду</h2>
          <button type="button" onClick={onClose} className="close-btn">
            <CloseIcon size="sm" />
          </button>
        </div>

        {errors.general && (
          <div className="error-message">
            {errors.general}
          </div>
        )}

        <form onSubmit={handleSubmit} className="team-form">
          <div className="form-group">
            <label>Название команды *</label>
            <input
              type="text"
              value={teamData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className={errors.name ? 'error-input' : ''}
              placeholder="Введите название команды"
            />
            {errors.name && <span className="error-text">{errors.name}</span>}
          </div>

          <div className="form-group">
            <label>Описание</label>
            <textarea
              value={teamData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              className={errors.description ? 'error-input' : ''}
              placeholder="Опишите команду"
              rows={3}
            />
            {errors.description && <span className="error-text">{errors.description}</span>}
          </div>

          <div className="form-group">
            <label>Участники команды</label>
            <p className="member-search-hint">
              Изменения ролей и состава применяются только после «Сохранить изменения»
            </p>

            <div className="user-search">
              <input
                type="text"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Поиск сотрудника для добавления..."
                className="user-search-input"
                disabled={membersLoading}
              />

              {memberSearch.length >= 2 && memberSearchLoading && (
                <p className="member-search-hint">Поиск...</p>
              )}

              {memberSearch.length >= 2 && !memberSearchLoading && availableMemberSearchResults.length > 0 && (
                <div className="search-results">
                  {availableMemberSearchResults.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => handleAddMember(user)}
                      className="search-result-item"
                    >
                      <span className="user-name">{user.name || user.login}</span>
                      {user.email && <span className="user-email">{user.email}</span>}
                      {user.login && user.login !== user.name && (
                        <span className="user-role">{user.login}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {memberSearch.length >= 2 && !memberSearchLoading && memberSearchResults.length > 0 && availableMemberSearchResults.length === 0 && (
                <p className="member-search-hint">Все найденные сотрудники уже в команде</p>
              )}

              {memberSearch.length >= 2 && !memberSearchLoading && memberSearchResults.length === 0 && (
                <p className="member-search-hint">Сотрудники не найдены</p>
              )}

              {memberSearch.length > 0 && memberSearch.length < 2 && (
                <p className="member-search-hint">Введите минимум 2 символа для поиска</p>
              )}
            </div>

            {membersLoading ? (
              <p className="text-slate-400 text-sm mt-3">Загрузка участников...</p>
            ) : members.length > 0 ? (
              <div className="members-list mt-3">
                {members.map((member) => {
                  const name = memberDisplayName(member);
                  return (
                    <div key={member.id ?? member.user_id} className="member-item">
                      <span className="member-name">{name}</span>
                      <select
                        value={member.role}
                        onChange={(e) => handleRoleChange(member.user_id, e.target.value)}
                        className="member-role-select"
                      >
                        <option value="manager">Менеджер</option>
                        <option value="member">Участник</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(member.user_id, name)}
                        className="remove-member-btn"
                      >
                        Удалить
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-slate-400 text-sm mt-3">Участники не найдены</p>
            )}
          </div>

          <div className="form-actions">
            <button
              type="button"
              onClick={onClose}
              className="cancel-btn"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading || membersLoading}
              className="submit-btn"
            >
              {loading ? 'Обновление...' : 'Сохранить изменения'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditTeamModal;
