import React, { useEffect, useState } from 'react';
import useAuth from '../../hooks/useAuth';

export default function StatisticsPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');

  const defaultStats = {
    completed: { day: 0, week: 0, month: 0, all_time: 0 },
    overdue_in_period: 0,
    teams_count: 0,
    projects_count: 0,
  };

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const base = process.env.REACT_APP_API_URL || '';
      const token = localStorage.getItem('access_token');
      const params = new URLSearchParams();
      if (periodFrom) params.set('period_from', new Date(periodFrom).toISOString());
      if (periodTo) params.set('period_to', new Date(periodTo).toISOString());
      const res = await fetch(`${base}/api/stats/user?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const stats = (() => {
    const base = defaultStats;
    if (!data || typeof data !== 'object') return base;
    return {
      ...base,
      ...data,
      completed: { ...base.completed, ...(data.completed || {}) }
    };
  })();

  const isAllZero =
    (stats.completed?.day ?? 0) === 0 &&
    (stats.completed?.week ?? 0) === 0 &&
    (stats.completed?.month ?? 0) === 0 &&
    (stats.completed?.all_time ?? 0) === 0 &&
    (stats.overdue_in_period ?? 0) === 0 &&
    (stats.teams_count ?? 0) === 0 &&
    (stats.projects_count ?? 0) === 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0D1414] to-[#16251C] p-6 text-sm text-gray-100">
      <div className="bg-[#0F1717] rounded-xl shadow-md p-6">
        <div className="flex items-center gap-4 mb-4">
          <button 
            onClick={() => window.location.href = '/tasks'}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            ← К задачам
          </button>
          <h2 className="text-xl font-semibold">Статистика</h2>
        </div>

        {loading && <div>Загрузка...</div>}
        {error && <div className="text-red-400">{error}</div>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[#0D1414] border border-gray-800 rounded p-4">
            <h3 className="text-lg font-medium mb-2">Выполненные задачи</h3>
            <ul className="space-y-1">
              <li>Сегодня: <b>{stats.completed?.day ?? 0}</b></li>
              <li>За неделю: <b>{stats.completed?.week ?? 0}</b></li>
              <li>За месяц: <b>{stats.completed?.month ?? 0}</b></li>
              <li>За всё время: <b>{stats.completed?.all_time ?? 0}</b></li>
            </ul>
          </div>
          <div className="bg-[#0D1414] border border-gray-800 rounded p-4">
            <h3 className="text-lg font-medium mb-3">Просрочки</h3>
            <div className="space-y-3">
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex-1 min-w-[120px]">
                  <label className="block text-gray-400 text-xs mb-1">Период с</label>
                  <input type="date" className="w-full bg-[#0D1414] border border-gray-700 rounded px-2 py-1 text-sm" value={periodFrom} onChange={(e)=>setPeriodFrom(e.target.value)} />
                </div>
                <div className="flex-1 min-w-[120px]">
                  <label className="block text-gray-400 text-xs mb-1">Период по</label>
                  <input type="date" className="w-full bg-[#0D1414] border border-gray-700 rounded px-2 py-1 text-sm" value={periodTo} onChange={(e)=>setPeriodTo(e.target.value)} />
                </div>
                <button onClick={fetchStats} className="bg-green-600 px-3 py-1 rounded text-sm whitespace-nowrap">Обновить</button>
              </div>
              <p>Просрочек за выбранный период: <b>{stats.overdue_in_period ?? 0}</b></p>
            </div>
          </div>
          <div className="bg-[#0D1414] border border-gray-800 rounded p-4">
            <h3 className="text-lg font-medium mb-2">Команды пользователя</h3>
            <p>Количество команд: <b>{stats.teams_count ?? 0}</b></p>
          </div>
          <div className="bg-[#0D1414] border border-gray-800 rounded p-4">
            <h3 className="text-lg font-medium mb-2">Проекты пользователя</h3>
            <p>Количество проектов: <b>{stats.projects_count ?? 0}</b></p>
          </div>
          <div className="bg-[#0D1414] border border-gray-800 rounded p-4 md:col-span-2">
            <h3 className="text-lg font-medium mb-2">Жалобы и похвалы</h3>
            <div className="flex gap-8">
              <p>Жалобы: <b>0</b></p>
              <p>Похвалы: <b>0</b></p>
              <span className="text-gray-500">(заглушка, будет реализовано позже)</span>
            </div>
          </div>
        </div>
        {!loading && !error && isAllZero && (
          <div className="mt-4 text-gray-400">Недостаточно данных</div>
        )}
      </div>
    </div>
  );
}
