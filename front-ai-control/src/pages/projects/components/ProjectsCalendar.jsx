import React, { useMemo, useState } from 'react';
import './ProjectsCalendar.css';

const getMonthLabel = (date) => {
  const formatter = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' });
  return formatter.format(date);
};

const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);
const endOfMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);

const addMonths = (date, delta) => new Date(date.getFullYear(), date.getMonth() + delta, 1);

const isSameDay = (a, b) => (
  a && b &&
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()
);

const parseDate = (value) => {
  if (!value) return null;
  try {
    const d = value instanceof Date ? value : new Date(value);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
};

const ProjectsCalendar = ({ projects = [] }) => {
  const [current, setCurrent] = useState(startOfMonth(new Date()));

  const calendarDays = useMemo(() => {
    const first = startOfMonth(current);
    const last = endOfMonth(current);

    const weekday = (first.getDay() + 6) % 7; // Monday as first day
    const daysInMonth = last.getDate();

    const days = [];
    for (let i = 0; i < weekday; i++) {
      days.push({ date: null, items: [] });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({ date: new Date(current.getFullYear(), current.getMonth(), d), items: [] });
    }
    while (days.length % 7 !== 0) {
      days.push({ date: null, items: [] });
    }
    return days;
  }, [current]);

  const projectMarkers = useMemo(() => {
    return projects.map((p) => {
      const start = parseDate(p.start_date);
      const due = parseDate(p.due_date);
      return { id: p.id, name: p.name, start, due, status: p.status, priority: p.priority };
    });
  }, [projects]);

  const daysWithItems = useMemo(() => {
    return calendarDays.map((cell) => {
      if (!cell.date) return cell;
      const items = [];
      for (const m of projectMarkers) {
        if (m.start && isSameDay(m.start, cell.date)) {
          items.push({ type: 'start', project: m });
        }
        if (m.due && isSameDay(m.due, cell.date)) {
          items.push({ type: 'due', project: m });
        }
      }
      return { ...cell, items };
    });
  }, [calendarDays, projectMarkers]);

  return (
    <div className="projects-calendar">
      <div className="cal-header">
        <button className="cal-nav" onClick={() => setCurrent((d) => addMonths(d, -1))}>←</button>
        <div className="cal-title">{getMonthLabel(current)}</div>
        <button className="cal-nav" onClick={() => setCurrent((d) => addMonths(d, 1))}>→</button>
      </div>

      <div className="cal-weekdays">
        <div>Пн</div>
        <div>Вт</div>
        <div>Ср</div>
        <div>Чт</div>
        <div>Пт</div>
        <div>Сб</div>
        <div>Вс</div>
      </div>

      <div className="cal-grid">
        {daysWithItems.map((cell, idx) => (
          <div key={idx} className={`cal-cell${cell.date ? '' : ' cal-cell--empty'}`}>
            {cell.date && (
              <>
                <div className="cal-date">{cell.date.getDate()}</div>
                <div className="cal-items">
                  {cell.items.map((it, i) => (
                    <div key={i} className={`cal-chip cal-chip--${it.type}`} title={`${it.type === 'start' ? 'Старт' : 'Дедлайн'} • ${it.project.name}`}>
                      <span className="cal-chip-dot" />
                      <span className="cal-chip-text">{it.project.name}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProjectsCalendar;


