const ACTIVE_PROJECT_STATUSES = new Set(['planning', 'active', 'on_hold']);
const COMPLETED_PROJECT_STATUSES = new Set(['completed']);
const COMPLETED_TASK_STATUSES = new Set(['completed', 'done']);

function daysBetween(startRaw, endRaw) {
  if (!startRaw || !endRaw) return null;
  const start = new Date(startRaw);
  const end = new Date(endRaw);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const days = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  if (days < 0) return null;
  return days;
}

function isCompletedTask(task) {
  return COMPLETED_TASK_STATUSES.has(task?.status);
}

function taskCompletionEnd(task) {
  if (!task) return null;
  return task.completed_at || (isCompletedTask(task) ? task.updated : null);
}

function collectTeamTasks(teamProjects, catalogTasks = [], teamId) {
  const wanted = teamId == null ? null : Number(teamId);
  const byId = new Map();

  const take = (task) => {
    if (task?.id == null || wanted == null || Number.isNaN(wanted)) return;
    const explicit = task.team_id ?? task.teamId;
    if (explicit == null || explicit === '' || Number(explicit) !== wanted) return;
    const existing = byId.get(task.id);
    byId.set(task.id, existing ? { ...existing, ...task } : task);
  };

  teamProjects.forEach((project) => {
    (project.tasks || []).forEach(take);
  });
  catalogTasks.forEach(take);
  return [...byId.values()];
}

export function getProjectsForTeam(projects, teamId) {
  if (!teamId || !Array.isArray(projects)) return [];
  return projects.filter((project) =>
    (project.teams || []).some((link) => (link.team_id ?? link.id) === teamId)
  );
}

function calcAverage(daysArray) {
  if (!daysArray.length) return null;
  return Math.round(daysArray.reduce((sum, value) => sum + value, 0) / daysArray.length);
}

export function calcTeamProjectStats(projects, teamId, catalogTasks = []) {
  const teamProjects = getProjectsForTeam(projects, teamId);
  const completedProjects = teamProjects.filter((project) =>
    COMPLETED_PROJECT_STATUSES.has(project.status)
  );
  const activeProjects = teamProjects.filter((project) =>
    ACTIVE_PROJECT_STATUSES.has(project.status)
  );

  const projectDurations = completedProjects
    .map((project) => {
      const start = project.start_date || project.created;
      const end = project.updated || project.due_date;
      return daysBetween(start, end);
    })
    .filter((days) => days != null);

  const teamTasks = collectTeamTasks(teamProjects, catalogTasks, teamId);
  const taskDurations = teamTasks
    .filter((task) => isCompletedTask(task))
    .map((task) => daysBetween(task.created, taskCompletionEnd(task)))
    .filter((days) => days != null);

  return {
    totalProjects: teamProjects.length,
    completedProjectsCount: completedProjects.length,
    activeProjectsCount: activeProjects.length,
    hasActiveProject: activeProjects.length > 0,
    activeProjectNames: activeProjects.map((project) => project.name).filter(Boolean),
    avgProjectCompletionDays: calcAverage(projectDurations),
    avgTaskCompletionDays: calcAverage(taskDurations),
  };
}

export function formatAvgCompletionDays(days) {
  if (days == null) return '—';
  return `${days} дн.`;
}

export function formatActiveProjectLabel(stats) {
  if (!stats?.hasActiveProject) return 'Нет';
  const names = stats.activeProjectNames || [];
  if (names.length === 1) return names[0];
  if (names.length > 1) return `${names[0]} (+${names.length - 1})`;
  return 'Есть';
}
