import React, { useEffect, useMemo, useState } from 'react';
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { reportService } from '../services/api';
import LeaveCalendar from '../components/LeaveCalendar';
import LeaveRequestsTable from '../components/LeaveRequestsTable';
import ApplicationDetailModal from '../components/ApplicationDetailModal';
import './DashboardPage.css';
import './LeaveHistoryPage.css';

ChartJS.register(ArcElement, BarElement, CategoryScale, Legend, LinearScale, Tooltip);

function DirectorDashboardPage() {
  const [data, setData] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedAppId, setSelectedAppId] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    const fetchDirectorData = async () => {
      try {
        setLoading(true);
        setError('');
        const [dashboardRes, employeeRes] = await Promise.all([
          reportService.getDirectorDashboard({ days: 30 }),
          reportService.getDirectorEmployees()
        ]);
        setData(dashboardRes.data || null);
        setEmployees(employeeRes.data?.data || []);
      } catch (err) {
        setError(err?.response?.data?.message || 'Unable to load directorate dashboard');
      } finally {
        setLoading(false);
      }
    };

    fetchDirectorData();
  }, []);

  const trends = (data?.leaveTrends || []).filter(row => row.year && row.month);
  const allRequests = data?.allRequests || [];
  const visibleRequests = statusFilter === 'all'
    ? allRequests
    : allRequests.filter(request => request.status === statusFilter);
  const approvedCalendar = allRequests.filter(request => request.status === 'approved');
  const employeeBalances = data?.employeeBalances || [];

  const statusCounts = useMemo(() => {
    return allRequests.reduce((acc, request) => {
      const status = request.status || 'pending';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});
  }, [allRequests]);

  const leaveTypeUsage = useMemo(() => {
    const totals = new Map();
    trends.forEach(row => {
      if (!row.leave_type) return;
      totals.set(row.leave_type, (totals.get(row.leave_type) || 0) + (row.total_days || 0));
    });
    return [...totals.entries()].slice(0, 6);
  }, [trends]);

  // Employee roster filtering
  const filteredEmployees = useMemo(() => {
    const needle = employeeSearch.trim().toLowerCase();
    if (!needle) return employees;
    return employees.filter(emp => {
      const fullName = `${emp.first_name || ''} ${emp.middle_name || ''} ${emp.last_name || ''}`.toLowerCase();
      const empId = (emp.employee_id || '').toLowerCase();
      const email = (emp.email || '').toLowerCase();
      const designation = (emp.designation || '').toLowerCase();
      return fullName.includes(needle) || empId.includes(needle) || email.includes(needle) || designation.includes(needle);
    });
  }, [employees, employeeSearch]);

  // Employee role stats
  const roleStats = useMemo(() => {
    const counts = {};
    employees.forEach(emp => {
      const role = emp.role || 'employee';
      counts[role] = (counts[role] || 0) + 1;
    });
    return counts;
  }, [employees]);

  if (loading) {
    return <div className="loading">Loading directorate dashboard...</div>;
  }

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'employees', label: `Employees (${employees.length})` },
    { key: 'calendar', label: 'Leave Calendar' },
    { key: 'requests', label: 'Requests' },
  ];

  const content = (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div className="header-content">
          <span className="dashboard-kicker">Director Dashboard</span>
          <h1>{data?.department?.name || 'Directorate'} — Directorate Leave Overview</h1>
          <p className="header-subtitle">Leave visibility and management for your directorate.</p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Tab Navigation */}
      <div className="director-tabs" style={{
        display: 'flex', gap: 0, marginBottom: 24, background: '#fff',
        borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
      }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1, padding: '14px 20px', border: 'none', cursor: 'pointer',
              fontWeight: 700, fontSize: 14, letterSpacing: '0.2px',
              transition: 'all 0.2s ease',
              background: activeTab === tab.key ? '#1B7340' : 'transparent',
              color: activeTab === tab.key ? '#fff' : '#475569',
              borderBottom: activeTab === tab.key ? 'none' : '2px solid transparent',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══════════ OVERVIEW TAB ═══════════ */}
      {activeTab === 'overview' && (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-content">
                <h3>On Leave Today</h3>
                <div className="number">{data?.metrics?.employees_on_leave_today || 0}</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-content">
                <h3>Upcoming Leave</h3>
                <div className="number">{data?.metrics?.upcoming_leave_count || 0}</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-content">
                <h3>Directorate Employees</h3>
                <div className="number">{employees.length}</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-content">
                <h3>Pending Approvals</h3>
                <div className="number">{data?.metrics?.pending_approvals || 0}</div>
              </div>
            </div>
          </div>

          <div className="dashboard-grid-two">
            <div className="card chart-card">
              <h2 className="card-title">Application Status</h2>
              <div className="chart-frame">
                <Doughnut
                  data={{
                    labels: ['Pending', 'Approved', 'Rejected'],
                    datasets: [{
                      data: [statusCounts.pending || 0, statusCounts.approved || 0, statusCounts.rejected || 0],
                  backgroundColor: ['#E65100', '#1B7340', '#C62828'],
                      borderWidth: 0
                    }]
                  }}
                  options={{ maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }}
                />
              </div>
            </div>
            <div className="card chart-card">
              <h2 className="card-title">Leave Usage by Type</h2>
              <div className="chart-frame">
                <Bar
                  data={{
                    labels: leaveTypeUsage.map(([name]) => name),
                    datasets: [{
                      label: 'Approved days',
                      data: leaveTypeUsage.map(([, days]) => days),
                      backgroundColor: '#2D6BB0',
                      borderRadius: 8
                    }]
                  }}
                  options={{ maintainAspectRatio: false, plugins: { legend: { display: false } } }}
                />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Currently On Leave</h2>
            </div>
            {(data?.onLeaveToday || []).length === 0 ? (
              <div className="empty-state-box">No employees are on approved leave today.</div>
            ) : (
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Leave Type</th>
                      <th>Start</th>
                      <th>Return</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.onLeaveToday.map(item => (
                      <tr key={`${item.id}-${item.start_date}`}>
                        <td>{item.first_name} {item.last_name}</td>
                        <td>{item.leave_type}</td>
                        <td>{item.start_date}</td>
                        <td>{item.return_date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Upcoming Leave</h2>
            </div>
            {(data?.upcomingLeave || []).length === 0 ? (
              <div className="empty-state-box">No approved leave starts in the next 30 days.</div>
            ) : (
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Leave Type</th>
                      <th>Start</th>
                      <th>Return</th>
                      <th>Days</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.upcomingLeave.map(item => (
                      <tr key={`${item.id}-${item.start_date}`}>
                        <td>{item.first_name} {item.last_name}</td>
                        <td>{item.leave_type}</td>
                        <td>{item.start_date}</td>
                        <td>{item.return_date}</td>
                        <td>{item.number_of_days}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══════════ EMPLOYEES TAB ═══════════ */}
      {activeTab === 'employees' && (
        <>
          {/* Quick role stats */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-content">
                <h3>Total Staff</h3>
                <div className="number">{employees.length}</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-content">
                <h3>Supervisors</h3>
                <div className="number">{roleStats.supervisor || 0}</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-content">
                <h3>Employees</h3>
                <div className="number">{roleStats.employee || 0}</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-content">
                <h3>Active</h3>
                <div className="number">{employees.filter(e => e.is_active !== 0).length}</div>
              </div>
            </div>
          </div>

          {/* Employee Roster */}
          <div className="card">
            <div className="card-header approver-card-header">
              <div>
                <h2 className="card-title">Directorate Employee Roster</h2>
                <p className="subtitle">All employees in the {data?.department?.name || ''} directorate</p>
              </div>
              <input
                type="text"
                placeholder="Search by name, ID, email, or designation..."
                value={employeeSearch}
                onChange={e => setEmployeeSearch(e.target.value)}
                style={{
                  padding: '10px 16px', borderRadius: 10, border: '1px solid #d1d5db',
                  fontSize: 14, minWidth: 280, background: '#f8fafc',
                  outline: 'none', transition: 'border-color 0.15s ease'
                }}
              />
            </div>
            {filteredEmployees.length === 0 ? (
              <div className="empty-state-box">No employees match your search.</div>
            ) : (
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Employee ID</th>
                      <th>Designation</th>
                      <th>Role</th>
                      <th>Supervisor</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmployees.map(emp => (
                      <tr key={emp.id}>
                        <td>
                          <strong>{emp.first_name} {emp.middle_name ? emp.middle_name + ' ' : ''}{emp.last_name}</strong>
                        </td>
                        <td>{emp.employee_id || 'N/A'}</td>
                        <td>{emp.designation || 'N/A'}</td>
                        <td>
                          <span className={`status-badge status-${emp.role === 'supervisor' ? 'approved' : 'pending'}`} style={{ textTransform: 'capitalize' }}>
                            {(emp.role || 'employee').replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td>{emp.supervisor_name || 'Unassigned'}</td>
                        <td><small>{emp.email || 'N/A'}</small></td>
                        <td><small>{emp.phone || 'N/A'}</small></td>
                        <td>
                          <span className={`status-badge ${emp.is_active !== 0 ? 'status-approved' : 'status-rejected'}`}>
                            {emp.is_active !== 0 ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Employee Leave Balances */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Employee Leave Balances</h2>
              <p className="subtitle">Leave utilization and remaining balances for the current year</p>
            </div>
            {employeeBalances.length === 0 ? (
              <div className="empty-state-box">No leave balance data available for this directorate.</div>
            ) : (
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Job Group</th>
                      <th>Supervisor</th>
                      <th>Leave Type</th>
                      <th>Used</th>
                      <th>Remaining</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employeeBalances.map((row, index) => (
                      <tr key={`${row.id}-${row.leave_type}-${index}`}>
                        <td>{row.first_name} {row.last_name}<small>{row.employee_id}</small></td>
                        <td>{row.designation || 'N/A'}</td>
                        <td>{row.supervisor_name || 'Unassigned'}</td>
                        <td>{row.leave_type}</td>
                        <td>{row.used_days || 0}</td>
                        <td><strong>{row.remaining_days || 0}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══════════ CALENDAR TAB ═══════════ */}
      {activeTab === 'calendar' && (
        <>
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Directorate Leave Calendar</h2>
              <p className="subtitle">Visual overview of approved leave across the {data?.department?.name || ''} directorate. Hover over highlighted days to see who is on leave.</p>
            </div>
            {approvedCalendar.length === 0 ? (
              <div className="empty-state-box">No approved directorate leave is available for the calendar.</div>
            ) : (
              <LeaveCalendar applications={approvedCalendar} />
            )}
          </div>

          {/* On leave today & upcoming — context alongside calendar */}
          <div className="dashboard-grid-two">
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">On Leave Today</h2>
              </div>
              {(data?.onLeaveToday || []).length === 0 ? (
                <div className="empty-state-box">No employees are on approved leave today.</div>
              ) : (
                <div className="table-wrapper">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Leave Type</th>
                        <th>Return Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.onLeaveToday.map(item => (
                        <tr key={`${item.id}-${item.start_date}`}>
                          <td><strong>{item.first_name} {item.last_name}</strong></td>
                          <td>{item.leave_type}</td>
                          <td>{item.return_date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Upcoming Leave</h2>
              </div>
              {(data?.upcomingLeave || []).length === 0 ? (
                <div className="empty-state-box">No approved leave in the next 30 days.</div>
              ) : (
                <div className="table-wrapper">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Leave Type</th>
                        <th>Start</th>
                        <th>Days</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.upcomingLeave.map(item => (
                        <tr key={`${item.id}-${item.start_date}`}>
                          <td><strong>{item.first_name} {item.last_name}</strong></td>
                          <td>{item.leave_type}</td>
                          <td>{item.start_date}</td>
                          <td>{item.number_of_days}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ═══════════ REQUESTS TAB ═══════════ */}
      {activeTab === 'requests' && (
        <>
          <div className="card">
            <div className="card-header approver-card-header">
              <div>
                <h2 className="card-title">Directorate Leave Requests</h2>
                <p className="subtitle">All leave applications within your directorate</p>
              </div>
              <select
                className="compact-select"
                value={statusFilter}
                onChange={event => setStatusFilter(event.target.value)}
                aria-label="Filter applications by status"
              >
                <option value="all">All statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <LeaveRequestsTable
              requests={visibleRequests}
              showEmployee
              emptyTitle="No department requests"
              emptyMessage="Department leave requests will appear here."
              actions={(app) => (
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: 13, padding: '6px 14px' }}
                  onClick={() => { setSelectedAppId(app.id); setModalVisible(true); }}
                >
                  View
                </button>
              )}
            />
          </div>

          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Leave Frequency Trends</h2>
            </div>
            {trends.length === 0 ? (
              <div className="empty-state-box">No approved leave history is available yet.</div>
            ) : (
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Leave Type</th>
                      <th>Period</th>
                      <th>Requests</th>
                      <th>Days</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trends.map((item, index) => (
                      <tr key={`${item.user_id}-${item.leave_type}-${item.year}-${item.month}-${index}`}>
                        <td>{item.first_name} {item.last_name}</td>
                        <td>{item.leave_type || 'N/A'}</td>
                        <td>{item.year}-{item.month}</td>
                        <td>{item.leave_count}</td>
                        <td>{item.total_days || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );

  return (
    <>
      {content}
      <ApplicationDetailModal
        applicationId={selectedAppId}
        visible={modalVisible}
        onClose={() => { setModalVisible(false); setSelectedAppId(null); }}
      />
    </>
  );
}

export default DirectorDashboardPage;
