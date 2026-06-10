import React, { useState, useEffect } from 'react';
import { leaveService } from '../services/api';
import AttachmentManager from '../components/AttachmentManager';

function ApprovalWorkflowPage() {
  const [applications, setApplications] = useState([]);
  const [filterStatus, setFilterStatus] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedApp, setSelectedApp] = useState(null);
  const [approvingApp, setApprovingApp] = useState(null);
  const [approvalComments, setApprovalComments] = useState('');
  const userRole = localStorage.getItem('userRole');

  useEffect(() => {
    fetchApplications();
  }, [filterStatus]);

  const fetchApplications = async () => {
    try {
      const params = { status: filterStatus };
      const response = await leaveService.getApplications(params);
      setApplications(response.data.data);
    } catch (err) {
      setError('Error loading applications');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!approvingApp) return;

    try {
      await leaveService.updateApplicationStatus(approvingApp.id, {
        approval_level: 'supervisor',
        status: 'approved',
        comments: approvalComments
      });

      setApprovalComments('');
      setApprovingApp(null);
      fetchApplications();
    } catch (err) {
      setError('Error approving application');
    }
  };

  const handleReject = async () => {
    if (!approvingApp) return;

    try {
      await leaveService.updateApplicationStatus(approvingApp.id, {
        approval_level: 'supervisor',
        status: 'rejected',
        comments: approvalComments
      });

      setApprovalComments('');
      setApprovingApp(null);
      fetchApplications();
    } catch (err) {
      setError('Error rejecting application');
    }
  };

  const getStatusBadge = (status) => {
    const badgeClass = `badge badge-${status}`;
    return <span className={badgeClass}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>;
  };

  return (
    <div>
      <div className="card">
        <h2 className="card-title">Leave Approval Workflow</h2>

        {error && <div className="alert alert-error">{error}</div>}

        <div className="form-group">
          <label htmlFor="filter">Filter by Status:</label>
          <select
            id="filter"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {loading ? (
          <div className="loading">Loading...</div>
        ) : applications.length === 0 ? (
          <div className="empty-state">No applications to display</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Leave Type</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Days</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {applications.map(app => (
                <tr key={app.id}>
                  <td>{app.first_name} {app.last_name}</td>
                  <td>{app.leave_type}</td>
                  <td>{new Date(app.start_date).toLocaleDateString()}</td>
                  <td>{new Date(app.end_date).toLocaleDateString()}</td>
                  <td>{app.number_of_days}</td>
                  <td>{getStatusBadge(app.status)}</td>
                  <td>
                    {app.status === 'pending' && (
                      <button
                        className="btn btn-primary"
                        onClick={() => {
                          setSelectedApp(app);
                          setApprovingApp(app);
                        }}
                      >
                        Review
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Approval Modal */}
      {approvingApp && (
        <div className="modal open">
          <div className="modal-content">
            <div className="modal-header">
              Review Leave Application
              <span
                className="modal-close"
                onClick={() => {
                  setApprovingApp(null);
                  setApprovalComments('');
                }}
              >
                &times;
              </span>
            </div>

            <div className="form-group">
              <label>Employee</label>
              <p>{approvingApp.first_name} {approvingApp.last_name}</p>
            </div>

            <div className="form-group">
              <label>Leave Type</label>
              <p>{approvingApp.leave_type}</p>
            </div>

            <div className="form-group">
              <label>Duration</label>
              <p>
                {new Date(approvingApp.start_date).toLocaleDateString()} to{' '}
                {new Date(approvingApp.end_date).toLocaleDateString()} ({approvingApp.number_of_days} days)
              </p>
            </div>

            <div className="form-group">
              <label>Reason</label>
              <p>{approvingApp.reason || 'N/A'}</p>
            </div>

            <AttachmentManager applicationId={approvingApp.id} isReadOnly={true} />

            <div className="form-group">
              <label htmlFor="comments">Comments</label>
              <textarea
                id="comments"
                value={approvalComments}
                onChange={(e) => setApprovalComments(e.target.value)}
                placeholder="Add your comments or notes"
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-success"
                onClick={handleApprove}
              >
                Approve
              </button>
              <button
                className="btn btn-danger"
                onClick={handleReject}
              >
                Reject
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setApprovingApp(null);
                  setApprovalComments('');
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ApprovalWorkflowPage;
