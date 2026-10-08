import React, { useState, useEffect } from 'react';
import { teamService } from '../../../../services/teamService';
import { projectService } from '../../../../services/projectService';
import { getTasks } from '../../../../services/taskService';
import useAuth from '../../../../hooks/useAuth';
import CreateTeamModal from './components/CreateTeamModal';
import TeamCard from './components/TeamCard';
import {
  CloseIcon,
  PlusIconSm,
  SearchIcon,
  TeamsIcon,
} from '../../components/TaskManagerIcons';
import { confirmAction } from '../../../../components/shared/confirmAction';
import '../tmPage.css';

const pluralize = (n, one, few, many) => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
};
import { canUserCreateTeam, canUserManageTeam } from './teamPermissions';

const isUserTeamMember = (team, userId) =>
  team.creator_id === userId ||
  team.members?.some((member) => member.user_id === userId && member.is_active !== false);

const canViewAllTeams = (user) => {
  if (!user) return false;
  if (user.is_superuser) return true;
  const role = String(user.role || '').toLowerCase();
  if (role === 'admin' || role === 'ceo') return true;
  const executiveRoles = ['CEO', 'CTO', 'COO', 'CFO', 'CPO', 'CMO'];
  return executiveRoles.includes(user.team_role);
};

const normalizeTeamsList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.teams)) return data.teams;
  return null;
};

const getTeamStatus = (team) =>
  team.status ?? (team.is_active !== false ? 'active' : 'inactive');

