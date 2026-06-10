import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { leaveService, attachmentService } from '../services/api';
import './LeaveHistoryPage.css';

function LeaveHistoryPage() {
  const navigate = useNavigate();
  const [applications, setApplications] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({});
  const [expandedApplication, setExpandedApplication] = useState(null);
  const [editingApplication, setEditingApplication] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [attachments, setAttachments] = useState({});
  const [availableYears, setAvailableYears] = useState([]);
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    generateAvailableYears();
    fetchLeaveTypes();
    fetchApplications();
  }, []);

  useEffect(() => {
    fetchApplications();
  }, [filterStatus, filterYear]);

  const generateAvailableYears = () => {
    const years = [];
    for (let i = currentYear; i >= currentYear - 5; i--) {
      years.push(i);
    }
    setAvailableYears(years);
  };

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const params = {
        ...(filterStatus && { status: filterStatus })
      };
      const response = await leaveService.getApplications(params);
      const allApps = response.data.data || [];
      const filteredApps = filterYear
        ? allApps.filter(app => new Date(app.start_date).getFullYear() === Number(filterYear))
        : allApps;

      setApplications(filteredApps);
      calculateStats(filteredApps);
    } catch (err) {
      setError('Error loading leave history');
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

  const calculateStats = (apps) => {
    const stats = {
      total: apps.length,
      approved: apps.filter(a => a.status === 'approved').length,
      pending: apps.filter(a => a.status === 'pending').length,
      rejected: apps.filter(a => a.status === 'rejected').length,
      cancelled: apps.filter(a => a.status === 'cancelled').length,
      totalDays: apps.reduce((sum, a) => sum + a.number_of_days, 0)
    };
    setStats(stats);
  };

  const calculateWorkingDays = (startDate, endDate) => {
    let count = 0;
    const currentDate = new Date(startDate);
    const end = new Date(endDate);

    while (currentDate <= end) {
      const dayOfWeek = currentDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday or Saturday
        count++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return count;
  };

  const handleCancel = async (applicationId) => {
    if (window.confirm('Are you sure you want to cancel this leave application?')) {
      try {
        await leaveService.cancelApplication(applicationId);
        setApplications(applications.map(app => 
          app.id === applicationId 
            ? { ...app, status: 'cancelled' }
            : app
        ));
        alert('Application cancelled successfully');
      } catch (err) {
        alert('Error cancelling application: ' + err.message);
      }
    }
  };

  const handleReapply = async (applicationId) => {
    try {
      const response = await leaveService.getApplicationById(applicationId);
      const app = response.data.data;
      
      // Store in sessionStorage to pre-fill form
      sessionStorage.setItem('reapplyData', JSON.stringify({
        leave_type_id: app.leave_type_id,
        start_date: app.start_date,
        end_date: app.end_date,
        reason: app.reason
      }));
      
      navigate('/dashboard', { state: { scrollToForm: true } });
    } catch (err) {
      alert('Error preparing reapply: ' + err.message);
    }
  };

  const handleViewAttachments = async (applicationId) => {
    try {
      const response = await attachmentService.getAttachments(applicationId);
      setAttachments({
        ...attachments,
        [applicationId]: response.data.data
      });
    } catch (err) {
      alert('Error loading attachments: ' + err.message);
    }
  };

  const handleDownloadAttachment = async (attachmentId) => {
    try {
      const response = await attachmentService.downloadAttachment(attachmentId);
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.click();
    } catch (err) {
      alert('Error downloading attachment: ' + err.message);
    }
  };

  const handleDownloadApplication = async (applicationId) => {
    try {
      const response = await leaveService.downloadApplication(applicationId);
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `leave-application-${applicationId}.txt`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Error downloading application: ' + (err.response?.data?.message || err.message));
    }
  };

  const startEditing = (app) => {
    setExpandedApplication(app.id);
    setEditingApplication(app.id);
    setEditForm({
      leave_type_id: app.leave_type_id || '',
      start_date: app.start_date?.slice(0, 10) || '',
      end_date: app.end_date?.slice(0, 10) || '',
      reason: app.reason || ''
    });
  };

  const saveEdit = async (applicationId) => {
    try {
      await leaveService.editApplication(applicationId, editForm);
      setEditingApplication(null);
      setEditForm({});
      await fetchApplications();
      alert('Application updated successfully');
    } catch (err) {
      alert('Error updating application: ' + (err.response?.data?.message || err.message));
    }
  };

  const exportToCSV = () => {
    const headers = ['Leave Type', 'Start Date', 'End Date', 'Days', 'Working Days', 'Reason', 'Status', 'Submitted'];
    const rows = applications.map(app => [
      app.leave_type_name || app.leave_type || '',
      new Date(app.start_date).toLocaleDateString(),
      new Date(app.end_date).toLocaleDateString(),
      app.number_of_days,
      calculateWorkingDays(app.start_date, app.end_date),
      app.reason || '-',
      app.status.charAt(0).toUpperCase() + app.status.slice(1),
      new Date(app.created_at).toLocaleDateString()
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `leave-applications-${filterYear || 'all-years'}.csv`;
    link.click();
  };

  const getStatusBadge = (status) => {
    const badgeClass = `badge badge-${status}`;
    return <span className={badgeClass}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>;
  };

  return (
    <div className="leave-History-container">
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">My Application</h2>
        </div>

        {/* Statistics Cards */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-content">
              <h3>Total Applications</h3>
              <div className="number">{stats.total}</div>
            </div>
          </div>
          <div className="stat-card stat-card-approved">
            <div className="stat-content">
              <h3>Approved</h3>
              <div className="number">{stats.approved}</div>
            </div>
          </div>
          <div className="stat-card stat-card-pending">
            <div className="stat-content">
              <h3>Pending</h3>
              <div className="number">{stats.pending}</div>
            </div>
          </div>
          <div className="stat-card stat-card-rejected">
            <div className="stat-content">
              <h3>Rejected</h3>
              <div className="number">{stats.rejected}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-content">
              <h3>Total Days</h3>
              <div className="number">{stats.totalDays}</div>
            </div>
          </div>
        </div>

        {/* Filter Section */}
        <div className="filter-section">
          <div className="filter-group">
            <label htmlFor="filter-year">Filter by Year:</label>
            <select
              id="filter-year"
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="filter-select"
            >
              <option value="">All Years</option>
              {availableYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="filter-status">Filter by Status:</label>
            <select
              id="filter-status"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="filter-select"
            >
              <option value="">All Applications</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <button onClick={exportToCSV} className="btn-export">
            Export to CSV
          </button>
        </div>
      </div>

      {/* Applications Table */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Application Details</h2>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {loading ? (
          <div className="loading">Loading...</div>
        ) : applications.length === 0 ? (
          <div className="empty-state">No leave applications found</div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Leave Type</th>
                  <th>Dates</th>
                  <th>Days</th>
                  <th>Working Days</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {applications.map(app => (
                  <React.Fragment key={app.id}>
                    <tr className={`status-${app.status}`}>
                      <td className="leave-type-cell">
                        <strong>{app.leave_type_name || app.leave_type || 'N/A'}</strong>
                      </td>
                      <td className="date-cell">
                        <small>
                          {new Date(app.start_date).toLocaleDateString()} - {new Date(app.end_date).toLocaleDateString()}
                        </small>
                      </td>
                      <td><strong>{app.number_of_days}</strong></td>
                      <td><strong>{calculateWorkingDays(app.start_date, app.end_date)}</strong></td>
                      <td>{app.reason ? app.reason.substring(0, 50) + (app.reason.length > 50 ? '...' : '') : '-'}</td>
                      <td>{getStatusBadge(app.status)}</td>
                      <td className="actions-cell">
                        <div className="actions-buttons">
                          <button
                            className="btn-action-detail"
                            title="View application"
                            onClick={() => setExpandedApplication(expandedApplication === app.id ? null : app.id)}
                          >
                            {expandedApplication === app.id ? 'Hide' : 'View'}
                          </button>
                          <button
                            className="btn-action-attachments"
                            title="Download filled application"
                            onClick={() => handleDownloadApplication(app.id)}
                          >
                            Download
                          </button>
                          {app.status === 'rejected' && (
                            <button
                              className="btn-action-reapply"
                              title="Reapply with same details"
                              onClick={() => handleReapply(app.id)}
                            >
                              Reapply
                            </button>
                          )}
                          <button
                            className="btn-action-attachments"
                            title="View attachments"
                            onClick={() => handleViewAttachments(app.id)}
                          >
                            Attachments
                          </button>
                          {app.status === 'pending' && (
                            <>
                              <button
                                className="btn-action-reapply"
                                title="Edit application"
                                onClick={() => startEditing(app)}
                              >
                                Edit
                              </button>
                              <button
                                className="btn-action-cancel"
                                title="Cancel application"
                                onClick={() => handleCancel(app.id)}
                              >
                                Cancel
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Expanded Details Row */}
                    {expandedApplication === app.id && (
                      <tr className="expanded-row">
                        <td colSpan="7">
                          <div className="expanded-content">
                            <div className="detail-section">
                              <h4>Filled Application Form</h4>
                              <p><strong>Leave Type:</strong> {app.leave_type_name || app.leave_type || 'N/A'}</p>
                              <p><strong>Start Date:</strong> {new Date(app.start_date).toLocaleDateString()}</p>
                              <p><strong>End Date:</strong> {new Date(app.end_date).toLocaleDateString()}</p>
                              <p><strong>Days:</strong> {app.number_of_days}</p>
                              <p><strong>Reason:</strong> {app.reason || 'No reason provided'}</p>
                              <p><strong>Status:</strong> {app.status}</p>
                              <p><strong>Submitted:</strong> {new Date(app.created_at).toLocaleDateString()}</p>
                              <div className="actions-buttons">
                                <button className="btn-action-attachments" onClick={() => handleDownloadApplication(app.id)}>Download</button>
                                {app.status === 'pending' && <button className="btn-action-reapply" onClick={() => startEditing(app)}>Edit</button>}
                                {app.status === 'pending' && <button className="btn-action-cancel" onClick={() => handleCancel(app.id)}>Cancel</button>}
                              </div>
                            </div>

                            {editingApplication === app.id && (
                              <div className="detail-section edit-application-panel">
                                <h4>Edit Application</h4>
                                <label>
                                  Leave Type
                                  <select
                                    value={editForm.leave_type_id}
                                    onChange={(event) => setEditForm(prev => ({ ...prev, leave_type_id: event.target.value }))}
                                  >
                                    <option value="">Select leave type</option>
                                    {leaveTypes.map(type => (
                                      <option key={type.id} value={type.id}>{type.name}</option>
                                    ))}
                                  </select>
                                </label>
                                <label>
                                  Start Date
                                  <input
                                    type="date"
                                    value={editForm.start_date}
                                    onChange={(event) => setEditForm(prev => ({ ...prev, start_date: event.target.value }))}
                                  />
                                </label>
                                <label>
                                  End Date
                                  <input
                                    type="date"
                                    value={editForm.end_date}
                                    onChange={(event) => setEditForm(prev => ({ ...prev, end_date: event.target.value }))}
                                  />
                                </label>
                                <label>
                                  Reason
                                  <textarea
                                    value={editForm.reason}
                                    onChange={(event) => setEditForm(prev => ({ ...prev, reason: event.target.value }))}
                                  />
                                </label>
                                <div className="actions-buttons">
                                  <button className="btn-action-reapply" onClick={() => saveEdit(app.id)}>Save</button>
                                  <button className="btn-action-cancel" onClick={() => setEditingApplication(null)}>Close</button>
                                </div>
                              </div>
                            )}

                            {attachments[app.id] && attachments[app.id].length > 0 && (
                              <div className="detail-section">
                                <h4>Attachments ({attachments[app.id].length})</h4>
                                <div className="attachment-list">
                                  {attachments[app.id].map(att => (
                                    <div key={att.id} className="attachment-item">
                                      <span className="att-name">{att.filename}</span>
                                      <span className="att-size">({(att.file_size / 1024).toFixed(2)} KB)</span>
                                      <button
                                        className="btn-icon-tiny"
                                        onClick={() => handleDownloadAttachment(att.id)}
                                        title="Download"
                                      >
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default LeaveHistoryPage;
