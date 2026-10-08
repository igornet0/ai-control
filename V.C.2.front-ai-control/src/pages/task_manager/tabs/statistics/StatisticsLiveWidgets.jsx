import React, { useEffect, useState } from 'react';
import { OverviewWidget } from '../overview/OverviewWidget';
import { StatHero, StatIcons, StatMetric } from './StatisticsWidgets';
import { getProductivity, getProductivityPeople } from '../../../../services/statsService';

export function StatisticsCompletedWidget({ model }) {
  const { stats } = model;
  return (
    <OverviewWidget
      cardId="completed-tasks"
      accent="emerald"
      icon={StatIcons.completed}
      title="Выполненные задачи"
      subtitle="Закрытые вами задачи"
    >
      <div className="stat-metric-grid">
        <StatMetric label="Сегодня" value={stats.completed?.day} tone="emerald" icon={StatIcons.today} accent />
        <StatMetric label="За неделю" value={stats.completed?.week} tone="blue" icon={StatIcons.week} />
        <StatMetric label="За месяц" value={stats.completed?.month} tone="purple" icon={StatIcons.month} />
        <StatMetric label="За всё время" value={stats.completed?.all_time} tone="amber" icon={StatIcons.allTime} />
      </div>
    </OverviewWidget>
  );
}

const toInputDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const daysAgo = (n) => {
  const date = new Date();
  date.setDate(date.getDate() - n);
  return toInputDate(date);
};

const PERIOD_PRESETS = [
  { id: '7', label: '7 дней', range: () => [daysAgo(7), toInputDate(new Date())] },
  { id: '30', label: '30 дней', range: () => [daysAgo(30), toInputDate(new Date())] },
  { id: 'all', label: 'Всё время', range: () => ['', ''] },
];

export function StatisticsOverdueWidget({ model, idPrefix = 'stats' }) {
  const { stats, periodFrom, setPeriodFrom, periodTo, setPeriodTo } = model;
  const overdue = stats.overdue_in_period ?? 0;
  const activePreset = PERIOD_PRESETS.find((preset) => {
    const [from, to] = preset.range();
    return from === periodFrom && to === periodTo;
  });

  return (
    <OverviewWidget
      cardId="overdue-tasks"
      accent="amber"
      icon={StatIcons.overdue}
      title="Просрочки"
      subtitle="Открытые задачи с прошедшим сроком"
    >
      <div className="stat-period-form">
        <div className="stat-chip-row" role="group" aria-label="Период">
          {PERIOD_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`stat-chip ${activePreset?.id === preset.id ? 'stat-chip--active' : ''}`}
              aria-pressed={activePreset?.id === preset.id}
              onClick={() => {
                const [from, to] = preset.range();
                setPeriodFrom(from);
                setPeriodTo(to);
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="stat-period-form__row">
          <input
            id={`${idPrefix}-period-from`}
            type="date"
            aria-label="Срок с"
            className="stat-period-form__input"
            value={periodFrom}
            onChange={(e) => setPeriodFrom(e.target.value)}
          />
          <span className="stat-period-form__sep" aria-hidden>—</span>
          <input
            id={`${idPrefix}-period-to`}
            type="date"
            aria-label="Срок по"
            className="stat-period-form__input"
            value={periodTo}
            onChange={(e) => setPeriodTo(e.target.value)}
          />
        </div>
        <StatHero
          compact
          value={overdue}
          label={overdue > 0 ? 'Задач со сроком в этом периоде ещё не закрыто' : 'Просрочек за период нет'}
          tone={overdue > 0 ? 'danger' : 'success'}
        />
      </div>
    </OverviewWidget>
  );
}

export function StatisticsTeamsWidget({ model }) {
  const { stats } = model;
  const count = stats.teams_count ?? 0;
  return (
    <OverviewWidget
      cardId="user-teams"
      accent="blue"
      icon={StatIcons.teams}
      title="Команды"
      subtitle="Где вы участник"
    >
      <StatHero
        inline
        value={count}
        label={count > 0 ? 'Команд, в которых вы состоите' : 'Вы пока не состоите в командах'}
      />
    </OverviewWidget>
  );
}

export function StatisticsProjectsWidget({ model }) {
  const { stats } = model;
  const count = stats.projects_count ?? 0;
  return (
    <OverviewWidget
      cardId="user-projects"
      accent="purple"
      icon={StatIcons.projects}
      title="Проекты"
      subtitle="Доступные вам проекты"
    >
      <StatHero
        inline
        value={count}
        label={count > 0 ? 'Проектов в вашей зоне доступа' : 'Нет доступных проектов'}
      />
    </OverviewWidget>
  );
}

// ——— Продуктивность ———

const PRODUCTIVITY_PERIODS = [
  { days: 7, label: '7 дней' },
  { days: 30, label: '30 дней' },
  { days: 90, label: '90 дней' },
];

const LEVEL_COLORS = {
  excellent: '#34d399',
  good: '#60a5fa',
  fair: '#fbbf24',
  poor: '#f87171',
};

const scoreColor = (score) => {
  if (score == null) return '#475569';
  if (score >= 85) return LEVEL_COLORS.excellent;
  if (score >= 70) return LEVEL_COLORS.good;
  if (score >= 50) return LEVEL_COLORS.fair;
  return LEVEL_COLORS.poor;
};

const pluralTasks = (n) => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'задача';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'задачи';
  return 'задач';
};

function ScoreRing({ score, color }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - (score ?? 0) / 100);
  return (
    <div className="prod__ring">
      <svg viewBox="0 0 100 100" aria-hidden>
        <circle className="prod__ring-track" cx="50" cy="50" r={radius} fill="none" strokeWidth="8" />
        <circle
          className="prod__ring-value"
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="prod__ring-label">
        <span className="prod__score">{score ?? '—'}</span>
        <span className="prod__score-max">из 100</span>
      </div>
    </div>
  );
}

