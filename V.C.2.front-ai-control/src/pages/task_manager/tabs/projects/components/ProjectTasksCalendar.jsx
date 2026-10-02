import React, { useEffect, useMemo, useRef, useState } from 'react';
import './ProjectTasksCalendar.css';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const STATUS_CHIP_CLASS = {
  created: 'ptc-chip--status-created',
  todo: 'ptc-chip--status-created',
  in_progress: 'ptc-chip--status-progress',
  review: 'ptc-chip--status-review',
  completed: 'ptc-chip--status-completed',
  done: 'ptc-chip--status-completed',
  cancelled: 'ptc-chip--status-cancelled',
  on_hold: 'ptc-chip--status-hold',
  blocked: 'ptc-chip--status-blocked',
};

const PRIORITY_CHIP_CLASS = {
  low: 'ptc-chip--priority-low',
  medium: 'ptc-chip--priority-medium',
  high: 'ptc-chip--priority-high',
  critical: 'ptc-chip--priority-critical',
  urgent: 'ptc-chip--priority-urgent',
};

const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);
const endOfMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);
const addMonths = (date, delta) => new Date(date.getFullYear(), date.getMonth() + delta, 1);

const isSameDay = (a, b) => (
  a && b
  && a.getFullYear() === b.getFullYear()
  && a.getMonth() === b.getMonth()
  && a.getDate() === b.getDate()
);

