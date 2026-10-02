import React, { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { CloseIcon } from '../../components/TaskManagerIcons';
import { ProjectStatusBadge, PriorityBadge } from './OverviewWidget';
import {
  formatDateRu,
  getProjectTasksGroupedByTeam,
  getTaskStatusConfig,
} from './overviewHelpers';

function ProjectTeamTaskRow({ task, onClick }) {
  const statusCfg = getTaskStatusConfig(task.status);

  return (
    <button
      type="button"
      className="ow-project-modal__task"
      onClick={() => onClick?.(task)}
    >
      <div className="ow-project-modal__task-main">
        <span className="ow-project-modal__task-title">{task.title}</span>
        <div className="ow-project-modal__task-meta">
          <span className={`ow-task-status ${statusCfg.className}`}>{statusCfg.label}</span>
          {task.priority && <PriorityBadge priority={task.priority} />}
          {task.executor_name && (
            <span className="ow-project-modal__task-executor">{task.executor_name}</span>
          )}
        </div>
      </div>
      <span className="ow-project-modal__task-date">{formatDateRu(task.due_date)}</span>
    </button>
  );
}

function ProjectTeamSection({ team, onTaskClick }) {
  return (
    <section className="ow-project-modal__team">
      <div className="ow-project-modal__team-header">
        <div>
          <h4 className="ow-project-modal__team-name">{team.teamName}</h4>
          {team.role && <p className="ow-project-modal__team-role">Роль: {team.role}</p>}
        </div>
        <span className="ow-project-modal__team-count">
          {team.memberCount} уч. · {team.tasks.length} задач
        </span>
      </div>

      {team.tasks.length > 0 ? (
        <div
          className="ow-project-modal__tasks"
          onWheel={(event) => event.stopPropagation()}
        >
          {team.tasks.map((task) => (
            <ProjectTeamTaskRow key={task.id} task={task} onClick={onTaskClick} />
          ))}
        </div>
      ) : (
        <p className="ow-project-modal__empty-team">У команды пока нет задач в проекте</p>
      )}
    </section>
  );
}

export default function ProjectTeamsModal({ project, tasks, onClose, onTaskClick }) {
  const { teamGroups, unassignedTasks } = useMemo(
    () => getProjectTasksGroupedByTeam(project, tasks),
    [project, tasks]
  );

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleEscape = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  if (!project) return null;

  const totalTasks = (project.tasks || []).length;

  return createPortal(
    <div
      className="ow-project-modal-overlay"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="ow-project-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ow-project-modal-title"
      >
        <div className="ow-project-modal__header">
          <div className="ow-project-modal__header-main">
            <h3 id="ow-project-modal-title" className="ow-project-modal__title">
              {project.name}
            </h3>
            <div className="ow-project-modal__header-meta">
              <ProjectStatusBadge status={project.status} />
              <span className="ow-project-modal__summary">
                {(project.teams || []).length} команд · {totalTasks} задач
              </span>
            </div>
          </div>
          <button
            type="button"
            className="ow-project-modal__close"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <CloseIcon size="sm" />
          </button>
        </div>

        <div className="ow-project-modal__body">
          <div
            className="ow-project-modal__body-scroll"
            onWheel={(event) => event.stopPropagation()}
          >
            {teamGroups.length === 0 ? (
              <p className="ow-project-modal__empty">К проекту не привязаны команды</p>
            ) : (
              teamGroups.map((team) => (
                <ProjectTeamSection
                  key={team.teamId}
                  team={team}
                  onTaskClick={onTaskClick}
                />
              ))
            )}

            {unassignedTasks.length > 0 && (
              <section className="ow-project-modal__team ow-project-modal__team--unassigned">
                <div className="ow-project-modal__team-header">
                  <h4 className="ow-project-modal__team-name">Без команды</h4>
                  <span className="ow-project-modal__team-count">{unassignedTasks.length} задач</span>
                </div>
                <div
                  className="ow-project-modal__tasks"
                  onWheel={(event) => event.stopPropagation()}
                >
                  {unassignedTasks.map((task) => (
                    <ProjectTeamTaskRow key={task.id} task={task} onClick={onTaskClick} />
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
