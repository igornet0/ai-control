import React from 'react';
import { OverviewWidget } from '../overview/OverviewWidget';
import { StatHero, StatIcons, StatMetric } from './StatisticsWidgets';

export function StatisticsCompletedWidget({ model }) {
  const { stats, completedTotal } = model;
  return (
    <OverviewWidget
      cardId="completed-tasks"
      accent="emerald"
      icon={StatIcons.completed}
      title="Выполненные задачи"
      subtitle="Закрытые задачи за период"
      count={completedTotal}
    >
      <div className="stat-metric-grid">
        <StatMetric label="Сегодня" value={stats.completed?.day} tone="emerald" icon={StatIcons.today} />
        <StatMetric label="За неделю" value={stats.completed?.week} tone="blue" icon={StatIcons.week} />
        <StatMetric label="За месяц" value={stats.completed?.month} tone="purple" icon={StatIcons.month} />
        <StatMetric label="За всё время" value={stats.completed?.all_time} tone="amber" icon={StatIcons.allTime} />
      </div>
    </OverviewWidget>
  );
}

export function StatisticsOverdueWidget({ model, idPrefix = 'stats' }) {
  const { stats, periodFrom, setPeriodFrom, periodTo, setPeriodTo, fetchStats } = model;
  return (
    <OverviewWidget
      cardId="overdue-tasks"
      accent="amber"
      icon={StatIcons.overdue}
      title="Просрочки"
      subtitle="Задачи с истёкшим дедлайном"
      count={stats.overdue_in_period ?? 0}
    >
      <div className="stat-period-form">
        <div className="stat-period-form__row">
          <div className="stat-period-form__field">
            <label className="stat-period-form__label" htmlFor={`${idPrefix}-period-from`}>
              Период с
            </label>
            <input
              id={`${idPrefix}-period-from`}
              type="date"
              className="stat-period-form__input"
              value={periodFrom}
              onChange={(e) => setPeriodFrom(e.target.value)}
            />
          </div>
          <div className="stat-period-form__field">
            <label className="stat-period-form__label" htmlFor={`${idPrefix}-period-to`}>
              Период по
            </label>
            <input
              id={`${idPrefix}-period-to`}
              type="date"
              className="stat-period-form__input"
              value={periodTo}
              onChange={(e) => setPeriodTo(e.target.value)}
            />
          </div>
          <button type="button" className="stat-period-form__btn" onClick={() => fetchStats()}>
            Обновить
          </button>
        </div>
        <StatHero
          compact
          value={stats.overdue_in_period ?? 0}
          label="Просрочек за выбранный период"
          tone={(stats.overdue_in_period ?? 0) > 0 ? 'danger' : 'default'}
        />
      </div>
    </OverviewWidget>
  );
}

export function StatisticsTeamsWidget({ model }) {
  const { stats } = model;
  return (
    <OverviewWidget
      cardId="user-teams"
      accent="blue"
      icon={StatIcons.teams}
      title="Команды"
      subtitle="Участие в командах"
      count={stats.teams_count ?? 0}
    >
      <StatHero
        value={stats.teams_count ?? 0}
        label="Команд, в которых вы состоите"
        tone={(stats.teams_count ?? 0) > 0 ? 'success' : 'default'}
      />
    </OverviewWidget>
  );
}

export function StatisticsProjectsWidget({ model }) {
  const { stats } = model;
  return (
    <OverviewWidget
      cardId="user-projects"
      accent="purple"
      icon={StatIcons.projects}
      title="Проекты"
      subtitle="Доступные проекты"
      count={stats.projects_count ?? 0}
    >
      <StatHero
        value={stats.projects_count ?? 0}
        label="Проектов в вашей зоне доступа"
        tone={(stats.projects_count ?? 0) > 0 ? 'success' : 'default'}
      />
    </OverviewWidget>
  );
}

export function StatisticsFeedbackWidget() {
  return (
    <OverviewWidget
      cardId="feedback"
      accent="cyan"
      icon={StatIcons.praise}
      title="Жалобы и похвалы"
      subtitle="Обратная связь по задачам"
    >
      <div className="stat-pair-grid">
        <div className="stat-pair-card stat-pair-card--negative">
          <span className="stat-pair-card__value">0</span>
          <span className="stat-pair-card__label">Жалобы</span>
        </div>
        <div className="stat-pair-card stat-pair-card--positive">
          <span className="stat-pair-card__value">0</span>
          <span className="stat-pair-card__label">Похвалы</span>
        </div>
      </div>
      <p className="stat-placeholder">Раздел в разработке — данные появятся позже</p>
    </OverviewWidget>
  );
}

const STATISTICS_WIDGETS = {
  'completed-tasks': StatisticsCompletedWidget,
  'overdue-tasks': StatisticsOverdueWidget,
  'user-teams': StatisticsTeamsWidget,
  'user-projects': StatisticsProjectsWidget,
  feedback: StatisticsFeedbackWidget,
};

export function renderStatisticsLiveWidget(cardId, model, extraProps = {}) {
  const Widget = STATISTICS_WIDGETS[cardId];
  if (!Widget) return null;
  return <Widget model={model} {...extraProps} />;
}
