import React from 'react';
import useAuth from '../../../../hooks/useAuth';
import DraggableGrid from '../../../../components/DraggableGrid';
import { StatisticsIcon } from '../../components/TaskManagerIcons';
import {
  StatisticsCompletedWidget,
  StatisticsFeedbackWidget,
  StatisticsOverdueWidget,
  StatisticsProjectsWidget,
  StatisticsTeamsWidget,
} from './StatisticsLiveWidgets';
import { useStatisticsLiveState } from './useStatisticsLiveState';
import '../overview/overviewWidget.css';
import './statisticsWidget.css';

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
        <p className="stat-page-header__hint hidden md:flex">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <circle cx="12" cy="5" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="12" cy="19" r="2" />
          </svg>
          Перетаскивайте за троеточие ⋮ — переместить
        </p>
      </header>

      {loading ? (
        <div className="stat-loading">Загрузка статистики…</div>
      ) : error ? (
        <div className="stat-error">{error}</div>
      ) : (
        <DraggableGrid user={user} enableDragAndDrop layoutType="statistics">
          <StatisticsCompletedWidget cardId="completed-tasks" model={model} />
          <StatisticsOverdueWidget cardId="overdue-tasks" model={model} />
          <StatisticsTeamsWidget cardId="user-teams" model={model} />
          <StatisticsProjectsWidget cardId="user-projects" model={model} />
          <StatisticsFeedbackWidget cardId="feedback" />
        </DraggableGrid>
      )}

      {!loading && !error && isAllZero && (
        <div className="stat-empty">Пока недостаточно данных для отображения статистики</div>
      )}
    </div>
  );
}
