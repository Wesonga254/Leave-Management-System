import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { notificationService } from '../services/api';
import ApplicationDetailModal from '../components/ApplicationDetailModal';
import { triggerNotificationRefresh } from '../components/NotificationCenter';
import { normalizeRole } from '../utils/roleHelper';
import './NotificationsPage.css';

function NotificationsPage() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit] = useState(12);
  const [hasMore, setHasMore] = useState(false);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [selectedAppId, setSelectedAppId] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const userRole = normalizeRole(localStorage.getItem('userRole') || 'employee');

  const fetchNotifications = useCallback(async (nextPage = 1, replace = false) => {
    try {
      setLoading(true);
      const params = { page: nextPage, limit };
      if (onlyUnread) params.unread = true;

      const response = await notificationService.getMyNotifications(params);
      const items = response.data.data || [];
      const total = response.data.meta?.total || 0;

      setNotifications(prev => replace ? items : [...prev, ...items]);
      setHasMore((nextPage * limit) < total);
      setPage(nextPage);
      setUnreadCount(response.data.meta?.unreadCount || 0);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [limit, onlyUnread]);

  useEffect(() => {
    fetchNotifications(1, true);
    const interval = setInterval(() => fetchNotifications(1, true), 5000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const markRead = async (id) => {
    try {
      await notificationService.markRead(id);
      setNotifications(prev => prev.map(item => (
        item.id === id ? { ...item, is_read: true } : item
      )));
      setUnreadCount(prev => Math.max(0, prev - 1));
      triggerNotificationRefresh();
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const markAllRead = async () => {
    try {
      const unread = notifications.filter(n => !n.is_read);
      await Promise.all(unread.map(n => notificationService.markRead(n.id)));
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
      triggerNotificationRefresh();
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  };

  const handleNotificationClick = (notification) => {
    // Mark as read automatically
    if (!notification.is_read) {
      markRead(notification.id);
    }

    if (!notification.reference_id) return;

    // Supervisors with actionable notifications go to the approval queue
    const actionableTypes = ['leave_submission', 'approval_request'];
    if (userRole === 'supervisor' && actionableTypes.includes(notification.type)) {
      navigate('/approval-queue');
      return;
    }

    // Everyone else opens the read-only detail modal
    setSelectedAppId(notification.reference_id);
    setModalVisible(true);
  };

  const isClickable = (notification) => !!notification.reference_id;

  const getNotificationIcon = (type) => {
    const svgProps = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
    const icons = {
      // Submitted / application
      submit: <svg {...svgProps}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
      // Approved
      check: <svg {...svgProps}><polyline points="20 6 9 17 4 12"/></svg>,
      // Rejected
      x: <svg {...svgProps}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
      // Pending / action needed
      clock: <svg {...svgProps}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
      // Cancelled
      slash: <svg {...svgProps}><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>,
      // Updated
      edit: <svg {...svgProps}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
      // Reminder
      bell: <svg {...svgProps}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
      // User / registration
      user: <svg {...svgProps}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
      // Key / account
      key: <svg {...svgProps}><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>,
    };
    const colorMap = {
      leave_submission: { bg: '#eff6ff', color: '#2563eb', icon: icons.submit },
      leave_submission_info: { bg: '#eff6ff', color: '#2563eb', icon: icons.submit },
      approval: { bg: '#dcfce7', color: '#16a34a', icon: icons.check },
      approval_step: { bg: '#dcfce7', color: '#16a34a', icon: icons.check },
      leave_approved_info: { bg: '#dcfce7', color: '#16a34a', icon: icons.check },
      leave_hr_notice: { bg: '#dcfce7', color: '#16a34a', icon: icons.check },
      rejection: { bg: '#fef2f2', color: '#dc2626', icon: icons.x },
      leave_rejected_info: { bg: '#fef2f2', color: '#dc2626', icon: icons.x },
      approval_request: { bg: '#fef3c7', color: '#d97706', icon: icons.clock },
      leave_cancelled: { bg: '#f1f5f9', color: '#64748b', icon: icons.slash },
      leave_update: { bg: '#eff6ff', color: '#2563eb', icon: icons.edit },
      leave_ending_reminder: { bg: '#fff7ed', color: '#ea580c', icon: icons.bell },
      new_registration: { bg: '#eff6ff', color: '#2563eb', icon: icons.user },
      registration_approved: { bg: '#dcfce7', color: '#16a34a', icon: icons.check },
      registration_rejected: { bg: '#fef2f2', color: '#dc2626', icon: icons.x },
      account_created: { bg: '#f0fdf4', color: '#16a34a', icon: icons.key },
    };
    const entry = colorMap[type] || { bg: '#f1f5f9', color: '#64748b', icon: icons.bell };
    return (
      <span className="notif-icon-circle" style={{ background: entry.bg, color: entry.color }}>
        {entry.icon}
      </span>
    );
  };

  const getNotificationTypeLabel = (type) => {
    switch (type) {
      case 'leave_submission': return 'Submitted';
      case 'leave_submission_info': return 'Application';
      case 'approval': return 'Approved';
      case 'approval_step': return 'In Progress';
      case 'leave_approved_info': return 'Approved';
      case 'leave_hr_notice': return 'HR Update';
      case 'rejection': return 'Not Approved';
      case 'leave_rejected_info': return 'Not Approved';
      case 'approval_request': return 'Action Needed';
      case 'leave_cancelled': return 'Cancelled';
      case 'leave_update': return 'Updated';
      case 'leave_ending_reminder': return 'Reminder';
      case 'new_registration': return 'New Staff';
      case 'registration_approved': return 'Approved';
      case 'registration_rejected': return 'Declined';
      case 'account_created': return 'Account';
      default: return 'Update';
    }
  };

  const getTypeClass = (type) => {
    if (['approval', 'approval_step', 'leave_approved_info', 'registration_approved'].includes(type)) return 'type-approved';
    if (['rejection', 'leave_rejected_info', 'registration_rejected'].includes(type)) return 'type-rejected';
    if (['approval_request'].includes(type)) return 'type-action';
    if (['leave_cancelled'].includes(type)) return 'type-cancelled';
    if (['leave_ending_reminder'].includes(type)) return 'type-warning';
    if (['new_registration', 'account_created'].includes(type)) return 'type-info';
    return 'type-info';
  };

  return (
    <div className="notifications-page">
      <div className="notifications-header">
        <div>
          <h1>Notifications</h1>
          <p>Stay up to date with leave activity and account updates.{unreadCount > 0 && ` ${unreadCount} unread`}</p>
        </div>
        <div className="notifications-header-actions">
          {unreadCount > 0 && (
            <button
              type="button"
              className="btn btn-primary btn-small"
              onClick={markAllRead}
            >
              ✓ Mark all as read
            </button>
          )}
          <label className="unread-toggle">
            <input
              type="checkbox"
              checked={onlyUnread}
              onChange={(event) => setOnlyUnread(event.target.checked)}
            />
            Unread only
          </label>
        </div>
      </div>

      <div className="notifications-panel-page">
        {loading && notifications.length === 0 ? (
          <div className="loading">Loading notifications...</div>
        ) : notifications.length === 0 ? (
          <div className="empty-state-notifications">
            <span className="empty-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
            </span>
            <h3>Nothing here yet</h3>
            <p>New updates about leave applications, approvals, and account activity will appear here.</p>
          </div>
        ) : (
          <div className="notifications-list-page">
            {notifications.map(notification => (
              <article
                key={notification.id}
                className={`notification-row-page ${notification.is_read ? 'read' : 'unread'} ${isClickable(notification) ? 'clickable' : ''}`}
                onClick={() => isClickable(notification) && handleNotificationClick(notification)}
                style={isClickable(notification) ? { cursor: 'pointer' } : undefined}
              >
                <span className="notification-row-icon">{getNotificationIcon(notification.type)}</span>
                <div className="notification-row-content">
                  <div className="notification-row-heading">
                    <h2>{notification.title}</h2>
                    <div className="notification-row-meta">
                      <span className={`notification-type-badge ${getTypeClass(notification.type)}`}>
                        {getNotificationTypeLabel(notification.type)}
                      </span>
                      <span className="notification-time">{new Date(notification.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                  <p>{notification.message}</p>
                  {isClickable(notification) && (
                    <span className="notification-link-hint">
                      {userRole === 'supervisor' && ['leave_submission', 'approval_request'].includes(notification.type)
                        ? 'Go to Approval Queue →'
                        : 'View details →'}
                    </span>
                  )}
                </div>
                <div className="notification-row-actions">
                  {!notification.is_read && (
                    <button
                      type="button"
                      className="btn-mark-read"
                      onClick={(e) => { e.stopPropagation(); markRead(notification.id); }}
                      title="Mark as read"
                    >
                      ✓
                    </button>
                  )}
                  {!notification.is_read && <span className="unread-indicator"></span>}
                </div>
              </article>
            ))}
          </div>
        )}

        {hasMore && (
          <div className="notifications-load-more">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => fetchNotifications(page + 1, false)}
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Load more'}
            </button>
          </div>
        )}
      </div>

      <ApplicationDetailModal
        applicationId={selectedAppId}
        visible={modalVisible}
        onClose={() => { setModalVisible(false); setSelectedAppId(null); }}
      />
    </div>
  );
}

export default NotificationsPage;
