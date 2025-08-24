import React, { useState } from 'react';
import { teamService } from '../../../services/teamService';
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
    switch (status) {
      case 'active': return '#10b981';
      case 'inactive': return '#6b7280';
      case 'archived': return '#f59e0b';
      case 'disbanded': return '#ef4444';
      default: return '#6b7280';
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
    if (!dateString) return 'Не указана';
    return new Date(dateString).toLocaleDateString('ru-RU');
  };

  return (
    <div className="team-card">
      <div className="team-card-header">
        <h3 className="team-name">{team.name}</h3>
        <div 
          className="team-status"
          style={{ backgroundColor: getStatusColor(team.status) }}
        >
          {getStatusText(team.status)}
        </div>
      </div>

      <div className="team-card-body">
        {team.description && (
          <p className="team-description">{team.description}</p>
        )}

        <div className="team-info">
          <div className="info-item">
            <span className="info-label">Участников:</span>
            <span className="info-value">{team.member_count}</span>
          </div>
          
          {team.auto_disband_date && (
            <div className="info-item">
              <span className="info-label">Авторасформирование:</span>
              <span className="info-value">{formatDate(team.auto_disband_date)}</span>
            </div>
          )}

          {team.tags && team.tags.length > 0 && (
            <div className="team-tags">
              {team.tags.map((tag, index) => (
                <span key={index} className="tag">{tag}</span>
              ))}
            </div>
          )}
        </div>

        <div className="team-actions">
          <button 
            className="btn btn-secondary"
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? 'Скрыть' : 'Подробнее'}
          </button>
          
          <button 
            className="btn btn-primary"
            onClick={() => setShowEditModal(true)}
          >
            Редактировать
          </button>
          
          <button 
            className="btn btn-danger"
            onClick={handleDelete}
          >
            Удалить
          </button>
        </div>
      </div>

      {showDetails && (
        <div className="team-details">
          <div className="members-section">
            <h4>Участники команды</h4>
            <div className="members-list">
              {team.members.map(member => (
                <div key={member.id} className="member-item">
                  <span className="member-name">{member.username}</span>
                  <span className="member-role">{member.role}</span>
                  <button 
                    className="remove-member-btn"
                    onClick={() => handleRemoveMember(member.user_id)}
                    disabled={member.role === 'owner'}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            
            <button 
              className="btn btn-primary add-member-btn"
              onClick={() => setShowAddMemberModal(true)}
            >
              Добавить участника
            </button>
          </div>

          {team.tasks && team.tasks.length > 0 && (
            <div className="tasks-section">
              <h4>Задачи команды</h4>
              <div className="tasks-list">
                {team.tasks.map(task => (
                  <div key={task.id} className="task-item">
                    <span className="task-title">{task.title}</span>
                    <span className="task-status">{task.status}</span>
                    <span className="task-priority">{task.priority}</span>
                    {task.due_date && (
                      <span className="task-due-date">
                        {formatDate(task.due_date)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Модальные окна будут добавлены позже */}
      {showEditModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Редактировать команду</h3>
            {/* Форма редактирования */}
            <div className="modal-actions">
              <button onClick={() => setShowEditModal(false)}>Отмена</button>
              <button onClick={() => handleUpdate({})}>Сохранить</button>
            </div>
          </div>
        </div>
      )}

      {showAddMemberModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Добавить участника</h3>
            {/* Форма добавления участника */}
            <div className="modal-actions">
              <button onClick={() => setShowAddMemberModal(false)}>Отмена</button>
              <button onClick={() => handleAddMember({})}>Добавить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamCard;
