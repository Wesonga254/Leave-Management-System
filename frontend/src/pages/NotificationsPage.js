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
    switch (type) {
      case 'leave_submission':
      case 'leave_submission_info':
        return '📝';
      case 'approval':
      case 'approval_step':
      case 'leave_approved_info':
      case 'leave_hr_notice':
        return '✅';
      case 'rejection':
      case 'leave_rejected_info':
        return '❌';
      case 'approval_request':
        return '⏳';
      case 'leave_cancelled':
        return '🚫';
      case 'leave_update':
        return '📋';
      case 'leave_ending_reminder':
        return '⏰';
      default:
        return '🔔';
    }
  };

  const getNotificationTypeLabel = (type) => {
    switch (type) {
      case 'leave_submission': return 'Submitted';
      case 'leave_submission_info': return 'New Application';
      case 'approval': return 'Approved';
      case 'approval_step': return 'Step Approved';
      case 'leave_approved_info': return 'Approved';
      case 'leave_hr_notice': return 'HR Notice';
      case 'rejection': return 'Rejected';
      case 'leave_rejected_info': return 'Rejected';
      case 'approval_request': return 'Action Required';
      case 'leave_cancelled': return 'Cancelled';
      case 'leave_update': return 'Updated';
      case 'leave_ending_reminder': return 'Reminder';
      default: return 'Notification';
    }
  };

  const getTypeClass = (type) => {
    if (['approval', 'approval_step', 'leave_approved_info'].includes(type)) return 'type-approved';
    if (['rejection', 'leave_rejected_info'].includes(type)) return 'type-rejected';
    if (['approval_request'].includes(type)) return 'type-action';
    if (['leave_cancelled'].includes(type)) return 'type-cancelled';
    if (['leave_ending_reminder'].includes(type)) return 'type-warning';
    return 'type-info';
  };

  return (
    <div className="notifications-page">
      <div className="notifications-header">
        <div>
          <h1>Notifications</h1>
          <p>Review leave updates and application messages.{unreadCount > 0 && ` (${unreadCount} unread)`}</p>
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
            <span className="empty-icon">🔔</span>
            <h3>No notifications found</h3>
            <p>You'll receive notifications here when leave applications are submitted, approved, or rejected.</p>
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
                        ? 'Click to review in Approval Queue →'
                        : 'Click to view application details →'}
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
