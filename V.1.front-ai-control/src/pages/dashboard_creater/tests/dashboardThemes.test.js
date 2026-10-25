// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  DASHBOARD_THEME_PRESETS,
  THEME_HISTORY_LIMIT,
  normalizeTheme,
  isDefaultTheme,
  themesEqual,
  resolveThemeTokens,
  buildThemeVars,
  applyDashboardTheme,
  pushThemeHistory,
  loadCustomThemes,
  saveCustomThemes,
} from '../src/theme/dashboardThemes.js';
import { defaultTextColor, defaultFontFamily, adaptTextColor, setThemeRuntime } from '../src/theme/themeRuntime.js';

const LIGHT = DASHBOARD_THEME_PRESETS.find((p) => p.mode === 'light');

describe('normalizeTheme', () => {
  it('falls back to dark for unknown input', () => {
    expect(normalizeTheme(null)).toEqual({ preset: 'dark', overrides: {} });
    expect(normalizeTheme({ preset: 'nope' }).preset).toBe('dark');
    expect(isDefaultTheme(undefined)).toBe(true);
  });

  it('keeps only valid overrides and clamps numbers', () => {
    const t = normalizeTheme({
      preset: LIGHT.id,
      overrides: { bg: '#fff', text: 'not-a-color', radius: 99, blur: -5, font: 'Comic', evil: 'x', shadow: 'bogus' },
    });
    expect(t.overrides).toEqual({ bg: '#fff', radius: 40, blur: 0 });
  });

  it('compares themes by value', () => {
    expect(themesEqual({ preset: 'dark', overrides: { radius: 8 } }, { preset: 'dark', overrides: { radius: '8' } })).toBe(true);
    expect(themesEqual({ preset: 'dark' }, { preset: LIGHT.id })).toBe(false);
  });
});

describe('presets', () => {
  it('have unique ids and produce every variable', () => {
    const ids = new Set(DASHBOARD_THEME_PRESETS.map((p) => p.id));
    expect(ids.size).toBe(DASHBOARD_THEME_PRESETS.length);
    expect(DASHBOARD_THEME_PRESETS.length).toBeGreaterThanOrEqual(20);
    for (const p of DASHBOARD_THEME_PRESETS) {
      const vars = buildThemeVars(resolveThemeTokens({ preset: p.id }));
      for (const [k, v] of Object.entries(vars)) {
        expect(typeof v, `${p.id} ${k}`).toBe('string');
        expect(v, `${p.id} ${k}`).not.toMatch(/undefined|NaN/);
      }
    }
  });

  it('applies overrides on top of the preset', () => {
    const tk = resolveThemeTokens({ preset: LIGHT.id, overrides: { accent: '#ff0000' } });
    expect(tk.accent).toBe('#ff0000');
    expect(tk.mode).toBe('light');
    expect(buildThemeVars(tk)['--dash-accent']).toBe('#ff0000');
  });
});

describe('applyDashboardTheme', () => {
  it('sets variables, classes and runtime values, and clears them for the default', () => {
    const el = document.createElement('div');
    let calls = 0;
    applyDashboardTheme(el, { preset: LIGHT.id, overrides: { text: '#123456' } }, { rerender: () => calls++ });
    expect(el.classList.contains('dash-themed')).toBe(true);
    expect(el.classList.contains('dash-theme-light')).toBe(true);
    expect(el.style.getPropertyValue('--dash-text')).toBe('#123456');
    expect(defaultTextColor()).toBe('#123456');
    expect(calls).toBe(1);

    applyDashboardTheme(el, { preset: 'dark' });
    expect(el.classList.contains('dash-themed')).toBe(false);
    expect(el.style.getPropertyValue('--dash-text')).toBe('');
    expect(defaultTextColor()).toBe('#E4E6EB');
    expect(defaultFontFamily()).toBe('Inter');
  });
});

describe('pushThemeHistory', () => {
  it('prepends, skips consecutive duplicates and caps the length', () => {
    let h = pushThemeHistory([], { preset: 'dark' }, 't1');
    h = pushThemeHistory(h, { preset: 'dark' }, 't2');
    expect(h).toHaveLength(1);
    h = pushThemeHistory(h, { preset: LIGHT.id }, 't3');
    expect(h[0]).toEqual({ theme: { preset: LIGHT.id, overrides: {} }, savedAt: 't3' });
    for (let i = 0; i < 20; i++) h = pushThemeHistory(h, { preset: 'dark', overrides: { radius: i } }, `x${i}`);
    expect(h).toHaveLength(THEME_HISTORY_LIMIT);
  });
});

describe('custom themes storage', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips and drops broken entries', () => {
    saveCustomThemes([{ id: 'a', name: 'Мой', theme: { preset: LIGHT.id } }]);
    expect(loadCustomThemes()).toEqual([{ id: 'a', name: 'Мой', theme: { preset: LIGHT.id, overrides: {} } }]);
    localStorage.setItem('dashboard.customThemes.v1', '{bad json');
    expect(loadCustomThemes()).toEqual([]);
  });
});

describe('adaptTextColor', () => {
  it('keeps colors as is for the default theme', () => {
    setThemeRuntime({});
    expect(adaptTextColor('#FFFFFF')).toBe('#FFFFFF');
    expect(adaptTextColor('')).toBe('');
  });

  it('replaces near-white text on light themes only', () => {
    setThemeRuntime({ textColor: '#0F172A', mode: 'light' });
    expect(adaptTextColor('#F8FAFC')).toBe('#0F172A');
    expect(adaptTextColor('#ffffff')).toBe('#0F172A');
    expect(adaptTextColor('#00E0FF')).toBe('#00E0FF');
    expect(adaptTextColor('#8B5CF6')).toBe('#8B5CF6');
    expect(adaptTextColor('not-a-color')).toBe('not-a-color');
    setThemeRuntime({});
  });

  it('replaces near-black text on dark themes', () => {
    setThemeRuntime({ textColor: '#E4E6EB', mode: 'dark' });
    expect(adaptTextColor('#000000')).toBe('#E4E6EB');
    expect(adaptTextColor('#F8FAFC')).toBe('#F8FAFC');
    setThemeRuntime({});
  });
});
