/** @vitest-environment jsdom */

import { describe, expect, it } from 'vitest';
import {
  findBracketFieldSpanAt,
  findNextTableFieldPlaceholder,
  insertOrReplaceFieldRef,
} from '../src/formula/formulaEditorModal.js';

describe('formula editor field placeholder UX', () => {
  it('finds [TABLE.FIELD] span under cursor', () => {
    const text = 'SUM([TABLE.FIELD])';
    const open = text.indexOf('[');
    const span = findBracketFieldSpanAt(text, open + 3);
    expect(span).toEqual({ start: open, end: open + '[TABLE.FIELD]'.length, text: '[TABLE.FIELD]' });
  });

  it('includes $ prefix for $[TABLE.FIELD]', () => {
    const text = 'SUM($[TABLE.FIELD])';
    const span = findBracketFieldSpanAt(text, text.indexOf('T'));
    expect(span?.text).toBe('$[TABLE.FIELD]');
  });

  it('finds next TABLE.* placeholder', () => {
    const text = 'IF([TABLE.FIELD]="x", RGB(1,2,3), None)';
    const span = findNextTableFieldPlaceholder(text, 0);
    expect(span?.text).toBe('[TABLE.FIELD]');
  });

  it('replaces selected placeholder with field ref', () => {
    const ta = document.createElement('textarea');
    ta.value = 'SUM([TABLE.FIELD])';
    const open = ta.value.indexOf('[');
    ta.setSelectionRange(open, open + '[TABLE.FIELD]'.length);
    document.body.appendChild(ta);
    insertOrReplaceFieldRef(ta, '[payments.status]');
    expect(ta.value).toBe('SUM([payments.status])');
    ta.remove();
  });

  it('replaces placeholder under cursor without prior selection', () => {
    const ta = document.createElement('textarea');
    ta.value = 'AVG([TABLE.FIELD])';
    const mid = ta.value.indexOf('FIELD');
    ta.setSelectionRange(mid, mid);
    document.body.appendChild(ta);
    insertOrReplaceFieldRef(ta, '[orders.amount]');
    expect(ta.value).toBe('AVG([orders.amount])');
    ta.remove();
  });
});
