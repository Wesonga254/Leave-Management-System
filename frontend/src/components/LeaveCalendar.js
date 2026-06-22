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

function computeBusinessDays(start, end) {
  const [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  let d = new Date(sy, sm - 1, sd);
  const endDate = new Date(ey, em - 1, ed);
  let count = 0;
  while (d <= endDate) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

function businessDaysBetween(start, current) {
  const [sy, sm, sd] = start.split('-').map(Number);
  const [cy, cm, cd] = current.split('-').map(Number);
  let d = new Date(sy, sm - 1, sd);
  const endDate = new Date(cy, cm - 1, cd);
  let count = 0;
  while (d <= endDate) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function LeaveCalendar({ applications = [], currentUserId = null }) {
  const today = new Date();
  const todayISO = toISO(today);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-indexed

  // Find active leave for the current user (employee perspective)
  const activeLeave = useMemo(() => {
    if (!currentUserId) return null;
    return (applications || []).find(app => {
      if (!app) return false;
      const status = (app.status || '').toLowerCase();
      if (status !== 'approved' && status !== 'approved by director' && status !== 'approved_hr') return false;
      const appUserId = app.user_id || app.userId;
      if (String(appUserId) !== String(currentUserId)) return false;
      const s = toISO(app.start_date || app.startDate || app.from);
      const e = toISO(app.end_date || app.endDate || app.to);
      if (!s || !e || !todayISO) return false;
      return todayISO >= s && todayISO <= e;
    });
  }, [applications, currentUserId, todayISO]);

  const activeLeaveProgress = useMemo(() => {
    if (!activeLeave) return null;
    const s = toISO(activeLeave.start_date || activeLeave.startDate || activeLeave.from);
    const e = toISO(activeLeave.end_date || activeLeave.endDate || activeLeave.to);
    if (!s || !e) return null;
    const totalDays = computeBusinessDays(s, e);
    const currentDay = businessDaysBetween(s, todayISO);
    return { currentDay: Math.min(currentDay, totalDays), totalDays, leaveName: activeLeave.leave_type_name || activeLeave.leave_type || 'Leave' };
  }, [activeLeave, todayISO]);

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
        const employeeName = app.employee_name || [app.first_name, app.last_name].filter(Boolean).join(' ') || 'Employee';
        const entry = map[d] || { count: 0, names: [], isCurrentUser: false };
        entry.count += 1;
        if (!entry.names.includes(employeeName)) entry.names.push(employeeName);
        const appUserId = app.user_id || app.userId;
        if (currentUserId && String(appUserId) === String(currentUserId)) {
          entry.isCurrentUser = true;
        }
        map[d] = entry;
      });
    });
    return map;
  }, [applications, currentUserId]);

  // Navigation
  const goToday = () => {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
  };
  const goPrev = () => {
    const m = viewMonth - 1;
    if (m < 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m);
  };
  const goNext = () => {
    const m = viewMonth + 1;
    if (m > 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m);
  };

  // Build calendar grid (Sunday-start)
  const firstDay = new Date(viewYear, viewMonth, 1);
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  // getDay(): 0=Sun … 6=Sat (Sunday-start, no conversion needed)
  const startOffset = firstDay.getDay();

  // Previous month trailing days
  const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();
  const leadingDays = Array.from({ length: startOffset }).map((_, i) => {
    const day = prevMonthDays - startOffset + 1 + i;
    const m = viewMonth === 0 ? 11 : viewMonth - 1;
    const y = viewMonth === 0 ? viewYear - 1 : viewYear;
    const d = new Date(y, m, day);
    return { day, iso: toISO(d), outside: true };
  });

  // Current month days
  const currentDays = Array.from({ length: daysInMonth }).map((_, i) => {
    const d = new Date(viewYear, viewMonth, i + 1);
    return { day: i + 1, iso: toISO(d), outside: false };
  });

  // Next month trailing days to complete the grid (always fill to 6 rows = 42 cells)
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
  const trailingCount = totalCells - startOffset - daysInMonth;
  const trailingDays = Array.from({ length: trailingCount }).map((_, i) => {
    const m = viewMonth === 11 ? 0 : viewMonth + 1;
    const y = viewMonth === 11 ? viewYear + 1 : viewYear;
    const d = new Date(y, m, i + 1);
    return { day: i + 1, iso: toISO(d), outside: true };
  });

  const cells = [...leadingDays, ...currentDays, ...trailingDays];

  const isToday = viewYear === today.getFullYear() && viewMonth === today.getMonth();

  return (
    <div className="leave-calendar-v2">
      {/* Active Leave Banner (Employee view) */}
      {activeLeaveProgress && (
        <div className="active-leave-banner">
          <div className="active-leave-indicator">
            <span className="active-leave-dot"></span>
            <span className="active-leave-label">On Leave</span>
          </div>
          <div className="active-leave-details">
            <span className="active-leave-type">{activeLeaveProgress.leaveName}</span>
            <div className="active-leave-counter">
              <span className="counter-current">Day {activeLeaveProgress.currentDay}</span>
              <span className="counter-separator">of</span>
              <span className="counter-total">{activeLeaveProgress.totalDays}</span>
            </div>
            <div className="active-leave-progress-bar">
              <div
                className="active-leave-progress-fill"
                style={{ width: `${Math.min(100, (activeLeaveProgress.currentDay / activeLeaveProgress.totalDays) * 100)}%` }}
              ></div>
            </div>
          </div>
        </div>
      )}

      {/* Calendar Header — Navigation */}
      <div className="cal-v2-header">
        <div className="cal-v2-nav">
          <button className="cal-v2-nav-btn" onClick={goPrev} aria-label="Previous month">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <button className="cal-v2-nav-btn" onClick={goNext} aria-label="Next month">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
          <h2 className="cal-v2-title">{MONTH_NAMES[viewMonth]} {viewYear}</h2>
        </div>
        <button className={`cal-v2-today-btn${isToday ? ' cal-v2-today-active' : ''}`} onClick={goToday}>Today</button>
      </div>

      {/* Weekday Headers */}
      <div className="cal-v2-grid">
        {WEEKDAYS.map(day => (
          <div key={day} className={`cal-v2-weekday ${day === 'Sat' || day === 'Sun' ? 'cal-v2-weekend-hdr' : ''}`}>{day}</div>
        ))}

        {/* Calendar Cells */}
        {cells.map((c, idx) => {
          const dayOfWeek = idx % 7; // 0=Sun … 6=Sat
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
          const isCurrentDay = c.iso === todayISO && !c.outside;
          const info = highlighted[c.iso];
          const hasLeave = !!info;
          const isSelf = info?.isCurrentUser;

          return (
            <div
              key={`${c.iso}-${idx}`}
              className={[
                'cal-v2-cell',
                c.outside ? 'cal-v2-outside' : '',
                isWeekend ? 'cal-v2-weekend' : '',
                isCurrentDay ? 'cal-v2-today' : '',
                hasLeave && !c.outside ? 'cal-v2-has-leave' : '',
                isSelf && !c.outside ? 'cal-v2-self' : ''
              ].filter(Boolean).join(' ')}
              title={info && !c.outside ? info.names.join(', ') : ''}
            >
              <span className={`cal-v2-day-num ${isCurrentDay ? 'cal-v2-day-today' : ''}`}>{c.day}</span>
              {hasLeave && !c.outside && (
                <div className="cal-v2-leave-info">
                  {info.names.slice(0, 2).map(name => (
                    <span key={name} className="cal-v2-name-chip">{name.split(' ')[0]}</span>
                  ))}
                  {info.names.length > 2 && (
                    <span className="cal-v2-more">+{info.names.length - 2}</span>
                  )}
                </div>
              )}
              {hasLeave && !c.outside && info.count > 1 && (
                <span className="cal-v2-badge">{info.count}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
