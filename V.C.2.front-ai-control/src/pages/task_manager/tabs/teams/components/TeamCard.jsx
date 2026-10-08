import React, { useState, useEffect, useMemo } from 'react';
import { TrashIcon } from '@heroicons/react/24/outline';
import { teamService } from '../../../../../services/teamService';
import EditTeamModal from './EditTeamModal';
import EmployeeHoverTrigger from '../../../../profile/components/employees/EmployeeHoverTrigger';
import { confirmAction } from '../../../../../components/shared/confirmAction';
import '../../tmPage.css';
import {
  calcTeamProjectStats,
  formatActiveProjectLabel,
  formatAvgCompletionDays,
} from '../teamProjectStats';
import {
  CloseIcon,
  EditIcon,
  PlusIconSm,
  TasksIcon,
} from '../../../components/TaskManagerIcons';

const memberDisplayName = (member) =>
  member.user_name || member.user_email || `User ${member.user_id}`;

const TEAM_STATUS_TONES = {
  active: 'green',
  inactive: 'slate',
  archived: 'amber',
  disbanded: 'red',
};

const MEMBER_ROLE_LABELS = {
  manager: 'Менеджер',
  member: 'Участник',
};

const TASK_STATUS_LABELS = {
  created: 'Создана',
  todo: 'Создана',
  in_progress: 'В работе',
  review: 'На проверке',
  completed: 'Завершена',
  done: 'Завершена',
  cancelled: 'Отменена',
  on_hold: 'На паузе',
  blocked: 'Заблокирована',
};

const TASK_STATUS_TONES = {
  created: 'slate',
  todo: 'slate',
  in_progress: 'blue',
  review: 'amber',
  completed: 'green',
  done: 'green',
  cancelled: 'slate',
  on_hold: 'amber',
  blocked: 'red',
};

const TASK_PRIORITY_LABELS = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
  critical: 'Критичный',
  urgent: 'Срочный',
};

const pluralize = (n, one, few, many) => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
};

const getMemberCount = (team) =>
  team.members?.length ?? team.member_count ?? 0;

const getTeamStatus = (team) =>
  team.status ?? (team.is_active !== false ? 'active' : 'inactive');

