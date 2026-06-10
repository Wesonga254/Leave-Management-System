import React, { useState, useEffect } from 'react';
import { leaveService } from '../services/api';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import './TrendsPage.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend);

function TrendsPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Analytics data
  const [monthlyChart, setMonthlyChart] = useState(null);
  const [leaveTypeChart, setLeaveTypeChart] = useState(null);
  const [yoyChart, setYoyChart] = useState(null);
  const [teamStats, setTeamStats] = useState(null);
  const [carryoverData, setCarryoverData] = useState(null);
  const [longestLeave, setLongestLeave] = useState(null);
  const [yearStats, setYearStats] = useState(null);

  const currentYear = new Date().getFullYear();

  useEffect(() => {
    generateAvailableYears();
    fetchAllAnalytics();
  }, []);

  useEffect(() => {
    fetchAllAnalytics();
  }, [year]);

  const generateAvailableYears = () => {
    const years = [];
    for (let i = currentYear; i >= currentYear - 5; i--) {
      years.push(i);
    }
    setAvailableYears(years);
  };

  const fetchAllAnalytics = async () => {
    try {
      setLoading(true);
      const [trendsRes, teamRes, carryoverRes] = await Promise.all([
        leaveService.getAnalyticsTrends(year),
        leaveService.getTeamStats(year),
        leaveService.getCarryoverData()
      ]);

      const trendsData = trendsRes.data;
      buildMonthlyChart(trendsData.monthlyData);
      buildLeaveTypeChart(trendsData.leaveTypeBreakdown);
      buildYoyChart(trendsData.yearOverYear);
      setYearStats(trendsData.yearStats);
      setLongestLeave(trendsData.longestLeave);
      setTeamStats(teamRes.data);
      setCarryoverData(carryoverRes.data);
    } catch (err) {
      setError('Error loading analytics data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const buildMonthlyChart = (monthlyData) => {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const months = monthlyData.map(m => monthNames[parseInt(m.month) - 1]);
    const days = monthlyData.map(m => m.total_days);
    const counts = monthlyData.map(m => m.count);

    const data = {
      labels: months,
      datasets: [
        {
          label: 'Days Used',
          data: days,
          backgroundColor: 'rgba(102, 126, 234, 0.7)',
          borderColor: '#667eea',
          borderWidth: 2,
          borderRadius: 6,
          yAxisID: 'y'
        },
        {
          label: 'Applications',
          data: counts,
          backgroundColor: 'rgba(72, 187, 120, 0.5)',
          borderColor: '#48bb78',
          borderWidth: 2,
          borderRadius: 6,
          yAxisID: 'y1'
        }
      ]
    };

    setMonthlyChart(data);
  };

  const buildLeaveTypeChart = (leaveTypeData) => {
    const colors = ['#667eea', '#48bb78', '#f39c12', '#e74c3c', '#3498db', '#9b59b6'];
    const data = {
      labels: leaveTypeData.map(lt => lt.name),
      datasets: [{
        data: leaveTypeData.map(lt => lt.total_days),
        backgroundColor: colors.slice(0, leaveTypeData.length),
        borderColor: '#fff',
        borderWidth: 2
      }]
    };

    setLeaveTypeChart(data);
  };

  const buildYoyChart = (yearOverYearData) => {
    const labels = yearOverYearData.map(y => y.year).reverse();
    const daysData = yearOverYearData.map(y => y.total_days).reverse();

    const data = {
      labels,
      datasets: [{
        label: 'Days Used',
        data: daysData,
        borderColor: '#667eea',
        backgroundColor: 'rgba(102, 126, 234, 0.1)',
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#667eea',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 6
      }]
    };

    setYoyChart(data);
  };

  const formatTrendMessage = () => {
    if (!yearStats || !teamStats) return '';
    
    const userDays = yearStats.total_approved_days || 0;
    const avgDays = teamStats.teamAverage || 0;
    
    if (userDays > avgDays) {
      return `You've taken ${Math.round(userDays - avgDays)} more days than your team average`;
    } else if (userDays < avgDays) {
      return `You've taken ${Math.round(avgDays - userDays)} fewer days than your team average`;
    }
    return 'You match your team average';
  };

  if (loading) {
    return <div className="trends-container"><div className="loading">Loading analytics data...</div></div>;
  }

  return (
    <div className="trends-container">
      {error && <div className="alert alert-error">{error}</div>}

      {/* Year Selector */}
      <div className="year-selector">
        <label htmlFor="year-select">Select Year:</label>
        <select
          id="year-select"
          value={year}
          onChange={(e) => setYear(parseInt(e.target.value))}
          className="year-select"
        >
          {availableYears.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* Key Metrics Cards */}
      <div className="metrics-grid">
        {/* Total Days Card */}
        <div className="metric-card metric-card-primary">
          <div className="metric-content">
            <h3>Total Days Used</h3>
            <div className="metric-value">{yearStats?.total_approved_days || 0}</div>
            <p className="metric-label">Approved leave in {year}</p>
          </div>
        </div>

        {/* Applications Card */}
        <div className="metric-card metric-card-info">
          <div className="metric-content">
            <h3>Applications</h3>
            <div className="metric-value">{yearStats?.approved || 0}</div>
            <p className="metric-label">Approved applications</p>
          </div>
        </div>

        {/* Longest Leave Card */}
        {longestLeave && (
          <div className="metric-card metric-card-success">

            <div className="metric-content">
              <h3>Longest Leave</h3>
              <div className="metric-value">{longestLeave.number_of_days} days</div>
              <p className="metric-label">{longestLeave.leave_type} in {new Date(longestLeave.start_date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}</p>
            </div>
          </div>
        )}

        {/* Team Comparison Card */}
        {teamStats && (
          <div className="metric-card metric-card-warning">
            <div className="metric-content">
              <h3>Team Comparison</h3>
              <div className="metric-value">{teamStats.teamAverage.toFixed(1)}</div>
              <p className="metric-label">Team average: {teamStats.comparison}</p>
            </div>
          </div>
        )}
      </div>

      {/* Charts Section */}
      <div className="charts-grid">
        {/* Monthly Usage Chart */}
        {monthlyChart && (
          <div className="chart-card">
            <div className="chart-header">
              <h3>Monthly Leave Usage</h3>
              <p>Days used and applications submitted each month</p>
            </div>
            <div className="chart-wrapper">
              <Bar
                data={monthlyChart}
                options={{
                  responsive: true,
                  interaction: {
                    mode: 'index',
                    intersect: false,
                  },
                  plugins: {
                    legend: {
                      position: 'top',
                    }
                  },
                  scales: {
                    y: {
                      type: 'linear',
                      display: true,
                      position: 'left',
                      beginAtZero: true,
                      title: {
                        display: true,
                        text: 'Days'
                      }
                    },
                    y1: {
                      type: 'linear',
                      display: true,
                      position: 'right',
                      beginAtZero: true,
                      title: {
                        display: true,
                        text: 'Count'
                      },
                      grid: {
                        drawOnChartArea: false,
                      }
                    }
                  }
                }}
              />
            </div>
          </div>
        )}

        {/* Leave Type Breakdown */}
        {leaveTypeChart && (
          <div className="chart-card">
            <div className="chart-header">
              <h3>Leave Type Breakdown</h3>
              <p>Distribution of leave days by type</p>
            </div>
            <div className="chart-wrapper doughnut-wrapper">
              <Doughnut
                data={leaveTypeChart}
                options={{
                  responsive: true,
                  plugins: {
                    legend: {
                      position: 'bottom',
                    }
                  }
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Year-over-Year Comparison */}
      {yoyChart && (
        <div className="chart-card full-width">
          <div className="chart-header">
            <h3>Year-over-Year Comparison</h3>
            <p>Leave days used across multiple years</p>
          </div>
          <div className="chart-wrapper" style={{ height: '300px' }}>
            <Line
              data={yoyChart}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'top',
                  }
                },
                scales: {
                  y: {
                    beginAtZero: true
                  }
                }
              }}
            />
          </div>
        </div>
      )}

      {/* Carry-over & Expiry Information */}
      {carryoverData && (
        <div className="info-cards-grid">
          <div className="info-card">
            <div className="info-content">
              <h3>Days Carried Over</h3>
              <div className="info-value">{carryoverData.totalCarriedOver}</div>
              <p>From previous year</p>
              {carryoverData.carriedFromLastYear.length > 0 && (
                <ul className="info-list">
                  {carryoverData.carriedFromLastYear.map((item, idx) => (
                    <li key={idx}>
                      <span>{item.leave_type}</span>
                      <span className="info-number">{item.carried_over_days} days</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="info-card">
            <div className="info-content">
              <h3>Days Expiring Soon</h3>
              <div className="info-value">{carryoverData.totalExpiringSoon}</div>
              <p>In current year</p>
              {carryoverData.currentYearBalance.length > 0 && (
                <ul className="info-list">
                  {carryoverData.currentYearBalance.map((item, idx) => (
                    <li key={idx} className={item.status === 'Expired' ? 'expired' : ''}>
                      <span>{item.leave_type}</span>
                      <span className="info-number">{item.remaining_days} days</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Status Summary */}
      {yearStats && (
        <div className="summary-card">
          <h3>{year} Summary</h3>
          <div className="summary-grid">
            <div className="summary-item">
              <span>Total Applications</span>
              <strong>{yearStats.total}</strong>
            </div>
            <div className="summary-item status-approved">
              <span>Approved</span>
              <strong>{yearStats.approved}</strong>
            </div>
            <div className="summary-item status-pending">
              <span>Pending</span>
              <strong>{yearStats.pending}</strong>
            </div>
            <div className="summary-item status-rejected">
              <span>Rejected</span>
              <strong>{yearStats.rejected}</strong>
            </div>
            {yearStats.cancelled > 0 && (
              <div className="summary-item status-cancelled">
                <span>Cancelled</span>
                <strong>{yearStats.cancelled}</strong>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default TrendsPage;
