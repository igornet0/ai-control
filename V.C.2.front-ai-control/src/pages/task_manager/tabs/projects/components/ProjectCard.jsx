import React, { useMemo, useState } from 'react';
import { projectService } from '../../../../../services/projectService';
import { taskService } from '../../../../../services/taskService';
import useAuth from '../../../../../hooks/useAuth';
import EditProjectModal from './EditProjectModal';
import ConfirmDialog from '../../../../../components/shared/ConfirmDialog';
import TaskDetails from '../../../components/TaskDetails';
import ProjectTasksCalendar from './ProjectTasksCalendar';
import EmployeeHoverTrigger from '../../../../profile/components/employees/EmployeeHoverTrigger';
import { userCanManageProject, visibleCardManagers } from './projectManagers';
import './ProjectCard.css';
import { CheckIcon, EditIcon, IconWithText, TaskPriorityIcon, TasksIcon, TaskStatusIcon, TeamsIcon } from '../../../components/TaskManagerIcons';

function formatTaskDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('ru-RU');
}

const PROJECT_STATUS_COLORS = {
  planning: 'bg-gray-500',
  active: 'bg-green-500',
  on_hold: 'bg-yellow-500',
  completed: 'bg-blue-500',
  cancelled: 'bg-red-500',
  archived: 'bg-gray-700',
};

const PROJECT_STATUS_LABELS = {
  planning: 'Планирование',
  active: 'Активный',
  on_hold: 'На паузе',
  completed: 'Завершён',
  cancelled: 'Отменён',
  archived: 'Архивный',
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

const PRIORITY_COLORS = {
  low: 'bg-gray-400',
  medium: 'bg-blue-400',
  high: 'bg-yellow-400',
  critical: 'bg-orange-400',
  urgent: 'bg-red-400',
};

const PRIORITY_LABELS = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
  critical: 'Критичный',
  urgent: 'Срочный',
};

const TASK_STATUS_BADGE_STYLES = {
  created: 'project-card-task-badge--created',
  in_progress: 'project-card-task-badge--progress',
  review: 'project-card-task-badge--review',
  completed: 'project-card-task-badge--completed',
  cancelled: 'project-card-task-badge--cancelled',
  on_hold: 'project-card-task-badge--hold',
  blocked: 'project-card-task-badge--blocked',
};

const TASK_PRIORITY_BADGE_STYLES = {
  urgent: 'project-card-task-badge--priority-urgent',
  critical: 'project-card-task-badge--priority-critical',
  high: 'project-card-task-badge--priority-high',
  medium: 'project-card-task-badge--priority-medium',
  low: 'project-card-task-badge--priority-low',
};

