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
        <h1 className="text-2xl font-bold text-gray-100">Статистика</h1>
        <div className="text-sm text-gray-400 hidden md:flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="2"/>
            <circle cx="12" cy="12" r="2"/>
            <circle cx="12" cy="19" r="2"/>
          </svg>
          Перетаскивайте за троеточие
        </div>
      </div>

        {loading ? (
          <div className="text-gray-400">Загрузка...</div>
        ) : error ? (
          <div className="text-red-400">{error}</div>
        ) : (
          <DraggableGrid user={user} enableDragAndDrop={true} layoutType="statistics">
            {/* Выполненные задачи */}
            <div data-card-id="completed-tasks" className="bg-[#0F1717] rounded-xl p-4 border border-gray-700 stats-block">
              <h3 className="text-lg font-semibold mb-3">Выполненные задачи</h3>
              <div className="block-content">
                <ul className="space-y-2">
                  <li>Сегодня: <b>{stats.completed?.day ?? 0}</b></li>
                  <li>За неделю: <b>{stats.completed?.week ?? 0}</b></li>
                  <li>За месяц: <b>{stats.completed?.month ?? 0}</b></li>
                  <li>За всё время: <b>{stats.completed?.all_time ?? 0}</b></li>
                </ul>
              </div>
            </div>

            {/* Просрочки */}
            <div data-card-id="overdue-tasks" className="bg-[#0F1717] rounded-xl p-4 border border-gray-700 stats-block">
              <h3 className="text-lg font-semibold mb-3">Просрочки</h3>
              <div className="block-content">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="flex-1 min-w-[120px]">
                      <label className="block text-gray-400 text-xs mb-1">Период с</label>
                      <input type="date" className="w-full bg-[#16251C] border border-gray-700 rounded px-3 py-2 text-sm" value={periodFrom} onChange={(e)=>setPeriodFrom(e.target.value)} />
                    </div>
                    <div className="flex-1 min-w-[120px]">
                      <label className="block text-gray-400 text-xs mb-1">Период по</label>
                      <input type="date" className="w-full bg-[#16251C] border border-gray-700 rounded px-3 py-2 text-sm" value={periodTo} onChange={(e)=>setPeriodTo(e.target.value)} />
                    </div>
                    <button onClick={fetchStats} className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded text-sm whitespace-nowrap transition-colors">Обновить</button>
                  </div>
                  <p>Просрочек за выбранный период: <b>{stats.overdue_in_period ?? 0}</b></p>
                </div>
              </div>
            </div>

            {/* Команды пользователя */}
            <div data-card-id="user-teams" className="bg-[#0F1717] rounded-xl p-4 border border-gray-700 stats-block">
              <h3 className="text-lg font-semibold mb-3">Команды пользователя</h3>
              <div className="block-content">
                <p>Количество команд: <b>{stats.teams_count ?? 0}</b></p>
              </div>
            </div>

            {/* Проекты пользователя */}
            <div data-card-id="user-projects" className="bg-[#0F1717] rounded-xl p-4 border border-gray-700 stats-block">
              <h3 className="text-lg font-semibold mb-3">Проекты пользователя</h3>
              <div className="block-content">
                <p>Количество проектов: <b>{stats.projects_count ?? 0}</b></p>
              </div>
            </div>

            {/* Жалобы и похвалы */}
            <div data-card-id="feedback" className="bg-[#0F1717] rounded-xl p-4 border border-gray-700 stats-block">
              <h3 className="text-lg font-semibold mb-3">Жалобы и похвалы</h3>
              <div className="block-content">
                <div className="flex gap-8">
                  <p>Жалобы: <b>0</b></p>
                  <p>Похвалы: <b>0</b></p>
                  <span className="text-gray-500">(заглушка, будет реализовано позже)</span>
                </div>
              </div>
            </div>
          </DraggableGrid>
        )}

      {!loading && !error && isAllZero && (
        <div className="mt-4 text-gray-400">Недостаточно данных</div>
      )}
    </div>
  );
}
