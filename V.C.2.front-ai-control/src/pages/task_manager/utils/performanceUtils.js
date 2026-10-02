const CLOSED_STATUSES = new Set(['completed', 'cancelled', 'done']);

export function isTaskClosed(status) {
  return CLOSED_STATUSES.has(status);
}

/** Completed for performance metrics (excludes cancelled). */
export function isTaskCompleted(status) {
  return status === 'completed' || status === 'done';
}

export function isTaskOverdue(task, now = new Date()) {
  if (!task?.due_date || isTaskClosed(task.status)) return false;
  const raw = String(task.due_date);
  const dateOnly = raw.slice(0, 10);
  let dueDay;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
    const [y, m, d] = dateOnly.split('-').map(Number);
    dueDay = new Date(y, m - 1, d);
  } else {
    const due = new Date(task.due_date);
    if (Number.isNaN(due.getTime())) return false;
    dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  }
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return dueDay < today;
}

export function canFilterOverdueTasks(user, context) {
  if (!user && !context) return false;
  if (user?.is_superuser || user?.is_admin || context?.tier === 'platform_admin') return true;
  if (context?.tier === 'executive') return true;
  const role = String(user?.role || '').toLowerCase();
  if (role === 'admin' || role === 'ceo' || role === 'manager') return true;
  const teamRole = context?.team_role || user?.team_role;
  return teamRole === 'CEO' || teamRole === 'Manager';
}

export function getTaskAssigneeId(task) {
  return task?.assignee_id ?? task?.executor_id ?? null;
}

export function getTaskTeamId(task) {
  const id = task?.team_id ?? task?.teamId ?? null;
  if (id == null || id === '') return null;
  const numeric = Number(id);
  return Number.isNaN(numeric) ? null : numeric;
}

export function taskHasProject(task) {
  return (task?.project_id ?? task?.projectId) != null;
}

export function filterTasksWithProject(tasks) {
  return (tasks || []).filter(taskHasProject);
}

export function dedupeTasksById(tasks) {
  const byId = new Map();
  (tasks || []).forEach((task) => {
    if (task?.id != null) {
      byId.set(task.id, task);
    }
  });
  return [...byId.values()];
}

export function filterTasksForUsers(tasks, userIds) {
  if (!userIds?.length) return [];
  const idSet = new Set(userIds);
  return (tasks || []).filter((task) => {
    const assigneeId = getTaskAssigneeId(task);
    return assigneeId != null && idSet.has(assigneeId);
  });
}

export function filterTasksForDepartment(tasks, userIds) {
  return filterTasksForUsers(tasks, userIds);
}

/** project_id -> Set of team_id linked via project.teams */
export function buildProjectTeamIdsMap(projects) {
  const map = new Map();
  (projects || []).forEach((project) => {
    if (project?.id == null) return;
    const teamIds = new Set(
      (project.teams || [])
        .map((link) => link.team_id ?? link.id)
        .filter((id) => id != null)
        .map(Number),
    );
    map.set(Number(project.id), teamIds);
  });
  return map;
}

/** Team views count only tasks with an explicit task.team_id. */
export function taskBelongsToTeam(task, teamId) {
  const wanted = Number(teamId);
  if (Number.isNaN(wanted)) return false;
  return getTaskTeamId(task) === wanted;
}

export function filterTasksForTeam(tasks, team) {
  const teamId = team?.id ?? team;
  if (teamId == null || teamId === '') return [];
  return (tasks || []).filter((task) => taskBelongsToTeam(task, teamId));
}

export function filterTasksForAllTeams(tasks, teams) {
  const allowed = new Set(
    (teams || [])
      .map((team) => Number(team?.id ?? team))
      .filter((id) => !Number.isNaN(id)),
  );
  return (tasks || []).filter((task) => {
    const teamId = getTaskTeamId(task);
    if (teamId == null) return false;
    return allowed.size === 0 ? true : allowed.has(teamId);
  });
}

