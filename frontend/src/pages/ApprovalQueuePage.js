import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { reportService, leaveService } from '../services/api';
import AttachmentManager from '../components/AttachmentManager';
import { showToast } from '../components/Toast';
import { triggerNotificationRefresh } from '../components/NotificationCenter';
import '../pages/DashboardPage.css';
import '../pages/LeaveHistoryPage.css';

function ApprovalQueuePage({ userRole, userId }) {
  const navigate = useNavigate();
  const [filteredApplications, setFilteredApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedApp, setSelectedApp] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [action, setAction] = useState('approve');
  const [comments, setComments] = useState('');
  const [approvedDays, setApprovedDays] = useState('');
  const [processing, setProcessing] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const errorRef = useRef(null);
  const errorTimerRef = useRef(null);

  // Auto-clear error messages after a delay
  const setAutoError = (msg) => {
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    setError(msg);
    errorTimerRef.current = setTimeout(() => setError(''), 5000);
  };

  // Only supervisors approve leave requests
  useEffect(() => {
    if (userRole !== 'supervisor' && userRole !== 'admin') {
      navigate('/dashboard');
    }
  }, [userRole, navigate]);

  useEffect(() => {
    fetchPendingApplications();
  }, [userRole]);

  const fetchPendingApplications = async () => {
    try {
      setLoading(true);
      let response;
      if (userRole === 'admin') {
        response = await reportService.getPendingApprovals();
      } else {
        response = await reportService.getMyApprovals();
      }

      if (response.data.success) {
        const data = response.data.data || [];
        const filtered = userRole === 'admin' ? filterByUserRole(data) : data;
        setFilteredApplications(filtered);
      }
    } catch (err) {
      setError('Error loading pending applications');
    } finally {
      setLoading(false);
    }
  };

  const filterByUserRole = (apps) => {
    return apps.filter(app => {
      const stage = getApprovalStage(userRole);
      const isPending = (app.approval_status === 'pending') || (app.status === 'pending');
      if (stage === 'all') return isPending;
      return app.approval_level === stage && isPending;
    });
  };

  const getApprovalStage = (role) => {
    const stageMap = {
      supervisor: 'supervisor',
      hr: 'hr',
    };
    return stageMap[role] || 'supervisor';
  };

  const formatDate = (value) => {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString();
  };

  const getEmployeeName = (app) => (
    app?.employee_name || `${app?.first_name || ''} ${app?.last_name || ''}`.trim() || 'N/A'
  );

  const getRequestedDays = (app) => Number(app?.requested_days || app?.number_of_days || 0);

  const getApprovedDays = () => {
    const requestedDays = getRequestedDays(selectedApp);
    const parsedDays = Number(approvedDays);
    if (!Number.isFinite(parsedDays) || parsedDays < 1) return requestedDays;
    return Math.min(parsedDays, requestedDays);
  };

  const closeDecisionModal = () => {
    setShowModal(false);
    setShowConfirmModal(false);
    setComments('');
    setApprovedDays('');
    setSelectedApp(null);
    setError('');
  };

  const handleReviewClick = (app) => {
    setError('');
    setSelectedApp(app);
    setAction('approve');
    setComments('');
    setApprovedDays(String(app.approved_days || app.requested_days || app.number_of_days || ''));
    setShowConfirmModal(false);
    setShowModal(true);
    setDetailsLoading(true);

    leaveService.getApplicationById(app.id)
      .then((response) => {
        if (response.data.success) {
          setSelectedApp(prev => ({
            ...prev,
            ...response.data.data,
            id: app.id,
            approval_level: app.approval_level,
            workflow_id: app.workflow_id
          }));
        }
      })
      .catch((err) => {
        console.error('Could not load full details:', err?.response?.data?.message || err.message);
      })
      .finally(() => {
        setDetailsLoading(false);
      });
  };

  const openConfirmation = (selectedAction) => {
    if (!selectedApp) return;
    setAction(selectedAction);

    if (selectedAction === 'approve') {
      const requestedDays = getRequestedDays(selectedApp);
      const adjustedDays = Number(approvedDays);
      if (!Number.isFinite(adjustedDays) || adjustedDays < 1 || adjustedDays > requestedDays) {
        setAutoError(`Approved days must be between 1 and ${requestedDays}.`);
        setTimeout(() => errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
        return;
      }
      if (adjustedDays < requestedDays && !comments.trim()) {
        setAutoError('A comment is required when adjusting days downward.');
        setTimeout(() => errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
        return;
      }
    }
    if (selectedAction === 'reject' && !comments.trim()) {
      setAutoError('Please provide a reason for rejecting this leave request.');
      setTimeout(() => errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
      return;
    }
    setError('');
    setShowConfirmModal(true);
  };

  const submitDecision = async () => {
    if (!selectedApp) return;

    try {
      setProcessing(true);
      setError('');
      await leaveService.approveApplication(selectedApp.id, {
        status: action === 'approve' ? 'approved' : 'rejected',
        comments: comments.trim(),
        ...(action === 'approve' && { approved_days: getApprovedDays() })
      });

      showToast(
        action === 'approve'
          ? `Leave approved for ${getEmployeeName(selectedApp)} (${getApprovedDays()} days)`
          : `Leave rejected for ${getEmployeeName(selectedApp)}`,
        'success'
      );
      // Immediately refresh notification bell
      triggerNotificationRefresh();
      closeDecisionModal();
      await fetchPendingApplications();
    } catch (err) {
      const msg = err?.response?.data?.message || 'Error updating application status';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setProcessing(false);
    }
  };

  const getRoleName = () => {
    const roleNames = {
      supervisor: 'Supervisor',
      hr: 'HR Manager',
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

        {error && !showModal && <div className="alert alert-error">{error}</div>}

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
                        type="button"
                        className="btn-icon-small btn-review"
                        title="Review Application"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleReviewClick(app);
                        }}
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Review Modal */}
      {showModal && selectedApp && (
        <div className="aq-modal-overlay" onClick={closeDecisionModal}>
          <div className="aq-modal" onClick={(e) => e.stopPropagation()}>
            <div className="aq-modal-header">
              <h2>Review Leave Application</h2>
              <button className="aq-modal-close" onClick={closeDecisionModal}>&times;</button>
            </div>

            <div className="aq-modal-body">
              {detailsLoading && <div className="loading">Loading request details...</div>}
              <div className="approval-balance-panel">
                <span>Current {selectedApp.leave_type_name || selectedApp.leave_type || 'leave'} balance</span>
                <strong>{selectedApp.balance_remaining_days ?? 'N/A'} days</strong>
                <small>Used {selectedApp.balance_used_days ?? 'N/A'} of {selectedApp.balance_total_days ?? 'N/A'} days</small>
              </div>
              <div className="app-summary">
                <p><strong>Employee:</strong> {getEmployeeName(selectedApp)}</p>
                <p><strong>Employee ID:</strong> {selectedApp.employee_id || 'N/A'}</p>
                <p><strong>Department:</strong> {selectedApp.department || 'N/A'}</p>
                <p><strong>Designation:</strong> {selectedApp.designation || 'N/A'}</p>
                <p><strong>Leave Type:</strong> {selectedApp.leave_type_name || selectedApp.leave_type || 'N/A'}</p>
                <p><strong>Dates:</strong> {formatDate(selectedApp.start_date)} - {formatDate(selectedApp.end_date)}</p>
                <p><strong>Requested Days:</strong> {getRequestedDays(selectedApp)}</p>
                <p><strong>Reason:</strong> {selectedApp.reason}</p>
              </div>

              <AttachmentManager applicationId={selectedApp.id} isReadOnly={true} />

              <div className="form-group">
                <label htmlFor="approved-days">Approved Days <small style={{color:'#64748b',fontWeight:400}}>(adjust downward if needed — max {getRequestedDays(selectedApp)})</small></label>
                <input
                  id="approved-days"
                  type="number"
                  min="1"
                  max={getRequestedDays(selectedApp)}
                  value={approvedDays}
                  onChange={(e) => setApprovedDays(e.target.value)}
                  className="form-control"
                />
              </div>

              <div className="form-group">
                <label htmlFor="comments">
                  Supervisor Comments{' '}
                  {Number(approvedDays) < getRequestedDays(selectedApp) && (
                    <span style={{color:'#dc2626'}}>*required when adjusting days</span>
                  )}
                </label>
                <textarea
                  id="comments"
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="Add your comments (required if adjusting days or rejecting)..."
                  className="form-control"
                  rows="3"
                />
              </div>
            </div>

            {error && <div ref={errorRef} className="alert alert-error" style={{margin:'0 20px 12px'}}>{error}</div>}

            <div className="aq-modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={closeDecisionModal}
                disabled={processing}
              >
                Cancel
              </button>
              <div style={{display:'flex',gap:10}}>
                <button
                  type="button"
                  className="btn btn-danger aq-btn-reject"
                  onClick={() => openConfirmation('reject')}
                  disabled={processing || detailsLoading}
                >
                  Reject
                </button>
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={() => openConfirmation('approve')}
                  disabled={processing || detailsLoading}
                >
                  Approve
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && selectedApp && (
        <div className="aq-modal-overlay" onClick={() => setShowConfirmModal(false)}>
          <div className="aq-modal confirmation-modal" onClick={(e) => e.stopPropagation()}>
            <div className="aq-modal-header">
              <h2>Confirm {action === 'approve' ? 'Approval' : 'Rejection'}</h2>
              <button className="aq-modal-close" onClick={() => setShowConfirmModal(false)}>&times;</button>
            </div>
            <div className="aq-modal-body">
              <div className="confirmation-summary">
                <p><strong>Employee:</strong> {getEmployeeName(selectedApp)}</p>
                <p><strong>Leave Type:</strong> {selectedApp.leave_type_name || selectedApp.leave_type || 'N/A'}</p>
                <p><strong>Requested Days:</strong> {getRequestedDays(selectedApp)}</p>
                <p><strong>Approved Days:</strong> {action === 'approve' ? getApprovedDays() : 'N/A'}</p>
                <p><strong>Dates:</strong> {formatDate(selectedApp.start_date)} - {formatDate(selectedApp.end_date)}</p>
                <p><strong>Comments:</strong> {comments.trim() || 'No comments provided'}</p>
              </div>
            </div>
            <div className="aq-modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowConfirmModal(false)} disabled={processing}>
                Back
              </button>
              <button
                type="button"
                className={`btn ${action === 'approve' ? 'btn-success' : 'btn-danger'}`}
                onClick={submitDecision}
                disabled={processing}
              >
                {processing ? 'Saving...' : `Confirm ${action === 'approve' ? 'Approval' : 'Rejection'}`}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .aq-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.55);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
        }

        .aq-modal {
          background: white;
          border-radius: 12px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.25);
          max-width: 640px;
          width: 90%;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
        }

        .aq-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
          border-bottom: 1px solid #e0e0e0;
          flex-shrink: 0;
        }

        .aq-modal-header h2 {
          margin: 0;
          font-size: 18px;
        }

        .aq-modal-close {
          background: none;
          border: none;
          font-size: 26px;
          cursor: pointer;
          color: #666;
          line-height: 1;
          padding: 0 4px;
        }

        .aq-modal-close:hover {
          color: #333;
        }

        .aq-modal-body {
          padding: 20px;
          overflow-y: auto;
          flex: 1;
        }

        .aq-modal-footer {
          display: flex;
          gap: 10px;
          justify-content: space-between;
          padding: 16px 20px;
          border-top: 1px solid #e0e0e0;
          flex-shrink: 0;
        }

        .approval-balance-panel {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 4px 16px;
          align-items: center;
          padding: 16px;
          margin-bottom: 16px;
          border: 1px solid #bdd7c8;
          border-left: 5px solid #2f855a;
          border-radius: 8px;
          background: #f2fbf6;
        }

        .approval-balance-panel span,
        .approval-balance-panel small {
          color: #2f4f3b;
          font-weight: 700;
        }

        .approval-balance-panel strong {
          grid-row: span 2;
          color: #1f6f46;
          font-size: 28px;
          line-height: 1;
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

        .confirmation-summary {
          display: grid;
          gap: 10px;
          padding: 16px;
          border: 1px solid #d7dee8;
          border-radius: 8px;
          background: #f8fafc;
        }

        .confirmation-summary p {
          margin: 0;
        }

        .form-control {
          width: 100%;
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 8px;
          font-family: inherit;
          resize: vertical;
          box-sizing: border-box;
        }

        .btn-review {
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%) !important;
          color: white !important;
          border: none !important;
          padding: 8px 16px !important;
          border-radius: 8px !important;
          font-weight: 700 !important;
          font-size: 13px !important;
          cursor: pointer !important;
          transition: transform 0.2s, box-shadow 0.2s;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }

        .btn-review:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35);
        }

        .btn-success {
          background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);
          color: white;
          border: none;
        }

        .btn-success:hover {
          box-shadow: 0 4px 12px rgba(22, 163, 74, 0.35);
        }

        .aq-btn-reject {
          background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%) !important;
          color: white !important;
          border: none !important;
          cursor: pointer !important;
          font-weight: 700;
          position: relative;
          z-index: 1;
        }

        .aq-btn-reject:hover:not(:disabled) {
          background: linear-gradient(135deg, #b91c1c 0%, #991b1b 100%) !important;
          box-shadow: 0 4px 12px rgba(220, 38, 38, 0.4);
          transform: translateY(-1px);
        }

        .aq-btn-reject:disabled {
          opacity: 0.5;
          cursor: not-allowed !important;
        }
      `}</style>
    </div>
  );
}

export default ApprovalQueuePage;
