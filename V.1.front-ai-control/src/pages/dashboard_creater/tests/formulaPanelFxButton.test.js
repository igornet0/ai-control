import { describe, expect, it } from 'vitest';
import { svgFormulaFxOpen } from '../icons/dashboardCreaterIcons.js';

describe('formula panel fx icon', () => {
    it('exports inline SVG usable as formula-open-btn icon', () => {
        expect(svgFormulaFxOpen).toContain('viewBox="0 0 24 24"');
        expect(svgFormulaFxOpen).toContain('stroke="currentColor"');
        expect(svgFormulaFxOpen).toMatch(/<text[\s\S]*>fx</);
        expect(svgFormulaFxOpen).toContain('xmlns="http://www.w3.org/2000/svg"');
    });
});
