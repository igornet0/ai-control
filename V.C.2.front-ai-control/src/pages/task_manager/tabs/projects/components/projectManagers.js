const EXECUTIVE_ROLES = new Set(['CEO', 'CTO', 'COO', 'CFO', 'CPO', 'CMO']);

function userIsAdminOrExecutive(user) {
  if (!user) return false;
  if (user.is_superuser) return true;
  if (String(user.role || '').toLowerCase() === 'admin') return true;
  return EXECUTIVE_ROLES.has(String(user.team_role || ''));
}

export function collectProjectManagers(project) {
  if (!project) return [];
  const list = [];
  if (project.manager_id) {
    list.push({
      user_id: Number(project.manager_id),
      name: project.manager_name || project.manager_username || null,
      username: project.manager_username || null,
      email: project.manager_email || null,
      isOwner: true,
    });
  }
  const seen = new Set(list.map((m) => m.user_id));
  for (const extra of project.extra_managers || []) {
    const userId = Number(extra.user_id);
    if (!userId || seen.has(userId)) continue;
    seen.add(userId);
    list.push({
      user_id: userId,
      name: extra.name || extra.username || null,
      username: extra.username || null,
      email: extra.email || null,
      isOwner: false,
    });
  }
  return list;
}

export function visibleCardManagers(project) {
  const all = collectProjectManagers(project);
  if (!Array.isArray(project.card_manager_ids)) {
    return all;
  }
  const allowed = new Set(project.card_manager_ids.map(Number));
  return all.filter((m) => allowed.has(Number(m.user_id)));
}

export function userCanManageProject(user, project) {
  if (!user || !project) return false;
  if (userIsAdminOrExecutive(user)) return true;
  const userId = Number(user.id);
  if (userId && Number(project.manager_id) === userId) return true;
  if ((project.extra_managers || []).some((m) => Number(m.user_id) === userId)) return true;
  const login = user.login || user.username;
  if (login && project.manager_username && login === project.manager_username) return true;
  return false;
}

/** Owner or already assigned project managers may add/remove managers. */
export function userCanAssignProjectManagers(user, project) {
  if (!user || !project) return false;
  if (userIsAdminOrExecutive(user)) return true;
  const userId = Number(user.id);
  if (!userId) return false;
  if (Number(project.manager_id) === userId) return true;
  return (project.extra_managers || []).some((m) => Number(m.user_id) === userId);
}

export function userCanConfigureProjectCard(user, project) {
  if (!user || !project) return false;
  if (userIsAdminOrExecutive(user)) return true;
  return Boolean(user.id && Number(project.manager_id) === Number(user.id));
}
