import React, { useEffect, useState } from 'react';
import { ChartBarIcon } from '@heroicons/react/24/outline';
import { strategyApiService } from '../../../../services/strategyApiService';

function ProgressBar({ value, max, color = 'bg-indigo-500' }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>
        <span>{value} / {max}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function StatBadge({ label, value, color }) {
  return (
    <div className={`flex flex-col items-center px-3 py-2 rounded-lg ${color}`}>
      <span className="text-lg font-bold">{value}</span>
      <span className="text-xs mt-0.5 opacity-80">{label}</span>
    </div>
  );
}

/**
 * Widget board showing goal progress stats.
 *
 * Props:
 *   mode        – "company" | "department" | "all"
 *   departmentId – required when mode==="department"
 *   departmentName
 */
export default function StrategyWidgetBoard({ mode = 'company', departmentId, departmentName }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    const fetch = async () => {
      try {
        if (mode === 'all') {
          setData(await strategyApiService.getAllWidgets());
        } else if (mode === 'department') {
          const stats = await strategyApiService.getDeptWidgets(departmentId);
          setData(stats);
        } else {
          setData(await strategyApiService.getCompanyWidgets());
        }
      } catch {
        setError('Не удалось загрузить виджеты');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [mode, departmentId]);

  if (loading) return <p className="text-sm py-4" style={{ color: 'var(--color-text-muted)' }}>Загрузка виджетов...</p>;
  if (error) return <p className="text-sm text-red-400">{error}</p>;
  if (!data) return null;

  const renderStats = (stats, label) => (
    <div className="card">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
        <ChartBarIcon className="w-4 h-4 shrink-0" aria-hidden />
        {label}
      </h3>
      {stats.total === 0 ? (
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Целей нет.</p>
      ) : (
        <>
          <div className="mb-4">
            <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>Выполнение целей</p>
            <ProgressBar value={stats.done} max={stats.total} color="bg-green-500" />
          </div>
          <div className="flex gap-2 flex-wrap">
            <StatBadge label="Выполнено" value={stats.done} color="bg-green-500/15 text-green-300" />
            <StatBadge label="В работе" value={stats.in_progress} color="bg-blue-500/15 text-blue-300" />
            <StatBadge label="Запланировано" value={stats.planned} color="bg-slate-500/15 text-slate-300" />
            {stats.overdue > 0 && (
              <StatBadge label="Просрочено" value={stats.overdue} color="bg-red-500/15 text-red-300" />
            )}
          </div>
        </>
      )}
    </div>
  );

  // mode==="all": show company + all departments
  if (mode === 'all' && data.company) {
    return (
      <div className="space-y-4">
        {renderStats(data.company, 'Компания в целом')}
        {(data.departments || []).map((ds) => (
          <div key={ds.department_id}>
            {renderStats(ds, `Отдел #${ds.department_id}`)}
          </div>
        ))}
      </div>
    );
  }

  // mode==="department" or "company"
  const label = mode === 'department'
    ? (departmentName || `Отдел #${departmentId}`)
    : 'Компания';
  return renderStats(data, label);
}
