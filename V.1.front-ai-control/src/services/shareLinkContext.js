/**
 * When set, sheet/widget/sqlite services use public share-link API instead of JWT.
 * @type {{ token: string, permission: 'read'|'edit', sessionType: 'shared'|'isolated', dashboardId: number } | null}
 */
let ctx = null;

export function setDashboardShareContext(c) {
  ctx = c;
}

export function clearDashboardShareContext() {
  ctx = null;
}

export function getDashboardShareContext() {
  return ctx;
}
