import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../services/api';
import './DashboardPage.css';
import './LeaveHistoryPage.css';

// Official Kenyan Public Holidays (gazetted)
const KENYAN_HOLIDAYS = [
  { name: "New Year's Day", month: 1, day: 1 },
  { name: 'Labour Day', month: 5, day: 1 },
  { name: 'Madaraka Day', month: 6, day: 1 },
  { name: 'Mazingira Day', month: 10, day: 10 },
  { name: 'Mashujaa Day', month: 10, day: 20 },
  { name: 'Jamhuri Day', month: 12, day: 12 },
  { name: 'Christmas Day', month: 12, day: 25 },
  { name: 'Boxing Day', month: 12, day: 26 },
];

function toISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function UpcomingHolidaysPage() {
  const [systemHolidays, setSystemHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [now, setNow] = useState(new Date());

  // Real-time update — re-render every 60 seconds
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchHolidays = async () => {
      try {
        setLoading(true);
        const res = await api.get('/leave/holidays');
        if (res.data.success) {
          setSystemHolidays(res.data.data || []);
        }
      } catch (err) {
        setError('Unable to load holidays from the system');
      } finally {
        setLoading(false);
      }
    };
    fetchHolidays();
  }, []);

  const today = useMemo(() => {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [now]);

  const currentYear = today.getFullYear();

  // Merge Kenyan holidays with system holidays
  const allHolidays = useMemo(() => {
    const map = new Map();

    [currentYear, currentYear + 1].forEach(year => {
      KENYAN_HOLIDAYS.forEach(h => {
        const d = new Date(year, h.month - 1, h.day);
        const iso = toISO(d);
        map.set(iso, { name: h.name, date: iso, source: 'kenyan' });
      });
    });

    systemHolidays.forEach(h => {
      const iso = (h.date || '').slice(0, 10);
      if (iso) {
        const existing = map.get(iso);
        map.set(iso, {
          name: h.name || (existing ? existing.name : 'Public Holiday'),
          date: iso,
          source: existing ? 'both' : 'system'
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [systemHolidays, currentYear]);

  const todayISO = toISO(today);
  const upcoming = allHolidays.filter(h => h.date >= todayISO);
  const past = allHolidays.filter(h => h.date < todayISO);

  const formatDate = (dateStr) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const getDayName = (dateStr) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('en-GB', { weekday: 'long' });
  };

  const getDaysUntil = useCallback((dateStr) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const target = new Date(y, m - 1, d);
    target.setHours(0, 0, 0, 0);
    const diff = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
    if (diff === 0) return { text: '🎉 Today!', bg: '#E8F5E9', color: '#145A32' };
    if (diff === 1) return { text: 'Tomorrow', bg: '#E8F5E9', color: '#145A32' };
    if (diff < 0) return { text: 'Passed', bg: '#f3f4f6', color: '#6b7280' };
    if (diff <= 7) return { text: `${diff} days away`, bg: '#fff7ed', color: '#c2410c' };
    if (diff <= 30) return { text: `${diff} days away`, bg: '#eff6ff', color: '#1d4ed8' };
    if (diff <= 60) return { text: `${Math.floor(diff / 7)} weeks away`, bg: '#f5f3ff', color: '#6d28d9' };
    return { text: `${diff} days away`, bg: '#f8fafc', color: '#475569' };
  }, [today]);

  if (loading) {
    return <div className="loading">Loading public holidays...</div>;
  }

  return (
    <div className="leave-history-container">
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Public Holidays</h2>
            <p className="subtitle">Gazetted public holidays and system-defined holidays</p>
          </div>
        </div>

        {error && <div className="alert alert-info" style={{ marginBottom: 16 }}>{error}</div>}

        {/* Upcoming Holidays */}
        {upcoming.length === 0 ? (
          <div className="empty-state">
            <h3>No Upcoming Holidays</h3>
            <p>There are no remaining public holidays this year.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Holiday</th>
                  <th>Date</th>
                  <th>Day</th>
                  <th>Days Away</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map(h => {
                  const info = getDaysUntil(h.date);
                  return (
                    <tr key={h.date + h.name}>
                      <td>
                        <strong>{h.name}</strong>
                        {h.source === 'system' && <small style={{ display: 'block', color: '#6b7280', fontSize: 11 }}>System Holiday</small>}
                      </td>
                      <td>{formatDate(h.date)}</td>
                      <td>{getDayName(h.date)}</td>
                      <td>
                        <span style={{
                          display: 'inline-block',
                          minWidth: 110,
                          textAlign: 'center',
                          padding: '4px 12px',
                          borderRadius: 20,
                          fontSize: 12,
                          fontWeight: 600,
                          background: info.bg,
                          color: info.color
                        }}>
                          {info.text}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Past Holidays */}
      {past.length > 0 && (
        <div className="card" style={{ marginTop: 18 }}>
          <div className="card-header">
            <h2 className="card-title">Past Holidays ({currentYear})</h2>
          </div>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Holiday</th>
                  <th>Date</th>
                  <th>Day</th>
                </tr>
              </thead>
              <tbody>
                {past.map(h => (
                  <tr key={h.date + h.name} style={{ opacity: 0.55 }}>
                    <td>{h.name}</td>
                    <td>{formatDate(h.date)}</td>
                    <td>{getDayName(h.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default UpcomingHolidaysPage;
