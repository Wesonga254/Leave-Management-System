import React, { useMemo, useState } from 'react';
import './LeaveCalendar.css';

function toISO(date) {
  if (!date) return null;
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(date)) {
    return date.slice(0, 10);
  }
  const d = new Date(date);
  if (isNaN(d)) return null;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function rangeDates(start, end) {
  const result = [];
  const [startYear, startMonth, startDay] = start.split('-').map(Number);
  const [endYear, endMonth, endDay] = end.split('-').map(Number);
  let d = new Date(startYear, startMonth - 1, startDay);
  const ed = new Date(endYear, endMonth - 1, endDay);
  while (d <= ed) {
    result.push(toISO(d));
    d.setDate(d.getDate() + 1);
  }
  return result;
}

export default function LeaveCalendar({ applications = [] }) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-indexed

  const highlighted = useMemo(() => {
    const map = {};
    (applications || []).forEach(app => {
      if (!app) return;
      const status = (app.status || '').toLowerCase();
      if (status !== 'approved' && status !== 'approved by director' && status !== 'approved_hr') return;
      const s = toISO(app.start_date || app.startDate || app.from);
      const e = toISO(app.end_date || app.endDate || app.to);
      if (!s || !e) return;
      const days = rangeDates(s, e);
      days.forEach(d => {
        map[d] = (map[d] || 0) + 1;
      });
    });
    return map;
  }, [applications]);

  // Build calendar for current month
  const firstDay = new Date(viewYear, viewMonth, 1);
  const startWeekDay = firstDay.getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const blanks = Array.from({ length: startWeekDay }).map((_, i) => ({ blank: true, key: `b-${i}` }));
  const days = Array.from({ length: daysInMonth }).map((_, i) => {
    const d = new Date(viewYear, viewMonth, i + 1);
    const iso = toISO(d);
    return { blank: false, day: i + 1, iso };
  });

  const cells = [...blanks, ...days];

  const monthName = new Date(viewYear, viewMonth, 1).toLocaleString(undefined, { month: 'long' });

  return (
    <div className="leave-calendar">
      <div className="calendar-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <button className="btn-small" onClick={() => {
            const m = viewMonth - 1;
            if (m < 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m);
          }}>&lt;</button>
          <button className="btn-small" onClick={() => {
            const m = viewMonth + 1;
            if (m > 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m);
          }} style={{ marginLeft: 8 }}>&gt;</button>
        </div>
        <strong>{monthName} {viewYear}</strong>
        <div />
      </div>
      <div className="calendar-grid">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(h => (
          <div key={h} className="cal-weekday">{h}</div>
        ))}
        {cells.map((c, idx) => (
          c.blank ? (
            <div key={c.key} className="cal-cell blank" />
          ) : (
            <div key={c.iso} className={`cal-cell ${highlighted[c.iso] ? 'highlight' : ''}`} title={highlighted[c.iso] ? `${highlighted[c.iso]} approved leave(s)` : ''}>
              <div className="cal-day">{c.day}</div>
              {highlighted[c.iso] ? <div className="cal-badge">{highlighted[c.iso]}</div> : null}
            </div>
          )
        ))}
      </div>
    </div>
  );
}
