import React from 'react';
import {
  getPriorityConfig,
  getProjectStatusConfig,
  getProjectTaskProgress,
  getTaskContextLabel,
  daysOverdue,
  getRelativeDeadlineLabel,
  formatDateRu,
} from './overviewHelpers';

export function OverviewWidget({
  cardId,
  accent = 'blue',
  icon,
  title,
  subtitle,
  count,
  children,
  className = '',
}) {
  return (
    <div
      data-card-id={cardId}
      className={`card overview-block overview-widget overview-widget--${accent} ${className}`.trim()}
    >
      <div className="overview-widget__header">
        <div className="overview-widget__icon">{icon}</div>
        <div className="overview-widget__title-wrap">
          <h3 className="overview-widget__title">{title}</h3>
          {subtitle && <p className="overview-widget__subtitle">{subtitle}</p>}
        </div>
        {count !== undefined && count !== null && (
          <span className="overview-widget__badge">{count}</span>
        )}
      </div>
      <div className="overview-widget__body">{children}</div>
    </div>
  );
}

export function OverviewEmpty({ icon, iconKey = 'empty', text }) {
  const IconNode = icon ?? EmptyStateIcons[iconKey] ?? EmptyStateIcons.empty;
  return (
    <div className="ow-empty">
      <span className="ow-empty__icon" aria-hidden>{IconNode}</span>
      <p className="ow-empty__text">{text}</p>
    </div>
  );
}

export function PriorityBadge({ priority }) {
  const cfg = getPriorityConfig(priority);
  return <span className={`ow-priority ${cfg.className}`}>{cfg.label}</span>;
}

export function ProjectStatusBadge({ status }) {
  const cfg = getProjectStatusConfig(status);
  return <span className={`ow-status ${cfg.className}`}>{cfg.label}</span>;
}

export function TaskListItem({ task, variant = 'default', onClick }) {
  const context = getTaskContextLabel(task);
  const overdueDays = variant === 'overdue' ? daysOverdue(task.due_date) : 0;
  const handleClick = onClick ? () => onClick(task) : undefined;

  return (
    <li
      className={`ow-item ${variant === 'overdue' ? 'ow-item--overdue' : ''} ${onClick ? 'ow-item--clickable' : ''}`}
      onClick={handleClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); } } : undefined}
    >
      <div className="ow-item__main">
        <p className="ow-item__title">{task.title}</p>
        <div className="ow-item__meta">
          {context && <span className="ow-item__context">[{context}]</span>}
          {task.priority && <PriorityBadge priority={task.priority} />}
          {variant === 'overdue' && overdueDays > 0 && (
            <span className="ow-item__date ow-item__date--danger">
              +{overdueDays} дн.
            </span>
          )}
        </div>
      </div>
      <span className={`ow-item__date ${variant === 'overdue' ? 'ow-item__date--danger' : ''}`}>
        {variant === 'upcoming'
          ? getRelativeDeadlineLabel(task.due_date)
          : formatDateRu(task.due_date)}
      </span>
    </li>
  );
}

export function ProjectListItem({ project, onClick }) {
  const teamCount = (project.teams || []).length;
  const { total, completed, percent } = getProjectTaskProgress(project);
  const handleClick = onClick ? () => onClick(project) : undefined;
  const progressTone =
    percent >= 100 ? 'ow-project-card__bar-fill--done'
      : percent >= 60 ? 'ow-project-card__bar-fill--good'
        : percent >= 30 ? 'ow-project-card__bar-fill--mid'
          : 'ow-project-card__bar-fill--low';

  return (
    <li
      className={`ow-project-card ${onClick ? 'ow-project-card--clickable' : ''}`}
      onClick={handleClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleClick();
        }
      } : undefined}
    >
      <div className="ow-project-card__header">
        <div className="ow-project-card__title-wrap">
          <p className="ow-project-card__title">{project.name}</p>
          <ProjectStatusBadge status={project.status} />
        </div>
        <span className="ow-project-card__percent">{percent}%</span>
      </div>

      <div className="ow-project-card__progress">
        <div className="ow-project-card__progress-meta">
          <span className="ow-project-card__progress-label">
            {total > 0
              ? `${completed} из ${total} задач выполнено`
              : 'Нет задач в проекте'}
          </span>
        </div>
        <div
          className="ow-project-card__bar"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Выполнено ${completed} из ${total} задач`}
        >
          <div
            className={`ow-project-card__bar-fill ${progressTone}`}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <div className="ow-project-card__footer">
        <span className="ow-project-card__teams">
          {teamCount} {teamCount === 1 ? 'команда' : teamCount >= 2 && teamCount <= 4 ? 'команды' : 'команд'}
        </span>
        {onClick && <span className="ow-project-card__hint" aria-hidden>Подробнее ›</span>}
      </div>
    </li>
  );
}

const svgProps = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
const emptySvgProps = { width: 28, height: 28, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round', strokeLinejoin: 'round' };
const actionSvgProps = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };

export const ActionIcons = {
  plus: (
    <svg {...actionSvgProps} aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  trash: (
    <svg {...actionSvgProps} aria-hidden>
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
    </svg>
  ),
};

export const EmptyStateIcons = {
  empty: (
    <svg {...emptySvgProps} aria-hidden>
      <path d="M4 4h16v16H4z" opacity="0.35" />
      <path d="M4 8h16M8 4v4" />
      <path d="M9 13h6M9 17h4" />
    </svg>
  ),
  priorities: (
    <svg {...emptySvgProps} aria-hidden>
      <path d="M12 3l2.2 4.5 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L4.8 8.2l5-.7L12 3z" />
    </svg>
  ),
  overdueClear: (
    <svg {...emptySvgProps} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  ),
  upcoming: (
    <svg {...emptySvgProps} aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  ),
  projects: (
    <svg {...emptySvgProps} aria-hidden>
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  ),
  checklist: (
    <svg {...emptySvgProps} aria-hidden>
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  ),
  loading: (
    <svg {...emptySvgProps} className="ow-empty__spinner" aria-hidden>
      <circle cx="12" cy="12" r="9" opacity="0.25" />
      <path d="M12 3a9 9 0 0 1 9 9" />
    </svg>
  ),
};

export const WidgetIcons = {
  priorities: (
    <svg {...svgProps} aria-hidden>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  ),
  overdue: (
    <svg {...svgProps} aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  ),
  upcoming: (
    <svg {...svgProps} aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  ),
  projects: (
    <svg {...svgProps} aria-hidden>
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  ),
  notes: (
    <svg {...svgProps} aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
    </svg>
  ),
  checklist: (
    <svg {...svgProps} aria-hidden>
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  ),
  schedule: (
    <svg {...svgProps} aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  ),
  aiAnalysis: (
    <svg {...svgProps} aria-hidden>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  aiChat: (
    <svg {...svgProps} aria-hidden>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <path d="M8 9h8M8 13h5" />
    </svg>
  ),
};
