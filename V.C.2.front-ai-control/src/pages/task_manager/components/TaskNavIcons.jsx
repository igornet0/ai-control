import React from 'react';

const Svg = ({ className, size = 20, children, ...rest }) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden
    {...rest}
  >
    {children}
  </svg>
);

/** Задачи — чеклист на планшете */
export function IconTasks({ className, size }) {
  return (
    <Svg className={className} size={size}>
      <path
        d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7l-5-5H9z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M14 2v5h5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M8.5 12.5l1.5 1.5 3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 17h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  );
}

/** Обзор — панель с виджетами */
export function IconOverview({ className, size }) {
  return (
    <Svg className={className} size={size}>
      <rect x="3" y="4" width="8" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="13" y="4" width="8" height="4" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="13" y="10" width="8" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="3" y="13" width="8" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    </Svg>
  );
}

/** Статистика — линейный график */
export function IconStatistics({ className, size }) {
  return (
    <Svg className={className} size={size}>
      <path d="M4 19h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M4 16V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M9 16V5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M14 16v-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M19 16V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M4 12l4.5-3 3.5 2.5L14 7l5 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Проекты — папка с мишенью */
export function IconProjects({ className, size }) {
  return (
    <Svg className={className} size={size}>
      <path
        d="M3 7.5A1.5 1.5 0 0 1 4.5 6H9l2 2h8.5A1.5 1.5 0 0 1 21 9.5v8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5v-10z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="13" r="2.75" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="13" r="0.9" fill="currentColor" />
    </Svg>
  );
}

/** Команды — группа людей */
export function IconTeams({ className, size }) {
  return (
    <Svg className={className} size={size}>
      <circle cx="9" cy="8.5" r="2.75" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M4.5 18.5c.6-2.4 2.4-3.75 4.5-3.75s3.9 1.35 4.5 3.75"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="16.5" cy="9" r="2.25" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M14.25 18.5c.45-1.8 1.65-2.85 3.25-2.85 1.05 0 2 .45 2.55 1.35"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Файлы — папка с документом */
export function IconFiles({ className, size }) {
  return (
    <Svg className={className} size={size}>
      <path
        d="M3 7.5A1.5 1.5 0 0 1 4.5 6H9l2 2h8.5A1.5 1.5 0 0 1 21 9.5v8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5v-10z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M10 12.5h6M10 15.5h4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M11.5 10.5H14a1 1 0 0 1 1 1v5.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function IconWorkspace({ className, size }) {
  return (
    <Svg className={className} size={size}>
      <rect x="4" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    </Svg>
  );
}

export function IconChevronLeft({ className, size }) {
  return (
    <Svg className={className} size={size}>
      <path d="M14 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function IconChevronRight({ className, size }) {
  return (
    <Svg className={className} size={size}>
      <path d="M10 6l6 6-6 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const TASK_NAV_ICONS = {
  tasks: IconTasks,
  overview: IconOverview,
  statistics: IconStatistics,
  projects: IconProjects,
  teams: IconTeams,
  files: IconFiles,
  workspace: IconWorkspace,
  chevronLeft: IconChevronLeft,
  chevronRight: IconChevronRight,
};

export function TaskNavIcon({ name, className, size = 20 }) {
  const Icon = TASK_NAV_ICONS[name];
  if (!Icon) return null;
  return <Icon className={className} size={size} />;
}
