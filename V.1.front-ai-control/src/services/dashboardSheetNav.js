/**
 * Sheet URLs for live, share-link and published-flow (snapshot) views.
 */

export function getFlowIdFromLocation(location) {
  if (!location) return null;
  const fromState = location.state?.flowId;
  if (fromState != null && String(fromState).trim() !== '') {
    return String(fromState);
  }
  try {
    const params = new URLSearchParams(location.search || '');
    const fromQuery = params.get('flow');
    if (fromQuery != null && String(fromQuery).trim() !== '') {
      return String(fromQuery);
    }
  } catch {
    // ignore
  }
  return null;
}

export function isFlowReadOnlyLocation(location) {
  if (!location) return false;
  if (location.state?.readOnlyFlow) return true;
  try {
    const params = new URLSearchParams(location.search || '');
    return Boolean(params.get('flow'));
  } catch {
    return false;
  }
}

export function getFlowViewContext(location) {
  const flowId = getFlowIdFromLocation(location);
  const readOnlyFlow = isFlowReadOnlyLocation(location);
  if (!readOnlyFlow || !flowId) return null;
  return { flowId, readOnlyFlow: true };
}

export function flowNavigateState(flowId) {
  if (flowId == null || String(flowId).trim() === '') return undefined;
  return {
    fromFlow: true,
    flowId: String(flowId),
    readOnlyFlow: true,
  };
}

export function buildDashboardSheetPath({
  shareToken,
  dashboardId,
  sheetId,
  flowId,
}) {
  if (!sheetId && sheetId !== 0) return null;
  if (shareToken) {
    return `/share/${encodeURIComponent(shareToken)}/sheet/${sheetId}`;
  }
  if (dashboardId == null || dashboardId === '') return null;
  const base = `/dashboard/${dashboardId}/sheet/${sheetId}`;
  if (flowId != null && String(flowId).trim() !== '') {
    return `${base}?flow=${encodeURIComponent(String(flowId))}`;
  }
  return base;
}

export function resolveNavigateSheetId(rawTarget, sheets = [], payload = {}) {
  const candidates = [
    rawTarget,
    payload?.sheetId,
    payload?.sheet_id,
    payload?.targetSheetId,
  ].filter((value) => {
    if (value == null || value === '') return false;
    const text = String(value).trim();
    return text !== 'global' && text !== 'all';
  });
  const list = Array.isArray(sheets) ? sheets : [];
  for (const candidate of candidates) {
    const text = String(candidate).replace(/^dashboard[_-]/i, '').trim();
    if (!text) continue;
    const byId = list.find((sheet) => String(sheet.id) === text);
    if (byId) return String(byId.id);
    const lower = text.toLowerCase();
    const byName = list.find((sheet) => {
      const name = String(sheet.name || sheet.title || '').trim().toLowerCase();
      return name && name === lower;
    });
    if (byName) return String(byName.id);
  }
  if (!candidates.length) return null;
  const fallback = String(candidates[0]).replace(/^dashboard[_-]/i, '').trim();
  return fallback || null;
}
