import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { reportService, leaveService, workflowService } from '../services/api';
import AttachmentManager from '../components/AttachmentManager';
import '../pages/DashboardPage.css';
import '../pages/LeaveHistoryPage.css';

function ApprovalQueuePage({ userRole, userId }) {
  const navigate = useNavigate();
  const [filteredApplications, setFilteredApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedApp, setSelectedApp] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [action, setAction] = useState('approve');
  const [comments, setComments] = useState('');
  const [processing, setProcessing] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [delegates, setDelegates] = useState([]);
  const [delegateTo, setDelegateTo] = useState('');
  const [showDelegateModal, setShowDelegateModal] = useState(false);

  // Only supervisors approve leave requests
  useEffect(() => {
    if (userRole !== 'supervisor' && userRole !== 'admin') {
      navigate('/dashboard');
    }
  }, [userRole, navigate]);

  useEffect(() => {
    fetchPendingApplications();
    fetchDelegates();
  }, [userRole]);

  const fetchPendingApplications = async () => {
    try {
      setLoading(true);
      let response;
      // Admins fetch all pending approvals, other approvers fetch only their assigned approvals
      if (userRole === 'admin') {
        response = await reportService.getPendingApprovals();
      } else {
        response = await reportService.getMyApprovals();
      }

      if (response.data.success) {
        const data = response.data.data || [];
        // If admin, allow additional filtering by role stage
        const filtered = userRole === 'admin' ? filterByUserRole(data) : data;
        setFilteredApplications(filtered);
      }
    } catch (err) {
      setError('Error loading pending applications');
    } finally {
      setLoading(false);
    }
  };

  const fetchDelegates = async () => {
    try {
      const res = await reportService.getDelegates();
      if (res.data.success) setDelegates(res.data.data || []);
    } catch (err) {
      // ignore - optional
    }
  };

  const filterByUserRole = (apps) => {
    // Filter applications based on user's approval stage
    return apps.filter(app => {
      const stage = getApprovalStage(userRole);
      // Admins see all pending approvals
      const isPending = (app.approval_status === 'pending') || (app.status === 'pending');
      if (stage === 'all') return isPending;
      // Check if the application approval workflow level matches and is still pending
      return app.approval_level === stage && isPending;
    });
  };

  const getApprovalStage = (role) => {
    const stageMap = {
      supervisor: 'supervisor',
      hr: 'hr',
      chief_officer: 'chief_officer',
    };
    return stageMap[role] || 'supervisor';
  };

  const formatDate = (value) => {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString();
  };

  const openActionModal = async (app, nextAction) => {
    setSelectedApp(app);
    setAction(nextAction);
    setComments('');
    setShowModal(true);
    setDetailsLoading(true);

    try {
      const response = await leaveService.getApplicationById(app.id);
      if (response.data.success) {
        setSelectedApp(prev => ({
          ...prev,
          ...response.data.data,
          id: app.id,
          approval_level: app.approval_level,
          workflow_id: app.workflow_id
        }));
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Error opening application details');
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedApp) return;
    
    try {
      setProcessing(true);
      const level = selectedApp.approval_level || getApprovalStage(userRole);
      await leaveService.updateApplicationStatus(selectedApp.id, {
        status: 'approved',
        approval_level: level,
        comments: comments
      });
      
      setShowModal(false);
      setComments('');
      setSelectedApp(null);
      await fetchPendingApplications();
    } catch (err) {
      setError(err?.response?.data?.message || 'Error updating application status');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedApp) return;
    
    try {
      setProcessing(true);
      const level = selectedApp.approval_level || getApprovalStage(userRole);
      await leaveService.updateApplicationStatus(selectedApp.id, {
        status: 'rejected',
        approval_level: level,
        comments: comments
      });
      
      setShowModal(false);
      setComments('');
      setSelectedApp(null);
      await fetchPendingApplications();
    } catch (err) {
      setError(err?.response?.data?.message || 'Error updating application status');
    } finally {
      setProcessing(false);
    }
  };

  const getRoleName = () => {
    const roleNames = {
      supervisor: 'Supervisor',
      hr: 'HR Manager',
      chief_officer: 'Chief Officer',
      manager: 'Manager',
      director: 'Director',
      admin: 'Administrator'
    };
    return roleNames[userRole] || 'Approver';
  };

  if (loading) {
    return <div className="loading">Loading approval queue...</div>;
  }

  return (
    <div className="leave-history-container approver-dashboard">
      <div className="approver-hero">
        <div>
          <span className="dashboard-kicker">{getRoleName()}</span>
          <h1>Review Center</h1>
          <p className="header-subtitle">Review and approve leave requests from your team. HR is notified automatically after you approve.</p>
        </div>
        <div className="approver-hero-count">
          <span>Pending Review</span>
          <strong>{filteredApplications.length}</strong>
        </div>
      </div>

      <div className="card approval-card-shell">
        <div className="card-header approver-card-header">
          <div>
            <h2 className="card-title">Pending Applications</h2>
            <p className="subtitle">Leave requests awaiting your supervisor approval</p>
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {/* Queue Table */}
        {filteredApplications.length === 0 ? (
          <div className="empty-state">
            <h3>No pending applications</h3>
            <p>All applications have been reviewed.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Leave Type</th>
                  <th>Dates</th>
                  <th>Days</th>
                  <th>Reason</th>
                  <th>Submitted</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredApplications.map(app => (
                  <tr key={app.id}>
                      <td data-label="Employee">
                        <strong>{app.employee_name || (app.first_name ? `${app.first_name} ${app.last_name}` : 'N/A')}</strong>
                        <small>{app.employee_id}</small>
                        {app.delegated_to ? (
                          <div style={{ marginTop: 6 }}><small className="badge badge-warning">Delegated to {app.delegated_first_name} {app.delegated_last_name}</small></div>
                        ) : null}
                      </td>
                    <td data-label="Leave Type">{app.leave_type_name || app.leave_type || 'N/A'}</td>
                    <td data-label="Dates">
                      <small>
                        {formatDate(app.start_date)} - {formatDate(app.end_date)}
                      </small>
                    </td>
                    <td data-label="Days"><strong>{app.number_of_days}</strong></td>
                    <td data-label="Reason">{app.reason?.substring(0, 40) || '-'}</td>
                    <td data-label="Submitted">
                      <small>{formatDate(app.submitted_at || app.submitted_date || app.created_at)}</small>
                    </td>
                    <td className="actions-cell" data-label="Actions">
                      <button
                        className="btn-icon-small btn-approve"
                        title="Approve"
                        onClick={() => {
                          setSelectedApp(app);
                          openActionModal(app, 'approve');
                        }}
                      >
                        Approve
                      </button>
                      <button
                        className="btn-icon-small btn-delegate"
                        title="Delegate"
                        onClick={() => {
                          setSelectedApp(app);
                          setShowDelegateModal(true);
                        }}
                      >
                        Delegate
                      </button>
                      <button
                        className="btn-icon-small btn-reject"
                        title="Reject"
                        onClick={() => {
                          setSelectedApp(app);
                          openActionModal(app, 'reject');
                        }}
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Action Modal */}
      {showModal && selectedApp && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                {action === 'approve' ? 'Approve Leave' : 'Reject Leave'}
              </h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>x</button>
            </div>

            <div className="modal-body">
              {detailsLoading && <div className="loading">Loading request details...</div>}
              <div className="app-summary">
                <p><strong>Employee:</strong> {selectedApp.employee_name || `${selectedApp.first_name || ''} ${selectedApp.last_name || ''}`.trim() || 'N/A'}</p>
                <p><strong>Employee ID:</strong> {selectedApp.employee_id || 'N/A'}</p>
                <p><strong>Department:</strong> {selectedApp.department || 'N/A'}</p>
                <p><strong>Designation:</strong> {selectedApp.designation || 'N/A'}</p>
                <p><strong>Leave Type:</strong> {selectedApp.leave_type_name || selectedApp.leave_type || 'N/A'}</p>
                <p><strong>Dates:</strong> {formatDate(selectedApp.start_date)} - {formatDate(selectedApp.end_date)}</p>
                <p><strong>Days:</strong> {selectedApp.number_of_days}</p>
                <p><strong>Reason:</strong> {selectedApp.reason}</p>
              </div>

              <AttachmentManager applicationId={selectedApp.id} isReadOnly={true} />

              <div className="form-group">
                <label htmlFor="comments">Comments (optional)</label>
                <textarea
                  id="comments"
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="Add your comments..."
                  className="form-control"
                  rows="4"
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowModal(false)}
                disabled={processing}
              >
                Cancel
              </button>
              {action === 'approve' ? (
                <button
                  className="btn btn-success"
                  onClick={handleApprove}
                  disabled={processing}
                >
                  {processing ? 'Approving...' : 'Approve'}
                </button>
              ) : (
                <button
                  className="btn btn-danger"
                  onClick={handleReject}
                  disabled={processing}
                >
                  {processing ? 'Rejecting...' : 'Reject'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delegate Modal */}
      {showDelegateModal && selectedApp && (
        <div className="modal-overlay" onClick={() => setShowDelegateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Delegate Approval</h2>
              <button className="modal-close" onClick={() => setShowDelegateModal(false)}>x</button>
            </div>
            <div className="modal-body">
              <p>Select a user to delegate this approval to:</p>
              <select value={delegateTo} onChange={(e) => setDelegateTo(e.target.value)} className="form-control">
                <option value="">Select delegate</option>
                {delegates.map(d => (
                  <option key={d.id} value={d.id}>{d.first_name} {d.last_name} - {d.role}</option>
                ))}
              </select>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowDelegateModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={async () => {
                if (!delegateTo) return;
                try {
                  setProcessing(true);
                  await workflowService.delegate({ applicationId: selectedApp.id, delegatedTo: delegateTo });
                  setShowDelegateModal(false);
                  setDelegateTo('');
                  setSelectedApp(null);
                  await fetchPendingApplications();
                } catch (err) {
                  setError('Error delegating approval');
                } finally {
                  setProcessing(false);
                }
              }}>{processing ? 'Delegating...' : 'Delegate'}</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal {
          background: white;
          border-radius: 12px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
          max-width: 500px;
          width: 90%;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
          border-bottom: 1px solid #e0e0e0;
        }

        .modal-header h2 {
          margin: 0;
          font-size: 18px;
        }

        .modal-close {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #666;
        }

        .modal-body {
          padding: 20px;
          max-height: 400px;
          overflow-y: auto;
        }

        .app-summary {
          background: #f5f5f5;
          padding: 15px;
          border-radius: 8px;
          margin-bottom: 20px;
          font-size: 14px;
        }

        .app-summary p {
          margin: 8px 0;
        }

        .form-control {
          width: 100%;
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 8px;
          font-family: inherit;
          resize: vertical;
        }

        .modal-footer {
          display: flex;
          gap: 10px;
          justify-content: flex-end;
          padding: 20px;
          border-top: 1px solid #e0e0e0;
        }
      `}</style>
    </div>
  );
}

export default ApprovalQueuePage;
