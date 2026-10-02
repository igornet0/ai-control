export const PRIORITY_CONFIG = {
  urgent: { label: 'Срочный', className: 'ow-priority--urgent' },
  critical: { label: 'Критический', className: 'ow-priority--critical' },
  high: { label: 'Высокий', className: 'ow-priority--high' },
  medium: { label: 'Средний', className: 'ow-priority--medium' },
  low: { label: 'Низкий', className: 'ow-priority--low' },
};

export const PROJECT_STATUS_CONFIG = {
  planning: { label: 'Планирование', className: 'ow-status--planning' },
  active: { label: 'Активный', className: 'ow-status--active' },
  on_hold: { label: 'На паузе', className: 'ow-status--hold' },
  completed: { label: 'Завершён', className: 'ow-status--completed' },
  cancelled: { label: 'Отменён', className: 'ow-status--cancelled' },
  archived: { label: 'Архив', className: 'ow-status--archived' },
};

export function formatDateRu(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('ru-RU');
}

export function formatDateTimeRu(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('ru-RU');
}

export function getPriorityConfig(priority) {
  return PRIORITY_CONFIG[priority] || { label: priority || '—', className: 'ow-priority--medium' };
}

export function getProjectStatusConfig(status) {
  return PROJECT_STATUS_CONFIG[status] || { label: status || '—', className: 'ow-status--planning' };
}

export function getTaskContextLabel(task) {
  return task?.team_name || task?.project_name || null;
}

export function daysOverdue(dueDate) {
  if (!dueDate) return 0;
  const due = new Date(dueDate);
  const now = new Date();
  due.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((now - due) / (1000 * 60 * 60 * 24)));
}

export function getRelativeDeadlineLabel(dueDate) {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const due = new Date(dueDate);
  if (due.toDateString() === tomorrow.toDateString()) return 'Завтра';
  const after = new Date(today);
  after.setDate(today.getDate() + 2);
  if (due.toDateString() === after.toDateString()) return 'Послезавтра';
  return formatDateRu(dueDate);
}

export const SCHEDULE_COMPLETE_PHRASES = [
  'Отличная работа — пункт расписания закрыт!',
  'Ещё один слот выполнен, так держать!',
  'Задача отмечена — день идёт по плану.',
  'Супер! Вы двигаетесь по расписанию.',
  'Готово! Можно переходить к следующему делу.',
  'Пункт выполнен — продуктивность растёт.',
  'Отлично справились с этим слотом!',
  'Задача закрыта — вы на правильном пути.',
  'Ещё одна галочка в вашем дне!',
  'Выполнено! План на сегодня работает.',
];

export function pickScheduleCompletePhrase() {
  return SCHEDULE_COMPLETE_PHRASES[
    Math.floor(Math.random() * SCHEDULE_COMPLETE_PHRASES.length)
  ];
}

export function normalizeScheduleItem(item = {}) {
  return {
    time: item.time ?? '',
    activity: item.activity ?? '',
    completed: Boolean(item.completed),
  };
}

export function normalizeScheduleItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return [{ time: '', activity: '', completed: false }];
  }
  return items.map(normalizeScheduleItem);
}

const EXECUTIVE_TEAM_ROLES = new Set(['CEO', 'CTO', 'COO', 'CFO', 'CPO', 'CMO']);
const MANAGEMENT_TEAM_ROLES = new Set(['Manager', 'TeamLead', 'HR']);

export function isOrgWideUser(user) {
  if (!user) return false;
  if (user.is_superuser) return true;
  if (user.role === 'admin' || user.role === 'CEO') return true;
  return EXECUTIVE_TEAM_ROLES.has(user.team_role);
}

export function isManagementUser(user) {
  if (!user) return false;
  return MANAGEMENT_TEAM_ROLES.has(user.team_role);
}

/** Tasks from API are already scoped; keep full list for CEO/managers, own for employees. */
export function canViewScopedOverviewTasks(user) {
  return isOrgWideUser(user) || isManagementUser(user);
}

export function getOverdueWidgetSubtitle(user) {
  if (isOrgWideUser(user)) return 'Все просроченные задачи организации';
  if (isManagementUser(user)) return 'Просроченные задачи вашего отдела';
  return 'Ваши просроченные задачи';
}

