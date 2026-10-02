import React, { useCallback, useEffect, useState } from 'react';
import { adminService } from '../../../services/adminService';
import { AdminIcon } from './AdminIcons';

export default function AdminHeroDemoPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [dashboardId, setDashboardId] = useState('');
  const [dashboards, setDashboards] = useState([]);
  const [config, setConfig] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [cfg, list] = await Promise.all([
        adminService.getHeroDemo(),
        adminService.listHeroDemoDashboards(),
      ]);
      setConfig(cfg);
      setEnabled(Boolean(cfg?.enabled));
      setDashboardId(cfg?.dashboard_id != null ? String(cfg.dashboard_id) : '');
      setDashboards(Array.isArray(list) ? list : []);
    } catch (e) {
      setError(e?.response?.data?.detail || e?.message || 'Не удалось загрузить настройки демо');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onSave = async () => {
    setSaving(true);
    setError('');
    setOkMsg('');
    try {
      const payload = {
        enabled,
        dashboard_id: enabled && dashboardId ? Number(dashboardId) : null,
      };
      const cfg = await adminService.saveHeroDemo(payload);
      setConfig(cfg);
      setEnabled(Boolean(cfg?.enabled));
      setDashboardId(cfg?.dashboard_id != null ? String(cfg.dashboard_id) : '');
      setOkMsg(
        cfg?.enabled
          ? 'Демо включено. Гости откроют публичную ссылку на дашборд (с моделями данных).'
          : 'Демо выключено.',
      );
    } catch (e) {
      setError(e?.response?.data?.detail || e?.message || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const sharePath = config?.share_path;

  return (
    <div
      className="rounded-2xl p-6 border animate-slideInLeft"
      style={{
        animationDelay: '0.15s',
        background: 'linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(99,102,241,0.04) 100%)',
        borderColor: 'rgba(139,92,246,0.2)',
      }}
    >
      <div className="flex items-start gap-4 mb-5">
        <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(139,92,246,0.25)]">
          <AdminIcon name="dashboards" size="md" className="text-violet-300" />
        </div>
        <div>
          <h3 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Демо на главной
            <span className="ml-2 text-xs font-normal px-2 py-0.5 rounded-full" style={{ background: 'rgba(139,92,246,0.2)', color: '#c4b5fd' }}>
              «Смотреть демо»
            </span>
          </h3>
          <p className="text-sm mt-1 leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            Выберите дашборд — кнопка на лендинге откроет его без авторизации. Связанные модели
            данных станут доступны через публичную share-ссылку.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2" style={{ color: 'var(--color-text-secondary)' }}>
          <div className="w-4 h-4 rounded-full border-2 border-violet-400/40 border-t-violet-400 animate-spin" />
          <span className="text-sm">Загрузка…</span>
        </div>
      ) : (
        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer group">
            <div className="relative">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="sr-only"
              />
              <div
                className="w-10 h-5 rounded-full transition-all"
                style={{ background: enabled ? 'rgba(139,92,246,0.8)' : 'rgba(255,255,255,0.1)' }}
              />
              <div
                className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-all"
                style={{ transform: enabled ? 'translateX(20px)' : 'translateX(0)' }}
              />
            </div>
            <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
              Публичное демо {enabled ? 'включено' : 'выключено'}
            </span>
          </label>

          <div>
            <label className="block text-xs font-medium mb-1.5 uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
              Дашборд
            </label>
            <select
              className="w-full max-w-xl px-3 py-2.5 rounded-xl text-sm transition-all"
              style={{
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(139,92,246,0.25)',
                color: 'var(--color-text-primary)',
                opacity: !enabled ? 0.5 : 1,
              }}
              value={dashboardId}
              disabled={!enabled}
              onChange={(e) => setDashboardId(e.target.value)}
            >
              <option value="">— не выбран —</option>
              {dashboards.map((d) => (
                <option key={d.id} value={d.id}>
                  #{d.id} · {d.name}
                  {d.is_public ? ' (public)' : ''}
                </option>
              ))}
            </select>
          </div>

          {config?.data_models?.length > 0 && (
            <div
              className="rounded-xl p-3"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--color-text-muted)' }}>
                Модели данных дашборда
              </div>
              <ul className="space-y-1">
                {config.data_models.map((m) => (
                  <li key={m.id} className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400/60 shrink-0" />
                    <span>#{m.id} · {m.name}</span>
                    {m.is_public && (
                      <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(16,185,129,0.15)', color: '#6ee7b7' }}>
                        публичная
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {sharePath && (
            <div
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm"
              style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}
            >
              <AdminIcon name="externalLink" size="sm" className="text-indigo-400 shrink-0" />
              <span style={{ color: 'var(--color-text-muted)' }}>Ссылка для гостей:</span>
              <a className="text-indigo-400 hover:text-indigo-300 underline truncate" href={sharePath} target="_blank" rel="noreferrer">
                {sharePath}
              </a>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-400 rounded-xl px-3 py-2" style={{ background: 'rgba(239,68,68,0.08)' }}>
              <AdminIcon name="error" size="sm" />
              {error}
            </div>
          )}
          {okMsg && (
            <div className="flex items-center gap-2 text-sm text-emerald-400 rounded-xl px-3 py-2" style={{ background: 'rgba(16,185,129,0.08)' }}>
              <AdminIcon name="success" size="sm" />
              {okMsg}
            </div>
          )}

          <div className="pt-1">
            <button
              type="button"
              disabled={saving || (enabled && !dashboardId)}
              onClick={() => void onSave()}
              className="px-5 py-2 rounded-xl text-sm font-medium transition-all hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
              style={{
                background: 'linear-gradient(135deg, rgba(99,102,241,0.8), rgba(139,92,246,0.8))',
                color: '#fff',
                boxShadow: '0 4px 15px rgba(99,102,241,0.25)',
              }}
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                  Сохранение…
                </span>
              ) : 'Сохранить'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
