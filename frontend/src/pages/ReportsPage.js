import React, { useState, useEffect } from 'react';
import { reportService } from '../services/api';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

function ReportsPage() {
  const [activeTab, setActiveTab] = useState('summary');
  const [summaryData, setSummaryData] = useState(null);
  const [leaveBalanceData, setLeaveBalanceData] = useState([]);
  const [monthlyTrends, setMonthlyTrends] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    fetchReportData();
  }, [selectedYear, activeTab]);

  const fetchReportData = async () => {
    setLoading(true);
    setError('');
    try {
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

      if (activeTab === 'balance') {
        const balanceResponse = await reportService.getLeaveBalanceReport({ year: selectedYear });
        setLeaveBalanceData(balanceResponse.data.data || []);
      }

      if (activeTab === 'trends') {
        const trendsResponse = await reportService.getMonthlyTrends({ year: selectedYear });
        setMonthlyTrends(trendsResponse.data.data || []);
      }

      if (activeTab === 'pending') {
        const pendingResponse = await reportService.getPendingApprovals();
        setPendingApprovals(pendingResponse.data.data || []);
      }
    } catch (err) {
      setError('Error loading reports: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
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

  const getChartData = () => {
    if (monthlyTrends.length === 0) return null;

    const months = [...new Set(monthlyTrends.map(t => t.month_name))];
    const approvedData = months.map(month => {
      const total = monthlyTrends
        .filter(t => t.month_name === month)
        .reduce((sum, t) => sum + (t.approved_count || t.approved || 0), 0);
      return total;
    });

    return {
      labels: months,
      datasets: [
        {
          label: 'Approved Leaves',
          data: approvedData,
          borderColor: '#27ae60',
          backgroundColor: 'rgba(39, 174, 96, 0.1)',
          tension: 0.1
        }
      ]
    };
  };

  const getLeaveTypeChartData = () => {
    if (leaveBalanceData.length === 0) return null;

    const leaveTypes = [...new Set(leaveBalanceData.map(b => b.leave_type))];
    const usedDays = leaveTypes.map(type => {
      const total = leaveBalanceData
        .filter(b => b.leave_type === type)
        .reduce((sum, b) => sum + (b.used_days || 0), 0);
      return total;
    });

    return {
      labels: leaveTypes,
      datasets: [
        {
          label: 'Days Used',
          data: usedDays,
          backgroundColor: [
            '#3498db',
            '#e74c3c',
            '#f39c12',
            '#27ae60',
            '#9b59b6',
            '#1abc9c'
          ]
        }
      ]
    };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        position: 'top'
      },
      title: {
        display: true
      }
    }
  };

  const formatDate = (value) => {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString();
  };

  const exportCurrentTabAsCSV = () => {
    let rows = [];
    let filename = 'report.csv';
    if (activeTab === 'summary') {
      rows = (summaryData?.by_department || []).map(d => ({ Department: d.department, TotalEmployees: d.total_employees, ApprovedLeaves: d.approved_leaves, DaysUsed: d.days_used || d.total_days_approved || 0 }));
      filename = `summary_${selectedYear}.csv`;
    } else if (activeTab === 'balance') {
      rows = leaveBalanceData.map(r => ({ Employee: `${r.first_name} ${r.last_name}`, EmployeeID: r.employee_id, Department: r.department, LeaveType: r.leave_type, TotalDays: r.total_days, UsedDays: r.used_days, Remaining: r.remaining_days }));
      filename = `leave_balance_${selectedYear}.csv`;
    } else if (activeTab === 'trends') {
      rows = monthlyTrends.map(t => ({ Month: t.month_name, LeaveType: t.leave_type, TotalApplications: t.total_applications, Approved: t.approved_count || t.approved, Pending: t.pending_count || t.pending, Rejected: t.rejected_count || t.rejected, TotalDays: t.approved_days || t.total_days }));
      filename = `monthly_trends_${selectedYear}.csv`;
    } else if (activeTab === 'pending') {
      rows = pendingApprovals.map(p => ({ Employee: `${p.first_name} ${p.last_name}`, EmployeeID: p.employee_id, LeaveType: p.leave_type, StartDate: p.start_date, EndDate: p.end_date, Days: p.number_of_days, ApprovalLevel: p.approval_level }));
      filename = `pending_approvals_${selectedYear}.csv`;
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

  return (
    <div>
      <div className="card">
        <h2 className="card-title">Leave Management Reports</h2>

        {error && <div className="alert alert-error">{error}</div>}

        <div className="report-tabs">
          <button
            className={`tab-btn ${activeTab === 'summary' ? 'active' : ''}`}
            onClick={() => setActiveTab('summary')}
          >
            Summary
          </button>
          <button
            className={`tab-btn ${activeTab === 'balance' ? 'active' : ''}`}
            onClick={() => setActiveTab('balance')}
          >
            Leave Balance
          </button>
          <button
            className={`tab-btn ${activeTab === 'trends' ? 'active' : ''}`}
            onClick={() => setActiveTab('trends')}
          >
            Monthly Trends
          </button>
          <button
            className={`tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
            onClick={() => setActiveTab('pending')}
          >
            Pending Approvals
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="form-group">
            <label htmlFor="year">Select Year:</label>
            <select
              id="year"
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            >
              {[2024, 2025, 2026].map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          <div>
            <button className="btn btn-outline" onClick={() => exportCurrentTabAsCSV()}>
              Export CSV (client)
            </button>
            <button className="btn btn-outline" style={{ marginLeft: 8 }} onClick={() => exportServerCSV()}>
              Export CSV (server)
            </button>
          </div>
        </div>

        {loading ? (
          <div className="loading">Loading report data...</div>
        ) : (
          <>
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

                <h3 style={{ marginTop: '30px' }}>Department Summary</h3>
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

            {/* Leave Balance Report */}
            {activeTab === 'balance' && (
              <div>
                {leaveBalanceData.length > 0 && getLeaveTypeChartData() && (
                  <div style={{ marginBottom: '40px' }}>
                    <Bar data={getLeaveTypeChartData()} options={chartOptions} />
                  </div>
                )}

                <table className="table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Employee ID</th>
                      <th>Department</th>
                      <th>Leave Type</th>
                      <th>Total Days</th>
                      <th>Used Days</th>
                      <th>Remaining Days</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaveBalanceData.map(balance => (
                      <tr key={balance.id}>
                        <td>{balance.first_name} {balance.last_name}</td>
                        <td>{balance.employee_id}</td>
                        <td>{balance.department}</td>
                        <td>{balance.leave_type}</td>
                        <td>{balance.total_days}</td>
                        <td>{balance.used_days}</td>
                        <td><strong>{balance.remaining_days}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Monthly Trends Report */}
            {activeTab === 'trends' && (
              <div>
                {monthlyTrends.length > 0 && getChartData() && (
                  <div style={{ marginBottom: '40px' }}>
                    <Line data={getChartData()} options={chartOptions} />
                  </div>
                )}

                <table className="table">
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th>Leave Type</th>
                      <th>Total Applications</th>
                      <th>Approved</th>
                      <th>Pending</th>
                      <th>Rejected</th>
                      <th>Total Days</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyTrends.map((trend, idx) => (
                      <tr key={idx}>
                        <td>{trend.month_name}</td>
                        <td>{trend.leave_type}</td>
                        <td>{trend.total_applications}</td>
                        <td>{trend.approved_count || trend.approved || 0}</td>
                        <td>{trend.pending_count || trend.pending || 0}</td>
                        <td>{trend.rejected_count || trend.rejected || 0}</td>
                        <td>{trend.approved_days || trend.total_days || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pending Approvals Report */}
            {activeTab === 'pending' && (
              <table className="table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Employee ID</th>
                    <th>Leave Type</th>
                    <th>Start Date</th>
                    <th>End Date</th>
                    <th>Days</th>
                    <th>Approval Level</th>
                    <th>Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingApprovals.length > 0 ? (
                    pendingApprovals.map(approval => (
                      <tr key={approval.id}>
                        <td>{approval.first_name} {approval.last_name}</td>
                        <td>{approval.employee_id}</td>
                        <td>{approval.leave_type}</td>
                        <td>{formatDate(approval.start_date)}</td>
                        <td>{formatDate(approval.end_date)}</td>
                        <td>{approval.number_of_days}</td>
                        <td>{approval.approval_level}</td>
                        <td>{formatDate(approval.submitted_date || approval.submitted_at || approval.created_at)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center' }}>No pending approvals</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>

      <style>{`
        .report-tabs {
          display: flex;
          gap: 10px;
          margin-bottom: 20px;
          border-bottom: 2px solid #ecf0f1;
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
        }

        .tab-btn:hover {
          color: #3498db;
        }

        .tab-btn.active {
          color: #3498db;
          border-bottom-color: #3498db;
        }
      `}</style>
    </div>
  );
}

export default ReportsPage;
