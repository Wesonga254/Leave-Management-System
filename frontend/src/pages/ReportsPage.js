import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { reportService, leaveService, adminService } from '../services/api';
import './ReportsPage.css';

function ReportsPage() {
  const userRole = localStorage.getItem('userRole') || 'employee';
  const isDirector = userRole === 'director';
  const [activeTab, setActiveTab] = useState('applications');
  const [summaryData, setSummaryData] = useState(null);
  const [allApplications, setAllApplications] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [allDirectorates, setAllDirectorates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Filters for applications tab
  const [deptFilter, setDeptFilter] = useState('');
  const [directorateFilter, setDirFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedAppId, setExpandedAppId] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  useEffect(() => {
    fetchDepartments();
    fetchDirectorates();
  }, []);

  useEffect(() => {
    fetchReportData();
  }, [selectedYear, activeTab]);

  const fetchDepartments = async () => {
    try {
      const res = await adminService.getDepartments();
      if (res.data.success) setDepartments(res.data.data || []);
    } catch { /* silent */ }
  };

  const fetchDirectorates = async () => {
    try {
      const res = await adminService.getDirectorates();
      if (res.data.success) setAllDirectorates(res.data.data || []);
    } catch { /* silent */ }
  };

  const fetchReportData = async () => {
    setLoading(true);
    setError('');
    try {
      if (activeTab === 'applications') {
        const res = await leaveService.getApplications({ year: selectedYear });
        setAllApplications(res.data.data || []);
      }

      if (activeTab === 'summary') {
        const [summaryResponse, departmentResponse] = await Promise.all([
          reportService.getSummaryReport({ year: selectedYear }),
          reportService.getDepartmentReport({ year: selectedYear })
        ]);
        const summary = summaryResponse.data.data || {};
        setSummaryData({
          overall: {
            total_employees_on_leave: summary.total_employees || 0,
            total_approved_leaves: summary.total_approved_leaves || 0,
            total_pending_leaves: summary.pending_approvals || 0,
            total_rejected_leaves: summary.total_rejected_leaves || 0,
            total_days_used: summary.total_days_used || 0
          },
          by_department: departmentResponse.data.data || []
        });
      }

    } catch (err) {
      setError('Error loading reports: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  // Directorates filtered by selected department
  const filteredDirectorates = useMemo(() => {
    if (!deptFilter) return [];
    const dept = departments.find(d => d.name === deptFilter);
    if (!dept) return [];
    return allDirectorates.filter(dir => dir.department_id === dept.id);
  }, [allDirectorates, departments, deptFilter]);

  const filteredApplications = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    return allApplications.filter(app => {
      if (deptFilter && (app.department || '') !== deptFilter) return false;
      if (statusFilter && app.status !== statusFilter) return false;
      if (needle) {
        const empId = (app.employee_id || '').toLowerCase();
        const fullName = `${app.first_name || ''} ${app.last_name || ''}`.toLowerCase();
        if (!empId.includes(needle) && !fullName.includes(needle)) return false;
      }
      return true;
    });
  }, [allApplications, deptFilter, statusFilter, searchQuery]);

  const getWorkflowSummary = useCallback((app) => {
    const workflow = app.workflow || [];
    if (workflow.length === 0) return { approver: '—', level: '—', decision: '—' };
    const decided = workflow.find(w => ['approved', 'rejected'].includes(w.status));
    if (decided) {
      return {
        approver: decided.approver_name || '—',
        level: (decided.approval_level || '').replace(/_/g, ' '),
        decision: decided.status,
        date: decided.approved_at || decided.updated_at
      };
    }
    const pending = workflow.find(w => w.status === 'pending');
    if (pending) {
      return {
        approver: pending.approver_name || '—',
        level: (pending.approval_level || '').replace(/_/g, ' '),
        decision: 'pending',
        date: null
      };
    }
    return { approver: '—', level: '—', decision: '—' };
  }, []);

  const getStatusBadge = (status) => {
    const colors = {
      approved: '#ecfdf3',
      pending: '#fffbeb',
      rejected: '#fef2f2',
      cancelled: '#f8fafc'
    };
    const textColors = {
      approved: '#027a48',
      pending: '#92400e',
      rejected: '#b42318',
      cancelled: '#475569'
    };
    return (
      <span style={{
        display: 'inline-block',
        padding: '3px 8px',
        borderRadius: '6px',
        fontSize: '12px',
        fontWeight: 700,
        background: colors[status] || '#f1f5f9',
        color: textColors[status] || '#334155',
        textTransform: 'capitalize'
      }}>
        {status}
      </span>
    );
  };

  const exportServerCSV = async () => {
    try {
      const type = activeTab === 'balance' ? 'balance' : activeTab === 'pending' ? 'pending' : activeTab === 'trends' ? 'monthly' : 'department';
      const res = await fetch(`${process.env.REACT_APP_API_BASE || 'http://localhost:5000/api'}/reports/export/${type}?year=${selectedYear}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}_report_${selectedYear}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Server export failed: ' + (err.message || err));
    }
  };

  const formatDate = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString();
  };

  const exportCurrentTabAsCSV = () => {
    let rows = [];
    let filename = 'report.csv';
    if (activeTab === 'applications') {
      rows = filteredApplications.map(app => {
        const wf = getWorkflowSummary(app);
        return {
          EmployeeNo: app.employee_id,
          Name: `${app.first_name} ${app.last_name}`,
          Department: app.department || '',
          LeaveType: app.leave_type_name || app.leave_type || '',
          StartDate: app.start_date,
          EndDate: app.end_date,
          Days: app.number_of_days,
          Status: app.status,
          Approver: wf.approver,
          ApprovalLevel: wf.level,
          Decision: wf.decision,
          Submitted: app.created_at
        };
      });
      filename = `leave_applications_${selectedYear}.csv`;
    } else if (activeTab === 'summary') {
      rows = (summaryData?.by_department || []).map(d => ({ Department: d.department, TotalEmployees: d.total_employees, ApprovedLeaves: d.approved_leaves, DaysUsed: d.days_used || d.total_days_approved || 0 }));
      filename = `summary_${selectedYear}.csv`;
    }

    if (rows.length === 0) {
      alert('No data to export for this tab');
      return;
    }

    const keys = Object.keys(rows[0]);
    const csv = [keys.join(',')].concat(rows.map(r => keys.map(k => `"${String(r[k] ?? '').replace(/"/g, '""')}"`).join(','))).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPdf = async (applicationId) => {
    try {
      setDownloadingId(applicationId);
      const response = await leaveService.downloadApplication(applicationId);
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `leave-application-${applicationId}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Error downloading PDF: ' + (err.response?.data?.message || err.message));
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div>
      <div className="card">
        <h2 className="card-title">{isDirector ? 'Directorate Reports' : 'Leave Management Reports'}</h2>

        {error && <div className="alert alert-error">{error}</div>}

        <div className="report-tabs">
          <button
            className={`tab-btn ${activeTab === 'applications' ? 'active' : ''}`}
            onClick={() => setActiveTab('applications')}
          >
            Applications
          </button>
          <button
            className={`tab-btn ${activeTab === 'summary' ? 'active' : ''}`}
            onClick={() => setActiveTab('summary')}
          >
            Summary
          </button>

        </div>

        <div className="report-controls">
          <div className="report-controls-left">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="report-select"
            >
              {[2024, 2025, 2026].map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>

            {activeTab === 'applications' && (
              <>
                {!isDirector && (
                  <>
                    <select
                      value={deptFilter}
                      onChange={e => { setDeptFilter(e.target.value); setDirFilter(''); }}
                      className="report-select"
                    >
                      <option value="">All departments</option>
                      {departments.map(d => (
                        <option key={d.id} value={d.name}>{d.name}</option>
                      ))}
                    </select>
                    {deptFilter && filteredDirectorates.length > 0 && (
                      <select
                        value={directorateFilter}
                        onChange={e => setDirFilter(e.target.value)}
                        className="report-select"
                      >
                        <option value="">All directorates</option>
                        {filteredDirectorates.map(d => (
                          <option key={d.id} value={d.name}>{d.name}</option>
                        ))}
                      </select>
                    )}
                  </>
                )}
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="report-select"
                >
                  <option value="">All statuses</option>
                  <option value="approved">Approved</option>
                  <option value="pending">Pending</option>
                  <option value="rejected">Rejected</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <input
                  type="text"
                  placeholder="Search by Employee No or name"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="report-search"
                />
              </>
            )}
          </div>

          <div className="report-controls-right">
            <button className="btn btn-outline" onClick={() => exportCurrentTabAsCSV()}>
              Export CSV
            </button>
            {activeTab !== 'applications' && (
              <button className="btn btn-outline" onClick={() => exportServerCSV()}>
                Export (server)
              </button>
            )}
          </div>
        </div>

        {activeTab === 'applications' && !loading && (
          <p className="report-result-count">{filteredApplications.length} of {allApplications.length} applications</p>
        )}

        {loading ? (
          <div className="loading">Loading report data...</div>
        ) : (
          <>
            {/* Applications Report */}
            {activeTab === 'applications' && (
              <div className="table-wrapper">
                {filteredApplications.length === 0 ? (
                  <div className="empty-state">
                    <h3>No applications found</h3>
                    <p>Try adjusting your filters or search query.</p>
                  </div>
                ) : (
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Employee No</th>
                        <th>Name</th>
                        <th>Leave Type</th>
                        <th>Days</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredApplications.map(app => {
                        const wf = getWorkflowSummary(app);
                        const isExpanded = expandedAppId === app.id;
                        return (
                          <React.Fragment key={app.id}>
                            <tr>
                              <td data-label="Employee No">{app.employee_id || '—'}</td>
                              <td data-label="Name">{app.first_name} {app.last_name}</td>
                              <td data-label="Leave Type">{app.leave_type_name || app.leave_type || '—'}</td>
                              <td data-label="Days"><strong>{app.number_of_days}</strong></td>
                              <td data-label="Status">{getStatusBadge(app.status)}</td>
                              <td data-label="Actions">
                                <button
                                  className="btn btn-secondary"
                                  style={{ fontSize: 12, padding: '4px 12px' }}
                                  onClick={() => setExpandedAppId(isExpanded ? null : app.id)}
                                >
                                  {isExpanded ? 'Close' : 'View'}
                                </button>
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr className="detail-row">
                                <td colSpan="6">
                                  <div className="report-detail-card">
                                    <div className="report-detail-grid">
                                      <div><span className="detail-label">Department</span><span className="detail-value">{app.department || '—'}</span></div>
                                      <div><span className="detail-label">Start Date</span><span className="detail-value">{formatDate(app.start_date)}</span></div>
                                      <div><span className="detail-label">End Date</span><span className="detail-value">{formatDate(app.end_date)}</span></div>
                                      <div><span className="detail-label">Approver</span><span className="detail-value">{wf.approver}{wf.level && wf.level !== '—' ? ` (${wf.level})` : ''}</span></div>
                                      <div><span className="detail-label">Decision Date</span><span className="detail-value">{wf.date ? formatDate(wf.date) : '—'}</span></div>
                                      <div><span className="detail-label">Date Applied</span><span className="detail-value">{formatDate(app.created_at)}</span></div>
                                    </div>
                                    {app.reason && (
                                      <div style={{ marginTop: 10 }}>
                                        <span className="detail-label">Reason</span>
                                        <p className="detail-value" style={{ marginTop: 2 }}>{app.reason}</p>
                                      </div>
                                    )}
                                    <div style={{ marginTop: 12 }}>
                                      <button
                                        className="btn btn-primary"
                                        style={{ fontSize: 12, padding: '6px 16px' }}
                                        onClick={() => handleDownloadPdf(app.id)}
                                        disabled={downloadingId === app.id}
                                      >
                                        {downloadingId === app.id ? 'Downloading...' : 'Download PDF'}
                                      </button>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Summary Report */}
            {activeTab === 'summary' && summaryData && (
              <div>
                <div className="stats-grid">
                  <div className="stat-card">
                    <h3>Total Employees on Leave</h3>
                    <div className="number">{summaryData.overall?.total_employees_on_leave || 0}</div>
                  </div>
                  <div className="stat-card">
                    <h3>Approved Leaves</h3>
                    <div className="number">{summaryData.overall?.total_approved_leaves || 0}</div>
                  </div>
                  <div className="stat-card">
                    <h3>Pending Leaves</h3>
                    <div className="number">{summaryData.overall?.total_pending_leaves || 0}</div>
                  </div>
                  <div className="stat-card">
                    <h3>Rejected Leaves</h3>
                    <div className="number">{summaryData.overall?.total_rejected_leaves || 0}</div>
                  </div>
                  <div className="stat-card">
                    <h3>Total Days Used</h3>
                    <div className="number">{summaryData.overall?.total_days_used || 0}</div>
                  </div>
                </div>

                <h3 style={{ marginTop: '30px' }}>{isDirector ? 'Directorate Summary' : 'Department Summary'}</h3>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Department</th>
                      <th>Total Employees</th>
                      <th>Approved Leaves</th>
                      <th>Days Used</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summaryData.by_department?.map((dept, idx) => (
                      <tr key={idx}>
                        <td>{dept.department || 'N/A'}</td>
                        <td>{dept.total_employees}</td>
                        <td>{dept.approved_leaves}</td>
                        <td>{dept.days_used || dept.total_days_approved || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

          </>
        )}
      </div>

      <style>{`
        .report-tabs {
          display: flex;
          gap: 4px;
          margin-bottom: 20px;
          border-bottom: 2px solid #ecf0f1;
          flex-wrap: wrap;
        }

        .tab-btn {
          padding: 10px 15px;
          border: none;
          background: none;
          cursor: pointer;
          font-size: 14px;
          color: #7f8c8d;
          border-bottom: 3px solid transparent;
          transition: all 0.3s;
          white-space: nowrap;
        }

        .tab-btn:hover {
          color: #3498db;
        }

        .tab-btn.active {
          color: #3498db;
          border-bottom-color: #3498db;
        }

        .report-controls {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }

        .report-controls-left {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          align-items: center;
          flex: 1;
        }

        .report-controls-right {
          display: flex;
          gap: 8px;
          flex-shrink: 0;
        }

        .report-select {
          height: 38px;
          padding: 6px 12px;
          border: 1px solid #d0d5dd;
          border-radius: 8px;
          font-size: 13px;
          font-family: inherit;
          min-width: 160px;
        }

        .report-search {
          height: 38px;
          padding: 6px 12px;
          border: 1px solid #d0d5dd;
          border-radius: 8px;
          font-size: 13px;
          font-family: inherit;
          min-width: 220px;
          flex: 1;
        }

        .report-select:focus,
        .report-search:focus {
          outline: none;
          border-color: var(--county-blue, #2D6BB0);
          box-shadow: 0 0 0 2px rgba(45, 107, 176, 0.08);
        }

        .report-result-count {
          font-size: 12px;
          color: var(--dark-gray, #6b7280);
          font-weight: 600;
          margin: -8px 0 12px;
        }
      `}</style>
    </div>
  );
}

export default ReportsPage;