export function toDateInputValue(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDateInput(value) {
  if (!value) return null;
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function parseDueDateLocal(value) {
  if (!value) return null;
  const str = String(value);
  const dateOnly = str.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
    return parseDateInput(dateOnly);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

export function isDateInRange(date, from, to) {
  if (!date || !from || !to) return false;
  const time = date.getTime();
  return time >= from.getTime() && time <= to.getTime();
}

export const PRIORITY_RANGE_PRESETS = [
  { id: 'today', label: 'Сегодня', days: 0 },
  { id: 'week', label: '7 дней', days: 6 },
  { id: 'month', label: '30 дней', days: 29 },
];

export function getPriorityRangeForPreset(presetId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const preset = PRIORITY_RANGE_PRESETS.find((p) => p.id === presetId) ?? PRIORITY_RANGE_PRESETS[1];
  const toDate = new Date(today);
  toDate.setDate(toDate.getDate() + preset.days);
  return { from: toDateInputValue(today), to: toDateInputValue(toDate) };
}

export const PRIORITY_SORT_ORDER = { urgent: 1, critical: 2, high: 3, medium: 4, low: 5 };

export function isMyTask(task, user) {
  if (!task || !user) return false;
  const assigneeId = task.assignee_id ?? task.executor_id;
  const creatorId = task.creator_id ?? task.created_by_id ?? task.author_id ?? task.created_by;
  return assigneeId === user.id || creatorId === user.id;
}

export const TASK_STATUS_CONFIG = {
  created: { label: 'Создана', className: 'ow-task-status--created' },
  todo: { label: 'Создана', className: 'ow-task-status--created' },
  in_progress: { label: 'В работе', className: 'ow-task-status--progress' },
  review: { label: 'На проверке', className: 'ow-task-status--review' },
  completed: { label: 'Завершена', className: 'ow-task-status--completed' },
  done: { label: 'Завершена', className: 'ow-task-status--completed' },
  cancelled: { label: 'Отменена', className: 'ow-task-status--cancelled' },
  on_hold: { label: 'На паузе', className: 'ow-task-status--hold' },
  blocked: { label: 'Заблокирована', className: 'ow-task-status--blocked' },
};

export function getTaskStatusConfig(status) {
  return TASK_STATUS_CONFIG[status] || { label: status || '—', className: 'ow-task-status--created' };
}

export function getProjectTasksGroupedByTeam(project, allTasks = []) {
  if (!project) {
    return { teamGroups: [], unassignedTasks: [] };
  }

  const taskMap = new Map(
    (allTasks || []).map((task) => [Number(task.id), task])
  );
  const projectTasks = (project.tasks || []).map((projectTask) => {
    const fullTask = taskMap.get(Number(projectTask.id));
    if (!fullTask) return projectTask;
    return {
      ...projectTask,
      ...fullTask,
      // Keep team from project payload if /api/tasks omitted it (common for limited member views).
      team_id: fullTask.team_id ?? projectTask.team_id ?? null,
    };
  });

  const teams = project.teams || [];
  const teamGroups = teams.map((team) => {
    const teamId = Number(team.team_id);
    return {
      teamId,
      teamName: team.team_name,
      role: team.role,
      memberCount: (team.members || []).filter((member) => member.is_active !== false).length,
      tasks: projectTasks.filter((task) => Number(task.team_id) === teamId),
    };
  });

  const linkedTeamIds = new Set(
    teams.map((team) => Number(team.team_id)).filter((id) => !Number.isNaN(id))
  );
  const unassignedTasks = projectTasks.filter((task) => {
    const teamId = Number(task.team_id);
    return !teamId || Number.isNaN(teamId) || !linkedTeamIds.has(teamId);
  });

  return { teamGroups, unassignedTasks };
}

const COMPLETED_TASK_STATUSES = new Set(['completed', 'done']);

export function getProjectTaskProgress(project) {
  const tasks = Array.isArray(project?.tasks) ? project.tasks : [];
  const total = project?.task_count ?? tasks.length;
  let completed = tasks.filter((task) => COMPLETED_TASK_STATUSES.has(task.status)).length;

  if (total > 0 && tasks.length === 0 && project?.progress != null) {
    completed = Math.round((Number(project.progress) / 100) * total);
  }

  const percent = total > 0
    ? Math.round((completed / total) * 100)
    : Math.round(Number(project?.progress) || 0);

  return { total, completed, percent: Math.min(100, Math.max(0, percent)) };
}
