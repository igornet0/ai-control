export function isPlatformAdmin(user) {
  if (!user) return false;
  return Boolean(user.is_admin || user.is_superuser || user.role === 'admin');
}
