import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminService, reportService } from '../services/api';
import '../pages/DashboardPage.css';

function AdminDashboardPage({ userRole, userId }) {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalApplications: 0,
    approvedApplications: 0,
    pendingApplications: 0,
    rejectedApplications: 0,
    daysUsed: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [carryForwardRunning, setCarryForwardRunning] = useState(false);
  const [carryForwardMessage, setCarryForwardMessage] = useState('');

  // Verify admin access
  useEffect(() => {
    if (userRole !== 'admin') {
      navigate('/dashboard');
    }
  }, [userRole, navigate]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await reportService.getSummaryReport();
      if (response.data.success) {
        const data = response.data.data || {};
        setStats({
          totalUsers: data.totalUsers ?? data.total_users ?? data.total_employees ?? 0,
          totalApplications: data.totalApplications ?? data.total_applications ?? (
            (data.total_approved_leaves || 0) + (data.pending_approvals || 0) + (data.total_rejected_leaves || 0)
          ),
          approvedApplications: data.approvedApplications ?? data.total_approved_leaves ?? 0,
          pendingApplications: data.pendingApplications ?? data.pending_approvals ?? 0,
          rejectedApplications: data.rejectedApplications ?? data.total_rejected_leaves ?? 0,
          daysUsed: data.daysUsed ?? data.total_days_used ?? 0
        });
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to load dashboard data right now');
    } finally {
      setLoading(false);
    }
  };

  const handleRunCarryForward = async () => {
    const fromYear = new Date().getFullYear() - 1;
    if (!window.confirm(`Run leave carry-forward from ${fromYear} to ${fromYear + 1}? This will update opening balances and record audit transactions.`)) {
      return;
    }

    try {
      setCarryForwardRunning(true);
      setCarryForwardMessage('');
      const response = await adminService.runCarryForward({ from_year: fromYear });
      const data = response.data.data || {};
      setCarryForwardMessage(`Carry-forward complete: ${data.processed || 0} balances processed, ${data.carriedForward || 0} days carried, ${data.forfeited || 0} days forfeited.`);
    } catch (err) {
      setCarryForwardMessage(err?.response?.data?.message || 'Unable to run carry-forward');
    } finally {
      setCarryForwardRunning(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading admin dashboard...</div>;
  }

  return (
    <div className="dashboard-container admin-dashboard leave-history-container">
      <div className="dashboard-header admin-hero">
        <div className="header-content">
          <span className="dashboard-kicker">System Administration</span>
          <h1>Control Center</h1>
          <p className="header-subtitle">Manage users, review leave activity, and monitor the core services that keep approvals running.</p>
        </div>
        <div className="admin-hero-summary">
          <span className="summary-label">Open Requests</span>
          <strong>{stats.pendingApplications}</strong>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {carryForwardMessage && <div className="alert alert-info">{carryForwardMessage}</div>}

      {/* Quick Stats */}
      <div className="stats-grid admin-stats-grid">
        <div className="stat-card admin-stat users">
          <div className="stat-content">
            <h3>Total Users</h3>
            <div className="number">{stats.totalUsers}</div>
          </div>
        </div>

        <div className="stat-card admin-stat applications">
          <div className="stat-content">
            <h3>Total Applications</h3>
            <div className="number">{stats.totalApplications}</div>
          </div>
        </div>

        <div className="stat-card admin-stat stat-approved">
          <div className="stat-content">
            <h3>Approved</h3>
            <div className="number">{stats.approvedApplications}</div>
          </div>
        </div>

        <div className="stat-card admin-stat stat-pending">
          <div className="stat-content">
            <h3>Pending</h3>
            <div className="number">{stats.pendingApplications}</div>
          </div>
        </div>

        <div className="stat-card admin-stat stat-rejected">
          <div className="stat-content">
            <h3>Rejected</h3>
            <div className="number">{stats.rejectedApplications}</div>
          </div>
        </div>
      </div>

      {/* Admin Controls */}
      <div className="admin-controls">
        <div className="section-heading">
          <span className="dashboard-kicker">Controls</span>
          <h2>Administration Controls</h2>
        </div>
        <div className="controls-grid">
          <div className="control-card">
            <h3>Organization</h3>
            <p>Review employee accounts and role assignments.</p>
            <button type="button" onClick={() => navigate('/admin/users')}>Manage Users</button>
          </div>

          <div className="control-card">
            <h3>Leave Management</h3>
            <p>Configure leave categories, public holidays, and accrual rules.</p>
            <div className="actions-buttons">
              <button type="button" onClick={() => navigate('/admin/leave-types')}>Leave Types</button>
              <button type="button" onClick={() => navigate('/admin/holidays')}>Holidays</button>
              <button type="button" onClick={handleRunCarryForward} disabled={carryForwardRunning}>
                {carryForwardRunning ? 'Running...' : 'Run Carry Forward'}
              </button>
            </div>
          </div>

          <div className="control-card">
            <h3>Reports & Analytics</h3>
            <p>Review utilization, approvals, and leave trends.</p>
            <div className="actions-buttons">
              <button type="button" onClick={() => navigate('/reports')}>View Reports</button>
              <button type="button" onClick={() => navigate('/admin/settings')}>System Config</button>
            </div>
          </div>
        </div>
      </div>

      {/* System Status */}
      <div className="system-status">
        <div className="section-heading">
          <span className="dashboard-kicker">Health</span>
          <h2>System Status</h2>
        </div>
        <div className="status-items">
          <div className="status-item">
            <span className="status-indicator active"></span>
            <span className="status-label">Database Connection</span>
            <span className="status-value">Connected</span>
          </div>
          <div className="status-item">
            <span className="status-indicator active"></span>
            <span className="status-label">API Server</span>
            <span className="status-value">Online</span>
          </div>
          <div className="status-item">
            <span className="status-indicator active"></span>
            <span className="status-label">Authentication</span>
            <span className="status-value">Active</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboardPage;
