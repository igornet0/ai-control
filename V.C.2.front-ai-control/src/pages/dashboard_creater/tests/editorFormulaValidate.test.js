import { describe, expect, it } from 'vitest';
import {
  formulaForScalarPreview,
  validateEditorFormula,
} from '../src/formula/editorFormulaValidate.js';

describe('validateEditorFormula', () => {
  it('requires aggregate by default', () => {
    const r = validateEditorFormula(
      '[source_data_124.value] WHERE [source_data_124.id] LIKE "*arduino*"',
    );
    expect(r.ok).toBe(false);
    expect(String(r.error || '')).toMatch(/агрегат/i);
  });

  it('allows field + WHERE when allowFieldRef', () => {
    const r = validateEditorFormula(
      '[source_data_124.value] WHERE [source_data_124.id] LIKE "*arduino*"',
      { allowFieldRef: true },
    );
    expect(r.ok).toBe(true);
    expect(r.kind).toBe('field_where');
  });

  it('allows simple field when allowFieldRef', () => {
    const r = validateEditorFormula('[t.v]', { allowFieldRef: true });
    expect(r.ok).toBe(true);
    expect(r.kind).toBe('field');
  });

  it('still accepts SUM with WHERE', () => {
    const r = validateEditorFormula('SUM([t.v] WHERE [t.id] = 1)', { allowFieldRef: true });
    expect(r.ok).toBe(true);
    expect(r.kind).toBe('aggregate');
  });

  it('classifies SUM FOR as grouped', () => {
    const r = validateEditorFormula('SUM([orders.qty]) FOR [orders.region_id]');
    expect(r.ok).toBe(true);
    expect(r.kind).toBe('grouped');
  });

  it('formulaForScalarPreview wraps field_where as AVG', () => {
    const raw = '[t.v] WHERE [t.id] LIKE "*x*"';
    const v = validateEditorFormula(raw, { allowFieldRef: true });
    expect(formulaForScalarPreview(raw, v)).toBe('AVG([t.v] WHERE [t.id] LIKE "*x*")');
  });
});
