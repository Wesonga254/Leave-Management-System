import React, { useState, useEffect } from 'react';
import { leaveService } from '../services/api';
import AttachmentManager from './AttachmentManager';
import './ApplicationDetailModal.css';

/**
 * Read-only modal for viewing leave application details.
 * Used by Director and HR dashboards — shows all details but no action buttons.
 *
 * Props:
 *  - applicationId: number — the leave application ID to display
 *  - onClose: function — called when modal is dismissed
 *  - visible: boolean — controls visibility
 */
function ApplicationDetailModal({ applicationId, onClose, visible }) {
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible && applicationId) {
      fetchDetails();
    } else {
      setApplication(null);
      setError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, applicationId]);

  const fetchDetails = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await leaveService.getApplicationById(applicationId);
      if (response.data.success) {
        setApplication(response.data.data);
      } else {
        setError(response.data.message || 'Could not load application details');
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Error loading application details');
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  const formatDate = (value) => {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const statusClass = (status) => {
    const s = String(status || '').toLowerCase();
    if (s === 'approved') return 'approved';
    if (s === 'rejected') return 'rejected';
    if (s === 'cancelled' || s === 'canceled') return 'cancelled';
    return 'pending';
  };

  const dotSymbol = (status) => {
    const s = String(status || '').toLowerCase();
    if (s === 'approved') return '✓';
    if (s === 'rejected') return '✗';
    if (s === 'not_required') return '—';
    return '•';
  };

  const employeeName = application
    ? [application.first_name, application.middle_name, application.last_name].filter(Boolean).join(' ')
    : '';

  return (
    <div className="adm-overlay" onClick={onClose}>
      <div className="adm-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="adm-header">
          <div className="adm-header-left">
            <h2>Application Details</h2>
            <span className="adm-badge-readonly">View Only</span>
          </div>
          <button className="adm-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        {/* Body */}
        <div className="adm-body">
          {loading && (
            <div className="adm-loading">
              <div className="adm-spinner" />
              <p>Loading application details…</p>
            </div>
          )}

          {error && !loading && (
            <div className="adm-error">
              <p>{error}</p>
              <button className="btn btn-secondary" onClick={onClose}>Close</button>
            </div>
          )}

          {!loading && !error && application && (
            <>
              {/* Status */}
              <div style={{ marginBottom: 20 }}>
                <span className={`adm-status ${statusClass(application.status)}`}>
                  {application.status || 'Pending'}
                </span>
              </div>

              {/* Detail Grid */}
              <div className="adm-detail-grid">
                <div className="adm-detail-item">
                  <span className="adm-detail-label">Employee</span>
                  <span className="adm-detail-value">{employeeName || 'N/A'}</span>
                </div>
                <div className="adm-detail-item">
                  <span className="adm-detail-label">Employee ID</span>
                  <span className="adm-detail-value">{application.employee_id || 'N/A'}</span>
                </div>
                <div className="adm-detail-item">
                  <span className="adm-detail-label">Department</span>
                  <span className="adm-detail-value">{application.department || 'N/A'}</span>
                </div>
                <div className="adm-detail-item">
                  <span className="adm-detail-label">Designation</span>
                  <span className="adm-detail-value">{application.designation || 'N/A'}</span>
                </div>
                <div className="adm-detail-item">
                  <span className="adm-detail-label">Leave Type</span>
                  <span className="adm-detail-value">{application.leave_type_name || 'N/A'}</span>
                </div>
                <div className="adm-detail-item">
                  <span className="adm-detail-label">Duration</span>
                  <span className="adm-detail-value">{application.number_of_days || 0} day(s)</span>
                </div>
                <div className="adm-detail-item">
                  <span className="adm-detail-label">Start Date</span>
                  <span className="adm-detail-value">{formatDate(application.start_date)}</span>
                </div>
                <div className="adm-detail-item">
                  <span className="adm-detail-label">End Date</span>
                  <span className="adm-detail-value">{formatDate(application.end_date)}</span>
                </div>
                <div className="adm-detail-item">
                  <span className="adm-detail-label">Submitted On</span>
                  <span className="adm-detail-value">{formatDate(application.created_at)}</span>
                </div>
                {application.approved_days && (
                  <div className="adm-detail-item">
                    <span className="adm-detail-label">Approved Days</span>
                    <span className="adm-detail-value">{application.approved_days}</span>
                  </div>
                )}
                <div className="adm-detail-item full-width">
                  <span className="adm-detail-label">Reason</span>
                  <span className="adm-detail-value reason-text">
                    {application.reason || 'No reason provided'}
                  </span>
                </div>
              </div>

              {/* Approval Workflow */}
              <div className="adm-section-divider">Approval Workflow</div>
              {(application.workflow || []).length === 0 ? (
                <p className="adm-workflow-empty">No approval workflow recorded.</p>
              ) : (
                <div className="adm-workflow-timeline">
                  {application.workflow.map((step, idx) => (
                    <div className="adm-workflow-step" key={step.id || idx}>
                      <div className={`adm-workflow-dot ${statusClass(step.status)}`}>
                        {dotSymbol(step.status)}
                      </div>
                      <div className="adm-workflow-info">
                        <strong>{(step.approval_level || '').replace(/_/g, ' ')}</strong>
                        <span>
                          {step.approver_name || 'Unknown'} — {' '}
                          <span className={`adm-status ${statusClass(step.status)}`} style={{ fontSize: 11, padding: '2px 8px' }}>
                            {step.status || 'pending'}
                          </span>
                          {step.approved_at && ` on ${formatDate(step.approved_at)}`}
                        </span>
                        {step.delegated_to_name && (
                          <span style={{ display: 'block', fontSize: 12, color: '#64748b', marginTop: 2 }}>
                            Delegated to: {step.delegated_to_name}
                          </span>
                        )}
                        {step.comments && (
                          <span className="adm-workflow-comments">{step.comments}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Attachments */}
              <div className="adm-section-divider">Supporting Documents</div>
              <div className="adm-attachments-section">
                <AttachmentManager applicationId={applicationId} isReadOnly={true} />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="adm-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default ApplicationDetailModal;