const TipIcon = ({ kind }) => (kind === 'warning' ? (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
    <path d="M12 9v4M12 17h.01" strokeLinecap="round" />
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
  </svg>
) : (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
    <path d="M9 18h6M10 22h4M12 2a7 7 0 00-4 12.74V17h8v-2.26A7 7 0 0012 2z" strokeLinejoin="round" />
  </svg>
));

function ProductivityReport({ report, isMe }) {
  const { metrics } = report;
  const lowConfidence = Boolean(report.low_confidence);
  const levelKey = report.level?.key;
  const ringColor = lowConfidence ? '#94a3b8' : scoreColor(report.score);
  const trend = metrics.trend_percent;

  return (
    <div className={`prod__layout ${lowConfidence ? 'prod--low-confidence' : ''}`}>
      <section className="prod__area prod__area--summary" aria-label="Итог">
        <div className="prod__summary">
          <ScoreRing score={report.score} color={ringColor} />
          <div>
            <p className={`prod__level prod__level--${lowConfidence ? 'muted' : levelKey}`}>{report.level?.label}</p>
            <p className="prod__summary-text">
              За {report.period_days} дн. {isMe ? 'вы закрыли' : 'закрыто'} {metrics.completed} {pluralTasks(metrics.completed)},
              {' '}открыто сейчас — {metrics.open}.
            </p>
            {lowConfidence && (
              <span className="prod__note" title="Меньше трёх задач за период — оценка может сильно меняться">
                Мало задач — оценка предварительная
              </span>
            )}
          </div>
        </div>

        <div className="prod__facts">
          <div className="prod__fact">
            <div className="prod__fact-value">
              {metrics.completed}
              {trend != null && trend !== 0 && (
                <span className={`prod__fact-trend prod__fact-trend--${trend > 0 ? 'up' : 'down'}`}>
                  {trend > 0 ? '↑' : '↓'}{Math.abs(trend)}%
                </span>
              )}
            </div>
            <div className="prod__fact-label" title="Сравнение с предыдущим таким же периодом">Закрыто за период</div>
          </div>
          <div className="prod__fact">
            <div className="prod__fact-value">
              {metrics.avg_cycle_days != null ? `${metrics.avg_cycle_days} дн.` : '—'}
            </div>
            <div className="prod__fact-label" title="От создания задачи до закрытия">В среднем на задачу</div>
          </div>
          <div className="prod__fact">
            <div className="prod__fact-value">{metrics.hours_logged} ч</div>
            <div className="prod__fact-label">Учтено времени</div>
          </div>
        </div>
      </section>

      <section className="prod__area prod__area--components" aria-label="Из чего складывается оценка">
        <ul className="prod__components">
          {report.components.map((component) => (
            <li key={component.key}>
              <div className="prod__component-head">
                <span className="prod__component-label">
                  {component.label}
                  <span className="prod__component-weight">{component.weight}%</span>
                </span>
                <span className={`prod__component-value ${component.score == null ? 'prod__component-value--empty' : ''}`}>
                  {component.score == null ? 'нет данных' : component.score}
                </span>
              </div>
              <div className="prod__bar" aria-hidden>
                <div
                  className="prod__bar-fill"
                  style={{ width: `${component.score ?? 0}%`, background: scoreColor(component.score) }}
                />
              </div>
              <p className="prod__component-detail">{component.detail}</p>
            </li>
          ))}
        </ul>
        <details className="prod__how">
          <summary>Как считается оценка</summary>
          <p>
            Взвешенное среднее: сроки — доля задач, закрытых не позже срока (35%); просрочки — доля открытых
            задач без просрочки (25%); качество — доля проверок без возврата на доработку (20%); фокус —
            сколько задач одновременно «В работе», лучше всего до 3 (20%). Составляющие без данных не учитываются.
          </p>
        </details>
      </section>

      <section className="prod__area prod__area--tips" aria-label="Рекомендации">
        {report.strengths.length > 0 && (
          <div>
            <h4 className="prod__section-title">Получается хорошо</h4>
            <div className="prod__strengths">
              {report.strengths.map((text) => (
                <span key={text} className="prod__strength">✓ {text}</span>
              ))}
            </div>
          </div>
        )}

        <div>
          <h4 className="prod__section-title">Что улучшить</h4>
          {report.recommendations.length > 0 ? (
            <ul className="prod__tips">
              {report.recommendations.map((tip) => (
                <li key={tip.title} className={`prod__tip prod__tip--${tip.kind}`}>
                  <span className="prod__tip-icon"><TipIcon kind={tip.kind} /></span>
                  <div>
                    <p className="prod__tip-title">{tip.title}</p>
                    <p className="prod__tip-text">{tip.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="prod__how">Явных проблем не видно — так держать.</p>
          )}
        </div>
      </section>
    </div>
  );
}

export function StatisticsProductivityWidget() {
  const [days, setDays] = useState(30);
  const [people, setPeople] = useState([]);
  const [userId, setUserId] = useState(null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getProductivityPeople()
      .then((list) => {
        if (!cancelled) setPeople(list);
      })
      .catch(() => {
        if (!cancelled) setPeople([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getProductivity({ userId, days })
      .then((data) => {
        if (!cancelled) setReport(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setReport(null);
          setError(err.response?.data?.detail || 'Не удалось рассчитать продуктивность');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, days]);

  const canPickPerson = people.length > 1;
  const me = people.find((person) => person.is_me);
  const isMe = userId == null || userId === me?.id;

  return (
    <OverviewWidget
      cardId="productivity"
      accent="purple"
      icon={StatIcons.productivity}
      title="Продуктивность"
      subtitle={canPickPerson ? 'Оценка работы сотрудника по задачам' : 'Оценка вашей работы по задачам'}
      className="prod-container"
    >
      <div className="prod">
        <div className="prod__controls">
          <div className="stat-chip-row" role="group" aria-label="Период">
            {PRODUCTIVITY_PERIODS.map((period) => (
              <button
                key={period.days}
                type="button"
                className={`stat-chip ${days === period.days ? 'stat-chip--active' : ''}`}
                aria-pressed={days === period.days}
                onClick={() => setDays(period.days)}
              >
                {period.label}
              </button>
            ))}
          </div>
          {canPickPerson && (
            <select
              className="prod__select"
              aria-label="Сотрудник"
              value={userId ?? me?.id ?? ''}
              onChange={(e) => setUserId(Number(e.target.value))}
            >
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.is_me ? `${person.name} (вы)` : person.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {error ? (
          <div className="stat-error" role="alert">{error}</div>
        ) : loading && !report ? (
          <p className="prod__how">Считаем…</p>
        ) : report && report.score != null ? (
          <ProductivityReport report={report} isMe={isMe} />
        ) : (
          <div className="prod__empty">
            {report?.has_data
              ? 'За выбранный период недостаточно данных для оценки — попробуйте период длиннее.'
              : `${isMe ? 'У вас' : 'У сотрудника'} пока нет назначенных задач — оценка появится, когда они будут.`}
          </div>
        )}
      </div>
    </OverviewWidget>
  );
}

const STATISTICS_WIDGETS = {
  'completed-tasks': StatisticsCompletedWidget,
  'overdue-tasks': StatisticsOverdueWidget,
  'user-teams': StatisticsTeamsWidget,
  'user-projects': StatisticsProjectsWidget,
  productivity: StatisticsProductivityWidget,
  // Старый id виджета «Жалобы и похвалы» — на его месте теперь продуктивность
  feedback: StatisticsProductivityWidget,
};

export function renderStatisticsLiveWidget(cardId, model, extraProps = {}) {
  const Widget = STATISTICS_WIDGETS[cardId];
  if (!Widget) return null;
  return <Widget model={model} {...extraProps} />;
}
