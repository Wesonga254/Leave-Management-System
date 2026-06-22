import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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
import { leaveService, reportService } from '../services/api';

import LeaveRequestsTable from '../components/LeaveRequestsTable';
import ApplicationDetailModal from '../components/ApplicationDetailModal';
import './HRDashboardPage.css';

ChartJS.register(ArcElement, BarElement, CategoryScale, Legend, LinearScale, Tooltip);

const TABS = [
  { key: 'applications', label: 'Applications' },
  { key: 'balances', label: 'Balances' },
  { key: 'pending', label: 'Pending' },
  { key: 'trends', label: 'Trends' },
];

function HRDashboardPage() {
  const currentYear = new Date().getFullYear();
  const [summary, setSummary] = useState({});
  const [departmentRows, setDepartmentRows] = useState([]);
  const [balances, setBalances] = useState([]);
  const [trends, setTrends] = useState([]);
  const [pending, setPending] = useState([]);
  const [applications, setApplications] = useState([]);
  const [filters, setFilters] = useState({ department: '', employee: '', year: currentYear });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedAppId, setSelectedAppId] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('applications');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError('');
        const params = { year: filters.year };
        const [summaryRes, departmentRes, balanceRes, trendsRes, pendingRes, applicationsRes] = await Promise.all([
          reportService.getSummaryReport(params),
          reportService.getDepartmentReport(params),
          reportService.getLeaveBalanceReport(params),
          reportService.getMonthlyTrends(params),
          reportService.getPendingApprovals(),
          leaveService.getApplications()
        ]);

        setSummary(summaryRes.data.data || {});
        setDepartmentRows(departmentRes.data.data || []);
        setBalances(balanceRes.data.data || []);
        setTrends(trendsRes.data.data || []);
        setPending(pendingRes.data.data || []);
        setApplications(applicationsRes.data.data || []);
      } catch (err) {
        setError(err?.response?.data?.message || 'Unable to load HR dashboard');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [filters.year]);

  const departments = useMemo(() => {
    return [...new Set(balances.map(row => row.department).filter(Boolean))].sort();
  }, [balances]);

  const filteredBalances = useMemo(() => {
    const employeeNeedle = filters.employee.trim().toLowerCase();
    return balances.filter(row => {
      const matchesDepartment = !filters.department || row.department === filters.department;
      const fullName = `${row.first_name || ''} ${row.last_name || ''} ${row.employee_id || ''}`.toLowerCase();
      const matchesEmployee = !employeeNeedle || fullName.includes(employeeNeedle);
      return matchesDepartment && matchesEmployee;
    });
  }, [balances, filters.department, filters.employee]);

  const behaviorFlags = useMemo(() => {
    const totals = new Map();
    filteredBalances.forEach(row => {
      const key = row.employee_id || `${row.first_name}-${row.last_name}`;
      const current = totals.get(key) || {
        employee_id: row.employee_id,
        first_name: row.first_name,
        last_name: row.last_name,
        department: row.department,
        used_days: 0,
        remaining_days: 0
      };
      current.used_days += row.used_days || 0;
      current.remaining_days += row.remaining_days || 0;
      totals.set(key, current);
    });

    return [...totals.values()]
      .filter(row => row.used_days >= 15 || row.remaining_days <= 2)
      .sort((a, b) => b.used_days - a.used_days)
      .slice(0, 8);
  }, [filteredBalances]);



  const statusCounts = useMemo(() => {
    return applications.reduce((acc, request) => {
      const status = request.status || 'pending';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});
  }, [applications]);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const outToday = useMemo(() => {
    return applications.filter(app => {
      if (app.status !== 'approved') return false;
      return app.start_date <= today && app.end_date >= today;
    });
  }, [applications, today]);

  const upcomingLeaves = useMemo(() => {
    const next7 = new Date();
    next7.setDate(next7.getDate() + 7);
    const next7Str = next7.toISOString().slice(0, 10);
    return applications.filter(app => {
      if (app.status !== 'approved') return false;
      return app.start_date > today && app.start_date <= next7Str;
    }).sort((a, b) => a.start_date.localeCompare(b.start_date));
  }, [applications, today]);

  const departmentUsage = useMemo(() => {
    const totals = new Map();
    departmentRows.forEach(row => {
      const key = row.department || 'Unassigned';
      totals.set(key, (totals.get(key) || 0) + (row.total_days_approved || 0));
    });
    return [...totals.entries()].slice(0, 8);
  }, [departmentRows]);

  // #4 — Department headcount
  const departmentHeadcount = useMemo(() => {
    const counts = new Map();
    departmentRows.forEach(row => {
      const key = row.department || 'Unassigned';
      const current = counts.get(key) || 0;
      counts.set(key, Math.max(current, row.total_employees || 0));
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [departmentRows]);

  const totalHeadcount = useMemo(() => {
    return departmentHeadcount.reduce((sum, [, count]) => sum + count, 0);
  }, [departmentHeadcount]);

  // #8 — Overdue approvals (pending > 3 days)
  const overdueApprovals = useMemo(() => {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const cutoff = threeDaysAgo.toISOString().slice(0, 10);
    return pending.filter(app => {
      const created = app.created_at ? app.created_at.slice(0, 10) : '';
      return created && created <= cutoff;
    });
  }, [pending]);

  // #10 — Leave utilisation rate
  const utilisationRate = useMemo(() => {
    let totalUsed = 0;
    let totalAllocated = 0;
    balances.forEach(row => {
      totalUsed += row.used_days || 0;
      totalAllocated += (row.used_days || 0) + (row.remaining_days || 0);
    });
    if (totalAllocated === 0) return 0;
    return Math.round((totalUsed / totalAllocated) * 100);
  }, [balances]);

  const exportServerCSV = async (type) => {
    const res = await fetch(`${process.env.REACT_APP_API_BASE || 'http://localhost:5000/api'}/reports/export/${type}?year=${filters.year}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    if (!res.ok) {
      setError('Export failed');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}_report_${filters.year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const tabCounts = {
    applications: applications.length,
    balances: filteredBalances.length,
    pending: pending.length,
    trends: trends.length,
  };

  if (loading) {
    return <div className="loading">Loading…</div>;
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'applications':
        return (
          <>
            <div className="hr-tab-header">
              <h3>All Leave Applications</h3>
              <button className="hr-btn-sm" type="button" onClick={() => exportServerCSV('balance')}>Export CSV</button>
            </div>
            <LeaveRequestsTable
              requests={applications.slice(0, 12)}
              showEmployee
              actions={(app) => (
                <button
                  className="hr-btn-sm"
                  onClick={() => { setSelectedAppId(app.id); setModalVisible(true); }}
                >
                  View
                </button>
              )}
            />
          </>
        );
      case 'balances':
        return (
          <>
            <div className="hr-tab-header">
              <h3>Employee Leave Balances</h3>
              <Link className="hr-btn-sm" to="/reports">Full Reports</Link>
            </div>
            <div className="table-wrapper">
              <table className="table">
                <thead><tr><th>Employee</th><th>Department</th><th>Leave Type</th><th>Used</th><th>Remaining</th></tr></thead>
                <tbody>
                  {filteredBalances.slice(0, 12).map((row, index) => (
                    <tr key={`${row.employee_id}-${row.leave_type}-${index}`}>
                      <td>{row.first_name} {row.last_name}<small>{row.employee_id}</small></td>
                      <td>{row.department}</td>
                      <td>{row.leave_type}</td>
                      <td>{row.used_days}</td>
                      <td><strong>{row.remaining_days}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        );
      case 'pending':
        return (
          <>
            <div className="hr-tab-header">
              <h3>Awaiting Supervisor Action</h3>
            </div>
            <LeaveRequestsTable requests={pending.slice(0, 10)} showEmployee showComments={false} />
          </>
        );
      case 'trends':
        return (
          <>
            <div className="hr-tab-header">
              <h3>Monthly Leave Patterns</h3>
              <button className="hr-btn-sm" type="button" onClick={() => exportServerCSV('department')}>Export</button>
            </div>
            <div className="table-wrapper">
              <table className="table">
                <thead><tr><th>Month</th><th>Department</th><th>Type</th><th>Apps</th><th>Days</th></tr></thead>
                <tbody>
                  {trends.slice(0, 10).map((row, index) => (
                    <tr key={`${row.month_name}-${row.department}-${row.leave_type}-${index}`}>
                      <td>{row.month_name}</td>
                      <td>{row.department || '—'}</td>
                      <td>{row.leave_type}</td>
                      <td>{row.total_applications}</td>
                      <td><strong>{row.approved_days || 0}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <div className="hr-page">
        <header className="hr-header">
          <div>
            <p className="hr-header-role">HR Manager</p>
            <h1 className="hr-header-title">HR Dashboard</h1>
          </div>
          <div className="hr-header-actions">
            <button className="hr-btn-export" type="button" onClick={() => exportServerCSV('balance')}>Export Balances</button>
            <button className="hr-btn-export" type="button" onClick={() => exportServerCSV('department')}>Export Departments</button>
            <button className="hr-btn-export" type="button" onClick={() => window.print()}>Print</button>
          </div>
        </header>

        {error && <div className="alert alert-error">{error}</div>}

        <div className="hr-kpi-strip">
          <div className="hr-kpi">
            <span className="hr-kpi-indicator hr-kpi-blue" />
            <div className="hr-kpi-meta">
              <h3>Employees</h3>
              <span className="hr-kpi-value">{summary.total_employees || summary.total_users || 0}</span>
            </div>
          </div>
          <div className="hr-kpi">
            <span className="hr-kpi-indicator hr-kpi-green" />
            <div className="hr-kpi-meta">
              <h3>Approved</h3>
              <span className="hr-kpi-value">{summary.total_approved_leaves || 0}</span>
            </div>
          </div>
          <div className="hr-kpi">
            <span className="hr-kpi-indicator hr-kpi-amber" />
            <div className="hr-kpi-meta">
              <h3>Pending</h3>
              <span className="hr-kpi-value">{summary.pending_approvals || pending.length || 0}</span>
            </div>
          </div>
          <div className="hr-kpi">
            <span className="hr-kpi-indicator hr-kpi-slate" />
            <div className="hr-kpi-meta">
              <h3>Days Used</h3>
              <span className="hr-kpi-value">{summary.total_days_used || 0}</span>
            </div>
          </div>
          <div className="hr-kpi">
            <span className="hr-kpi-indicator hr-kpi-red" />
            <div className="hr-kpi-meta">
              <h3>Out Today</h3>
              <span className="hr-kpi-value">{outToday.length}</span>
            </div>
          </div>
          <div className="hr-kpi">
            <span className="hr-kpi-indicator hr-kpi-maroon" />
            <div className="hr-kpi-meta">
              <h3>Rejected</h3>
              <span className="hr-kpi-value">{statusCounts.rejected || 0}</span>
            </div>
          </div>
          <div className="hr-kpi">
            <span className="hr-kpi-indicator hr-kpi-teal" />
            <div className="hr-kpi-meta">
              <h3>Utilisation</h3>
              <span className="hr-kpi-value">{utilisationRate}%</span>
            </div>
          </div>
        </div>

        {(outToday.length > 0 || upcomingLeaves.length > 0) && (
          <div className="hr-tables-row">
            <div className="hr-mini-card">
              <h3>Out Today ({outToday.length})</h3>
              {outToday.length === 0 ? (
                <p className="hr-empty">No one is on leave today.</p>
              ) : (
                <table className="table">
                  <thead><tr><th>Employee</th><th>Department</th><th>Type</th><th>Returns</th></tr></thead>
                  <tbody>
                    {outToday.slice(0, 8).map(app => {
                      const name = app.employee_name || [app.first_name, app.last_name].filter(Boolean).join(' ') || '—';
                      return (
                        <tr key={app.id}>
                          <td>{name}<small>{app.employee_id || ''}</small></td>
                          <td>{app.department || '—'}</td>
                          <td>{app.leave_type_name || app.leave_type || '—'}</td>
                          <td>{app.end_date ? new Date(app.end_date).toLocaleDateString() : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            <div className="hr-mini-card">
              <h3>Starting Next 7 Days ({upcomingLeaves.length})</h3>
              {upcomingLeaves.length === 0 ? (
                <p className="hr-empty">No upcoming leaves in the next 7 days.</p>
              ) : (
                <table className="table">
                  <thead><tr><th>Employee</th><th>Dept</th><th>Starts</th><th>Days</th></tr></thead>
                  <tbody>
                    {upcomingLeaves.slice(0, 8).map(app => {
                      const name = app.employee_name || [app.first_name, app.last_name].filter(Boolean).join(' ') || '—';
                      return (
                        <tr key={app.id}>
                          <td>{name}<small>{app.employee_id || ''}</small></td>
                          <td>{app.department || '—'}</td>
                          <td>{new Date(app.start_date).toLocaleDateString()}</td>
                          <td><strong>{app.number_of_days || 0}</strong></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        <div className="hr-toolbar">
          <label className="hr-toolbar-label">Filter</label>
          <select value={filters.department} onChange={e => setFilters(prev => ({ ...prev, department: e.target.value }))}>
            <option value="">All departments</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <input value={filters.employee} placeholder="Search employee or ID" onChange={e => setFilters(prev => ({ ...prev, employee: e.target.value }))} />
          <select value={filters.year} onChange={e => setFilters(prev => ({ ...prev, year: Number(e.target.value) }))}>
            {[currentYear, currentYear - 1, currentYear - 2, currentYear - 3].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        <nav className="hr-nav-cards">
          <Link className="hr-nav-card" to="/admin/users">
            <strong>User Management</strong>
            <span>Roles, departments, reporting</span>
          </Link>
          <Link className="hr-nav-card" to="/reports">
            <strong>Reports</strong>
            <span>Full reports and exports</span>
          </Link>
          <Link className="hr-nav-card" to="/notifications">
            <strong>Notifications</strong>
            <span>Alerts, approvals, updates</span>
          </Link>
          <Link className="hr-nav-card" to="/leave-calendar">
            <strong>Leave Calendar</strong>
            <span>Organisation-wide view</span>
          </Link>
        </nav>

        <div className="hr-charts-row">
          <div className="hr-chart-card">
            <h3>Status Overview</h3>
            <div className="hr-chart-frame">
              <Doughnut
                data={{
                  labels: ['Pending', 'Approved', 'Rejected'],
                  datasets: [{
                    data: [statusCounts.pending || 0, statusCounts.approved || 0, statusCounts.rejected || 0],
                    backgroundColor: ['#d97706', '#1B7340', '#b91c1c'],
                    borderWidth: 0
                  }]
                }}
                options={{
                  maintainAspectRatio: false,
                  cutout: '62%',
                  plugins: { legend: { position: 'bottom', labels: { padding: 14, usePointStyle: true, pointStyle: 'circle', font: { size: 12, weight: '500' } } } }
                }}
              />
            </div>
          </div>

          <div className="hr-chart-card">
            <h3>Department Usage (Approved Days)</h3>
            <div className="hr-chart-frame">
              <Bar
                data={{
                  labels: departmentUsage.map(([d]) => d),
                  datasets: [{
                    label: 'Days',
                    data: departmentUsage.map(([, days]) => days),
                    backgroundColor: '#2D6BB0',
                    borderRadius: 4,
                    borderSkipped: false,
                    maxBarThickness: 40
                  }]
                }}
                options={{
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: {
                    x: { grid: { display: false }, ticks: { font: { size: 11 } } },
                    y: { grid: { color: '#f1f5f9' }, beginAtZero: true, ticks: { font: { size: 11 } } }
                  }
                }}
              />
            </div>
          </div>
        </div>

        <div className="hr-tables-row">
          <div className="hr-mini-card">
            <h3>Behaviour Flags</h3>
            {behaviorFlags.length === 0 ? (
              <p className="hr-empty">No flags for current filters.</p>
            ) : (
              <table className="table">
                <thead><tr><th>Employee</th><th>Dept</th><th>Used</th><th>Left</th></tr></thead>
                <tbody>
                  {behaviorFlags.map(flag => (
                    <tr key={flag.employee_id}>
                      <td>{flag.first_name} {flag.last_name}<small>{flag.employee_id}</small></td>
                      <td>{flag.department}</td>
                      <td>
                        <span className={`hr-flag ${flag.used_days >= 15 ? 'hr-flag--high' : 'hr-flag--warn'}`}>
                          {flag.used_days}
                        </span>
                      </td>
                      <td>{flag.remaining_days}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="hr-mini-card">
            <h3>Department Headcount ({totalHeadcount})</h3>
            <table className="table">
              <thead><tr><th>Department</th><th>Staff</th><th>Approved</th><th>Days</th></tr></thead>
              <tbody>
                {departmentRows.slice(0, 8).map((row, index) => (
                  <tr key={`${row.department}-${row.leave_type}-${index}`}>
                    <td>{row.department || '—'}</td>
                    <td>{row.total_employees || 0}</td>
                    <td>{row.approved_leaves || 0}</td>
                    <td><strong>{row.total_days_approved || 0}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {overdueApprovals.length > 0 && (
          <div className="hr-mini-card" style={{ marginBottom: 20 }}>
            <h3 className="hr-overdue-title">Overdue Approvals ({overdueApprovals.length})</h3>
            <p className="hr-overdue-desc">Pending over 3 days without supervisor action.</p>
            <table className="table">
              <thead><tr><th>Employee</th><th>Type</th><th>Submitted</th><th>Days Waiting</th></tr></thead>
              <tbody>
                {overdueApprovals.slice(0, 8).map(app => {
                  const name = app.employee_name || [app.first_name, app.last_name].filter(Boolean).join(' ') || '—';
                  const created = app.created_at ? app.created_at.slice(0, 10) : '';
                  const daysWaiting = created ? Math.floor((new Date() - new Date(created)) / 86400000) : 0;
                  return (
                    <tr key={app.id || app.workflow_id}>
                      <td>{name}<small>{app.employee_id || ''}</small></td>
                      <td>{app.leave_type_name || app.leave_type || '—'}</td>
                      <td>{created ? new Date(created).toLocaleDateString() : '—'}</td>
                      <td><span className="hr-flag hr-flag--high">{daysWaiting}d</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}



        <div className="hr-tabs" role="tablist">
          {TABS.map(tab => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeTab === tab.key}
              className={`hr-tab${activeTab === tab.key ? ' hr-tab--active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
              {tabCounts[tab.key] > 0 && (
                <span className="hr-tab-count">{tabCounts[tab.key]}</span>
              )}
            </button>
          ))}
        </div>
        <div className="hr-tab-panel" role="tabpanel">
          {renderTabContent()}
        </div>
      </div>

      <ApplicationDetailModal
        applicationId={selectedAppId}
        visible={modalVisible}
        onClose={() => { setModalVisible(false); setSelectedAppId(null); }}
      />
    </>
  );
}

export default HRDashboardPage;
