/**
 * Utility functions for dashboard operations
 */

/**
 * Check if user has editing permissions for dashboard
 * @param {Object} dashboard - Dashboard object
 * @param {Object} user - User object
 * @returns {boolean} True if user can edit dashboard
 */
export const canEditDashboard = (dashboard, user) => {
  if (!dashboard || !user) return false;
  if (Number(dashboard.owner_id ?? dashboard.user_id) === Number(user.id)) return true;
  if (user.is_superuser || user.is_admin) return true;
  if (dashboard.can_edit) return true;
  if (dashboard.is_public && dashboard.allow_edit) return true;
  return false;
};