export function applyStatsScope(tasks, scope, context = {}) {
  const { segment = null, teams = [] } = context;

  if (scope?.type === 'team') {
    return filterTasksForTeam(tasks, { id: scope.id ?? scope.teamId });
  }

  if (scope?.type === 'employee' && (scope.teamId != null || scope.team_id != null)) {
    const teamId = scope.teamId ?? scope.team_id;
    const assigneeId = scope.id;
    return filterTasksForTeam(tasks, { id: teamId }).filter(
      (task) => getTaskAssigneeId(task) === assigneeId,
    );
  }

  if (scope?.taskIds?.length) {
    const idSet = new Set(scope.taskIds);
    return (tasks || []).filter((task) => idSet.has(task.id));
  }
  if (scope?.userIds?.length) return filterTasksForUsers(tasks, scope.userIds);

  if (segment === 'departments') {
    return tasks || [];
  }
  if (segment === 'teams') {
    return filterTasksForAllTeams(tasks, teams);
  }

  return filterTasksWithProject(tasks);
}

export function formatStatsScopeLabel(scope, context = {}) {
  if (scope?.label) {
    if (scope.type === 'employee') return `Сотрудник: ${scope.label}`;
    if (scope.type === 'department') return `Отдел: ${scope.label}`;
    if (scope.type === 'team') return `Команда: ${scope.label}`;
    return scope.label;
  }
  if (context.segment === 'departments') return 'Отделы: все задачи';
  if (context.segment === 'teams') return 'Команды: командные задачи';
  return null;
}

export function calcPerformanceStats(tasks) {
  const list = tasks || [];
  const total = list.length;
  const completed = list.filter((t) => isTaskCompleted(t.status)).length;
  const efficiency = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { total, completed, efficiency };
}

export function getEfficiencyColor(efficiency) {
  if (efficiency >= 80) return 'text-slate-300';
  if (efficiency >= 60) return 'text-amber-400';
  return 'text-red-400';
}

export function getEfficiencyBg(efficiency) {
  if (efficiency >= 80) return 'bg-slate-500';
  if (efficiency >= 60) return 'bg-amber-500';
  return 'bg-red-500';
}

export function getInitials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function isTeamManager(team, userId) {
  return (team?.members || []).some(
    (member) =>
      member.user_id === userId &&
      member.role === 'manager' &&
      member.is_active !== false
  );
}

export const EXECUTIVE_TEAM_ROLES = new Set(['CEO', 'CTO', 'COO', 'CFO', 'CPO', 'CMO']);

export function isExecutivePerformanceUser(user, context) {
  if (user?.is_superuser || context?.tier === 'platform_admin') return true;
  if (context?.tier === 'executive') return true;
  const teamRole = context?.team_role || user?.team_role;
  return Boolean(teamRole && EXECUTIVE_TEAM_ROLES.has(teamRole));
}

/** Переключатель отделы/команды: CEO и платформенный админ. */
export function canSwitchPerformanceSegment(user, context) {
  if (!user && !context) return false;
  if (user?.is_superuser || context?.tier === 'platform_admin') return true;
  const teamRole = context?.team_role || user?.team_role;
  if (teamRole === 'CEO') return true;
  return false;
}

/** @deprecated use isExecutivePerformanceUser */
export function isCeoPerformanceUser(user, context) {
  return canSwitchPerformanceSegment(user, context) || isExecutivePerformanceUser(user, context);
}

export function resolvePerformanceViewMode(context, teams, userId) {
  const tier = context?.tier;
  if (tier === 'executive' || tier === 'platform_admin') {
    return 'departments';
  }
  const managedDeptIds = context?.managed_department_ids || [];
  if (managedDeptIds.length > 0) {
    return 'departments';
  }
  const hasManagedTeams = (teams || []).some((team) => isTeamManager(team, userId));
  if (hasManagedTeams) {
    return 'teams';
  }
  return 'employee';
}

export function getEmployeeDueTasks(tasks, userId) {
  const now = new Date();
  return (tasks || [])
    .filter((task) => {
      const assigneeId = getTaskAssigneeId(task);
      if (assigneeId !== userId) return false;
      if (!task.due_date) return false;
      return !isTaskClosed(task.status);
    })
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
    .map((task) => ({
      ...task,
      isOverdue: new Date(task.due_date) < now,
    }));
}
