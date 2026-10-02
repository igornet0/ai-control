export function hasPermission(context, permission) {
  return Boolean(context?.permissions?.includes(permission));
}

export function isLeadershipRole(context, teamRole) {
  if (!teamRole || !context) return false;
  const executive = context.executive_roles || [];
  const management = context.management_roles || [];
  return executive.includes(teamRole) || management.includes(teamRole);
}

export function canManageDepartments(context) {
  return hasPermission(context, 'manage_departments');
}

export function canEditDepartment(context, departmentId) {
  if (canManageDepartments(context)) return true;
  return (context?.managed_department_ids || []).includes(departmentId);
}

export function canAssignManagers(context) {
  return hasPermission(context, 'assign_managers') || canManageDepartments(context);
}

export function canManageAllTeams(context) {
  return context?.tier === 'platform_admin' || context?.tier === 'executive';
}

export function canCreateTeams(context) {
  return hasPermission(context, 'manage_teams') || hasPermission(context, 'manage_own_teams');
}

export function canManageProjects(context) {
  return hasPermission(context, 'manage_projects') || canManageAllTeams(context);
}

export function teamRolesFromContext(context) {
  return context?.team_roles?.length ? context.team_roles : [];
}

export function canCreateInvites(context) {
  return Boolean(context?.can_create_invites) || hasPermission(context, 'create_invites');
}

export function inviteRolesFromContext(context) {
  return context?.invite_allowed_roles?.length ? context.invite_allowed_roles : [];
}
