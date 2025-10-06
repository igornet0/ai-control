import React, { useState } from 'react';
import { teamService } from '../../../../../services/teamService';
import EditTeamModal from './EditTeamModal';
import styles from './TeamCard.module.css';

const TeamCard = ({ team, onDelete, onUpdate }) => {
  const [showDetails, setShowDetails] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleDelete = () => {
    onDelete(team.id);
  };

  const handleUpdate = async (updatedData) => {
    await onUpdate(team.id, updatedData);
    setShowEditModal(false);
  };

  const handleAddMember = async (memberData) => {
    try {
      setLoading(true);
      await teamService.addTeamMember(team.id, memberData);
      // Перезагружаем данные команды
      const updatedTeam = await teamService.getTeam(team.id);
      onUpdate(team.id, updatedTeam);
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
        // Перезагружаем данные команды
        const updatedTeam = await teamService.getTeam(team.id);
        onUpdate(team.id, updatedTeam);
      } catch (error) {
        console.error('Error removing member:', error);
      }
    }
  };

  const getStatusColor = (status) => {
    const statusColors = {
      'active': 'bg-slate-500',
      'inactive': 'bg-gray-500',
      'archived': 'bg-amber-500',
      'disbanded': 'bg-red-500'
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

  return (
    <div className="card animate-fadeIn hover-lift">
      <div className="card-header">
        <div className="team-title">
          <h3 className="text-lg font-semibold text-slate-100">{team.name}</h3>
          <div className="team-badges">
            <span className={`badge ${getStatusColor(team.status)} text-white px-3 py-1 rounded-full text-xs font-medium`}>
              {getStatusText(team.status)}
            </span>
          </div>
        </div>
        <div className="team-actions">
          <button
            onClick={() => setShowDetails(!showDetails)}
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
            <span className="text-sm font-semibold text-slate-100">{team.member_count || 0}</span>
          </div>
          
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/30 backdrop-blur-sm">
            <span className="text-sm text-slate-400">Авторасформирование:</span>
            <span className="text-sm font-medium text-slate-200">{formatDate(team.auto_disband_date)}</span>
          </div>

          {team.created_at && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/30 backdrop-blur-sm">
              <span className="text-sm text-slate-400">Создана:</span>
              <span className="text-sm font-medium text-slate-200">{formatDate(team.created_at)}</span>
            </div>
          )}
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
            {/* Участники команды */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                  👥 Участники команды
                </h4>
                <button 
                  className="btn btn-primary btn-sm"
                  onClick={() => setShowAddMemberModal(true)}
                >
                  ➕ Добавить
                </button>
              </div>
              
              {team.members && team.members.length > 0 ? (
                <div className="space-y-3">
                  {team.members.map(member => (
                    <div key={member.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/40 backdrop-blur-sm border border-slate-700/50">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-slate-600 to-slate-700 flex items-center justify-center text-white font-semibold text-sm">
                          {member.username ? member.username.charAt(0).toUpperCase() : '?'}
                        </div>
                        <div>
                          <span className="text-sm font-medium text-slate-200">{member.username}</span>
                          <div className="text-xs text-slate-400">{member.role}</div>
                        </div>
                      </div>
                      {member.role !== 'owner' && (
                        <button 
                          className="btn btn-ghost btn-sm text-red-400 hover:text-red-300"
                          onClick={() => handleRemoveMember(member.user_id)}
                          title="Удалить участника"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400 text-sm">Участники не найдены</p>
              )}
            </div>

            {/* Задачи команды */}
            {team.tasks && team.tasks.length > 0 && (
              <div>
                <h4 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
                  📋 Задачи команды
                </h4>
                <div className="space-y-3">
                  {team.tasks.map(task => (
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
          <span className="text-sm text-slate-400">
            👥 {team.member_count || 0} участников
          </span>
          {team.tasks && (
            <span className="text-sm text-slate-400">
              📋 {team.tasks.length} задач
            </span>
          )}
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => setShowEditModal(true)}
            className="btn btn-outline btn-sm"
            title="Редактировать команду"
          >
            ✏️ Изменить
          </button>
          <button
            onClick={handleDelete}
            className="btn btn-danger btn-sm"
            title="Удалить команду"
          >
            🗑️ Удалить
          </button>
        </div>
      </div>

      {/* Модальное окно редактирования команды */}
      {showEditModal && (
        <EditTeamModal
          team={team}
          onClose={() => setShowEditModal(false)}
          onSubmit={handleUpdate}
        />
      )}

      {showAddMemberModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Добавить участника</h2>
              <button
                onClick={() => setShowAddMemberModal(false)}
                className="close-btn"
              >
                ×
              </button>
            </div>
            <div className="task-form">
              <p className="text-slate-300 mb-4">Форма добавления участника будет реализована позже</p>
              <div className="form-actions">
                <button 
                  onClick={() => setShowAddMemberModal(false)}
                  className="cancel-btn"
                >
                  Отмена
                </button>
                <button 
                  onClick={() => handleAddMember({})}
                  className="submit-btn"
                  disabled={loading}
                >
                  {loading ? 'Добавление...' : 'Добавить'}
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
