import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { notificationService } from '../services/api';
import { showToast } from './Toast';
import './NotificationCenter.css';

// Custom event name used to trigger a notification refresh from anywhere in the app
export const NOTIFICATION_REFRESH_EVENT = 'refresh-notifications';

/**
 * Dispatch this from any component after a leave action (submit, approve, reject, cancel, etc.)
 * to make the bell badge update immediately instead of waiting for the next poll.
 */
export const triggerNotificationRefresh = () => {
  window.dispatchEvent(new CustomEvent(NOTIFICATION_REFRESH_EVENT));
};

function NotificationCenter() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [hasMore, setHasMore] = useState(false);
  const notificationRef = useRef(null);
  const previousUnreadRef = useRef(0);

  const fetchNotifications = useCallback(async (p = 1, replace = false) => {
    try {
      setLoading(true);
      const params = { page: p, limit };
      const response = await notificationService.getMyNotifications(params);
      const notifs = response.data.data || [];
      if (replace) setNotifications(notifs); else setNotifications(prev => [...prev, ...notifs]);

      const newUnread = response.data.meta?.unreadCount || 0;

      // Show a toast when new notifications arrive (only after first load)
      if (previousUnreadRef.current !== null && newUnread > previousUnreadRef.current && previousUnreadRef.current >= 0) {
        const diff = newUnread - previousUnreadRef.current;
        if (diff > 0 && previousUnreadRef.current > 0) {
          showToast(`You have ${diff} new notification${diff > 1 ? 's' : ''}`, 'info', 4000);
        }
      }
      previousUnreadRef.current = newUnread;

      setUnreadCount(newUnread);
      setHasMore((p * limit) < (response.data.meta?.total || 0));
      setPage(p);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchNotifications(1, true);
    const interval = setInterval(() => fetchNotifications(1, true), 5000);

    // Listen for manual refresh triggers from other components
    const handleRefreshEvent = () => fetchNotifications(1, true);
    window.addEventListener(NOTIFICATION_REFRESH_EVENT, handleRefreshEvent);

    return () => {
      clearInterval(interval);
      window.removeEventListener(NOTIFICATION_REFRESH_EVENT, handleRefreshEvent);
    };
  }, [fetchNotifications]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const toggleNotifications = () => {
    const nextState = !showNotifications;
    setShowNotifications(nextState);
    if (nextState) fetchNotifications(1, true);
  };

  const handleMarkRead = async (id) => {
    try {
      await notificationService.markRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const unread = notifications.filter(n => !n.is_read);
      await Promise.all(unread.map(n => notificationService.markRead(n.id)));
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  };

  const handleViewAll = () => {
    setShowNotifications(false);
    navigate('/notifications');
  };

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

  return (
    <div className="notification-center" ref={notificationRef}>
      <button 
        className={`notification-bell ${unreadCount > 0 ? 'has-unread' : ''}`}
        onClick={toggleNotifications}
        title={unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'Notifications'}
      >
        <svg className={`bell-icon ${unreadCount > 0 ? 'bell-animate' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
        {unreadCount > 0 && (
          <span className="badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {showNotifications && (
        <div className="notification-panel">
          <div className="notification-header">
            <h3>Notifications</h3>
            <div className="notification-header-actions">
              {unreadCount > 0 && (
                <button
                  className="mark-all-read-btn"
                  onClick={handleMarkAllRead}
                  title="Mark all as read"
                >
                  ✓ All
                </button>
              )}
              <button 
                className="close-btn"
                onClick={() => setShowNotifications(false)}
                aria-label="Close notifications"
                title="Close notifications"
              >
                ×
              </button>
            </div>
          </div>

          <div className="notification-content">
            {loading && notifications.length === 0 ? (
              <div className="loading">Loading notifications...</div>
            ) : notifications.length === 0 ? (
              <div className="empty-state">
                <p>No notifications yet</p>
                <p className="empty-state-sub">You'll see updates here when leave applications are submitted, approved, or rejected.</p>
              </div>
            ) : (
              <div className="notification-list">
                {notifications.map(n => (
                  <div
                    key={n.id}
                    className={`notification-item ${n.is_read ? 'read' : 'unread'}`}
                    onClick={() => {
                      if (!n.is_read) handleMarkRead(n.id);
                    }}
                  >
                    <span className="notification-icon">{getNotificationIcon(n.type)}</span>
                    <div className="notification-details">
                      <h4>{n.title}</h4>
                      <p className="message">{n.message}</p>
                      <p className="date-info">{new Date(n.created_at).toLocaleString()}</p>
                    </div>
                    {!n.is_read && <span className="unread-dot"></span>}
                  </div>
                ))}
              </div>
            )}
            {hasMore && (
              <div style={{ padding: 8, textAlign: 'center' }}>
                <button className="btn btn-secondary btn-small" onClick={() => fetchNotifications(page + 1, false)} disabled={loading}>Load more</button>
              </div>
            )}
          </div>

          <div className="notification-footer">
            <button className="view-all-btn" onClick={handleViewAll}>
              View All Notifications →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationCenter;
