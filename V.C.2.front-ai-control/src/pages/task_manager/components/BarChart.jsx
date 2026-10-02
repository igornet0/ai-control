import React, { useMemo, useRef } from 'react';
import { useWidgetLayoutProfile } from '../hooks/useWidgetLayoutProfile';
import {
  TaskStatsWidget,
  TaskStatsWidgetBody,
  TaskStatsWidgetHeader,
  TaskStatsWidgetScroll,
} from './TaskStatsWidget';

const PRIORITY_ORDER = ['urgent', 'critical', 'high', 'medium', 'low'];

const PRIORITY_COLORS = {
  urgent: 'bg-red-500',
  critical: 'bg-orange-500',
  high: 'bg-yellow-500',
  medium: 'bg-blue-500',
  low: 'bg-gray-400',
};

const PRIORITY_GLOWS = {
  urgent: 'rgba(239, 68, 68, 0.4)',
  critical: 'rgba(249, 115, 22, 0.4)',
  high: 'rgba(234, 179, 8, 0.4)',
  medium: 'rgba(59, 130, 246, 0.4)',
  low: 'rgba(156, 163, 175, 0.4)',
};

const PRIORITY_LABELS = {
  urgent: 'Срочно',
  critical: 'Критично',
  high: 'Высокий',
  medium: 'Средний',
  low: 'Низкий',
};

function HorizontalBarRow({
  priority,
  count,
  maxValue,
  isSelected,
  barHeight,
  onClick,
}) {
  const widthPct = maxValue === 0 ? 0 : (count / maxValue) * 100;
  const glow = PRIORITY_GLOWS[priority];

  return (
    <div
      className={`group cursor-pointer transition-all duration-200 ${
        isSelected ? 'ring-2 ring-offset-2 ring-offset-slate-800 ring-purple-500 rounded-lg p-2 -m-2' : ''
      }`}
      onClick={onClick}
      title={`Нажмите для фильтрации по приоритету: ${PRIORITY_LABELS[priority]}`}
    >
      <div className="flex items-center gap-3 mb-2">
        <span className="text-sm font-medium text-slate-300 w-20 text-right shrink-0">
          {PRIORITY_LABELS[priority]}
        </span>
        <div className="flex-1 relative min-w-0">
          <div
            className={`rounded-lg transition-all duration-700 ease-out ${PRIORITY_COLORS[priority]} flex items-center justify-end pr-3 group-hover:scale-[1.02] ${
              isSelected ? 'ring-2 ring-white/50' : ''
            }`}
            style={{
              height: barHeight,
              width: `${Math.max(widthPct, 2)}%`,
              minWidth: count > 0 ? '40px' : '0',
              boxShadow: isSelected
                ? `0 0 30px ${glow}, 0 0 15px ${glow}`
                : `0 0 20px ${glow}`,
            }}
          >
            {count > 0 && (
              <span className="text-xs font-semibold text-white">{count}</span>
            )}
          </div>
          {count === 0 && (
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-500">0</span>
          )}
        </div>
      </div>
    </div>
  );
}