const Teams = () => {
  const [teams, setTeams] = useState([]);
  const [projects, setProjects] = useState([]);
  const [catalogTasks, setCatalogTasks] = useState([]);
  const [filteredTeams, setFilteredTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showMyTeams, setShowMyTeams] = useState(false);

  const { user, loading: userLoading } = useAuth();

  const loadTeams = async () => {
    try {
      setLoading(true);
      const params = { include_members: true };
      if (canViewAllTeams(user)) {
        params.all = true;
      }
      const [teamsData, projectsData, tasksData] = await Promise.all([
        teamService.getTeams(params),
        projectService.getProjects().catch(() => []),
        getTasks().catch(() => []),
      ]);
      const list = normalizeTeamsList(teamsData);

      if (list) {
        setTeams(list);
        setFilteredTeams(list);
        setProjects(Array.isArray(projectsData) ? projectsData : []);
        setCatalogTasks(Array.isArray(tasksData) ? tasksData : []);
        setError(null);
      } else {
        setError('Неверный формат данных команд');
        setTeams([]);
        setFilteredTeams([]);
        setProjects([]);
        setCatalogTasks([]);
      }
    } catch (err) {
      setError(`Ошибка при загрузке команд: ${err.message}`);
      setTeams([]);
      setFilteredTeams([]);
      setProjects([]);
      setCatalogTasks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!userLoading) {
      loadTeams();
    }
  }, [user?.id, userLoading]);

  useEffect(() => {
    let filtered = teams;

    if (showMyTeams && user) {
      filtered = filtered.filter((team) => isUserTeamMember(team, user.id));
    }

    if (searchTerm) {
      filtered = filtered.filter(
        (team) =>
          (team.name && team.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (team.description && team.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    if (statusFilter) {
      filtered = filtered.filter((team) => getTeamStatus(team) === statusFilter);
    }

    setFilteredTeams(filtered);
  }, [teams, searchTerm, statusFilter, showMyTeams, user]);

  const handleCreateTeam = async (teamData) => {
    try {
      const { member_ids = [], no_deadline, is_public, tags, auto_disband_date, ...createPayload } = teamData;

      const team = await teamService.createTeam({
        name: createPayload.name,
        description: createPayload.description || null,
        department_id: createPayload.department_id ?? null,
      });

      for (const userId of member_ids) {
        await teamService.addTeamMember(team.id, { user_id: userId, role: 'member' });
      }

      const fullTeam = await teamService.getTeam(team.id);
      setTeams((prev) => [fullTeam, ...prev]);
      setShowCreateModal(false);
      setError(null);
    } catch (err) {
      setError('Ошибка при создании команды');
      console.error('Error creating team:', err);
    }
  };

  const handleDeleteTeam = async (teamId) => {
    const team = teams.find((item) => item.id === teamId);
    const confirmed = await confirmAction({
      title: team ? `Удалить команду «${team.name}»?` : 'Удалить команду?',
      message: 'Это действие нельзя отменить.',
      confirmLabel: 'Удалить',
      danger: true,
    });
    if (confirmed) {
      try {
        await teamService.deleteTeam(teamId);
        setTeams((prev) => prev.filter((team) => team.id !== teamId));
        setError(null);
      } catch (err) {
        setError('Ошибка при удалении команды');
        console.error('Error deleting team:', err);
      }
    }
  };

  const handleUpdateTeam = async (teamId, teamData) => {
    try {
      const updatedTeam = await teamService.updateTeam(teamId, {
        name: teamData.name,
        description: teamData.description ?? null,
        department_id: teamData.department_id ?? null,
      });
      setTeams((prev) =>
        prev.map((team) =>
          team.id === teamId ? { ...team, ...updatedTeam } : team
        )
      );
      setError(null);
    } catch (err) {
      setError('Ошибка при обновлении команды');
      console.error('Error updating team:', err);
    }
  };

  const handleRefreshTeam = (teamId, fullTeam) => {
    setTeams((prev) =>
      prev.map((team) => (team.id === teamId ? fullTeam : team))
    );
  };

  if (loading || userLoading) {
    return <div className="tm-loading">Загрузка команд…</div>;
  }

  const myTeamsCount = user
    ? teams.filter((team) => isUserTeamMember(team, user.id)).length
    : 0;
  const allowCreateTeam = canUserCreateTeam(user);
  const hasFilters = Boolean(searchTerm || statusFilter);

  return (
    <div className="teams-page">
      <header className="tm-page-header">
        <div>
          <h1 className="tm-page-header__title">
            <TeamsIcon size="lg" className="text-indigo-400" />
            Команды
          </h1>
          <p className="tm-page-header__subtitle">
            <strong>{teams.length}</strong> {pluralize(teams.length, 'команда', 'команды', 'команд')}
            {user && <> · вы в <strong>{myTeamsCount}</strong></>}
          </p>
        </div>
        {allowCreateTeam && (
          <div className="tm-page-header__actions">
            <button type="button" className="tm-btn tm-btn--primary" onClick={() => setShowCreateModal(true)}>
              <PlusIconSm size="sm" />
              Новая команда
            </button>
          </div>
        )}
      </header>

      {error && (
        <div className="tm-banner tm-banner--error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Скрыть"><CloseIcon size="sm" /></button>
        </div>
      )}

      <div className="tm-toolbar">
        <div className="tm-segmented" role="tablist" aria-label="Какие команды показывать">
          {[
            { id: false, label: 'Все' },
            { id: true, label: 'Мои' },
          ].map((option) => (
            <button
              key={String(option.id)}
              type="button"
              role="tab"
              aria-selected={showMyTeams === option.id}
              disabled={!user}
              className={`tm-segmented__btn ${showMyTeams === option.id ? 'tm-segmented__btn--active' : ''}`}
              onClick={() => setShowMyTeams(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="tm-search">
          <SearchIcon size="sm" className="tm-search__icon" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Поиск по названию или описанию…"
            className="tm-input"
            aria-label="Поиск команд"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={`tm-select ${statusFilter ? 'tm-select--active' : ''}`}
          aria-label="Статус"
        >
          <option value="">Все статусы</option>
          <option value="active">Активные</option>
          <option value="inactive">Неактивные</option>
          <option value="archived">Архивные</option>
          <option value="disbanded">Расформированные</option>
        </select>

        {hasFilters && (
          <button
            type="button"
            className="tm-toolbar__reset"
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('');
            }}
          >
            Сбросить
          </button>
        )}
      </div>

      <div className="tm-grid">
        {filteredTeams.length === 0 ? (
          <div className="tm-empty">
            <TeamsIcon size="2xl" className="text-slate-500" />
            <span>
              {!user
                ? 'Загрузка пользователя…'
                : showMyTeams
                  ? 'Вы не состоите ни в одной команде'
                  : hasFilters
                    ? 'Ничего не найдено'
                    : 'Команд пока нет'}
            </span>
            {!showMyTeams && !hasFilters && allowCreateTeam && (
              <span className="tm-empty__hint">Создайте первую команду — кнопка «Новая команда» вверху</span>
            )}
          </div>
        ) : (
          filteredTeams.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              projects={projects}
              catalogTasks={catalogTasks}
              canManage={canUserManageTeam(team, user)}
              onDelete={handleDeleteTeam}
              onUpdate={handleUpdateTeam}
              onRefresh={handleRefreshTeam}
            />
          ))
        )}
      </div>

      {showCreateModal && (
        <CreateTeamModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateTeam}
        />
      )}
    </div>
  );
};

export default Teams;
