import React, { useState, useEffect } from 'react';
import { leaveService } from '../services/api';
import LeaveCalendar from '../components/LeaveCalendar';
import './LeaveCalendarPage.css';

function LeaveCalendarPage() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const response = await leaveService.getApplications();
      setApplications(response.data.data || []);
    } catch (err) {
      setError('Error loading leave applications');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="leave-calendar-page">
      <div className="calendar-header">
        <div className="header-content">
          <h1>Leave Calendar</h1>
          <p className="header-subtitle">View all your approved leave on the calendar</p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="loading">Loading calendar...</div>
      ) : (
        <div className="calendar-container">
          <LeaveCalendar applications={applications} />
          
          <div className="calendar-legend">
            <h3>Calendar Legend</h3>
            <div className="legend-items">
              <div className="legend-item">
                <div className="legend-color highlight"></div>
                <span>Approved Leave</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LeaveCalendarPage;
