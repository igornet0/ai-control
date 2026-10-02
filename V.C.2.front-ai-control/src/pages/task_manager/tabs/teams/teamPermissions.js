const EXECUTIVE_ROLES = ['CEO', 'CTO', 'COO', 'CFO', 'CPO', 'CMO'];
const ORG_MANAGEMENT_ROLES = ['Manager', 'TeamLead', 'HR'];

export function isUserTeamManager(team, userId) {
  if (!team || !userId) return false;
  if (team.creator_id === userId) return true;
  return team.members?.some(
    (member) =>
      member.user_id === userId
      && member.role === 'manager'
      && member.is_active !== false,
  );
}

export function isOrgTeamAdmin(user) {
  if (!user) return false;
  if (user.is_superuser || user.is_admin) return true;
  const role = String(user.role || '').toLowerCase();
  if (role === 'admin') return true;
  if (EXECUTIVE_ROLES.includes(user.team_role)) return true;
  return false;
}

/** Редактирование/удаление команды и управление составом — только manager команды или админ/executive. */
export function canUserManageTeam(team, user) {
  if (!user) return false;
  if (isOrgTeamAdmin(user)) return true;
  return isUserTeamManager(team, user.id);
}

/** Создание новой команды — org management / executive (не обычный member команды). */
export function canUserCreateTeam(user) {
  if (!user) return false;
  if (isOrgTeamAdmin(user)) return true;
  return ORG_MANAGEMENT_ROLES.includes(user.team_role);
}
