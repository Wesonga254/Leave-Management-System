import React, { useState, useEffect, useMemo } from 'react';
import './DashboardPage.css';
import { leaveService } from '../services/api';

import ApplicationTracker from '../components/ApplicationTracker';

const LEAVE_TYPE_COLORS = [
  { bg: '#E8F5E9', border: '#1B7340', text: '#145A32' },
  { bg: '#eff6ff', border: '#2563eb', text: '#1e40af' },
  { bg: '#fefce8', border: '#ca8a04', text: '#854d0e' },
  { bg: '#fdf2f8', border: '#db2777', text: '#9d174d' },
  { bg: '#f5f3ff', border: '#7c3aed', text: '#5b21b6' },
  { bg: '#ecfdf5', border: '#059669', text: '#145A32' },
  { bg: '#fef2f2', border: '#dc2626', text: '#991b1b' },
];

function DashboardPage() {
  const [leaveBalance, setLeaveBalance] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    fetchLeaveBalance();
    fetchLeaveTypes();
    fetchApplications();
    const interval = setInterval(fetchApplications, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchLeaveBalance = async () => {
    try {
      const response = await leaveService.getLeaveBalance();
      setLeaveBalance(response.data.data);
    } catch (err) {
      setError('Error loading leave balance');
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaveTypes = async () => {
    try {
      const response = await leaveService.getLeaveTypes();
      setLeaveTypes(response.data.data || []);
    } catch (err) {
      console.error('Error loading leave types:', err);
    }
  };

  const fetchApplications = async () => {
    try {
      const response = await leaveService.getApplications({ scope: 'own' });
      setApplications(response.data.data || []);
    } catch (err) {
      console.error('Error loading applications:', err);
    }
  };

  // Get approval status summary
  const getApprovalSummary = () => {
    const summary = {
      pending: applications.filter(a => a.status === 'pending').length,
      approved: applications.filter(a => a.status === 'approved').length,
      rejected: applications.filter(a => a.status === 'rejected').length
    };
    return summary;
  };

  getApprovalSummary();



  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div className="header-content">
          <h1>Welcome back, <span className="user-name">{user.first_name}</span></h1>
          <p className="header-subtitle">Manage your leave requests and track approvals</p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Leave Type Entitlements */}
      <div className="leave-entitlements-section">
        {loading ? (
          <div className="loading">Loading...</div>
        ) : (
          <div className="leave-entitlements-grid">
            {leaveTypes.map((lt, index) => {
              const color = LEAVE_TYPE_COLORS[index % LEAVE_TYPE_COLORS.length];
              return (
                <div
                  className="leave-entitlement-card"
                  key={lt.id}
                  style={{
                    background: color.bg,
                    borderTop: `4px solid ${color.border}`
                  }}
                >
                  <div className="entitlement-info">
                    <span className="entitlement-name">{lt.name}</span>
                    <span className="entitlement-days" style={{ color: color.text }}>
                      {lt.annual_limit} <small>Days</small>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Approval Status Section - Line Form */}
      <div className="approval-status-section">
        <h2 className="section-title">Recent Applications</h2>
        {applications.length === 0 ? (
          <div className="empty-state-box">No applications yet. <a href="/apply-leave">Submit your first leave request</a></div>
        ) : (
          <div className="recent-applications">
            {applications.slice(0, 5).map(app => (
              <div key={app.id} className="application-row">
                <div className="application-info">
                  <span className="application-title">{app.leave_type_name || app.leave_type}</span>
                  <span className="application-dates">{app.start_date} to {app.end_date}</span>
                </div>
                <div className="application-status">
                  <span className={`status-badge status-${app.status || 'pending'}`}>
                    {(app.status || 'pending').charAt(0).toUpperCase() + (app.status || 'pending').slice(1)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Application Tracker for each recent application */}
      {applications.length > 0 && (
        <div className="status-tracker-card">
          <div className="tracker-heading">
            <h2 className="section-title">Application Status Tracker</h2>
          </div>
          {applications.slice(0, 3).map(app => (
            <ApplicationTracker key={app.id} application={app} />
          ))}
        </div>
      )}



      {/* Leave Balance Cards */}
      <div className="card">
        <h2 className="card-title">Leave Balance by Type</h2>
        {loading ? (
          <div className="loading">Loading...</div>
        ) : leaveBalance.length === 0 ? (
          <div className="empty-state">No leave balance found</div>
        ) : (
          <div className="balance-cards-grid">
            {leaveBalance.map(balance => {
              const total = balance.total_days || balance.annual_limit || 0;
              const used = balance.used_days || 0;
              const remaining = balance.remaining_days || 0;
              const usedPercent = total > 0 ? Math.round((used / total) * 100) : 0;
              return (
                <div className="balance-type-card" key={balance.id}>
                  <div className="balance-type-header">
                    <span className="balance-type-name">{balance.leave_type_name}</span>
                    <span className={`balance-type-status ${remaining > 0 ? 'available' : 'exhausted'}`}>
                      {remaining > 0 ? 'Available' : 'Exhausted'}
                    </span>
                  </div>
                  <div className="balance-type-total">{total} <small>Days</small></div>
                  <div className="balance-type-bar">
                    <div className="balance-type-bar-fill" style={{ width: `${usedPercent}%` }}></div>
                  </div>
                  <div className="balance-type-meta">
                    <span>{used} used</span>
                    <span><strong>{remaining} remaining</strong></span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default DashboardPage;
