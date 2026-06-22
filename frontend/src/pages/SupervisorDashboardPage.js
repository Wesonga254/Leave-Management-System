import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { leaveService, reportService } from '../services/api';
import LeaveRequestsTable from '../components/LeaveRequestsTable';

import './DashboardPage.css';
import './LeaveHistoryPage.css';

function SupervisorDashboardPage() {
  const [balance, setBalance] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [teamStats, setTeamStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        setError('');
        const [balanceRes, requestsRes, approvalsRes, teamRes] = await Promise.all([
          leaveService.getLeaveBalance(),
          leaveService.getApplications(),
          reportService.getMyApprovals(),
          leaveService.getTeamStats(new Date().getFullYear())
        ]);

        setBalance(balanceRes.data.data || []);
        setMyRequests(requestsRes.data.data || []);
        setPendingApprovals(approvalsRes.data.data || []);
        setTeamStats(teamRes.data || null);
      } catch (err) {
        setError(err?.response?.data?.message || 'Unable to load dashboard');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  const totalRemaining = useMemo(() => balance.reduce((sum, b) => sum + (b.remaining_days || 0), 0), [balance]);
  const totalUsed = useMemo(() => balance.reduce((sum, b) => sum + (b.used_days || 0), 0), [balance]);

  const recentDecisions = useMemo(() =>
    myRequests.filter(r => ['approved', 'rejected', 'cancelled', 'canceled'].includes(String(r.status).toLowerCase())).slice(0, 5),
    [myRequests]
  );

  const today = new Date();
  const greeting = today.getHours() < 12 ? 'Good morning' : today.getHours() < 17 ? 'Good afternoon' : 'Good evening';

  if (loading) {
    return <div className="loading">Loading dashboard...</div>;
  }

  return (
    <div className="dashboard-container leave-history-container supervisor-dash">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-content">
          <span className="dashboard-kicker">Supervisor Dashboard</span>
          <h1>{greeting}, <span className="user-name">{user.first_name || 'Supervisor'}</span></h1>
          <p className="header-subtitle">
            {user.department || 'County Government of Busia'} &mdash; {today.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Priority Alert — Pending Approvals */}
      {pendingApprovals.length > 0 && (
        <div className="sv-alert-banner">
          <div className="sv-alert-left">
            <span className="sv-alert-count">{pendingApprovals.length}</span>
            <div>
              <strong>Pending {pendingApprovals.length === 1 ? 'Request' : 'Requests'}</strong>
              <span>Leave {pendingApprovals.length === 1 ? 'application requires' : 'applications require'} your review</span>
            </div>
          </div>
          <Link className="btn btn-primary" to="/approval-queue">Review Now</Link>
        </div>
      )}

      {/* Stat Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-content">
            <h3>Awaiting Review</h3>
            <div className="number">{pendingApprovals.length}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-content">
            <h3>My Days Remaining</h3>
            <div className="number">{totalRemaining}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-content">
            <h3>My Days Used</h3>
            <div className="number">{totalUsed}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-content">
            <h3>Team Avg. Used</h3>
            <div className="number">{teamStats?.teamAverage?.toFixed ? teamStats.teamAverage.toFixed(1) : '—'}</div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="sv-main-grid">
        {/* Left Column — Pending Approvals */}
        <div className="sv-col-primary">
          <div className="card">
            <div className="card-header approver-card-header">
              <div>
                <h2 className="card-title">Approval Queue</h2>
                <p className="subtitle">Leave requests from your direct reports</p>
              </div>
              <Link className="btn btn-secondary btn-sm" to="/approval-queue">View All</Link>
            </div>
            <LeaveRequestsTable
              requests={pendingApprovals.slice(0, 8)}
              showEmployee
              showComments={false}
              emptyTitle="No pending requests"
              emptyMessage="All leave requests have been reviewed."
              actions={() => <Link className="btn btn-primary btn-sm" to="/approval-queue">Review</Link>}
            />
          </div>

          {/* Decision History */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Recent Decisions</h2>
            </div>
            <LeaveRequestsTable
              requests={recentDecisions}
              showComments
              emptyTitle="No decisions yet"
              emptyMessage="Your reviewed requests will appear here."
            />
          </div>
        </div>

        {/* Right Column — My Leave */}
        <div className="sv-col-secondary">
          <div className="card">
            <div className="card-header approver-card-header">
              <h2 className="card-title">My Leave Balance</h2>
              <Link className="btn btn-primary btn-sm" to="/apply-leave">Apply</Link>
            </div>
            <div className="sv-balance-list">
              {balance.map(item => {
                const total = (item.used_days || 0) + (item.remaining_days || 0);
                const usedPct = total > 0 ? ((item.used_days || 0) / total) * 100 : 0;
                return (
                  <div key={item.id} className="sv-balance-item">
                    <div className="sv-balance-header">
                      <span className="sv-balance-type">{item.leave_type_name}</span>
                      <span className="sv-balance-days">
                        <strong>{item.remaining_days || 0}</strong> / {total}
                      </span>
                    </div>
                    <div className="sv-balance-bar-bg">
                      <div
                        className={`sv-balance-bar-fill ${usedPct > 80 ? 'bar-danger' : usedPct > 50 ? 'bar-warn' : 'bar-ok'}`}
                        style={{ width: `${usedPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {balance.length === 0 && <p className="sv-empty-note">No leave balance records.</p>}
            </div>
          </div>

          {/* My Recent Applications */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">My Recent Applications</h2>
            </div>
            <LeaveRequestsTable
              requests={myRequests.slice(0, 4)}
              showComments={false}
              emptyTitle="No requests"
              emptyMessage="You have not applied for any leave."
            />
          </div>
        </div>
      </div>



      <style>{`
        /* Supervisor Dashboard — Alert Banner */
        .supervisor-dash .sv-alert-banner {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #fffbeb;
          border: 1px solid #fcd34d;
          border-left: 4px solid #f59e0b;
          border-radius: 10px;
          padding: 14px 20px;
          margin-bottom: 20px;
          gap: 16px;
        }
        .sv-alert-left {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .sv-alert-count {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          background: #f59e0b;
          color: #fff;
          border-radius: 10px;
          font-size: 18px;
          font-weight: 800;
          flex-shrink: 0;
        }
        .sv-alert-left strong {
          display: block;
          font-size: 14px;
          color: #78350f;
        }
        .sv-alert-left span {
          font-size: 12px;
          color: #92400e;
        }

        /* Two-Column Layout */
        .sv-main-grid {
          display: grid;
          grid-template-columns: 1.6fr 1fr;
          gap: 18px;
          margin-bottom: 18px;
        }
        .sv-col-primary, .sv-col-secondary {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        /* Balance List */
        .sv-balance-list {
          padding: 4px 0;
        }
        .sv-balance-item {
          padding: 10px 16px;
          border-bottom: 1px solid #f3f4f6;
        }
        .sv-balance-item:last-child {
          border-bottom: none;
        }
        .sv-balance-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;
        }
        .sv-balance-type {
          font-size: 13px;
          font-weight: 600;
          color: #374151;
        }
        .sv-balance-days {
          font-size: 13px;
          color: #6b7280;
        }
        .sv-balance-days strong {
          color: #111827;
        }
        .sv-balance-bar-bg {
          height: 6px;
          background: #f3f4f6;
          border-radius: 3px;
          overflow: hidden;
        }
        .sv-balance-bar-fill {
          height: 100%;
          border-radius: 3px;
          transition: width 0.5s ease;
        }
        .bar-ok { background: #1B7340; }
        .bar-warn { background: #d97706; }
        .bar-danger { background: #C62828; }

        .sv-empty-note {
          padding: 16px;
          color: #6b7280;
          font-size: 13px;
          text-align: center;
        }

        .btn-sm {
          padding: 6px 14px !important;
          font-size: 12px !important;
          min-height: auto !important;
        }

        @media (max-width: 900px) {
          .sv-main-grid { grid-template-columns: 1fr; }
          .sv-alert-banner { flex-direction: column; align-items: flex-start; }
        }
      `}</style>
    </div>
  );
}

export default SupervisorDashboardPage;
