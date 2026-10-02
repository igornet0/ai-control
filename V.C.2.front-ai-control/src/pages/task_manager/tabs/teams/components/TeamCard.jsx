import React, { useState, useEffect, useMemo } from 'react';
import { TrashIcon } from '@heroicons/react/24/outline';
import { teamService } from '../../../../../services/teamService';
import EditTeamModal from './EditTeamModal';
import styles from './TeamCard.module.css';
import {
  calcTeamProjectStats,
  formatActiveProjectLabel,
  formatAvgCompletionDays,
} from '../teamProjectStats';
import {
  CloseIcon,
  EditIcon,
  IconWithText,
  PlusIconSm,
  TasksIcon,
  TeamsIcon,
} from '../../../components/TaskManagerIcons';

const memberDisplayName = (member) =>
  member.user_name || member.user_email || `User ${member.user_id}`;

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

  const handleRemoveMember = async (userId) => {
    if (window.confirm('Удалить участника из команды?')) {
      try {
        await teamService.removeTeamMember(team.id, userId);
        const updatedTeam = await teamService.getTeam(team.id);
        onRefresh(team.id, updatedTeam);
      } catch (error) {
        console.error('Error removing member:', error);
      }
    }
  };

  const getStatusColor = (status) => {
    const statusColors = {
      active: 'bg-slate-500',
      inactive: 'bg-gray-500',
      archived: 'bg-amber-500',
      disbanded: 'bg-red-500',
    };
    return statusColors[status] || 'bg-gray-500';
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
    <div className="card animate-fadeIn hover-lift">
      <div className="card-header">
        <div className="team-title">
          <h3 className="text-lg font-semibold text-slate-100">{team.name}</h3>
          <div className="team-badges">
            <span className={`badge ${getStatusColor(teamStatus)} text-white px-3 py-1 rounded-full text-xs font-medium`}>
              {getStatusText(teamStatus)}
            </span>
          </div>
        </div>
        <div className="team-actions">
          <button
            onClick={handleToggleDetails}
            className="btn btn-ghost btn-sm"
            title={showDetails ? 'Свернуть' : 'Развернуть'}
          >
            {showDetails ? '▼' : '▶'}
          </button>
        </div>
      </div>

      <div className="card-body">
        {team.description && (
          <p className="text-slate-300 mb-4 leading-relaxed">
            {team.description}
          </p>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/30 backdrop-blur-sm">
            <span className="text-sm text-slate-400">Участников:</span>
            <span className="text-sm font-semibold text-slate-100">{memberCount}</span>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/30 backdrop-blur-sm">
            <span className="text-sm text-slate-400">Авторасформирование:</span>
            <span className="text-sm font-medium text-slate-200">{formatDate(team.auto_disband_date)}</span>
          </div>

          {team.created && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/30 backdrop-blur-sm">
              <span className="text-sm text-slate-400">Создана:</span>
              <span className="text-sm font-medium text-slate-200">{formatDate(team.created)}</span>
            </div>
          )}

          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/30 backdrop-blur-sm">
            <span className="text-sm text-slate-400">Выполнено проектов:</span>
            <span className="text-sm font-semibold text-slate-100">
              {projectStats.completedProjectsCount}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-slate-800/30 backdrop-blur-sm space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-slate-400">Среднее время выполнения:</span>
              <span className="text-sm font-medium text-slate-200 shrink-0">
                {formatAvgCompletionDays(avgCompletionDays)}
              </span>
            </div>
            <div
              className="inline-flex rounded-lg border border-slate-600/60 bg-slate-900/40 p-0.5"
              role="group"
              aria-label="Тип среднего времени"
            >
              {[
                { id: 'project', label: 'Проект' },
                { id: 'task', label: 'Задачи' },
              ].map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setAvgTimeMode(option.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    avgTimeMode === option.id
                      ? 'bg-slate-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  aria-pressed={avgTimeMode === option.id}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/30 backdrop-blur-sm">
            <span className="text-sm text-slate-400">Активный проект:</span>
            <span
              className={`text-sm font-medium text-right max-w-[58%] truncate ${
                projectStats.hasActiveProject ? 'text-emerald-300' : 'text-slate-400'
              }`}
              title={formatActiveProjectLabel(projectStats)}
            >
              {formatActiveProjectLabel(projectStats)}
            </span>
          </div>
        </div>

        {team.tags && team.tags.length > 0 && (
          <div className="mt-4">
            <div className="flex flex-wrap gap-2">
              {team.tags.map((tag, index) => (
                <span
                  key={index}
                  className="px-2 py-1 text-xs font-medium bg-slate-700/50 text-slate-300 rounded-md border border-slate-600/50"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {showDetails && (
          <div className="mt-6 pt-6 border-t border-slate-700/50 space-y-6">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                  <IconWithText icon={TeamsIcon}>Участники команды</IconWithText>
                </h4>
                {canManage && (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => setShowAddMemberModal(true)}
                  >
                    <IconWithText icon={PlusIconSm}>Добавить</IconWithText>
                  </button>
                )}
              </div>

              {detailsLoading ? (
                <p className="text-slate-400 text-sm">Загрузка участников...</p>
              ) : team.members && team.members.length > 0 ? (
                <div className="space-y-3">
                  {team.members.map((member) => {
                    const name = memberDisplayName(member);
                    return (
                      <div key={member.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/40 backdrop-blur-sm border border-slate-700/50">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-slate-600 to-slate-700 flex items-center justify-center text-white font-semibold text-sm">
                            {name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="text-sm font-medium text-slate-200">{name}</span>
                            {member.user_email && (
                              <div className="text-xs text-slate-500">{member.user_email}</div>
                            )}
                            <div className="text-xs text-slate-400">{member.role}</div>
                          </div>
                        </div>
                        {canManage && (
                          <button
                            className="btn btn-ghost btn-sm text-red-400 hover:text-red-300"
                            onClick={() => handleRemoveMember(member.user_id)}
                            title="Удалить участника"
                          >
                            <CloseIcon size="xs" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-slate-400 text-sm">Участники не найдены</p>
              )}
            </div>

            {team.tasks && team.tasks.length > 0 && (
              <div>
                <h4 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
                  <IconWithText icon={TasksIcon}>Задачи команды</IconWithText>
                </h4>
                <div className="space-y-3">
                  {team.tasks.map((task) => (
                    <div key={task.id} className="p-3 rounded-lg bg-slate-800/40 backdrop-blur-sm border border-slate-700/50">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-slate-200">{task.title}</span>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(task.status)} text-white`}>
                          {task.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-400">
                        <span>Приоритет: {task.priority}</span>
                        {task.due_date && (
                          <span>Срок: {formatDate(task.due_date)}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card-footer">
        <div className="team-stats">
          {team.tasks && (
            <span className="text-sm text-slate-400">
              <IconWithText icon={TasksIcon}>
                {team.tasks.length} задач
              </IconWithText>
            </span>
          )}
        </div>

        {canManage && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowEditModal(true)}
              className="btn btn-outline btn-sm"
              title="Редактировать команду"
            >
              <IconWithText icon={EditIcon}>Изменить</IconWithText>
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="btn btn-danger btn-sm inline-flex items-center justify-center"
              title="Удалить команду"
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
    </div>
  );
};

export default TeamCard;
