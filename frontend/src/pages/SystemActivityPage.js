import React, { useState, useEffect, useCallback } from 'react';
import { adminService } from '../services/api';
import './DashboardPage.css';
import './SystemActivityPage.css';

const CATEGORY_LABELS = {
  auth: 'Authentication',
  leave: 'Leave Management',
  user: 'User Management',
  system: 'System',
  settings: 'Settings',
  general: 'General'
};

const CATEGORY_COLORS = {
  auth: '#2563eb',
  leave: '#1B7340',
  user: '#7c3aed',
  system: '#ca8a04',
  settings: '#db2777',
  general: '#64748b'
};

function formatDate(dateStr) {
  if (!dateStr) return '—';
  // SQLite CURRENT_TIMESTAMP returns UTC without 'Z' suffix.
  // Append 'Z' if no timezone indicator exists so JS parses it as UTC.
  let normalized = dateStr;
  if (!dateStr.endsWith('Z') && !dateStr.includes('+') && !dateStr.includes('T')) {
    normalized = dateStr.replace(' ', 'T') + 'Z';
  }
  const d = new Date(normalized);
  if (isNaN(d.getTime())) return dateStr;
  const now = new Date();
  const diff = now - d;

  // Within last minute
  if (diff < 60000 && diff >= 0) return 'Just now';
  // Within last hour
  if (diff < 3600000 && diff >= 0) return `${Math.floor(diff / 60000)}m ago`;
  // Within today
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  // Yesterday
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) {
    return 'Yesterday ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  // Older
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function SystemActivityPage() {
  const [activities, setActivities] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [clearing, setClearing] = useState(false);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const fetchActivities = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const params = {
        page: currentPage,
        limit: 50
      };
      if (selectedCategory) params.category = selectedCategory;
      if (searchQuery) params.search = searchQuery;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;

      const response = await adminService.getActivityLog(params);
      setActivities(response.data.data || []);
      setCategories(response.data.categories || []);
      setPagination(response.data.pagination || { page: 1, totalPages: 1, total: 0 });
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load activity log');
    } finally {
      setLoading(false);
    }
  }, [currentPage, selectedCategory, searchQuery, dateFrom, dateTo]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(fetchActivities, 10000);
    return () => clearInterval(interval);
  }, [fetchActivities]);

  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  const handleCategoryChange = (e) => {
    setSelectedCategory(e.target.value);
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setSelectedCategory('');
    setSearchQuery('');
    setDateFrom('');
    setDateTo('');
    setCurrentPage(1);
  };

  const hasActiveFilters = selectedCategory || searchQuery || dateFrom || dateTo;

  const handleClearLog = async () => {
    if (!window.confirm('Are you sure you want to permanently delete ALL activity log entries? This action cannot be undone.')) return;
    try {
      setClearing(true);
      await adminService.clearActivityLog();
      setActivities([]);
      setPagination({ page: 1, totalPages: 1, total: 0 });
      setCurrentPage(1);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to clear activity log');
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="dashboard-container admin-dashboard">
      <div className="dashboard-header admin-hero">
        <div className="header-content">
          <span className="dashboard-kicker">Audit Trail</span>
          <h1>System Activity</h1>
          <p className="header-subtitle">
            Complete log of all system actions — logins, leave applications, approvals, user changes, and configuration updates.
          </p>
        </div>
        <div className="admin-hero-summary">
          <span className="summary-label">Total Events</span>
          <strong>{pagination.total}</strong>
        </div>
      </div>



      {error && <div className="alert alert-error">{error}</div>}

      {/* Filters */}
      <div className="activity-filters">
        <div className="activity-filter-row">
          <input
            type="text"
            className="activity-search"
            placeholder="Search actions, users, details..."
            value={searchQuery}
            onChange={handleSearch}
            id="activity-search"
          />
          <select
            className="activity-category-select"
            value={selectedCategory}
            onChange={handleCategoryChange}
            id="activity-category"
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>
                {CATEGORY_LABELS[cat] || cat}
              </option>
            ))}
          </select>
          <input
            type="date"
            className="activity-date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }}
            id="activity-date-from"
          />
          <button
            type="button"
            className="btn btn-danger"
            onClick={handleClearLog}
            disabled={clearing || pagination.total === 0}
            style={{ padding: '8px 16px', fontSize: 13, borderRadius: 8, whiteSpace: 'nowrap' }}
            id="clear-activity-log-btn"
          >
            {clearing ? 'Clearing...' : 'Clear Log'}
          </button>
          {hasActiveFilters && (
            <button
              type="button"
              className="activity-clear-btn"
              onClick={handleClearFilters}
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Activity Table */}
      <div className="activity-table-wrapper">
        {loading && activities.length === 0 ? (
          <div className="loading">Loading activity log...</div>
        ) : activities.length === 0 ? (
          <div className="activity-empty">
            <p>No activity found{hasActiveFilters ? ' matching your filters' : ''}.</p>
          </div>
        ) : (
          <table className="table activity-table" id="activity-log-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>User</th>
                <th>Action</th>
                <th>Category</th>
                <th>Details</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {activities.map(row => (
                <tr key={row.id}>
                  <td className="activity-time">
                    <span className="activity-time-relative">{formatDate(row.created_at)}</span>
                  </td>
                  <td className="activity-user">
                    <span className="activity-user-name">{row.user_name || 'System'}</span>
                    {row.user_role && (
                      <span className="activity-user-role">{row.user_role}</span>
                    )}
                  </td>
                  <td className="activity-action">{row.action}</td>
                  <td>
                    <span
                      className="activity-category-badge"
                      style={{
                        background: `${CATEGORY_COLORS[row.category] || '#64748b'}14`,
                        color: CATEGORY_COLORS[row.category] || '#64748b',
                        borderColor: `${CATEGORY_COLORS[row.category] || '#64748b'}30`
                      }}
                    >
                      {CATEGORY_LABELS[row.category] || row.category}
                    </span>
                  </td>
                  <td className="activity-details">
                    {row.details ? (
                      <DetailsCell details={row.details} />
                    ) : (
                      <span className="activity-no-details">—</span>
                    )}
                  </td>
                  <td className="activity-ip">{row.ip_address || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="activity-pagination">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage(p => p - 1)}
            className="activity-page-btn"
          >
            Previous
          </button>
          <span className="activity-page-info">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            type="button"
            disabled={currentPage >= pagination.totalPages}
            onClick={() => setCurrentPage(p => p + 1)}
            className="activity-page-btn"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

function DetailsCell({ details }) {
  const [expanded, setExpanded] = useState(false);

  let parsed = details;
  try {
    parsed = JSON.parse(details);
  } catch {
    // plain text, keep as is
  }

  if (typeof parsed === 'object' && parsed !== null) {
    const keys = Object.keys(parsed).filter(k => parsed[k] !== undefined && parsed[k] !== null && parsed[k] !== '');
    if (keys.length === 0) return <span className="activity-no-details">—</span>;

    const displayKeys = expanded ? keys : keys.slice(0, 3);
    return (
      <span className="activity-details-json">
        {displayKeys.map(k => (
          <span key={k} className="activity-detail-pair">
            <span className="activity-detail-key">{k}:</span> {String(parsed[k]).slice(0, 60)}
          </span>
        ))}
        {keys.length > 3 && (
          <button type="button" className="activity-details-toggle" onClick={() => setExpanded(!expanded)}>
            {expanded ? 'Less' : `+${keys.length - 3} more`}
          </button>
        )}
      </span>
    );
  }

  const text = String(parsed);
  if (text.length > 80) {
    return (
      <span className="activity-details-text">
        {expanded ? text : text.slice(0, 80) + '...'}
        <button type="button" className="activity-details-toggle" onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Less' : 'More'}
        </button>
      </span>
    );
  }

  return <span className="activity-details-text">{text}</span>;
}

export default SystemActivityPage;
