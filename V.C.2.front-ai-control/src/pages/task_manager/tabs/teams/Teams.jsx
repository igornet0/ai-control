import React, { useState, useEffect } from 'react';
import { teamService } from '../../../../services/teamService';
import { projectService } from '../../../../services/projectService';
import { getTasks } from '../../../../services/taskService';
import useAuth from '../../../../hooks/useAuth';
import CreateTeamModal from './components/CreateTeamModal';
import TeamCard from './components/TeamCard';
import styles from './Teams.module.css';
import {
  CloseIcon,
  CreateIcon,
  IconWithText,
  SearchInput,
  TeamsIcon,
  UserSingleIcon,
} from '../../components/TaskManagerIcons';
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
    if (window.confirm('Вы уверены, что хотите удалить эту команду? Это действие нельзя отменить.')) {
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
    return (
      <div className={styles['teams-container']}>
        <div className={styles['loading']}>Загрузка команд...</div>
      </div>
    );
  }

  const myTeamsCount = user
    ? teams.filter((team) => isUserTeamMember(team, user.id)).length
    : 0;
  const allowCreateTeam = canUserCreateTeam(user);

  return (
    <div className="mt-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div className="animate-slideInLeft">
          <h1 className="text-3xl font-bold text-slate-100 tracking-tight flex items-center gap-3">
            <TeamsIcon size="lg" className="text-indigo-400" />
            Управление командами
          </h1>
          <p className="text-slate-400 mt-1">Создавайте и координируйте рабочие группы</p>
          {user ? (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-sm text-slate-500">Мои команды:</span>
              <span className="px-2 py-1 bg-slate-700/50 text-slate-300 text-sm font-medium rounded-md">
                {myTeamsCount}
              </span>
            </div>
          ) : (
            <div className="mt-2">
              <span className="text-sm text-slate-500">Загрузка пользователя...</span>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-3 animate-slideInRight">
          {user ? (
            <button
              onClick={() => setShowMyTeams(!showMyTeams)}
              className={`btn ${showMyTeams ? 'btn-primary' : 'btn-outline'} transition-all duration-300`}
              title={showMyTeams ? 'Показать все команды' : 'Показать только мои команды'}
            >
              {showMyTeams ? (
                <IconWithText icon={TeamsIcon}>Все команды</IconWithText>
              ) : (
                <IconWithText icon={UserSingleIcon}>Мои команды</IconWithText>
              )}
            </button>
          ) : (
            <button
              className="btn btn-outline opacity-50 cursor-not-allowed"
              disabled
              title="Загрузка пользователя..."
            >
              <IconWithText icon={UserSingleIcon}>Мои команды</IconWithText>
            </button>
          )}
          {allowCreateTeam && (
            <button
              className="btn btn-primary"
              onClick={() => setShowCreateModal(true)}
            >
              <IconWithText icon={CreateIcon}>Создать команду</IconWithText>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-gradient-to-r from-red-500/20 to-rose-600/20 border border-red-500/30 text-red-300 p-4 rounded-xl mb-6 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-red-300 hover:text-red-100 transition-colors"
            >
              <CloseIcon size="sm" />
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <SearchInput
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Поиск по названию или описанию..."
            inputClassName="form-input w-full"
          />
        </div>

        <div className="sm:w-48">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="form-input w-full"
          >
            <option value="">Все статусы</option>
            <option value="active">Активные</option>
            <option value="inactive">Неактивные</option>
            <option value="archived">Архивные</option>
            <option value="disbanded">Расформированные</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredTeams.length === 0 ? (
          <div className="col-span-full text-center py-16">
            <TeamsIcon size="4xl" className="mb-4 opacity-50 mx-auto text-slate-500" />
            <div className="text-slate-400 text-lg mb-2">
              {!user
                ? 'Загрузка пользователя...'
                : showMyTeams
                  ? 'Вы не состоите ни в одной команде'
                  : searchTerm || statusFilter
                    ? 'Команды не найдены'
                    : 'Команды не созданы'}
            </div>
            {!showMyTeams && !searchTerm && !statusFilter && allowCreateTeam && (
              <p className="text-slate-500 text-sm">Создайте первую команду для начала работы</p>
            )}
          </div>
        ) : (
          filteredTeams.map((team, index) => (
            <div
              key={team.id}
              className="animate-fadeIn"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <TeamCard
                team={team}
                projects={projects}
                catalogTasks={catalogTasks}
                canManage={canUserManageTeam(team, user)}
                onDelete={handleDeleteTeam}
                onUpdate={handleUpdateTeam}
                onRefresh={handleRefreshTeam}
              />
            </div>
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
