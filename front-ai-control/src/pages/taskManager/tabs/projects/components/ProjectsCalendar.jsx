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

const formatDate = (date) => {
  if (!date) return '';
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
};

const formatDateOnly = (dateString) => {
  if (!dateString) return '';
  try {
    // Handle both date strings and Date objects
    let date;
    if (typeof dateString === 'string') {
      // If it's a string like "2027-10-22" (without time), parse it directly
      if (dateString.includes('T')) {
        // If it's a string like "2027-10-22T00:00:00", extract just the date part
        const datePart = dateString.split('T')[0];
        const [year, month, day] = datePart.split('-').map(Number);
        date = new Date(year, month - 1, day); // month is 0-indexed in JS
      } else {
        // If it's already a date string like "2027-10-22"
        const [year, month, day] = dateString.split('-').map(Number);
        date = new Date(year, month - 1, day); // month is 0-indexed in JS
      }
    } else {
      date = new Date(dateString);
    }
    
    if (isNaN(date.getTime())) return '';
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  } catch {
    return '';
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
    const markers = [];
    
    // Add project start/due dates
    projects.forEach((p) => {
      const start = parseDate(p.start_date);
      const due = parseDate(p.due_date);
      if (start) {
        markers.push({ 
          id: `project-${p.id}-start`, 
          name: `Старт: ${p.name}`, 
          date: start, 
          type: 'project-start',
          project: p,
          formattedDate: formatDate(start)
        });
      }
      if (due) {
        markers.push({ 
          id: `project-${p.id}-due`, 
          name: `Дедлайн: ${p.name}`, 
          date: due, 
          type: 'project-due',
          project: p,
          formattedDate: formatDate(due)
        });
      }
    });
    
    // Add team disbandment dates
    projects.forEach((p) => {
      if (p.teams && Array.isArray(p.teams)) {
        p.teams.forEach((team) => {
          if (team.disbanded_at) {
            const disbandDate = parseDate(team.disbanded_at);
            if (disbandDate) {
              markers.push({
                id: `team-${team.id}-disband`,
                name: `Расформирование: ${team.team_name}`,
                date: disbandDate,
                type: 'team-disband',
                project: p,
                team: team,
                formattedDate: formatDateOnly(team.disbanded_at)
              });
            }
          }
        });
      }
    });
    
    return markers;
  }, [projects]);

  const daysWithItems = useMemo(() => {
    return calendarDays.map((cell) => {
      if (!cell.date) return cell;
      const items = [];
      for (const marker of projectMarkers) {
        if (marker.date && isSameDay(marker.date, cell.date)) {
          items.push({ 
            type: marker.type, 
            project: marker.project,
            team: marker.team,
            name: marker.name,
            formattedDate: marker.formattedDate
          });
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
                    <div key={i} className={`cal-chip cal-chip--${it.type}`} title={`${it.name} • ${it.formattedDate}`}>
                      <span className="cal-chip-dot" />
                      <span className="cal-chip-text">{it.name}</span>
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


