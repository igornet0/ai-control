import React, { useMemo, useRef } from 'react';
import { isTaskCompleted, isTaskOverdue } from '../utils/performanceUtils';
import { useWidgetLayoutProfile } from '../hooks/useWidgetLayoutProfile';
import {
  TaskStatsWidget,
  TaskStatsWidgetBody,
  TaskStatsWidgetHeader,
  TaskStatsWidgetScroll,
} from './TaskStatsWidget';

function StatusRow({
  statusKey,
  label,
  count,
  percentage,
  dotClass,
  selected,
  onClick,
  title,
  compact = false,
}) {
  const selectedStyles = {
    completed: 'bg-green-500/20 border-green-500/50 hover:bg-green-500/30',
    in_progress: 'bg-blue-500/20 border-blue-500/50 hover:bg-blue-500/30',
    review: 'bg-amber-500/20 border-amber-500/50 hover:bg-amber-500/30',
    other: 'bg-slate-500/20 border-slate-500/50 hover:bg-slate-500/30',
  };
  const activeStyle = selected ? selectedStyles[statusKey] : 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-700/50';

  return (
    <div
      className={`flex items-center justify-between rounded-lg backdrop-blur-sm border transition-all duration-300 cursor-pointer ${
        compact ? 'p-2.5' : 'p-3'
      } ${activeStyle}`}
      onClick={onClick}
      title={title}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-3 h-3 rounded-full shrink-0 ${dotClass}`} />
        <span className={`text-slate-300 truncate ${compact ? 'text-xs' : 'text-sm'}`}>{label}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={`font-semibold text-slate-100 ${compact ? 'text-xs' : 'text-sm'}`}>{count}</span>
        <span className="text-xs text-slate-400">({percentage}%)</span>
      </div>
    </div>
  );
}

function DonutChart({ percentage, size, largeText = false, caption = 'завершено', tone = 'default' }) {
  const labelClass = largeText ? 'text-3xl' : size >= 176 ? 'text-2xl' : 'text-xl';
  const strokeClass = tone === 'overdue' ? 'stroke-red-400' : 'stroke-slate-400';
  const glowClass = tone === 'overdue'
    ? 'shadow-[0_0_16px_rgba(248,113,113,0.45)]'
    : 'shadow-[0_0_16px_rgba(148,163,184,0.35)]';

  return (
    <div className={`relative shrink-0 rounded-full ${glowClass}`} style={{ width: size, height: size }}>
      <svg className="absolute inset-0 overflow-visible -rotate-90" viewBox="0 0 36 36">
        <circle className="stroke-slate-700" strokeWidth="3" fill="none" r="16" cx="18" cy="18" />
        <circle
          className={`${strokeClass} transition-all duration-1000 ease-out`}
          strokeWidth="3"
          strokeDasharray={`${percentage * 1.01} ${(100 - percentage) * 1.01}`}
          strokeDashoffset="0"
          strokeLinecap="round"
          fill="none"
          r="16"
          cx="18"
          cy="18"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`${labelClass} font-bold text-slate-100`}>{percentage}%</span>
        <span className="text-xs text-slate-400">{caption}</span>
      </div>
    </div>
  );
}

export default function ProgressChart({
  tasks = [],
  onStatusClick,
  selectedStatus,
  widgetSize = null,
  canFilterOverdue = false,
  overdueOnly = false,
  onOverdueChange,
}) {
  const contentRef = useRef(null);
  const layout = useWidgetLayoutProfile(contentRef, widgetSize);

  const overdueTasks = useMemo(
    () => (tasks || []).filter((task) => isTaskOverdue(task)),
    [tasks]
  );
  const chartTasks = overdueOnly ? overdueTasks : tasks;

  const stats = useMemo(() => {
    if (!chartTasks.length) return { total: 0, completed: 0, inProgress: 0, review: 0, other: 0 };

    const completed = chartTasks.filter((t) => isTaskCompleted(t.status)).length;
    const inProgress = chartTasks.filter((t) => t.status === 'in_progress').length;
    const review = chartTasks.filter((t) => t.status === 'review').length;
    const other = chartTasks.length - completed - inProgress - review;

    return { total: chartTasks.length, completed, inProgress, review, other };
  }, [chartTasks]);

  const completedPercentage = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
  const inProgressPercentage = stats.total > 0 ? Math.round((stats.inProgress / stats.total) * 100) : 0;
  const reviewPercentage = stats.total > 0 ? Math.round((stats.review / stats.total) * 100) : 0;
  const otherPercentage = stats.total > 0 ? Math.round((stats.other / stats.total) * 100) : 0;
  const overdueShare = tasks.length > 0 ? Math.round((overdueTasks.length / tasks.length) * 100) : 0;
  const donutPercentage = overdueOnly ? overdueShare : completedPercentage;

  const isSideLayout = layout.progressLayout === 'side' || layout.progressLayout === 'hero-side';
  const isHero = layout.progressLayout === 'hero-side';

  const statusItems = [
    !overdueOnly && {
      statusKey: 'completed',
      label: 'Завершено',
      count: stats.completed,
      percentage: completedPercentage,
      dotClass: 'bg-slate-400 shadow-lg shadow-slate-400/50',
      selected: selectedStatus === 'completed',
      onClick: () => onStatusClick?.('completed'),
      title: 'Нажмите для фильтрации по завершенным задачам',
    },
    {
      statusKey: 'in_progress',
      label: 'В работе',
      count: stats.inProgress,
      percentage: inProgressPercentage,
      dotClass: 'bg-blue-500 shadow-lg shadow-blue-500/50',
      selected: selectedStatus === 'in_progress',
      onClick: () => onStatusClick?.('in_progress'),
      title: overdueOnly
        ? 'Нажмите для фильтрации просроченных задач в работе'
        : 'Нажмите для фильтрации по задачам в работе',
    },
    {
      statusKey: 'review',
      label: 'На проверке',
      count: stats.review,
      percentage: reviewPercentage,
      dotClass: 'bg-amber-500 shadow-lg shadow-amber-500/50',
      selected: selectedStatus === 'review',
      onClick: () => onStatusClick?.('review'),
      title: overdueOnly
        ? 'Нажмите для фильтрации просроченных задач на проверке'
        : 'Нажмите для фильтрации по задачам на проверке',
    },
    {
      statusKey: 'other',
      label: 'Другие',
      count: stats.other,
      percentage: otherPercentage,
      dotClass: 'bg-slate-500 shadow-lg shadow-slate-500/50',
      selected: ['created', 'on_hold', 'blocked', 'cancelled'].includes(selectedStatus),
      onClick: () => onStatusClick?.(null),
      title: overdueOnly ? 'Нажмите для сброса фильтра по статусу' : 'Нажмите для сброса фильтра',
    },
  ].filter(Boolean);

  return (
    <TaskStatsWidget>
      <TaskStatsWidgetBody>
        <TaskStatsWidgetHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                overdueOnly
                  ? 'bg-gradient-to-r from-red-600 to-orange-600'
                  : 'bg-gradient-to-r from-slate-600 to-slate-700'
              }`}>
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H11V2.513a9.025 9.025 0 019.488 6.487z" />
                </svg>
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-slate-100">Обзор задач</h3>
              </div>
            </div>
            {canFilterOverdue && (
              <button
                type="button"
                className={`shrink-0 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  overdueOnly
                    ? 'border-red-400/60 bg-red-500/20 text-red-200'
                    : 'border-slate-600/70 bg-slate-800/70 text-slate-300 hover:border-red-400/40 hover:text-red-200'
                }`}
                aria-pressed={overdueOnly}
                onClick={() => onOverdueChange?.(!overdueOnly)}
                title={overdueOnly ? 'Показать все задачи' : 'Показать только просроченные задачи'}
              >
                Просроченные
              </button>
            )}
          </div>
        </TaskStatsWidgetHeader>

        <TaskStatsWidgetScroll contained={isSideLayout}>
          <div
            ref={contentRef}
            className={`flex min-h-0 flex-1 flex-col ${isSideLayout ? 'h-full' : ''}`}
          >
            <div
              className={
                isSideLayout
                  ? 'flex flex-1 min-h-0 items-center gap-6 lg:gap-8'
                  : 'flex flex-col flex-1 min-h-0'
              }
            >
              <div
                className={
                  isSideLayout
                    ? 'flex shrink-0 items-center justify-center pl-6 lg:pl-10'
                    : 'flex justify-center items-center pt-4 mb-5 shrink-0'
                }
              >
                <DonutChart
                  percentage={donutPercentage}
                  size={layout.donutSize}
                  largeText={layout.tall || layout.xLarge}
                  caption={overdueOnly ? 'просрочено' : 'завершено'}
                  tone={overdueOnly ? 'overdue' : 'default'}
                />
              </div>

              <div
                className={`min-w-0 flex-1 ${
                  isHero ? 'grid grid-cols-1 sm:grid-cols-2 gap-2.5 content-center' : 'space-y-3'
                } ${isSideLayout ? 'overflow-y-auto pr-1' : ''}`}
              >
                {statusItems.map((item) => (
                  <StatusRow key={item.statusKey} {...item} compact={isHero || isSideLayout} />
                ))}
              </div>
            </div>

            <div className={`shrink-0 border-t border-slate-700/50 ${isSideLayout ? 'mt-4 pt-3' : 'mt-6 pt-4'}`}>
              <div className="text-center">
                <span className={`font-bold text-slate-100 ${layout.tall ? 'text-xl' : 'text-lg'}`}>
                  {stats.total}
                </span>
                <span className="text-sm text-slate-400 ml-2">
                  {overdueOnly ? 'просроченных задач' : 'всего задач'}
                </span>
              </div>
            </div>
          </div>
        </TaskStatsWidgetScroll>
      </TaskStatsWidgetBody>
    </TaskStatsWidget>
  );
}
