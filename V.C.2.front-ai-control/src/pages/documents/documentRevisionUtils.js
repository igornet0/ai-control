/** Ревизии документа с доступным откатом. */

export function revisionMatchesDocument(revision, fieldData = {}, title = '') {
  if (!revision) return false;
  const revTitle = revision.title ?? '';
  const docTitle = title ?? '';
  if (revTitle !== docTitle) return false;
  return JSON.stringify(revision.field_data || {}) === JSON.stringify(fieldData || {});
}

export function getAvailableRevisions(revisions) {
  const now = Date.now();
  return (revisions || []).filter((rev) => {
    if (!rev?.rollback_available_until) return false;
    const until = new Date(rev.rollback_available_until).getTime();
    return Number.isFinite(until) && until > now;
  });
}

export function findActiveRevision(revisions, fieldData = {}, title = '') {
  const matches = (revisions || []).filter((rev) => revisionMatchesDocument(rev, fieldData, title));
  if (matches.length === 0) return null;
  return matches.reduce((best, rev) => (
    (rev.revision_no || 0) > (best.revision_no || 0) ? rev : best
  ));
}

/** Ревизии, к которым можно откатиться (не истекли и не совпадают с текущим состоянием). */
export function getRollbackTargets(revisions, fieldData = {}, title = '') {
  return getAvailableRevisions(revisions).filter(
    (rev) => !revisionMatchesDocument(rev, fieldData, title),
  );
}

export function countAvailableRollbacks(revisions, fieldData = {}, title = '') {
  return getRollbackTargets(revisions, fieldData, title).length;
}

export function formatRevisionSource(source) {
  if (source === 'accepted_proposal') return 'принято предложение';
  if (source === 'proposal_accept') return 'принято предложение';
  if (source === 'manual') return 'ручное сохранение';
  if (source === 'rollback') return 'откат';
  return source || 'изменение';
}
