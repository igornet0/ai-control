import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuth from '../../../../hooks/useAuth';
import { getUserStatistics } from '../../../../services/statsService';
import DraggableGrid from '../../../../components/DraggableGrid';

export default function StatisticsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
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
      const json = await getUserStatistics(periodFrom, periodTo);
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

  // Добавляем стили для блоков статистики
  React.useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .stats-block {
        min-height: 250px;
        max-height: 400px;
        display: flex;
        flex-direction: column;
        width: 100%;
      }
      
      .stats-block .block-content {
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  return (
    <div className="mt-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-slate-100 tracking-tight">📈 Статистика</h1>
        <div className="text-sm text-slate-400 hidden md:flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="2"/>
            <circle cx="12" cy="12" r="2"/>
            <circle cx="12" cy="19" r="2"/>
          </svg>
          Перетаскивайте за троеточие
        </div>
      </div>

        {loading ? (
          <div className="text-slate-400 mt-8">Загрузка...</div>
        ) : error ? (
          <div className="text-red-400 mt-8">{error}</div>
        ) : (
          <div className="mt-8">
            <DraggableGrid user={user} enableDragAndDrop={true} layoutType="statistics">
            {/* Выполненные задачи */}
            <div data-card-id="completed-tasks" className="card stats-block">
              <h3 className="text-lg font-semibold mb-3 text-slate-100">Выполненные задачи</h3>
              <div className="block-content">
                <ul className="space-y-3">
                  <li className="flex justify-between items-center p-3 rounded-lg bg-slate-800/30 backdrop-blur-sm border border-slate-700/50">
                    <span className="text-slate-300">Сегодня:</span>
                    <b className="text-slate-100">{stats.completed?.day ?? 0}</b>
                  </li>
                  <li className="flex justify-between items-center p-3 rounded-lg bg-slate-800/30 backdrop-blur-sm border border-slate-700/50">
                    <span className="text-slate-300">За неделю:</span>
                    <b className="text-slate-100">{stats.completed?.week ?? 0}</b>
                  </li>
                  <li className="flex justify-between items-center p-3 rounded-lg bg-slate-800/30 backdrop-blur-sm border border-slate-700/50">
                    <span className="text-slate-300">За месяц:</span>
                    <b className="text-slate-100">{stats.completed?.month ?? 0}</b>
                  </li>
                  <li className="flex justify-between items-center p-3 rounded-lg bg-slate-800/30 backdrop-blur-sm border border-slate-700/50">
                    <span className="text-slate-300">За всё время:</span>
                    <b className="text-slate-100">{stats.completed?.all_time ?? 0}</b>
                  </li>
                </ul>
              </div>
            </div>

            {/* Просрочки */}
            <div data-card-id="overdue-tasks" className="card stats-block">
              <h3 className="text-lg font-semibold mb-3 text-slate-100">Просрочки</h3>
              <div className="block-content">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="flex-1 min-w-[120px]">
                      <label className="form-label">Период с</label>
                      <input type="date" className="form-input text-sm" value={periodFrom} onChange={(e)=>setPeriodFrom(e.target.value)} />
                    </div>
                    <div className="flex-1 min-w-[120px]">
                      <label className="form-label">Период по</label>
                      <input type="date" className="form-input text-sm" value={periodTo} onChange={(e)=>setPeriodTo(e.target.value)} />
                    </div>
                    <button onClick={fetchStats} className="btn btn-secondary btn-sm whitespace-nowrap">Обновить</button>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 flex justify-between items-center">
                    <span className="text-slate-300">Просрочек за выбранный период:</span>
                    <b className="text-slate-100">{stats.overdue_in_period ?? 0}</b>
                  </div>
                </div>
              </div>
            </div>

            {/* Команды пользователя */}
            <div data-card-id="user-teams" className="card stats-block">
              <h3 className="text-lg font-semibold mb-3 text-slate-100">Команды пользователя</h3>
              <div className="block-content">
                <div className="p-3 rounded-lg bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 flex justify-between items-center">
                  <span className="text-slate-300">Количество команд:</span>
                  <b className="text-slate-100">{stats.teams_count ?? 0}</b>
                </div>
              </div>
            </div>

            {/* Проекты пользователя */}
            <div data-card-id="user-projects" className="card stats-block">
              <h3 className="text-lg font-semibold mb-3 text-slate-100">Проекты пользователя</h3>
              <div className="block-content">
                <div className="p-3 rounded-lg bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 flex justify-between items-center">
                  <span className="text-slate-300">Количество проектов:</span>
                  <b className="text-slate-100">{stats.projects_count ?? 0}</b>
                </div>
              </div>
            </div>

            {/* Жалобы и похвалы */}
            <div data-card-id="feedback" className="card stats-block">
              <h3 className="text-lg font-semibold mb-3 text-slate-100">Жалобы и похвалы</h3>
              <div className="block-content">
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 flex justify-between items-center">
                    <span className="text-slate-300">Жалобы:</span>
                    <b className="text-slate-100">0</b>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 flex justify-between items-center">
                    <span className="text-slate-300">Похвалы:</span>
                    <b className="text-slate-100">0</b>
                  </div>
                  <div className="text-xs text-slate-500 text-center italic">(заглушка, будет реализовано позже)</div>
                </div>
              </div>
            </div>
            </DraggableGrid>
          </div>
        )}

      {!loading && !error && isAllZero && (
        <div className="mt-4 text-slate-400">Недостаточно данных</div>
      )}
    </div>
  );
}
