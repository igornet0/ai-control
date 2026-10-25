import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { dashboardService } from '../../../services/dashboardService';
import { normalizeLayoutConfig } from '../../../utils/dashboardAutoRefresh.js';
import { colorToRgba, parseColorRgb } from '../src/widgets/common/colorToRgba.js';
import {
  BG_STYLE_OPTIONS,
  DASHBOARD_FONTS,
  DASHBOARD_THEME_PRESETS,
  DEFAULT_THEME_ID,
  SHADOW_OPTIONS,
  applyDashboardTheme,
  fontStack,
  getThemePreset,
  loadCustomThemes,
  loadThemeFont,
  normalizeTheme,
  pushThemeHistory,
  resolveThemeTokens,
  saveCustomThemes,
  themeLabel,
  themesEqual,
} from '../src/theme/dashboardThemes.js';

const TABS = [
  { id: 'presets', label: 'Готовые' },
  { id: 'custom', label: 'Настроить' },
  { id: 'mine', label: 'Мои стили' },
  { id: 'history', label: 'История' },
];

function toHex(color, fallback = '#000000') {
  const rgb = parseColorRgb(color);
  if (!rgb) return fallback;
  return `#${[rgb.r, rgb.g, rgb.b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function formatDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function previewBackground(tk) {
  if (tk.bgStyle === 'linear') return `linear-gradient(160deg, ${tk.bg}, ${tk.bg2})`;
  if (tk.bgStyle === 'radial') {
    return `radial-gradient(ellipse 80% 70% at 15% 0%, ${colorToRgba(tk.bg2, 0.95)}, transparent 70%), ${tk.bg}`;
  }
  return tk.bg;
}

/** Миниатюра стиля: фон, два «виджета», акцентная полоса, образец шрифта. */
function ThemePreview({ theme }) {
  const tk = resolveThemeTokens(theme);
  const surface = colorToRgba(tk.surface, Math.max(tk.surfaceOpacity, 0.35));
  const border = `1px solid ${colorToRgba(tk.border, Math.max(tk.borderOpacity, 0.06))}`;
  const radius = Math.min(tk.radius, 12) / 2 + 2;
  return (
    <div className="dash-theme-preview" style={{ background: previewBackground(tk), fontFamily: fontStack(tk.font) }}>
      <div className="dash-theme-preview__card" style={{ background: surface, border, borderRadius: radius }}>
        <span style={{ color: tk.text2 }}>Выручка</span>
        <strong style={{ color: tk.text }}>12,4 млн</strong>
        <i style={{ background: `linear-gradient(90deg, ${tk.accent}, ${tk.accent2})` }} />
      </div>
      <div className="dash-theme-preview__card dash-theme-preview__card--bars" style={{ background: surface, border, borderRadius: radius }}>
        {[0.45, 0.8, 0.6, 1].map((h, i) => (
          <b key={i} style={{ height: `${h * 100}%`, background: i % 2 ? tk.accent2 : tk.accent }} />
        ))}
      </div>
    </div>
  );
}

function ColorField({ label, value, onChange }) {
  return (
    <label className="dash-theme-field dash-theme-field--color">
      <span>{label}</span>
      <input type="color" value={toHex(value)} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function RangeField({ label, value, min, max, step = 1, format = (v) => v, onChange }) {
  return (
    <label className="dash-theme-field dash-theme-field--range">
      <span>{label}<em>{format(value)}</em></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

function SelectField({ label, value, options, onChange }) {
  return (
    <label className="dash-theme-field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    </label>
  );
}

/**
 * Панель глобального стиля дашборда. Изменения сразу видны на #viewport (черновик);
 * «Сохранить» пишет layout_config.theme и кладёт прежний стиль в theme_history.
 * Закрытие без сохранения возвращает стиль, который был при открытии.
 */
export default function DashboardThemeModal({ open, onClose, dashboardId, getViewport, onRerender, onSaved }) {
  const [tab, setTab] = useState('presets');
  const [draft, setDraft] = useState(() => normalizeTheme(null));
  const [saved, setSaved] = useState(() => normalizeTheme(null));
  const [history, setHistory] = useState([]);
  const [custom, setCustom] = useState([]);
  const [customName, setCustomName] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const rerenderTimer = useRef(null);

  const preview = useCallback(
    (theme) => {
      applyDashboardTheme(getViewport?.(), theme, {
        rerender: () => {
          clearTimeout(rerenderTimer.current);
          rerenderTimer.current = setTimeout(() => onRerender?.(), 150);
        },
      });
    },
    [getViewport, onRerender],
  );

  useEffect(() => () => clearTimeout(rerenderTimer.current), []);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setError(null);
    setNotice(null);
    setCustom(loadCustomThemes());
    DASHBOARD_FONTS.forEach((f) => loadThemeFont(f.id));
    if (!dashboardId) return undefined;
    setLoading(true);
    dashboardService
      .getDashboard(dashboardId)
      .then((dash) => {
        if (cancelled) return;
        const layout = normalizeLayoutConfig(dash?.layout_config);
        const current = normalizeTheme(layout.theme);
        setSaved(current);
        setDraft(current);
        setHistory(Array.isArray(layout.theme_history) ? layout.theme_history.filter((h) => h?.theme) : []);
      })
      .catch((e) => !cancelled && setError(e?.message || 'Не удалось загрузить стиль'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, dashboardId]);

  const updateDraft = useCallback(
    (next) => {
      const t = normalizeTheme(next);
      setDraft(t);
      setNotice(null);
      preview(t);
    },
    [preview],
  );

  const tokens = useMemo(() => resolveThemeTokens(draft), [draft]);
  const dirty = !themesEqual(draft, saved);

  const setToken = (key, value) => {
    const base = getThemePreset(draft.preset);
    const overrides = { ...draft.overrides };
    if (base[key] === value) delete overrides[key];
    else overrides[key] = value;
    updateDraft({ preset: draft.preset, overrides });
  };

  const close = useCallback(() => {
    if (!themesEqual(draft, saved)) preview(saved);
    onClose?.();
  }, [draft, saved, preview, onClose]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  const save = async () => {
    if (!dashboardId) return;
    setSaving(true);
    setError(null);
    try {
      const dash = await dashboardService.getDashboard(dashboardId);
      const layout = normalizeLayoutConfig(dash?.layout_config);
      const prev = normalizeTheme(layout.theme);
      const nextHistory = themesEqual(prev, draft) ? layout.theme_history || [] : pushThemeHistory(layout.theme_history, prev);
      await dashboardService.updateDashboard(dashboardId, {
        layout_config: { ...layout, theme: draft, theme_history: nextHistory },
      });
      setSaved(draft);
      setHistory(nextHistory);
      setNotice('Стиль сохранён');
      onSaved?.(draft);
    } catch (e) {
      setError(e?.response?.data?.detail || e?.message || 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  const addCustom = () => {
    const name = customName.trim() || themeLabel(draft);
    const list = [{ id: `${Date.now()}`, name: name.slice(0, 60), theme: draft }, ...custom];
    setCustom(list);
    saveCustomThemes(list);
    setCustomName('');
    setNotice(`Стиль «${name}» добавлен в «Мои стили»`);
  };

  const removeCustom = (id) => {
    const list = custom.filter((s) => s.id !== id);
    setCustom(list);
    saveCustomThemes(list);
  };

  if (!open) return null;

  const gridOn = tokens.grid !== 'none';
  const darkPresets = DASHBOARD_THEME_PRESETS.filter((p) => p.mode !== 'light');
  const lightPresets = DASHBOARD_THEME_PRESETS.filter((p) => p.mode === 'light');

  const renderPresetGrid = (list) => (
    <div className="dash-theme-grid">
      {list.map((p) => {
        const active = draft.preset === p.id;
        return (
          <button
            key={p.id}
            type="button"
            className={`dash-theme-tile${active ? ' is-active' : ''}`}
            onClick={() => updateDraft({ preset: p.id })}
          >
            <ThemePreview theme={{ preset: p.id }} />
            <span className="dash-theme-tile__name">
              {p.name}
              {active && Object.keys(draft.overrides).length > 0 && <em> · изменён</em>}
            </span>
          </button>
        );
      })}
    </div>
  );

  return createPortal(
    <div className="dash-theme-overlay" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <aside className="dash-theme-drawer" role="dialog" aria-label="Стиль дашборда">
        <header className="dash-theme-drawer__header">
          <div>
            <h3>Стиль дашборда</h3>
            <p>{themeLabel(draft)}{dirty ? ' — не сохранено' : ''}</p>
          </div>
          <button type="button" className="dash-theme-drawer__close" onClick={close} aria-label="Закрыть">×</button>
        </header>

        <nav className="dash-theme-tabs">
          {TABS.map((t) => (
            <button key={t.id} type="button" className={tab === t.id ? 'is-active' : ''} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>

        <div className="dash-theme-drawer__body">
          {loading && <div className="dash-theme-note">Загрузка…</div>}

          {tab === 'presets' && (
            <>
              <h4 className="dash-theme-section">Тёмные</h4>
              {renderPresetGrid(darkPresets)}
              <h4 className="dash-theme-section">Светлые</h4>
              {renderPresetGrid(lightPresets)}
            </>
          )}

          {tab === 'custom' && (
            <div className="dash-theme-form">
              <p className="dash-theme-note">
                Основа — «{getThemePreset(draft.preset).name}». Правки накладываются поверх неё.
              </p>
              <h4 className="dash-theme-section">Режим и фон</h4>
              <div className="dash-theme-segment">
                {[{ id: 'dark', label: 'Тёмный' }, { id: 'light', label: 'Светлый' }].map((m) => (
                  <button key={m.id} type="button" className={tokens.mode === m.id ? 'is-active' : ''} onClick={() => setToken('mode', m.id)}>
                    {m.label}
                  </button>
                ))}
              </div>
              <SelectField label="Заливка фона" value={tokens.bgStyle} options={BG_STYLE_OPTIONS} onChange={(v) => setToken('bgStyle', v)} />
              <div className="dash-theme-row">
                <ColorField label="Фон" value={tokens.bg} onChange={(v) => setToken('bg', v)} />
                <ColorField label="Фон 2" value={tokens.bg2} onChange={(v) => setToken('bg2', v)} />
              </div>
              <div className="dash-theme-row">
                <label className="dash-theme-field dash-theme-field--check">
                  <input
                    type="checkbox"
                    checked={gridOn}
                    onChange={(e) => setToken('grid', e.target.checked ? colorToRgba(tokens.accent, 0.07) : 'none')}
                  />
                  <span>Сетка</span>
                </label>
                {gridOn && (
                  <ColorField label="Цвет сетки" value={tokens.grid} onChange={(v) => setToken('grid', colorToRgba(v, tokens.mode === 'light' ? 0.08 : 0.07))} />
                )}
              </div>

              <h4 className="dash-theme-section">Виджеты</h4>
              <div className="dash-theme-row">
                <ColorField label="Фон виджета" value={tokens.surface} onChange={(v) => setToken('surface', v)} />
                <ColorField label="Рамка" value={tokens.border} onChange={(v) => setToken('border', v)} />
              </div>
              <RangeField label="Непрозрачность фона" value={tokens.surfaceOpacity} min={0} max={1} step={0.01} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => setToken('surfaceOpacity', v)} />
              <RangeField label="Заметность рамки" value={tokens.borderOpacity} min={0} max={1} step={0.01} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => setToken('borderOpacity', v)} />
              <RangeField label="Толщина рамки" value={tokens.borderWidth ?? 1} min={0} max={4} format={(v) => `${v}px`} onChange={(v) => setToken('borderWidth', v)} />
              <RangeField label="Скругление" value={tokens.radius} min={0} max={40} format={(v) => `${v}px`} onChange={(v) => setToken('radius', v)} />
              <RangeField label="Размытие (стекло)" value={tokens.blur} min={0} max={40} format={(v) => `${v}px`} onChange={(v) => setToken('blur', v)} />
              <SelectField label="Тень" value={tokens.shadow} options={SHADOW_OPTIONS} onChange={(v) => setToken('shadow', v)} />

              <h4 className="dash-theme-section">Текст и шрифт</h4>
              <SelectField label="Шрифт" value={tokens.font} options={DASHBOARD_FONTS} onChange={(v) => setToken('font', v)} />
              <div className="dash-theme-font-sample" style={{ fontFamily: fontStack(tokens.font) }}>Съешь же ещё этих мягких булок — 1 234 567</div>
              <div className="dash-theme-row dash-theme-row--3">
                <ColorField label="Основной" value={tokens.text} onChange={(v) => setToken('text', v)} />
                <ColorField label="Вторичный" value={tokens.text2} onChange={(v) => setToken('text2', v)} />
                <ColorField label="Подписи" value={tokens.text3} onChange={(v) => setToken('text3', v)} />
              </div>

              <h4 className="dash-theme-section">Акценты</h4>
              <div className="dash-theme-row">
                <ColorField label="Акцент" value={tokens.accent} onChange={(v) => setToken('accent', v)} />
                <ColorField label="Акцент 2" value={tokens.accent2} onChange={(v) => setToken('accent2', v)} />
              </div>

              <button
                type="button"
                className="dash-theme-btn"
                disabled={!Object.keys(draft.overrides).length}
                onClick={() => updateDraft({ preset: draft.preset })}
              >
                Сбросить правки
              </button>
            </div>
          )}

          {tab === 'mine' && (
            <>
              <div className="dash-theme-save-row">
                <input
                  type="text"
                  value={customName}
                  maxLength={60}
                  placeholder={themeLabel(draft)}
                  onChange={(e) => setCustomName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addCustom()}
                />
                <button type="button" className="dash-theme-btn dash-theme-btn--primary" onClick={addCustom}>
                  Запомнить текущий
                </button>
              </div>
              <p className="dash-theme-note">Мои стили хранятся в этом браузере и доступны во всех дашбордах.</p>
              {custom.length === 0 && <div className="dash-theme-empty">Пока пусто. Настройте стиль и запомните его.</div>}
              <div className="dash-theme-grid">
                {custom.map((s) => (
                  <div key={s.id} className={`dash-theme-tile${themesEqual(s.theme, draft) ? ' is-active' : ''}`}>
                    <button type="button" className="dash-theme-tile__hit" onClick={() => updateDraft(s.theme)}>
                      <ThemePreview theme={s.theme} />
                      <span className="dash-theme-tile__name">{s.name}</span>
                    </button>
                    <button type="button" className="dash-theme-tile__remove" title="Удалить" onClick={() => removeCustom(s.id)}>×</button>
                  </div>
                ))}
              </div>
            </>
          )}

          {tab === 'history' && (
            <>
              <button
                type="button"
                className="dash-theme-btn dash-theme-btn--primary dash-theme-btn--wide"
                disabled={!history.length}
                onClick={() => updateDraft(history[0].theme)}
              >
                ↶ Вернуть предыдущий стиль
              </button>
              <p className="dash-theme-note">Выберите стиль, чтобы посмотреть его, и нажмите «Сохранить», чтобы откатиться.</p>
              <ul className="dash-theme-history">
                <li className={themesEqual(saved, draft) ? 'is-active' : ''}>
                  <button type="button" onClick={() => updateDraft(saved)}>
                    <ThemePreview theme={saved} />
                    <span><strong>{themeLabel(saved)}</strong><small>Сохранён сейчас</small></span>
                  </button>
                </li>
                {history.map((h, i) => (
                  <li key={`${h.savedAt}-${i}`} className={themesEqual(h.theme, draft) ? 'is-active' : ''}>
                    <button type="button" onClick={() => updateDraft(h.theme)}>
                      <ThemePreview theme={h.theme} />
                      <span><strong>{themeLabel(h.theme)}</strong><small>до {formatDate(h.savedAt)}</small></span>
                    </button>
                  </li>
                ))}
              </ul>
              {!history.length && <div className="dash-theme-empty">История появится после первого сохранения стиля.</div>}
            </>
          )}
        </div>

        <footer className="dash-theme-drawer__footer">
          {error && <div className="dash-theme-msg dash-theme-msg--error">{error}</div>}
          {notice && !error && <div className="dash-theme-msg">{notice}</div>}
          <div className="dash-theme-actions">
            <button
              type="button"
              className="dash-theme-btn dash-theme-btn--ghost"
              disabled={themesEqual(draft, { preset: DEFAULT_THEME_ID })}
              onClick={() => updateDraft({ preset: DEFAULT_THEME_ID })}
            >
              К стандартному
            </button>
            <span className="dash-theme-actions__spacer" />
            <button type="button" className="dash-theme-btn" disabled={!dirty} onClick={() => updateDraft(saved)}>
              Отменить
            </button>
            <button type="button" className="dash-theme-btn dash-theme-btn--primary" disabled={!dirty || saving || !dashboardId} onClick={save}>
              {saving ? 'Сохранение…' : 'Сохранить'}
            </button>
          </div>
        </footer>
      </aside>
    </div>,
    document.body,
  );
}
