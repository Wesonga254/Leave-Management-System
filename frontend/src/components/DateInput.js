import React, { useState, useRef, useEffect, useCallback } from 'react';
import './DateInput.css';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function toISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseISO(str) {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function formatDisplay(str) {
  const d = parseISO(str);
  if (!d) return '';
  return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function DateInput({ value, onChange, min, max, required, id, name, className = '', placeholder = 'Select date', disabled }) {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => {
    const d = parseISO(value) || new Date();
    return d.getFullYear();
  });
  const [viewMonth, setViewMonth] = useState(() => {
    const d = parseISO(value) || new Date();
    return d.getMonth();
  });
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Sync view to value when it changes
  useEffect(() => {
    const d = parseISO(value);
    if (d) {
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  }, [value]);

  const today = new Date();
  const todayISO = toISO(today);

  const goPrev = (e) => { e.stopPropagation(); setViewMonth(m => m === 0 ? (setViewYear(y => y - 1), 11) : m - 1); };
  const goNext = (e) => { e.stopPropagation(); setViewMonth(m => m === 11 ? (setViewYear(y => y + 1), 0) : m + 1); };

  const handleSelect = useCallback((iso) => {
    // Simulate a native-like event
    const syntheticEvent = { target: { name: name || id || '', value: iso } };
    if (onChange) onChange(syntheticEvent);
    setOpen(false);
  }, [onChange, name, id]);

  // Build grid (Sunday-start)
  const firstDay = new Date(viewYear, viewMonth, 1);
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const startOffset = firstDay.getDay(); // 0=Sun
  const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();

  const cells = [];
  // Leading days
  for (let i = 0; i < startOffset; i++) {
    const day = prevMonthDays - startOffset + 1 + i;
    const m = viewMonth === 0 ? 11 : viewMonth - 1;
    const y = viewMonth === 0 ? viewYear - 1 : viewYear;
    cells.push({ day, iso: toISO(new Date(y, m, day)), outside: true });
  }
  // Current month
  for (let i = 1; i <= daysInMonth; i++) {
    cells.push({ day: i, iso: toISO(new Date(viewYear, viewMonth, i)), outside: false });
  }
  // Trailing days
  const total = Math.ceil(cells.length / 7) * 7;
  for (let i = 1; cells.length < total; i++) {
    const m = viewMonth === 11 ? 0 : viewMonth + 1;
    const y = viewMonth === 11 ? viewYear + 1 : viewYear;
    cells.push({ day: i, iso: toISO(new Date(y, m, i)), outside: true });
  }

  const isDisabled = (iso) => {
    if (min && iso < min) return true;
    if (max && iso > max) return true;
    return false;
  };

  return (
    <div className={`dateinput-wrap ${className}`} ref={ref}>
      <button
        type="button"
        className={`dateinput-trigger ${open ? 'dateinput-active' : ''} ${value ? '' : 'dateinput-placeholder'}`}
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
        id={id}
      >
        <svg className="dateinput-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        <span>{value ? formatDisplay(value) : placeholder}</span>
      </button>

      {/* Hidden native input for form compatibility */}
      <input type="hidden" name={name} value={value || ''} required={required} />

      {open && (
        <div className="dateinput-dropdown">
          <div className="dateinput-nav">
            <button type="button" className="dateinput-nav-btn" onClick={goPrev}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <span className="dateinput-month-label">{MONTHS[viewMonth]} {viewYear}</span>
            <button type="button" className="dateinput-nav-btn" onClick={goNext}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>

          <div className="dateinput-grid">
            {WEEKDAYS.map((d, i) => (
              <div key={i} className={`dateinput-wday ${i === 0 || i === 6 ? 'dateinput-wday-we' : ''}`}>{d}</div>
            ))}
            {cells.map((c, i) => {
              const selected = c.iso === value;
              const isToday = c.iso === todayISO && !c.outside;
              const dis = c.outside || isDisabled(c.iso);
              const weekend = i % 7 === 0 || i % 7 === 6;
              return (
                <button
                  key={i}
                  type="button"
                  className={[
                    'dateinput-day',
                    c.outside ? 'dateinput-outside' : '',
                    selected ? 'dateinput-selected' : '',
                    isToday ? 'dateinput-today' : '',
                    dis ? 'dateinput-disabled' : '',
                    weekend && !c.outside ? 'dateinput-weekend' : ''
                  ].filter(Boolean).join(' ')}
                  onClick={() => !dis && handleSelect(c.iso)}
                  disabled={dis}
                  tabIndex={dis ? -1 : 0}
                >
                  {c.day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
