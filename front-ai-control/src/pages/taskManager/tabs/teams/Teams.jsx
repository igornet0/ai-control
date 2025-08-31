import React, { useState, useEffect } from 'react';
import { teamService } from '../../../../services/teamService';
import { useNavigate } from 'react-router-dom';
import useAuth from '../../../../hooks/useAuth';
import CreateTeamModal from './components/CreateTeamModal';
import TeamCard from './components/TeamCard';
import styles from './Teams.module.css';

const Teams = () => {
  const [teams, setTeams] = useState([]);
  const [filteredTeams, setFilteredTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showMyTeams, setShowMyTeams] = useState(false);
  
  const navigate = useNavigate();
  const { user, loading: userLoading } = useAuth();

  // Загрузка команд
  const loadTeams = async () => {
    try {
      setLoading(true);
      console.log('Loading teams...');
      const teamsData = await teamService.getTeams();
      console.log('Teams loaded:', teamsData);
      
      // Проверяем, что teamsData это массив
      if (Array.isArray(teamsData)) {
        setTeams(teamsData);
        setFilteredTeams(teamsData);
        setError(null);
      } else {
        console.error('Teams data is not an array:', teamsData);
        setError('Неверный формат данных команд');
        setTeams([]);
        setFilteredTeams([]);
      }
    } catch (err) {
      console.error('Error loading teams:', err);
      setError(`Ошибка при загрузке команд: ${err.message}`);
      setTeams([]);
      setFilteredTeams([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeams();
  }, []);

  // Логирование для отладки
  useEffect(() => {
    console.log('User state:', user);
    console.log('User loading:', userLoading);
  }, [user, userLoading]);

  // Фильтрация команд
  useEffect(() => {
    console.log('Filtering teams...', { teams, searchTerm, statusFilter, showMyTeams, user });
    let filtered = teams;

    // Фильтр "My Teams" - показываем только команды пользователя
    if (showMyTeams && user) {
      filtered = filtered.filter(team => {
        return team.members && team.members.some(member => 
          member.user_id === user.id && member.is_active
        );
      });
    }

    if (searchTerm) {
      filtered = filtered.filter(team =>
        (team.name && team.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (team.description && team.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    if (statusFilter) {
      filtered = filtered.filter(team => team.status === statusFilter);
    }

    console.log('Filtered teams:', filtered);
    setFilteredTeams(filtered);
  }, [teams, searchTerm, statusFilter, showMyTeams, user]);

  // Создание команды
  const handleCreateTeam = async (teamData) => {
    try {
      const newTeam = await teamService.createTeam(teamData);
      setTeams(prev => [newTeam, ...prev]);
      setShowCreateModal(false);
      setError(null);
    } catch (err) {
      setError('Ошибка при создании команды');
      console.error('Error creating team:', err);
    }
  };

  // Удаление команды
  const handleDeleteTeam = async (teamId) => {
    if (window.confirm('Вы уверены, что хотите удалить эту команду? Это действие нельзя отменить.')) {
      try {
        await teamService.deleteTeam(teamId);
        setTeams(prev => prev.filter(team => team.id !== teamId));
        setError(null);
      } catch (err) {
        setError('Ошибка при удалении команды');
        console.error('Error deleting team:', err);
      }
    }
  };

  // Обновление команды
  const handleUpdateTeam = async (teamId, teamData) => {
    try {
      const updatedTeam = await teamService.updateTeam(teamId, teamData);
      setTeams(prev => prev.map(team => 
        team.id === teamId ? updatedTeam : team
      ));
      setError(null);
    } catch (err) {
      setError('Ошибка при обновлении команды');
      console.error('Error updating team:', err);
    }
  };

  if (loading || userLoading) {
    console.log('Showing loading state...');
    return (
      <div className={styles['teams-container']}>
        <div className={styles['loading']}>Загрузка команд...</div>
      </div>
    );
  }

  console.log('Rendering teams page...', { teams, filteredTeams, user, error });

  return (
    <div className="mt-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div className="animate-slideInLeft">
          <h1 className="text-3xl font-bold text-slate-100 tracking-tight flex items-center gap-3">
            👥 Управление командами
          </h1>
          <p className="text-slate-400 mt-1">Создавайте и координируйте рабочие группы</p>
          {user ? (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-sm text-slate-500">Мои команды:</span>
              <span className="px-2 py-1 bg-slate-700/50 text-slate-300 text-sm font-medium rounded-md">
                {teams.filter(team => 
                  team.members && team.members.some(member => 
                    member.user_id === user.id && member.is_active
                  )
                ).length}
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
              title={showMyTeams ? "Показать все команды" : "Показать только мои команды"}
            >
              {showMyTeams ? '👥 Все команды' : '👤 Мои команды'}
            </button>
          ) : (
            <button 
              className="btn btn-outline opacity-50 cursor-not-allowed"
              disabled
              title="Загрузка пользователя..."
            >
              👤 Мои команды
            </button>
          )}
          <button 
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            ✨ Создать команду
          </button>
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
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <input
            type="text"
            placeholder="🔍 Поиск по названию или описанию..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="form-input w-full"
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
            <div className="text-6xl mb-4 opacity-50">👥</div>
            <div className="text-slate-400 text-lg mb-2">
              {!user ? 'Загрузка пользователя...' :
                showMyTeams 
                  ? 'Вы не состоите ни в одной команде' 
                  : searchTerm || statusFilter 
                    ? 'Команды не найдены' 
                    : 'Команды не созданы'
              }
            </div>
            {!showMyTeams && !searchTerm && !statusFilter && (
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
                onDelete={handleDeleteTeam}
                onUpdate={handleUpdateTeam}
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