const ProjectCard = ({ project, onDelete, onUpdate, isExpanded = false, onExpandChange }) => {
  const [showEditModal, setShowEditModal] = useState(false);
  const { user } = useAuth();

  const getProjectStatusColor = (status) => PROJECT_STATUS_COLORS[status] || 'bg-gray-500';

  const getProjectStatusText = (status) => PROJECT_STATUS_LABELS[status] || status;

  const getTaskStatusText = (status) => TASK_STATUS_LABELS[status] || status;

  const getPriorityColor = (priority) => PRIORITY_COLORS[priority] || 'bg-gray-400';

  const getPriorityText = (priority) => PRIORITY_LABELS[priority] || priority;

  const getTaskStatusBadgeClass = (status) => (
    TASK_STATUS_BADGE_STYLES[status] || TASK_STATUS_BADGE_STYLES.created
  );

  const getTaskPriorityBadgeClass = (priority) => (
    TASK_PRIORITY_BADGE_STYLES[priority] || TASK_PRIORITY_BADGE_STYLES.low
  );

  const toggleExpanded = () => {
    onExpandChange?.(!isExpanded);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Без срока';
    return new Date(dateString).toLocaleDateString('ru-RU');
  };

  const [attachUploading, setAttachUploading] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [openingTaskId, setOpeningTaskId] = useState(null);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [completingProject, setCompletingProject] = useState(false);
  const [tasksViewMode, setTasksViewMode] = useState('table');

  const completableTaskCount = useMemo(() => {
    const openStatuses = new Set(['created', 'in_progress', 'on_hold']);
    return (project.tasks || []).filter((task) => openStatuses.has(task.status)).length;
  }, [project.tasks]);

  const completeProjectMessage = useMemo(() => {
    const base = `Вы уверены, что хотите завершить проект «${project.name}»? Статус проекта изменится на «Завершён».`;
    const tasksNote = 'Все задачи проекта в статусах «Создана», «В работе» и «На паузе» будут автоматически переведены в «Завершена».';
    if (completableTaskCount > 0) {
      return `${base} ${tasksNote} Будет завершено задач: ${completableTaskCount}.`;
    }
    return `${base} ${tasksNote}`;
  }, [project.name, completableTaskCount]);

  const canManageProject = useMemo(
    () => userCanManageProject(user, project),
    [user, project],
  );

  const managersOnCard = useMemo(() => visibleCardManagers(project), [project]);

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

  const handleOpenTask = async (task) => {
    if (!task?.id) return;
    try {
      setOpeningTaskId(task.id);
      const fullTask = await taskService.getTask(task.id);
      setSelectedTask({
        ...fullTask,
        project_id: project.id,
        executor_id: fullTask.assignee_id ?? fullTask.executor_id,
        executor_name: fullTask.assignee_name ?? task.executor_name,
      });
    } catch (error) {
      console.error('Error loading task details:', error);
      setSelectedTask({ ...task, project_id: project.id });
    } finally {
      setOpeningTaskId(null);
    }
  };

  const handleTaskUpdate = async () => {
    if (onUpdate) {
      try {
        await onUpdate(project.id, {});
      } catch (error) {
        console.error('Error refreshing project after task update:', error);
      }
    }
    if (!selectedTask?.id) return;
    try {
      const fullTask = await taskService.getTask(selectedTask.id);
      setSelectedTask({
        ...fullTask,
        project_id: project.id,
        executor_id: fullTask.assignee_id ?? fullTask.executor_id,
        executor_name: fullTask.assignee_name ?? selectedTask.executor_name,
      });
    } catch (error) {
      console.error('Error refreshing task details:', error);
    }
  };

  const handleCompleteProject = () => {
    if (project.status === 'completed') return;
    setShowCompleteConfirm(true);
  };

  const confirmCompleteProject = async () => {
    if (!onUpdate) return;
    try {
      setCompletingProject(true);
      await onUpdate(project.id, { status: 'completed' });
      setShowCompleteConfirm(false);
    } catch (error) {
      console.error('Error completing project:', error);
      alert('Не удалось завершить проект');
    } finally {
      setCompletingProject(false);
    }
  };

  const handleEditProject = async (projectData, files, onProgress) => {
    try {
      // Сначала обновляем проект
      const updatedProject = await projectService.updateProject(project.id, projectData);
      
      // Если есть файлы, ОБЯЗАТЕЛЬНО загружаем их
      if (files && files.length > 0) {
        try {
          await projectService.uploadProjectAttachments(project.id, files, onProgress);
        } catch (uploadError) {
          console.error('Failed to upload files for project update:', uploadError);
          
          // Показываем ошибку и не закрываем модальное окно
          alert('Ошибка при загрузке файлов. Данные проекта обновлены, но файлы не загружены.');
          throw uploadError;
        }
      }
      
      // Уведомляем родительский компонент об обновлении ТОЛЬКО при успешной загрузке всех файлов
      if (onUpdate) {
        try { 
          await onUpdate(project.id, updatedProject); 
        } catch (updateError) {
          console.error('Error notifying parent component:', updateError);
        }
      }
      
      setShowEditModal(false);
    } catch (err) {
      console.error('Edit project error:', err);
      // Модальное окно не закрываем при ошибке, чтобы пользователь мог попробовать снова
    }
  };

  return (
    <div className={`project-card-row${isExpanded ? ' project-card-row--expanded' : ''}`}>
      <div className={`project-card${isExpanded ? ' project-card--compact' : ''}`}>
      <div className="card-header">
        <div className="project-title">
          <h3>{project.name}</h3>
          <div className="project-badges">
            <span className={`status-badge ${getProjectStatusColor(project.status)}`}>
              {getProjectStatusText(project.status)}
            </span>
            <span className={`priority-badge ${getPriorityColor(project.priority)}`}>
              {getPriorityText(project.priority)}
            </span>
          </div>
        </div>
        <div className="project-actions">
          <button
            type="button"
            onClick={toggleExpanded}
            className="expand-btn"
            title={isExpanded ? 'Свернуть' : 'Развернуть'}
          >
            {isExpanded ? '◀' : '▶'}
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
          <div className="info-row info-row--managers">
            <span className="info-label">Менеджер:</span>
            <span className="info-value info-value--managers">
              {managersOnCard.length === 0 ? (
                'Не назначен'
              ) : (
                managersOnCard.map((manager, index) => (
                  <span key={manager.user_id} className="project-manager-chip-wrap">
                    {index > 0 ? <span className="project-manager-sep">,</span> : null}
                    <EmployeeHoverTrigger
                      employee={{ id: manager.user_id, name: manager.name || 'Менеджер' }}
                      className="project-manager-hover"
                    >
                      <span className="project-manager-name">
                        {manager.name || manager.username || `ID ${manager.user_id}`}
                        {manager.isOwner ? <em className="project-manager-owner">владелец</em> : null}
                      </span>
                    </EmployeeHoverTrigger>
                  </span>
                ))
              )}
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

          {project.updated && (
            <div className="info-row">
              <span className="info-label">Последнее обновление:</span>
              <span className="info-value">
                {formatDate(project.updated)}
                {project.updated_by_username && (
                  <span className="edit-info"> от {project.updated_by_username}</span>
                )}
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

      </div>

      <div className="card-footer">
        <div className="project-stats">
          <span className="stat">
            <IconWithText icon={TasksIcon}>
              {project.task_count} задач
            </IconWithText>
          </span>
          <span className="stat">
            <IconWithText icon={TeamsIcon}>
              {project.team_count} команд
            </IconWithText>
          </span>
        </div>
        
        <div className="project-actions">
          {canManageProject && (
            <>
              <button
                onClick={() => setShowEditModal(true)}
                className="edit-btn"
                title="Редактировать проект"
              >
                <EditIcon size="sm" />
              </button>
              {project.status !== 'completed' && (
                <button
                  type="button"
                  onClick={handleCompleteProject}
                  className="complete-btn"
                  title="Завершить проект"
                >
                  <CheckIcon size="sm" />
                </button>
              )}
            </>
          )}
        </div>
      </div>
      </div>

      {isExpanded && (
        <div className="project-card-sidepanel">
          <div className="project-card-sidepanel__header">
            <h4>
              <IconWithText icon={TasksIcon}>
                Задачи проекта ({project.task_count || 0})
              </IconWithText>
            </h4>
            {project.tasks && project.tasks.length > 0 && (
              <div className="project-card-sidepanel__view-toggle" role="group" aria-label="Вид списка задач">
                <button
                  type="button"
                  className={`project-card-view-btn${tasksViewMode === 'table' ? ' project-card-view-btn--active' : ''}`}
                  onClick={() => setTasksViewMode('table')}
                >
                  Таблица
                </button>
                <button
                  type="button"
                  className={`project-card-view-btn${tasksViewMode === 'calendar' ? ' project-card-view-btn--active' : ''}`}
                  onClick={() => setTasksViewMode('calendar')}
                >
                  Календарь
                </button>
              </div>
            )}
          </div>

          {project.tasks && project.tasks.length > 0 ? (
            tasksViewMode === 'calendar' ? (
              <div className="project-card-tasks-calendar-wrap">
                <ProjectTasksCalendar
                  tasks={project.tasks}
                  onTaskClick={handleOpenTask}
                  openingTaskId={openingTaskId}
                />
              </div>
            ) : (
            <div className="project-card-tasks-table-wrap">
              <div className="project-card-tasks-table">
                <div className="project-card-tasks-table__head">
                  <span>Задача</span>
                  <span className="project-card-tasks-table__head-compact" title="Статус">Стат.</span>
                  <span className="project-card-tasks-table__head-compact" title="Приоритет">Приор.</span>
                  <span>Исполнитель</span>
                  <span>Срок</span>
                  <span>Создана</span>
                </div>
                {project.tasks.map((task) => (
                  <div
                    key={task.id}
                    className={`project-card-tasks-table__row project-card-tasks-table__row--clickable${
                      openingTaskId === task.id ? ' project-card-tasks-table__row--loading' : ''
                    }`}
                    onClick={() => handleOpenTask(task)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        handleOpenTask(task);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    title="Открыть задачу"
                  >
                    <div className="project-card-tasks-table__title-cell">
                      <span className="project-card-tasks-table__title" title={task.title}>
                        {task.title || 'Без названия'}
                      </span>
                      <span className="project-card-tasks-table__subtitle">ID {task.id}</span>
                    </div>
                    <div className="project-card-tasks-table__status-cell">
                      <span
                        className={`project-card-task-badge ${getTaskStatusBadgeClass(task.status)}`}
                        title={getTaskStatusText(task.status)}
                      >
                        <TaskStatusIcon status={task.status} />
                      </span>
                    </div>
                    <div className="project-card-tasks-table__priority-cell">
                      <span
                        className={`project-card-task-badge ${getTaskPriorityBadgeClass(task.priority)}`}
                        title={getPriorityText(task.priority)}
                      >
                        <TaskPriorityIcon priority={task.priority} />
                      </span>
                    </div>
                    <div
                      className="project-card-tasks-table__executor-cell"
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      {task.executor_id ? (
                        <EmployeeHoverTrigger
                          employee={{ id: task.executor_id, name: task.executor_name || 'Исполнитель' }}
                          className="project-card-tasks-table__executor-trigger"
                        >
                          <span
                            className={`project-card-tasks-table__executor-name${
                              task.executor_id === user?.id ? ' project-card-tasks-table__executor-name--self' : ''
                            }`}
                            title={task.executor_name || undefined}
                          >
                            {task.executor_id === user?.id
                              ? `${task.executor_name || 'Не назначен'} (Вы)`
                              : task.executor_name || 'Не назначен'}
                          </span>
                        </EmployeeHoverTrigger>
                      ) : (
                        <span className="project-card-tasks-table__meta">—</span>
                      )}
                    </div>
                    <span className="project-card-tasks-table__meta">
                      {task.due_date ? formatDate(task.due_date) : '—'}
                    </span>
                    <span className="project-card-tasks-table__meta">
                      {formatTaskDate(task.created)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            )
          ) : (
            <p className="project-card-sidepanel__empty">Задачи не привязаны к проекту</p>
          )}
        </div>
      )}

      {showEditModal && (
        <EditProjectModal
          project={project}
          onClose={() => setShowEditModal(false)}
          onSubmit={handleEditProject}
          onDelete={onDelete}
        />
      )}

      {selectedTask && (
        <TaskDetails
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onTaskUpdate={handleTaskUpdate}
          currentUser={user}
          overlayZIndex={10000}
        />
      )}

      <ConfirmDialog
        open={showCompleteConfirm}
        title="Завершить проект?"
        message={completeProjectMessage}
        confirmLabel="Завершить"
        cancelLabel="Отмена"
        variant="primary"
        loading={completingProject}
        onConfirm={confirmCompleteProject}
        onCancel={() => !completingProject && setShowCompleteConfirm(false)}
        zIndex={10050}
      />
    </div>
  );
};

export default ProjectCard;