function parseTaskDate(value) {
  if (!value) return null;
  const str = String(value).trim();
  if (!str) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [year, month, day] = str.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  if (str.includes('T')) {
    const [year, month, day] = str.split('T')[0].split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  const parsed = new Date(str);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function getMonthLabel(date) {
  return new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(date);
}

function formatShortDate(date) {
  if (!date) return '';
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function getChipClass(task, colorMode) {
  if (colorMode === 'priority') {
    return PRIORITY_CHIP_CLASS[task.priority] || PRIORITY_CHIP_CLASS.low;
  }
  return STATUS_CHIP_CLASS[task.status] || STATUS_CHIP_CLASS.created;
}

export default function ProjectTasksCalendar({
  tasks = [],
  onTaskClick,
  openingTaskId = null,
}) {
  const [current, setCurrent] = useState(startOfMonth(new Date()));
  const [colorMode, setColorMode] = useState('status');
  const [highlightDate, setHighlightDate] = useState(null);
  const focusCellRef = useRef(null);

  const { tasksWithDue, tasksWithoutDue } = useMemo(() => {
    const withDue = [];
    const withoutDue = [];
    tasks.forEach((task) => {
      if (parseTaskDate(task.due_date)) {
        withDue.push(task);
      } else {
        withoutDue.push(task);
      }
    });
    return { tasksWithDue: withDue, tasksWithoutDue: withoutDue };
  }, [tasks]);

  const earliestTaskDate = useMemo(() => {
    let earliest = null;
    tasksWithDue.forEach((task) => {
      const date = parseTaskDate(task.due_date);
      if (!date) return;
      if (!earliest || date < earliest) earliest = date;
    });
    return earliest;
  }, [tasksWithDue]);

  useEffect(() => {
    if (!highlightDate) return undefined;
    const timer = window.setTimeout(() => setHighlightDate(null), 2500);
    return () => window.clearTimeout(timer);
  }, [highlightDate]);

  useEffect(() => {
    if (!highlightDate || !focusCellRef.current) return undefined;
    const timer = window.setTimeout(() => {
      focusCellRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 50);
    return () => window.clearTimeout(timer);
  }, [current, highlightDate]);

  const handleGoToEarliest = () => {
    if (!earliestTaskDate) return;
    setCurrent(startOfMonth(earliestTaskDate));
    setHighlightDate(earliestTaskDate);
  };

  const calendarDays = useMemo(() => {
    const first = startOfMonth(current);
    const last = endOfMonth(current);
    const weekday = (first.getDay() + 6) % 7;
    const daysInMonth = last.getDate();
    const days = [];

    for (let i = 0; i < weekday; i += 1) {
      days.push({ date: null, tasks: [] });
    }
    for (let d = 1; d <= daysInMonth; d += 1) {
      days.push({ date: new Date(current.getFullYear(), current.getMonth(), d), tasks: [] });
    }
    while (days.length % 7 !== 0) {
      days.push({ date: null, tasks: [] });
    }
    return days;
  }, [current]);

  const daysWithTasks = useMemo(() => (
    calendarDays.map((cell) => {
      if (!cell.date) return cell;
      const dayTasks = tasksWithDue.filter((task) => isSameDay(parseTaskDate(task.due_date), cell.date));
      return { ...cell, tasks: dayTasks };
    })
  ), [calendarDays, tasksWithDue]);

  const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  return (
    <div className="project-tasks-calendar">
      <div className="ptc-toolbar">
        <button
          type="button"
          className="ptc-jump-btn"
          onClick={handleGoToEarliest}
          disabled={!earliestTaskDate}
          title={
            earliestTaskDate
              ? `Перейти к самой ранней дате среди показанных задач: ${formatShortDate(earliestTaskDate)}`
              : 'Нет задач со сроком среди отфильтрованных'
          }
        >
          К началу
          {earliestTaskDate ? ` · ${formatShortDate(earliestTaskDate)}` : ''}
        </button>

        <div className="ptc-color-toggle" role="group" aria-label="Цвет задач">
          <button
            type="button"
            className={`ptc-toggle-btn${colorMode === 'status' ? ' ptc-toggle-btn--active' : ''}`}
            onClick={() => setColorMode('status')}
          >
            По статусу
          </button>
          <button
            type="button"
            className={`ptc-toggle-btn${colorMode === 'priority' ? ' ptc-toggle-btn--active' : ''}`}
            onClick={() => setColorMode('priority')}
          >
            По приоритету
          </button>
        </div>
      </div>

      <div className="ptc-header">
        <button type="button" className="ptc-nav" onClick={() => setCurrent((d) => addMonths(d, -1))} aria-label="Предыдущий месяц">
          ←
        </button>
        <div className="ptc-title">{getMonthLabel(current)}</div>
        <button type="button" className="ptc-nav" onClick={() => setCurrent((d) => addMonths(d, 1))} aria-label="Следующий месяц">
          →
        </button>
      </div>

      <div className="ptc-weekdays">
        {WEEKDAYS.map((day) => (
          <div key={day}>{day}</div>
        ))}
      </div>

      <div className="ptc-grid">
        {daysWithTasks.map((cell, idx) => {
          const isToday = cell.date && isSameDay(cell.date, today);
          const isHighlighted = cell.date && highlightDate && isSameDay(cell.date, highlightDate);
          return (
            <div
              key={idx}
              ref={isHighlighted ? focusCellRef : null}
              className={`ptc-cell${cell.date ? '' : ' ptc-cell--empty'}${isToday ? ' ptc-cell--today' : ''}${isHighlighted ? ' ptc-cell--focus' : ''}`}
            >
              {cell.date && (
                <>
                  <div className="ptc-date">{cell.date.getDate()}</div>
                  <div className="ptc-items">
                    {cell.tasks.map((task) => (
                      <button
                        key={task.id}
                        type="button"
                        className={`ptc-chip ${getChipClass(task, colorMode)}${
                          openingTaskId === task.id ? ' ptc-chip--loading' : ''
                        }`}
                        title={`${task.title || 'Без названия'} · ID ${task.id}`}
                        onClick={() => onTaskClick?.(task)}
                        disabled={openingTaskId === task.id}
                      >
                        <span className="ptc-chip-text">{task.title || 'Без названия'}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {tasksWithoutDue.length > 0 && (
        <div className="ptc-no-due">
          <p className="ptc-no-due__title">Без срока ({tasksWithoutDue.length})</p>
          <div className="ptc-no-due__list">
            {tasksWithoutDue.map((task) => (
              <button
                key={task.id}
                type="button"
                className={`ptc-chip ptc-chip--no-due ${getChipClass(task, colorMode)}${
                  openingTaskId === task.id ? ' ptc-chip--loading' : ''
                }`}
                onClick={() => onTaskClick?.(task)}
                disabled={openingTaskId === task.id}
              >
                <span className="ptc-chip-text">{task.title || 'Без названия'}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
