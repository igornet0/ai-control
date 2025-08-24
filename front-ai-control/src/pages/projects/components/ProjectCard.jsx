import React, { useState } from 'react';
import './ProjectCard.css';

const ProjectCard = ({ project, onDelete, onUpdate }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const getStatusColor = (status) => {
    const statusColors = {
      'planning': 'bg-gray-500',
      'active': 'bg-green-500',
      'on_hold': 'bg-yellow-500',
      'completed': 'bg-blue-500',
      'cancelled': 'bg-red-500',
      'archived': 'bg-gray-700'
    };
    return statusColors[status] || 'bg-gray-500';
  };

  const getPriorityColor = (priority) => {
    const priorityColors = {
      'low': 'bg-gray-400',
      'medium': 'bg-blue-400',
      'high': 'bg-yellow-400',
      'critical': 'bg-orange-400',
      'urgent': 'bg-red-400'
    };
    return priorityColors[priority] || 'bg-gray-400';
  };

  const getStatusText = (status) => {
    const statusTexts = {
      'planning': 'Планирование',
      'active': 'Активный',
      'on_hold': 'На паузе',
      'completed': 'Завершен',
      'cancelled': 'Отменен',
      'archived': 'Архивный'
    };
    return statusTexts[status] || status;
  };

  const getPriorityText = (priority) => {
    const priorityTexts = {
      'low': 'Низкий',
      'medium': 'Средний',
      'high': 'Высокий',
      'critical': 'Критический',
      'urgent': 'Срочный'
    };
    return priorityTexts[priority] || priority;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Не указана';
    return new Date(dateString).toLocaleDateString('ru-RU');
  };

  return (
    <div className="project-card">
      <div className="card-header">
        <div className="project-title">
          <h3>{project.name}</h3>
          <div className="project-badges">
            <span className={`status-badge ${getStatusColor(project.status)}`}>
              {getStatusText(project.status)}
            </span>
            <span className={`priority-badge ${getPriorityColor(project.priority)}`}>
              {getPriorityText(project.priority)}
            </span>
          </div>
        </div>
        <div className="project-actions">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="expand-btn"
            title={isExpanded ? 'Свернуть' : 'Развернуть'}
          >
            {isExpanded ? '▼' : '▶'}
          </button>
        </div>
      </div>

      <div className="card-body">
        {project.description && (
          <p className="project-description">
            {project.description}
          </p>
        )}

        <div className="project-info">
          <div className="info-row">
            <span className="info-label">Менеджер:</span>
            <span className="info-value">
              {project.manager_name || 'Не назначен'}
            </span>
          </div>
          
          <div className="info-row">
            <span className="info-label">Дата начала:</span>
            <span className="info-value">
              {formatDate(project.start_date)}
            </span>
          </div>
          
          <div className="info-row">
            <span className="info-label">Срок:</span>
            <span className="info-value">
              {formatDate(project.due_date)}
            </span>
          </div>
          
          <div className="info-row">
            <span className="info-label">Прогресс:</span>
            <span className="info-value">
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${project.progress}%` }}
                ></div>
              </div>
              <span className="progress-text">{project.progress}%</span>
            </span>
          </div>

          {project.budget && (
            <div className="info-row">
              <span className="info-label">Бюджет:</span>
              <span className="info-value">
                {project.budget.toLocaleString()} ₽
              </span>
            </div>
          )}
        </div>

        {project.tags && project.tags.length > 0 && (
          <div className="project-tags">
            {project.tags.map((tag, index) => (
              <span key={index} className="tag">
                {tag}
              </span>
            ))}
          </div>
        )}

        {isExpanded && (
          <div className="expanded-content">
            {/* Задачи проекта */}
            <div className="project-tasks">
              <h4>Задачи проекта ({project.task_count})</h4>
              {project.tasks && project.tasks.length > 0 ? (
                <div className="tasks-list">
                  {project.tasks.map(task => (
                    <div key={task.id} className="task-item">
                      <div className="task-header">
                        <span className="task-title">{task.title}</span>
                        <span className={`task-status ${getStatusColor(task.status)}`}>
                          {getStatusText(task.status)}
                        </span>
                      </div>
                      <div className="task-details">
                        <span className="task-priority">
                          {getPriorityText(task.priority)}
                        </span>
                        {task.executor_name && (
                          <span className="task-executor">
                            Исполнитель: {task.executor_name}
                          </span>
                        )}
                        {task.due_date && (
                          <span className="task-due">
                            Срок: {formatDate(task.due_date)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="no-tasks">Задачи не созданы</p>
              )}
            </div>

            {/* Команды проекта */}
            <div className="project-teams">
              <h4>Команды проекта ({project.team_count})</h4>
              {project.teams && project.teams.length > 0 ? (
                <div className="teams-list">
                  {project.teams.map(team => (
                    <div key={team.id} className="team-item">
                      <div className="team-header">
                        <span className="team-name">{team.team_name}</span>
                        <span className="team-role">{team.role}</span>
                      </div>
                      <div className="team-details">
                        <span className="team-joined">
                          Присоединилась: {formatDate(team.joined_at)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="no-teams">Команды не назначены</p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="card-footer">
        <div className="project-stats">
          <span className="stat">
            📋 {project.task_count} задач
          </span>
          <span className="stat">
            👥 {project.team_count} команд
          </span>
        </div>
        
        <div className="project-actions">
          <button
            onClick={() => onUpdate(project.id, { status: 'completed' })}
            className="complete-btn"
            title="Завершить проект"
          >
            ✅ Завершить
          </button>
          
          <button
            onClick={() => onDelete(project.id)}
            className="delete-btn"
            title="Удалить проект"
          >
            🗑️ Удалить
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProjectCard;
