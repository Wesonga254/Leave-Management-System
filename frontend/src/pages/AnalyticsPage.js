import React, { useState, useEffect, useMemo } from 'react';
import { reportService } from '../services/api';
import { Doughnut, Bar, Line } from 'react-chartjs-2';
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
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Title, Tooltip, Legend, Filler
);

function AnalyticsPage() {
  const [summary, setSummary] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [trends, setTrends] = useState([]);
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const userRole = localStorage.getItem('userRole') || 'employee';
  const isDirector = userRole === 'director';

  useEffect(() => {
    fetchData();
  }, [selectedYear]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [summaryRes, deptRes, trendsRes, balanceRes] = await Promise.all([
        reportService.getSummaryReport({ year: selectedYear }),
        reportService.getDepartmentReport({ year: selectedYear }),
        reportService.getMonthlyTrends({ year: selectedYear }),
        reportService.getLeaveBalanceReport({ year: selectedYear })
      ]);
      setSummary(summaryRes.data.data || {});
      setDepartments(deptRes.data.data || []);
      setTrends(trendsRes.data.data || []);
      setBalances(balanceRes.data.data || []);
    } catch (err) {
      setError('Error loading analytics: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  // KPI values
  const kpis = useMemo(() => {
    if (!summary) return {};
    return {
      employees: summary.total_employees || summary.total_users || 0,
      approved: summary.total_approved_leaves || 0,
      pending: summary.pending_approvals || 0,
      rejected: summary.total_rejected_leaves || 0,
      daysUsed: summary.total_days_used || 0
    };
  }, [summary]);

  // Utilisation
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

  // Status doughnut
  const statusChartData = useMemo(() => ({
    labels: ['Approved', 'Pending', 'Rejected'],
    datasets: [{
      data: [kpis.approved || 0, kpis.pending || 0, kpis.rejected || 0],
      backgroundColor: ['#1B7340', '#d97706', '#b91c1c'],
      borderWidth: 0
    }]
  }), [kpis]);

  // Department bar chart
  const deptChartData = useMemo(() => {
    const deptMap = new Map();
    departments.forEach(d => {
      const key = d.department || 'Unassigned';
      deptMap.set(key, (deptMap.get(key) || 0) + (d.total_days_approved || d.days_used || 0));
    });
    const entries = [...deptMap.entries()].slice(0, 10);
    return {
      labels: entries.map(([name]) => name),
      datasets: [{
        label: 'Days Used',
        data: entries.map(([, days]) => days),
        backgroundColor: '#2D6BB0',
        borderRadius: 4,
        maxBarThickness: 40
      }]
    };
  }, [departments]);

  // Dept headcount chart
  const deptHeadcountData = useMemo(() => {
    const deptMap = new Map();
    departments.forEach(d => {
      const key = d.department || 'Unassigned';
      const current = deptMap.get(key) || 0;
      deptMap.set(key, Math.max(current, d.total_employees || 0));
    });
    const entries = [...deptMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    return {
      labels: entries.map(([name]) => name),
      datasets: [{
        label: 'Staff',
        data: entries.map(([, count]) => count),
        backgroundColor: '#0d9488',
        borderRadius: 4,
        maxBarThickness: 40
      }]
    };
  }, [departments]);

  // Monthly trend line chart
  const trendChartData = useMemo(() => {
    const months = [...new Set(trends.map(t => t.month_name))];
    const approvedData = months.map(month =>
      trends.filter(t => t.month_name === month)
        .reduce((sum, t) => sum + (t.approved_count || t.approved || 0), 0)
    );
    const rejectedData = months.map(month =>
      trends.filter(t => t.month_name === month)
        .reduce((sum, t) => sum + (t.rejected_count || t.rejected || 0), 0)
    );
    return {
      labels: months,
      datasets: [
        {
          label: 'Approved',
          data: approvedData,
          borderColor: '#1B7340',
          backgroundColor: 'rgba(27, 115, 64, 0.08)',
          fill: true,
          tension: 0.3,
          pointRadius: 3
        },
        {
          label: 'Rejected',
          data: rejectedData,
          borderColor: '#b91c1c',
          backgroundColor: 'rgba(185, 28, 28, 0.05)',
          fill: true,
          tension: 0.3,
          pointRadius: 3
        }
      ]
    };
  }, [trends]);

  // Leave type breakdown
  const leaveTypeData = useMemo(() => {
    const typeMap = new Map();
    balances.forEach(b => {
      const key = b.leave_type || 'Other';
      typeMap.set(key, (typeMap.get(key) || 0) + (b.used_days || 0));
    });
    const entries = [...typeMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    const colors = ['#2D6BB0', '#d97706', '#1B7340', '#7c3aed', '#0d9488', '#dc2626', '#ea580c', '#64748b'];
    return {
      labels: entries.map(([name]) => name),
      datasets: [{
        data: entries.map(([, days]) => days),
        backgroundColor: colors.slice(0, entries.length),
        borderWidth: 0
      }]
    };
  }, [balances]);

  const chartOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 11 } } },
      y: { grid: { color: '#f1f5f9' }, beginAtZero: true, ticks: { font: { size: 11 } } }
    }
  };

  const doughnutOpts = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '62%',
    plugins: {
      legend: { position: 'bottom', labels: { padding: 14, usePointStyle: true, pointStyle: 'circle', font: { size: 12, weight: '500' } } }
    }
  };

  const lineOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top', labels: { usePointStyle: true, pointStyle: 'circle', font: { size: 12 } } }
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 11 } } },
      y: { grid: { color: '#f1f5f9' }, beginAtZero: true, ticks: { font: { size: 11 } } }
    }
  };

  if (loading) {
    return <div className="loading">Loading analytics...</div>;
  }

  return (
    <div className="analytics-page">
      <div className="analytics-header">
        <div>
          <h1 className="analytics-title">
            {isDirector ? 'Directorate Analytics' : 'Organisation Analytics'}
          </h1>
          <p className="analytics-subtitle">
            {isDirector ? 'Leave usage and trends for your directorate' : 'Leave usage and trends across the organisation'}
          </p>
        </div>
        <select
          className="analytics-year"
          value={selectedYear}
          onChange={e => setSelectedYear(Number(e.target.value))}
        >
          {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="analytics-kpi-strip">
        <div className="analytics-kpi">
          <span className="analytics-kpi-label">Employees</span>
          <span className="analytics-kpi-value">{kpis.employees}</span>
        </div>
        <div className="analytics-kpi">
          <span className="analytics-kpi-label">Approved</span>
          <span className="analytics-kpi-value analytics-kpi-green">{kpis.approved}</span>
        </div>
        <div className="analytics-kpi">
          <span className="analytics-kpi-label">Pending</span>
          <span className="analytics-kpi-value analytics-kpi-amber">{kpis.pending}</span>
        </div>
        <div className="analytics-kpi">
          <span className="analytics-kpi-label">Rejected</span>
          <span className="analytics-kpi-value analytics-kpi-red">{kpis.rejected}</span>
        </div>
        <div className="analytics-kpi">
          <span className="analytics-kpi-label">Days Used</span>
          <span className="analytics-kpi-value">{kpis.daysUsed}</span>
        </div>
        <div className="analytics-kpi">
          <span className="analytics-kpi-label">Utilisation</span>
          <span className="analytics-kpi-value analytics-kpi-teal">{utilisationRate}%</span>
        </div>
      </div>

      <div className="analytics-row">
        <div className="analytics-card analytics-card-wide">
          <h3>Monthly Trend</h3>
          <div className="analytics-chart-frame analytics-chart-wide">
            <Line data={trendChartData} options={lineOpts} />
          </div>
        </div>
        <div className="analytics-card">
          <h3>Status Breakdown</h3>
          <div className="analytics-chart-frame">
            <Doughnut data={statusChartData} options={doughnutOpts} />
          </div>
        </div>
      </div>

      <div className="analytics-row">
        <div className="analytics-card">
          <h3>{isDirector ? 'Directorate Usage (Days)' : 'Department Usage (Days)'}</h3>
          <div className="analytics-chart-frame">
            <Bar data={deptChartData} options={chartOpts} />
          </div>
        </div>
        <div className="analytics-card">
          <h3>{isDirector ? 'Directorate Headcount' : 'Department Headcount'}</h3>
          <div className="analytics-chart-frame">
            <Bar data={deptHeadcountData} options={chartOpts} />
          </div>
        </div>
      </div>

      <div className="analytics-row">
        <div className="analytics-card">
          <h3>Leave Type Breakdown</h3>
          <div className="analytics-chart-frame">
            <Doughnut data={leaveTypeData} options={doughnutOpts} />
          </div>
        </div>
        <div className="analytics-card">
          <h3>{isDirector ? 'Directorate Detail' : 'Department Detail'}</h3>
          <div className="analytics-table-frame">
            <table className="table">
              <thead>
                <tr><th>{isDirector ? 'Directorate' : 'Department'}</th><th>Staff</th><th>Approved</th><th>Days</th></tr>
              </thead>
              <tbody>
                {departments.slice(0, 10).map((d, i) => (
                  <tr key={`${d.department}-${i}`}>
                    <td>{d.department || '—'}</td>
                    <td>{d.total_employees || 0}</td>
                    <td>{d.approved_leaves || 0}</td>
                    <td><strong>{d.total_days_approved || d.days_used || 0}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <style>{`
        .analytics-page {
          max-width: 1200px;
          margin: 0 auto;
        }

        .analytics-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          padding-bottom: 16px;
          border-bottom: 2px solid var(--medium-gray, #e2e8f0);
        }

        .analytics-title {
          margin: 0 0 4px;
          font-size: 22px;
          font-weight: 700;
          color: #1e293b;
        }

        .analytics-subtitle {
          margin: 0;
          font-size: 14px;
          color: var(--dark-gray, #64748b);
        }

        .analytics-year {
          height: 38px;
          padding: 6px 14px;
          border: 1px solid #d0d5dd;
          border-radius: 8px;
          font-size: 14px;
          font-family: inherit;
          font-weight: 600;
        }

        .analytics-kpi-strip {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 12px;
          margin-bottom: 24px;
        }

        .analytics-kpi {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          padding: 16px 18px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .analytics-kpi-label {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          color: #6b7280;
        }

        .analytics-kpi-value {
          font-size: 26px;
          font-weight: 800;
          color: #1e293b;
          line-height: 1.1;
        }

        .analytics-kpi-green { color: #1B7340; }
        .analytics-kpi-amber { color: #d97706; }
        .analytics-kpi-red { color: #b91c1c; }
        .analytics-kpi-teal { color: #0d9488; }

        .analytics-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 16px;
        }

        .analytics-card {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          padding: 20px;
        }

        .analytics-card-wide {
          grid-column: 1;
        }

        .analytics-card h3 {
          margin: 0 0 16px;
          font-size: 14px;
          font-weight: 700;
          color: #1e293b;
        }

        .analytics-chart-frame {
          height: 260px;
          position: relative;
        }

        .analytics-chart-wide {
          height: 280px;
        }

        .analytics-table-frame {
          max-height: 300px;
          overflow-y: auto;
        }

        .analytics-table-frame .table {
          margin: 0;
          font-size: 13px;
        }

        @media (max-width: 768px) {
          .analytics-row {
            grid-template-columns: 1fr;
          }

          .analytics-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
          }

          .analytics-kpi-strip {
            grid-template-columns: repeat(3, 1fr);
          }
        }
      `}</style>
    </div>
  );
}

export default AnalyticsPage;
