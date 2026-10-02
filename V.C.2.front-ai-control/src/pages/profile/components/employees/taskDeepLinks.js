export function teamTasksPath(team) {
  const params = new URLSearchParams({ tab: 'tasks', team: String(team.id) });
  if (team.name) params.set('label', team.name);
  return `/tasks?${params.toString()}`;
}

export function projectTasksPath(project) {
  return `/tasks?tab=projects&project=${encodeURIComponent(project.id)}`;
}
