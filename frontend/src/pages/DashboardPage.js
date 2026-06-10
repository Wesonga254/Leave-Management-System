import React, { useState, useEffect } from 'react';
import './DashboardPage.css';
import { leaveService } from '../services/api';

function DashboardPage() {
  const [leaveBalance, setLeaveBalance] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    fetchLeaveBalance();
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

  const fetchApplications = async () => {
    try {
      const response = await leaveService.getApplications();
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

  const prettifyStep = (value = '') => {
    const labels = {
      supervisor: 'Supervisor Review',
      hr: 'HR Notified',
      chief_officer: 'Chief Officer',
      director: 'Director Approval'
    };
    return labels[value] || value.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
  };

  const getTrackerState = (step, index, applicationStatus) => {
    const status = (step.status || '').toLowerCase();
    const finalStatus = (applicationStatus || '').toLowerCase();

    if (status === 'approved') return 'complete';
    if (status === 'rejected' || finalStatus === 'rejected') return status === 'rejected' ? 'rejected' : 'waiting';
    if (finalStatus === 'cancelled' || finalStatus === 'canceled') return index === 0 ? 'complete' : 'waiting';

    const firstPendingIndex = (applications[0]?.workflow || []).findIndex(item => (item.status || '').toLowerCase() === 'pending');
    if (status === 'pending' && index === firstPendingIndex) return 'active';
    if (status === 'not_required') return 'waiting';
    return 'waiting';
  };

  const getTrackerSteps = (application) => {
    const workflow = application?.workflow || [];
    if (workflow.length > 0) {
      return [
        { label: 'Submitted', state: 'complete', note: application.created_at },
        ...workflow.map((step, index) => ({
          label: prettifyStep(step.approval_level),
          state: getTrackerState(step, index, application.status),
          note: step.approved_at || step.updated_at,
          comments: step.comments
        }))
      ];
    }

    const status = application?.status || 'pending';
    const normalized = status.toLowerCase();
    const steps = ['Submitted', 'Supervisor Review', 'Approved'];

    if (normalized === 'approved') {
      return steps.map(label => ({ label, state: 'complete' }));
    }

    if (normalized === 'rejected' || normalized === 'cancelled' || normalized === 'canceled') {
      return steps.map((label, index) => ({
        label,
        state: index === 0 ? 'complete' : index === 1 ? 'rejected' : 'waiting'
      }));
    }

    return steps.map((label, index) => ({
      label,
      state: index === 0 ? 'complete' : index === 1 ? 'active' : 'waiting'
    }));
  };

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div className="header-content">
          <h1>Welcome back, <span className="user-name">{user.first_name}</span></h1>
          <p className="header-subtitle">Manage your leave requests and track approvals</p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="stats-grid">
        <div className="stat-card stat-card-total">
          <div className="stat-content">
            <h3>Total Leave Days</h3>
            <div className="number">
              {leaveBalance.reduce((sum, balance) => sum + (balance.total_days || balance.annual_limit || 0), 0)}
            </div>
          </div>
        </div>
        <div className="stat-card stat-card-used">
          <div className="stat-content">
            <h3>Days Used</h3>
            <div className="number">
              {leaveBalance.reduce((sum, balance) => sum + balance.used_days, 0)}
            </div>
          </div>
        </div>
        <div className="stat-card stat-card-remaining">
          <div className="stat-content">
            <h3>Remaining Days</h3>
            <div className="number">
              {leaveBalance.reduce((sum, balance) => sum + balance.remaining_days, 0)}
            </div>
          </div>
        </div>
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

      {applications.length > 0 && (
        <div className="status-tracker-card">
          <div className="tracker-heading">
            <h2 className="section-title">Application Status Tracker</h2>
            <span>{applications[0].leave_type_name || applications[0].leave_type}</span>
          </div>
          <div className="status-tracker" aria-label="Latest application approval progress">
            {getTrackerSteps(applications[0]).map((step, index) => (
              <div className={`tracker-step tracker-${step.state}`} key={step.label}>
                <span className="tracker-dot">{index + 1}</span>
                <span className="tracker-label">{step.label}</span>
                {step.note && <small>{new Date(step.note).toLocaleString()}</small>}
                {step.comments && <small>{step.comments}</small>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="card-title">Leave Balance by Type</h2>
        {loading ? (
          <div className="loading">Loading...</div>
        ) : leaveBalance.length === 0 ? (
          <div className="empty-state">No leave balance found</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Leave Type</th>
                <th>Total Days</th>
                <th>Days Used</th>
                <th>Remaining Days</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {leaveBalance.map(balance => (
                <tr key={balance.id}>
                  <td className="leave-type-cell">
                    <strong>{balance.leave_type_name}</strong>
                  </td>
                  <td>{balance.total_days || balance.annual_limit || 0}</td>
                  <td>{balance.used_days}</td>
                  <td><strong className="remaining-days">{balance.remaining_days}</strong></td>
                  <td>
                    <span className={`status-tag ${balance.remaining_days > 0 ? 'status-available' : 'status-exhausted'}`}>
                      {balance.remaining_days > 0 ? 'Available' : 'Exhausted'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default DashboardPage;
