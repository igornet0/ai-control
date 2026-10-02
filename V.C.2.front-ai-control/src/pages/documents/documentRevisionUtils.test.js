import { describe, expect, it } from 'vitest';
import {
  countAvailableRollbacks,
  findActiveRevision,
  getAvailableRevisions,
  getRollbackTargets,
  revisionMatchesDocument,
} from './documentRevisionUtils';

describe('documentRevisionUtils', () => {
  const future = new Date(Date.now() + 86400000).toISOString();
  const past = new Date(Date.now() - 86400000).toISOString();

  it('counts only non-expired rollbacks', () => {
    const revisions = [
      { id: 1, rollback_available_until: future },
      { id: 2, rollback_available_until: past },
      { id: 3, rollback_available_until: null },
    ];
    expect(getAvailableRevisions(revisions)).toHaveLength(1);
  });

  it('excludes revision matching current document from rollback targets', () => {
    const fieldData = { sheet_0: [{ col_0: 'same' }] };
    const revisions = [
      {
        id: 1,
        revision_no: 5,
        title: 'Doc',
        field_data: fieldData,
        rollback_available_until: future,
      },
      {
        id: 2,
        revision_no: 4,
        title: 'Doc',
        field_data: { sheet_0: [{ col_0: 'old' }] },
        rollback_available_until: future,
      },
    ];

    expect(revisionMatchesDocument(revisions[0], fieldData, 'Doc')).toBe(true);
    expect(findActiveRevision(revisions, fieldData, 'Doc')?.revision_no).toBe(5);
    expect(getRollbackTargets(revisions, fieldData, 'Doc')).toHaveLength(1);
    expect(getRollbackTargets(revisions, fieldData, 'Doc')[0].revision_no).toBe(4);
    expect(countAvailableRollbacks(revisions, fieldData, 'Doc')).toBe(1);
  });
});