function ColumnChart({ priorityStats, maxValue, selectedPriority, onPriorityClick, chartHeight }) {
  return (
    <div
      className="flex items-end justify-around gap-3 px-2"
      style={{ height: chartHeight, minHeight: chartHeight }}
    >
      {PRIORITY_ORDER.map((priority) => {
        const count = priorityStats[priority] ?? 0;
        const heightPct = maxValue === 0 ? 0 : Math.max((count / maxValue) * 100, count > 0 ? 8 : 0);
        const isSelected = selectedPriority === priority;
        const glow = PRIORITY_GLOWS[priority];

        return (
          <button
            key={priority}
            type="button"
            className={`flex flex-1 min-w-0 max-w-[4.5rem] flex-col items-center gap-2 h-full transition-transform hover:scale-[1.03] ${
              isSelected ? 'ring-2 ring-purple-400 rounded-xl p-1 -m-1' : ''
            }`}
            onClick={() => onPriorityClick?.(priority)}
            title={`${PRIORITY_LABELS[priority]}: ${count}`}
          >
            <span className="text-xs font-semibold text-slate-200">{count}</span>
            <div className="flex flex-1 w-full items-end justify-center min-h-0">
              <div
                className={`w-full max-w-[2.75rem] rounded-t-lg transition-all duration-700 ease-out ${PRIORITY_COLORS[priority]}`}
                style={{
                  height: `${heightPct}%`,
                  minHeight: count > 0 ? '0.75rem' : 0,
                  boxShadow: isSelected ? `0 0 24px ${glow}` : `0 0 14px ${glow}`,
                }}
              />
            </div>
            <span className="text-[10px] sm:text-xs text-slate-400 text-center leading-tight">
              {PRIORITY_LABELS[priority]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default function BarChart({
  tasks = [],
  onPriorityClick,
  selectedPriority,
  scopeLabel = null,
  widgetSize = null,
}) {
  const contentRef = useRef(null);
  const layout = useWidgetLayoutProfile(contentRef, widgetSize);

  const priorityStats = useMemo(() => {
    if (!tasks.length) {
      return { urgent: 0, critical: 0, high: 0, medium: 0, low: 0 };
    }
    return {
      urgent: tasks.filter((t) => t.priority === 'urgent').length,
      critical: tasks.filter((t) => t.priority === 'critical').length,
      high: tasks.filter((t) => t.priority === 'high').length,
      medium: tasks.filter((t) => t.priority === 'medium').length,
      low: tasks.filter((t) => t.priority === 'low').length,
    };
  }, [tasks]);

  const total = Object.values(priorityStats).reduce((a, b) => a + b, 0);
  const maxValue = Math.max(...Object.values(priorityStats));
  const isColumnLayout = layout.barLayout === 'columns';
  const isGridLayout = layout.barLayout === 'grid';
  const chartHeight = layout.xLarge ? 220 : layout.tall ? 180 : 150;

  return (
    <TaskStatsWidget>
      <TaskStatsWidgetBody>
        <TaskStatsWidgetHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 flex items-center justify-center shrink-0">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-slate-100">Приоритеты</h3>
              {scopeLabel && (
                <p className="text-xs text-cyan-400/90 mt-0.5 truncate">{scopeLabel}</p>
              )}
            </div>
          </div>
        </TaskStatsWidgetHeader>

        <TaskStatsWidgetScroll contained={isColumnLayout || isGridLayout}>
          <div
            ref={contentRef}
            className={`flex min-h-0 flex-1 flex-col ${isColumnLayout ? 'h-full justify-between' : ''}`}
          >
            <div
              className={`flex-1 min-h-0 ${
                isColumnLayout
                  ? 'flex flex-col justify-center p-4 bg-slate-800/30 rounded-xl border border-slate-700/50'
                  : isGridLayout
                    ? 'grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-3 p-4 bg-slate-800/30 rounded-xl border border-slate-700/50'
                    : 'mb-6 p-4 bg-slate-800/30 rounded-xl border border-slate-700/50'
              }`}
              style={!isColumnLayout && !isGridLayout ? { display: 'flex', flexDirection: 'column', gap: layout.tall ? '1.25rem' : '1rem' } : undefined}
            >
              {isColumnLayout ? (
                <ColumnChart
                  priorityStats={priorityStats}
                  maxValue={maxValue}
                  selectedPriority={selectedPriority}
                  onPriorityClick={onPriorityClick}
                  chartHeight={chartHeight}
                />
              ) : (
                PRIORITY_ORDER.map((priority) => (
                  <HorizontalBarRow
                    key={priority}
                    priority={priority}
                    count={priorityStats[priority]}
                    maxValue={maxValue}
                    isSelected={selectedPriority === priority}
                    barHeight={layout.barHeight}
                    onClick={() => onPriorityClick?.(priority)}
                  />
                ))
              )}
            </div>

            <div className={`shrink-0 border-t border-slate-700/50 ${isColumnLayout ? 'mt-4 pt-3' : 'mt-6 pt-4'}`}>
              <div className="text-center">
                <span className={`font-bold text-slate-100 ${layout.tall ? 'text-xl' : 'text-lg'}`}>
                  {total}
                </span>
                <span className="text-sm text-slate-400 ml-2">всего задач по приоритетам</span>
              </div>
            </div>
          </div>
        </TaskStatsWidgetScroll>
      </TaskStatsWidgetBody>
    </TaskStatsWidget>
  );
}
