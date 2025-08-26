import React, { useState, useEffect } from 'react';
import { teamService } from '../../services/teamService';
import { useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
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
    <div className={styles['teams-container']}>
      <div className={styles['teams-header']}>
        <div className={styles['header-left']}>
          <button 
            className={styles['back-btn']}
            onClick={() => navigate('/tasks')}
            title="Вернуться к задачам"
          >
            ← К задачам
          </button>
          <div className={styles['title-section']}>
            <h1>Команды</h1>
            {user ? (
              <div className={styles['teams-counter']}>
                <span className={styles['counter-label']}>Мои команды:</span>
                <span className={styles['counter-value']}>
                  {teams.filter(team => 
                    team.members && team.members.some(member => 
                      member.user_id === user.id && member.is_active
                    )
                  ).length}
                </span>
              </div>
            ) : (
              <div className={styles['teams-counter']}>
                <span className={styles['counter-label']}>Загрузка пользователя...</span>
              </div>
            )}
          </div>
        </div>
        <div className={styles['header-actions']}>
          {user ? (
            <button 
              onClick={() => setShowMyTeams(!showMyTeams)}
              className={`${styles['my-teams-btn']} ${showMyTeams ? styles['my-teams-active'] : ''}`}
              title={showMyTeams ? "Показать все команды" : "Показать только мои команды"}
            >
              {showMyTeams ? '👥 Все команды' : '👤 Мои команды'}
            </button>
          ) : (
            <button 
              className={`${styles['my-teams-btn']} ${styles['my-teams-disabled']}`}
              disabled
              title="Загрузка пользователя..."
            >
              👤 Мои команды
            </button>
          )}
          <button 
            className={styles['create-team-btn']}
            onClick={() => setShowCreateModal(true)}
          >
            Создать команду
          </button>
        </div>
      </div>

      {error && (
        <div className={styles['error-message']}>
          {error}
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      <div className={styles['teams-filters']}>
        <div className={styles['search-box']}>
          <input
            type="text"
            placeholder="Поиск по названию или описанию..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles['search-input']}
          />
        </div>

        <div className={styles['status-filter']}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={styles['status-select']}
          >
            <option value="">Все статусы</option>
            <option value="active">Активные</option>
            <option value="inactive">Неактивные</option>
            <option value="archived">Архивные</option>
            <option value="disbanded">Расформированные</option>
          </select>
        </div>
      </div>

      <div className={styles['teams-grid']}>
        {filteredTeams.length === 0 ? (
          <div className={styles['no-teams']}>
            {!user ? 'Загрузка пользователя...' :
              showMyTeams 
                ? 'Вы не состоите ни в одной команде' 
                : searchTerm || statusFilter 
                  ? 'Команды не найдены' 
                  : 'Команды не созданы'
            }
          </div>
        ) : (
          filteredTeams.map(team => (
            <TeamCard
              key={team.id}
              team={team}
              onDelete={handleDeleteTeam}
              onUpdate={handleUpdateTeam}
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
