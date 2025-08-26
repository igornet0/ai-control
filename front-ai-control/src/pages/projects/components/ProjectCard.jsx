import React, { useEffect, useMemo, useState } from 'react';
import { projectService } from '../../../services/projectService';
import { getTasks } from '../../../services/taskService';
import useAuth from '../../../hooks/useAuth';
import './ProjectCard.css';

const ProjectCard = ({ project, onDelete, onUpdate }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { user } = useAuth();

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

  const [attachUploading, setAttachUploading] = useState(false);
  const [tasksList, setTasksList] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState('');

  const canManageProject = useMemo(() => {
    if (!user) return false;
    // Разрешить завершение/удаление только менеджеру проекта или ролям admin/CEO
    const isAdmin = user.role === 'admin' || user.role === 'CEO';
    const isManager = user.username && project.manager_name && user.username === project.manager_name;
    return isAdmin || isManager;
  }, [user, project.manager_name]);

  useEffect(() => {
    const loadTasks = async () => {
      try {
        setTasksLoading(true);
        const allTasks = await getTasks();
        setTasksList(Array.isArray(allTasks) ? allTasks : []);
      } catch (e) {
        console.error('Failed to load tasks for project linking:', e);
        setTasksList([]);
      } finally {
        setTasksLoading(false);
      }
    };
    if (isExpanded) {
      loadTasks();
    }
  }, [isExpanded]);

  const projectTaskIds = useMemo(() => new Set((project.tasks || []).map(t => t.id)), [project.tasks]);
  const selectableTasks = useMemo(() => {
    return (tasksList || []).filter(t => !projectTaskIds.has(t.id));
  }, [tasksList, projectTaskIds]);

  const handleUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    try {
      setAttachUploading(true);
      await projectService.uploadProjectAttachments(project.id, Array.from(files));
      // Запросим обновление карточки
      if (onUpdate) {
        try { await onUpdate(project.id, {}); } catch {}
      }
    } catch (err) {
      console.error('Upload attachments error:', err);
    } finally {
      setAttachUploading(false);
      e.target.value = '';
    }
  };

  const handleAddTask = async () => {
    const id = parseInt(selectedTaskId, 10);
    if (!id) return;
    try {
      await projectService.addTaskToProject(project.id, id);
      if (onUpdate) {
        try { await onUpdate(project.id, {}); } catch {}
      }
      setSelectedTaskId('');
    } catch (err) {
      console.error('Add task to project error:', err);
    }
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
              <div className="task-add-inline">
                <select
                  value={selectedTaskId}
                  onChange={(e) => setSelectedTaskId(e.target.value)}
                  disabled={tasksLoading || selectableTasks.length === 0}
                >
                  <option value="">{tasksLoading ? 'Загрузка задач...' : 'Выберите задачу'}</option>
                  {selectableTasks.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.id} — {t.title || 'Без названия'} ({t.status})
                    </option>
                  ))}
                </select>
                <button type="button" onClick={handleAddTask} disabled={!selectedTaskId}>Добавить задачу</button>
              </div>
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

            {/* Вложения проекта */}
            <div className="project-attachments">
              <h4>Вложения</h4>
              <div className="attach-actions">
                <label className="upload-btn">
                  {attachUploading ? 'Загрузка...' : 'Загрузить файлы'}
                  <input type="file" multiple style={{ display: 'none' }} onChange={handleUpload} />
                </label>
              </div>
              {project.attachments && project.attachments.length > 0 ? (
                <ul className="attachments-list">
                  {project.attachments.map((a, idx) => (
                    <li key={idx} className="attachment-item">
                      <span className="att-name">{a.filename}</span>
                      <span className="att-size">{a.size ? `${a.size} B` : ''}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="no-attachments">Файлы не прикреплены</p>
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
          {canManageProject && (
            <>
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
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectCard;
