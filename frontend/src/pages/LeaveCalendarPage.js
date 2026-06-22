import React, { useState, useEffect, useMemo } from 'react';
import { leaveService } from '../services/api';
import LeaveCalendar from '../components/LeaveCalendar';
import './LeaveCalendarPage.css';

function LeaveCalendarPage() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState('organisation');
  const userRole = localStorage.getItem('userRole') || 'employee';
  const canToggle = ['hr', 'admin', 'director'].includes(userRole);

  useEffect(() => {
    fetchApplications();
  }, [viewMode]);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const params = viewMode === 'my' ? { scope: 'own' } : {};
      const response = await leaveService.getApplications(params);
      setApplications(response.data.data || []);
    } catch (err) {
      setError('Error loading leave applications');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const approvedApps = useMemo(() => {
    return applications.filter(app => app.status === 'approved');
  }, [applications]);

  const title = viewMode === 'my' ? 'My Leave Calendar' : 'Organisation Leave Calendar';
  const subtitle = viewMode === 'my'
    ? 'Your approved leave shown on the calendar'
    : 'All approved leave across the organisation';

  return (
    <div className="leave-calendar-page">
      <div className="calendar-header">
        <div className="header-content">
          <h1>{title}</h1>
          <p className="header-subtitle">{subtitle}</p>
        </div>
        {canToggle && (
          <div className="calendar-toggle">
            <button
              className={`cal-toggle-btn${viewMode === 'my' ? ' cal-toggle-active' : ''}`}
              onClick={() => setViewMode('my')}
            >
              My Calendar
            </button>
            <button
              className={`cal-toggle-btn${viewMode === 'organisation' ? ' cal-toggle-active' : ''}`}
              onClick={() => setViewMode('organisation')}
            >
              Organisation
            </button>
          </div>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="loading">Loading calendar...</div>
      ) : (
        <div className="calendar-container">
          <LeaveCalendar applications={approvedApps} />
          
          <div className="calendar-legend">
            <h3>Calendar Legend</h3>
            <div className="legend-items">
              <div className="legend-item">
                <div className="legend-color" style={{ background: 'rgba(15, 118, 110, 0.12)', border: '2px solid rgba(15, 118, 110, 0.3)' }}></div>
                <span>Approved Leave</span>
              </div>
              <div className="legend-item">
                <div className="legend-color" style={{ background: '#0f172a' }}></div>
                <span>Today</span>
              </div>
              <div className="legend-item">
                <div className="legend-color" style={{ background: '#fafbfd', border: '2px solid #e5e7eb' }}></div>
                <span>Weekend</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LeaveCalendarPage;
