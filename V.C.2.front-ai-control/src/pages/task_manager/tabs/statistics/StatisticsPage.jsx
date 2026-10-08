import React from 'react';
import useAuth from '../../../../hooks/useAuth';
import DraggableGrid from '../../../../components/DraggableGrid';
import { StatisticsIcon } from '../../components/TaskManagerIcons';
import {
  StatisticsCompletedWidget,
  StatisticsOverdueWidget,
  StatisticsProductivityWidget,
  StatisticsProjectsWidget,
  StatisticsTeamsWidget,
} from './StatisticsLiveWidgets';
import { useStatisticsLiveState } from './useStatisticsLiveState';
import '../overview/overviewWidget.css';
import './statisticsWidget.css';

/**
 * Размеры карточек задаёт дизайн, а не сохранённая раскладка (менять размер здесь нельзя).
 * В сетке из 3 колонок по строкам 148px: две карточки по 2 строки и столбец из двух
 * компактных — ровный блок 3×2; продуктивность — на всю ширину под ним или над ним.
 */
const statisticsCardSizes = (gridColumns) => ({
  'completed-tasks': { col_span: 1, row_span: 2 },
  'overdue-tasks': { col_span: 1, row_span: 2 },
  'user-teams': { col_span: 1, row_span: 1 },
  'user-projects': { col_span: 1, row_span: 1 },
  // При 3 колонках содержимое продуктивности идёт в три столбца, при 2 — в два и выше
  productivity: { col_span: 3, row_span: gridColumns >= 3 ? 3 : 4 },
});

export default function StatisticsPage() {
  const { user } = useAuth();
  const model = useStatisticsLiveState();
  const { loading, error, isAllZero } = model;

  return (
    <div>
      <header className="stat-page-header">
        <h1 className="stat-page-header__title">
          <StatisticsIcon size="lg" className="text-emerald-400" />
          Статистика
        </h1>
        <p className="stat-page-header__subtitle">Результаты по задачам, сроки и продуктивность</p>
      </header>

      {loading ? (
        <div className="stat-loading">Загрузка статистики…</div>
      ) : error ? (
        <div className="stat-error">{error}</div>
      ) : (
        <DraggableGrid
          user={user}
          enableDragAndDrop
          layoutType="statistics"
          fixedCardSizes={statisticsCardSizes}
        >
          <StatisticsCompletedWidget cardId="completed-tasks" model={model} />
          <StatisticsOverdueWidget cardId="overdue-tasks" model={model} />
          <StatisticsTeamsWidget cardId="user-teams" model={model} />
          <StatisticsProjectsWidget cardId="user-projects" model={model} />
          <StatisticsProductivityWidget cardId="productivity" />
        </DraggableGrid>
      )}

      {!loading && !error && isAllZero && (
        <div className="stat-empty">Пока недостаточно данных для отображения статистики</div>
      )}
    </div>
  );
}