const TeamCard = ({
  team,
  projects = [],
  catalogTasks = [],
  canManage = false,
  onDelete,
  onUpdate,
  onRefresh,
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [avgTimeMode, setAvgTimeMode] = useState('project');
  const [loading, setLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberSearchResults, setMemberSearchResults] = useState([]);

  const loadTeamDetails = async () => {
    try {
      setDetailsLoading(true);
      const fullTeam = await teamService.getTeam(team.id);
      onRefresh(team.id, fullTeam);
    } catch (error) {
      console.error('Error loading team details:', error);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleToggleDetails = async () => {
    const next = !showDetails;
    setShowDetails(next);
    if (next && !team.members?.length) {
      await loadTeamDetails();
    }
  };

  useEffect(() => {
    if (memberSearch.length < 2) {
      setMemberSearchResults([]);
      return;
    }
    const timeoutId = setTimeout(async () => {
      try {
        const users = await teamService.searchUsers(memberSearch);
        setMemberSearchResults(users);
      } catch (error) {
        console.error('Error searching users:', error);
        setMemberSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [memberSearch]);

  const handleDelete = () => {
    onDelete(team.id);
  };

  const handleUpdate = async (updatedData) => {
    await onUpdate(team.id, updatedData);
  };

  const handleAddMember = async (userId) => {
    try {
      setLoading(true);
      await teamService.addTeamMember(team.id, { user_id: userId, role: 'member' });
      const updatedTeam = await teamService.getTeam(team.id);
      onRefresh(team.id, updatedTeam);
      setMemberSearch('');
      setMemberSearchResults([]);
      setShowAddMemberModal(false);
    } catch (error) {
      console.error('Error adding member:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (userId, name) => {
    const confirmed = await confirmAction({
      title: name ? `Убрать ${name} из команды?` : 'Убрать участника из команды?',
      confirmLabel: 'Убрать',
      danger: true,
    });
    if (confirmed) {
      try {
        await teamService.removeTeamMember(team.id, userId);
        const updatedTeam = await teamService.getTeam(team.id);
        onRefresh(team.id, updatedTeam);
      } catch (error) {
        console.error('Error removing member:', error);
      }
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'active': return 'Активная';
      case 'inactive': return 'Неактивная';
      case 'archived': return 'Архивная';
      case 'disbanded': return 'Расформированная';
      default: return status;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Без срока';
    return new Date(dateString).toLocaleDateString('ru-RU');
  };

  const teamStatus = getTeamStatus(team);
  const memberCount = getMemberCount(team);
  const projectStats = useMemo(
    () => calcTeamProjectStats(projects, team.id, catalogTasks),
    [projects, team.id, catalogTasks]
  );
  const avgCompletionDays =
    avgTimeMode === 'project'
      ? projectStats.avgProjectCompletionDays
      : projectStats.avgTaskCompletionDays;

  return (
    <article className={`tm-card${showDetails ? ' tm-card--active' : ''}`}>
      <div className="tm-card__head">
        <div className="tm-card__heading">
          <h3 className="tm-card__title">{team.name}</h3>
          <div className="tm-card__badges">
            <span className={`tm-pill tm-pill--${TEAM_STATUS_TONES[teamStatus] || 'slate'}`}>
              <span className="tm-pill__dot" aria-hidden />
              {getStatusText(teamStatus)}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={handleToggleDetails}
          className={`tm-expand-btn${showDetails ? ' tm-expand-btn--open' : ''}`}
          aria-expanded={showDetails}
          title={showDetails ? 'Скрыть участников и задачи' : 'Показать участников и задачи'}
        >
          Участники
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {team.description && (
        <p className="tm-card__desc" title={team.description}>{team.description}</p>
      )}

      <dl className="tm-meta">
        <div className="tm-meta__item">
          <dt className="tm-meta__label">Участников</dt>
          <dd className="tm-meta__value">{memberCount}</dd>
        </div>
        <div className="tm-meta__item">
          <dt className="tm-meta__label">Выполнено проектов</dt>
          <dd className="tm-meta__value">{projectStats.completedProjectsCount}</dd>
        </div>
        <div className="tm-meta__item tm-meta__item--wide">
          <dt className="tm-meta__label">Активный проект</dt>
          <dd
            className={`tm-meta__value${projectStats.hasActiveProject ? ' tm-meta__value--success' : ' tm-meta__value--muted'}`}
            title={formatActiveProjectLabel(projectStats)}
          >
            {formatActiveProjectLabel(projectStats)}
          </dd>
        </div>
        <div className="tm-meta__item tm-meta__item--wide">
          <dt className="tm-meta__label">
            Среднее время выполнения
            <span className="tm-segmented tm-segmented--sm" role="group" aria-label="Среднее время для">
              {[
                { id: 'project', label: 'Проект' },
                { id: 'task', label: 'Задача' },
              ].map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setAvgTimeMode(option.id)}
                  className={`tm-segmented__btn ${avgTimeMode === option.id ? 'tm-segmented__btn--active' : ''}`}
                  aria-pressed={avgTimeMode === option.id}
                >
                  {option.label}
                </button>
              ))}
            </span>
          </dt>
          <dd className={`tm-meta__value${avgCompletionDays == null ? ' tm-meta__value--muted' : ''}`}>
            {formatAvgCompletionDays(avgCompletionDays)}
          </dd>
        </div>
      </dl>

      {team.tags && team.tags.length > 0 && (
        <div className="tm-tags">
          {team.tags.map((tag, index) => (
            <span key={index} className="tm-tag">{tag}</span>
          ))}
        </div>
      )}

      {showDetails && (
        <>
          <div className="tm-divider" />
          <section>
            <h4 className="tm-section-title">
              Участники
              {canManage && (
                <button type="button" className="tm-expand-btn" onClick={() => setShowAddMemberModal(true)}>
                  <PlusIconSm size="xs" />
                  Добавить
                </button>
              )}
            </h4>

            {detailsLoading ? (
              <p className="tm-meta__hint">Загрузка участников…</p>
            ) : team.members && team.members.length > 0 ? (
              <ul className="tm-list">
                {team.members.map((member) => {
                  const name = memberDisplayName(member);
                  return (
                    <li key={member.id} className="tm-list__item">
                      <EmployeeHoverTrigger
                        employee={{ id: member.user_id, name }}
                        className="tm-list__person"
                        clickToPin
                      >
                        <span className="tm-avatar" aria-hidden>{name.charAt(0).toUpperCase()}</span>
                        <div className="tm-list__main">
                          <p className="tm-list__title">{name}</p>
                          <p className="tm-list__sub">
                            {MEMBER_ROLE_LABELS[member.role] || member.role}
                            {member.user_email ? ` · ${member.user_email}` : ''}
                          </p>
                        </div>
                      </EmployeeHoverTrigger>
                      {canManage && (
                        <button
                          type="button"
                          className="tm-icon-btn tm-icon-btn--danger"
                          onClick={() => handleRemoveMember(member.user_id, name)}
                          title="Убрать из команды"
                          aria-label={`Убрать ${name} из команды`}
                        >
                          <CloseIcon size="xs" />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="tm-meta__hint">В команде пока нет участников</p>
            )}
          </section>

          {team.tasks && team.tasks.length > 0 && (
            <section>
              <h4 className="tm-section-title">Задачи команды</h4>
              <ul className="tm-list">
                {team.tasks.map((task) => (
                  <li key={task.id} className="tm-list__item">
                    <div className="tm-list__main">
                      <p className="tm-list__title">{task.title}</p>
                      <p className="tm-list__sub">
                        {TASK_PRIORITY_LABELS[task.priority] || task.priority}
                        {task.due_date ? ` · до ${formatDate(task.due_date)}` : ''}
                      </p>
                    </div>
                    <span className={`tm-pill tm-pill--${TASK_STATUS_TONES[task.status] || 'slate'}`}>
                      {TASK_STATUS_LABELS[task.status] || task.status}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <div className="tm-card__footer">
        <div className="tm-card__stats">
          {team.created && <span>Создана {formatDate(team.created)}</span>}
          {team.auto_disband_date && (
            <span title="Дата авторасформирования">Расформирование {formatDate(team.auto_disband_date)}</span>
          )}
          {team.tasks && (
            <span><TasksIcon size="sm" /> {team.tasks.length} {pluralize(team.tasks.length, 'задача', 'задачи', 'задач')}</span>
          )}
        </div>

        {canManage && (
          <div className="tm-card__actions">
            <button
              type="button"
              onClick={() => setShowEditModal(true)}
              className="tm-icon-btn"
              title="Редактировать команду"
              aria-label="Редактировать команду"
            >
              <EditIcon size="sm" />
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="tm-icon-btn tm-icon-btn--danger"
              title="Удалить команду"
              aria-label="Удалить команду"
            >
              <TrashIcon className="h-4 w-4 shrink-0" aria-hidden />
            </button>
          </div>
        )}
      </div>

      {showEditModal && (
        <EditTeamModal
          team={team}
          onClose={() => setShowEditModal(false)}
          onSubmit={handleUpdate}
          onMembersChanged={(updatedTeam) => onRefresh(team.id, updatedTeam)}
        />
      )}

      {showAddMemberModal && (
        <div className="modal-overlay" onClick={() => setShowAddMemberModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Добавить участника</h2>
              <button
                onClick={() => setShowAddMemberModal(false)}
                className="close-btn"
              >
                <CloseIcon size="md" />
              </button>
            </div>
            <div className="task-form">
              <input
                type="text"
                placeholder="Поиск сотрудника (мин. 2 символа)..."
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="form-input w-full mb-4"
              />
              {memberSearchResults.length > 0 && (
                <div className="mb-4 rounded-lg border border-slate-600 bg-slate-800 max-h-40 overflow-y-auto">
                  {memberSearchResults.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => handleAddMember(user.id)}
                      disabled={loading}
                      className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 disabled:opacity-50"
                    >
                      {user.name || user.login} — {user.email}
                    </button>
                  ))}
                </div>
              )}
              <div className="form-actions">
                <button
                  onClick={() => setShowAddMemberModal(false)}
                  className="cancel-btn"
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </article>
  );
};

export default TeamCard;
