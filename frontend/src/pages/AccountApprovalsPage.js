import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { showToast } from '../components/Toast';

function AccountApprovalsPage() {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState('');

  const fetchPendingUsers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/users');
      if (res.data.success) {
        const pending = (res.data.data || []).filter(u =>
          String(u.registration_status || '').toUpperCase() === 'PENDING_APPROVAL'
        );
        setPendingUsers(pending);
      }
    } catch (err) {
      setError('Failed to load pending registrations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPendingUsers(); }, [fetchPendingUsers]);

  const handleAction = async (userId, status) => {
    try {
      setActionLoading(userId);
      await api.put(`/admin/users/${userId}/registration`, { status });
      showToast(`Registration ${status.toLowerCase()} successfully`, 'success');
      await fetchPendingUsers();
    } catch (err) {
      showToast(err.response?.data?.message || `Error ${status.toLowerCase()}ing registration`, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="admin-approvals-page">
      <div className="page-header">
        <h2>Account Approvals</h2>
        <p className="subtitle">Review and approve new employee registration requests</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="approvals-stats">
        <div className="stat-badge">
          <span className="stat-badge-count">{pendingUsers.length}</span>
          <span className="stat-badge-label">Pending Requests</span>
        </div>
      </div>

      {loading ? (
        <div className="empty-state"><p>Loading pending registrations...</p></div>
      ) : pendingUsers.length === 0 ? (
        <div className="empty-state">
          <h3>No Pending Requests</h3>
          <p>All registration requests have been reviewed.</p>
        </div>
      ) : (
        <div className="approvals-list">
          {pendingUsers.map(user => (
            <div key={user.id} className="approval-card">
              <div className="approval-card-header">
                <div className="approval-user-info">
                  <div className="approval-avatar">
                    {(user.first_name || '?')[0]}{(user.last_name || '?')[0]}
                  </div>
                  <div>
                    <h4>{user.first_name} {user.middle_name ? `${user.middle_name} ` : ''}{user.last_name}</h4>
                    <span className="approval-badge">Pending Approval</span>
                  </div>
                </div>
                <span className="approval-date">
                  {user.created_at ? new Date(user.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                </span>
              </div>
              <div className="approval-card-body">
                <div className="approval-detail-grid">
                  <div><span className="detail-label">Employee ID</span><span className="detail-value">{user.employee_id}</span></div>
                  <div><span className="detail-label">National ID</span><span className="detail-value">{user.username}</span></div>
                  <div><span className="detail-label">Email</span><span className="detail-value">{user.email}</span></div>
                  <div><span className="detail-label">Department</span><span className="detail-value">{user.department || '—'}</span></div>
                  <div><span className="detail-label">Gender</span><span className="detail-value" style={{ textTransform: 'capitalize' }}>{user.gender || '—'}</span></div>
                  <div><span className="detail-label">Phone</span><span className="detail-value">{user.phone || '—'}</span></div>
                </div>
              </div>
              <div className="approval-card-actions">
                <button
                  className="btn btn-primary"
                  onClick={() => handleAction(user.id, 'approved')}
                  disabled={actionLoading === user.id}
                >
                  {actionLoading === user.id ? 'Processing...' : 'Approve'}
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => handleAction(user.id, 'rejected')}
                  disabled={actionLoading === user.id}
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .admin-approvals-page .subtitle {
          margin: 4px 0 0;
          color: var(--dark-gray);
          font-size: 14px;
        }

        .approvals-stats {
          margin-bottom: 20px;
        }

        .stat-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: linear-gradient(135deg, #fef3c7, #fde68a);
          border: 1px solid #f59e0b;
          border-radius: 10px;
          padding: 10px 18px;
        }

        .stat-badge-count {
          font-size: 24px;
          font-weight: 800;
          color: #92400e;
        }

        .stat-badge-label {
          font-size: 13px;
          font-weight: 600;
          color: #78350f;
        }

        .approvals-list {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .approval-card {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 1px 4px rgba(0,0,0,0.04);
          transition: box-shadow 0.2s;
        }

        .approval-card:hover {
          box-shadow: 0 4px 16px rgba(0,0,0,0.08);
        }

        .approval-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          background: #f8fafc;
          border-bottom: 1px solid #e5e7eb;
        }

        .approval-user-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .approval-avatar {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: linear-gradient(135deg, #1E5494, #2D6BB0);
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 15px;
          text-transform: uppercase;
        }

        .approval-user-info h4 {
          margin: 0;
          font-size: 15px;
          font-weight: 700;
          color: #111827;
        }

        .approval-badge {
          display: inline-block;
          font-size: 11px;
          font-weight: 600;
          padding: 2px 10px;
          border-radius: 20px;
          background: #fef3c7;
          color: #92400e;
          border: 1px solid #fcd34d;
          margin-top: 2px;
        }

        .approval-date {
          font-size: 12px;
          color: #6b7280;
          font-weight: 500;
        }

        .approval-card-body {
          padding: 16px 20px;
        }

        .approval-detail-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 12px;
        }

        .approval-detail-grid > div {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .detail-label {
          font-size: 11px;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .detail-value {
          font-size: 14px;
          color: #111827;
          font-weight: 500;
        }

        .approval-card-actions {
          display: flex;
          gap: 10px;
          padding: 14px 20px;
          border-top: 1px solid #e5e7eb;
          background: #fafbfc;
        }

        .approval-card-actions .btn {
          min-width: 120px;
        }
      `}</style>
    </div>
  );
}

export default AccountApprovalsPage;
