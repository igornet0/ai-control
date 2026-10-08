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
import '../../tmPage.css';
import { CheckIcon, EditIcon, IconWithText, TaskPriorityIcon, TasksIcon, TaskStatusIcon, TeamsIcon } from '../../../components/TaskManagerIcons';

function formatTaskDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('ru-RU');
}

const PROJECT_STATUS_TONES = {
  planning: 'violet',
  active: 'green',
  on_hold: 'amber',
  completed: 'blue',
  cancelled: 'red',
  archived: 'slate',
};

const PRIORITY_ICON_COLORS = {
  low: 'text-slate-400',
  medium: 'text-blue-400',
  high: 'text-amber-400',
  critical: 'text-orange-400',
  urgent: 'text-red-400',
};

const pluralize = (n, one, few, many) => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
};

const shortDate = (value) => new Date(value).toLocaleDateString('ru-RU', {
  day: '2-digit', month: '2-digit', year: '2-digit',
});

/** «26.05.26 – 06.08.26», «до 06.08.26», «с 26.05.26» или «Без срока». */
function formatDateRange(start, due) {
  if (start && due) return `${shortDate(start)} – ${shortDate(due)}`;
  if (due) return `до ${shortDate(due)}`;
  if (start) return `с ${shortDate(start)}`;
  return 'Без срока';
}

const progressColor = (percent) => {
  if (percent >= 100) return '#34d399';
  if (percent >= 60) return '#60a5fa';
  if (percent >= 30) return '#fbbf24';
  return '#94a3b8';
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

  const getProjectStatusText = (status) => PROJECT_STATUS_LABELS[status] || status;

  const getTaskStatusText = (status) => TASK_STATUS_LABELS[status] || status;

  const getPriorityText = (priority) => PRIORITY_LABELS[priority] || priority;

  const getTaskStatusBadgeClass = (status) => (
    TASK_STATUS_BADGE_STYLES[status] || TASK_STATUS_BADGE_STYLES.created
  );

  const getTaskPriorityBadgeClass = (priority) => (
    TASK_PRIORITY_BADGE_STYLES[priority] || TASK_PRIORITY_BADGE_STYLES.low
  );

  const progress = Math.max(0, Math.min(100, Math.round(Number(project.progress) || 0)));
  const isOverdue = Boolean(
    project.due_date
    && !['completed', 'cancelled', 'archived'].includes(project.status)
    && new Date(project.due_date).setHours(23, 59, 59, 999) < Date.now()
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
      <article className={`project-card tm-card${isExpanded ? ' project-card--compact tm-card--active' : ''}`}>
        <div className="tm-card__head">
          <div className="tm-card__heading">
            <h3 className="tm-card__title">{project.name}</h3>
            <div className="tm-card__badges">
              <span className={`tm-pill tm-pill--${PROJECT_STATUS_TONES[project.status] || 'slate'}`}>
                <span className="tm-pill__dot" aria-hidden />
                {getProjectStatusText(project.status)}
              </span>
              {project.priority && (
                <span className="tm-pill tm-pill--plain" title="Приоритет">
                  <TaskPriorityIcon priority={project.priority} className={PRIORITY_ICON_COLORS[project.priority]} />
                  {getPriorityText(project.priority)}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={toggleExpanded}
            className={`tm-expand-btn${isExpanded ? ' tm-expand-btn--open' : ''}`}
            aria-expanded={isExpanded}
            title={isExpanded ? 'Скрыть задачи проекта' : 'Показать задачи проекта'}
          >
            Задачи
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
              <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {project.description && (
          <p className="tm-card__desc project-description" title={project.description}>{project.description}</p>
        )}

        <div className="tm-progress">
          <div className="tm-progress__head">
            <span>Прогресс</span>
            <span className="tm-progress__value">{progress}%</span>
          </div>
          <div className="tm-progress__bar" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <div className="tm-progress__fill" style={{ width: `${progress}%`, background: progressColor(progress) }} />
          </div>
        </div>

        <dl className="tm-meta">
          <div className="tm-meta__item">
            <dt className="tm-meta__label">{managersOnCard.length > 1 ? 'Менеджеры' : 'Менеджер'}</dt>
            <dd className={`tm-meta__value${managersOnCard.length === 0 ? ' tm-meta__value--muted' : ''}`}>
              {managersOnCard.length === 0 ? (
                'Не назначен'
              ) : (
                managersOnCard.map((manager, index) => (
                  <span key={manager.user_id} className="project-manager-chip-wrap">
                    {index > 0 ? <span className="project-manager-sep">, </span> : null}
                    <EmployeeHoverTrigger
                      employee={{ id: manager.user_id, name: manager.name || 'Менеджер' }}
                      className="project-manager-hover"
                    >
                      <span className="project-manager-name" title={manager.isOwner ? 'Владелец проекта' : undefined}>
                        {manager.name || manager.username || `ID ${manager.user_id}`}
                      </span>
                    </EmployeeHoverTrigger>
                  </span>
                ))
              )}
            </dd>
          </div>
          <div className="tm-meta__item">
            <dt className="tm-meta__label">Сроки</dt>
            <dd
              className={`tm-meta__value${isOverdue ? ' tm-meta__value--danger' : ''}${!project.start_date && !project.due_date ? ' tm-meta__value--muted' : ''}`}
              title={isOverdue ? 'Срок проекта прошёл' : undefined}
            >
              {formatDateRange(project.start_date, project.due_date)}
            </dd>
          </div>
          {project.budget ? (
            <div className="tm-meta__item">
              <dt className="tm-meta__label">Бюджет</dt>
              <dd className="tm-meta__value">{Number(project.budget).toLocaleString('ru-RU')} ₽</dd>
            </div>
          ) : null}
          {project.updated && (
            <div className="tm-meta__item">
              <dt className="tm-meta__label">Обновлён</dt>
              <dd className="tm-meta__value" title={project.updated_by_username ? `Изменил: ${project.updated_by_username}` : undefined}>
                {formatDate(project.updated)}
                {project.updated_by_username && <span className="tm-meta__hint"> · {project.updated_by_username}</span>}
              </dd>
            </div>
          )}
        </dl>

        {project.tags && project.tags.length > 0 && (
          <div className="tm-tags">
            {project.tags.map((tag, index) => (
              <span key={index} className="tm-tag">{tag}</span>
            ))}
          </div>
        )}

        <div className="tm-card__footer">
          <div className="tm-card__stats">
            <span><TasksIcon size="sm" /> {project.task_count || 0} {pluralize(project.task_count || 0, 'задача', 'задачи', 'задач')}</span>
            <span><TeamsIcon size="sm" /> {project.team_count || 0} {pluralize(project.team_count || 0, 'команда', 'команды', 'команд')}</span>
          </div>
          {canManageProject && (
            <div className="tm-card__actions">
              {project.status !== 'completed' && (
                <button
                  type="button"
                  onClick={handleCompleteProject}
                  className="tm-icon-btn tm-icon-btn--success"
                  title="Завершить проект"
                  aria-label="Завершить проект"
                >
                  <CheckIcon size="sm" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowEditModal(true)}
                className="tm-icon-btn"
                title="Редактировать проект"
                aria-label="Редактировать проект"
              >
                <EditIcon size="sm" />
              </button>
            </div>
          )}
        </div>
      </article>

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
