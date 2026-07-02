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
    const svgProps = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
    const icons = {
      submit: <svg {...svgProps}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
      check: <svg {...svgProps}><polyline points="20 6 9 17 4 12"/></svg>,
      x: <svg {...svgProps}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
      clock: <svg {...svgProps}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
      slash: <svg {...svgProps}><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>,
      edit: <svg {...svgProps}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
      bell: <svg {...svgProps}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
      user: <svg {...svgProps}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
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
                <p>Nothing here yet</p>
                <p className="empty-state-sub">Updates about leave and account activity will show up here.</p>
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
