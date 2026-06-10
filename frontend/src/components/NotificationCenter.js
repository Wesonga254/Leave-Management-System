import React, { useState, useEffect, useRef } from 'react';
import { notificationService } from '../services/api';
import './NotificationCenter.css';

function NotificationCenter() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [hasMore, setHasMore] = useState(false);
  const notificationRef = useRef(null);

  useEffect(() => {
    fetchNotifications(1, true);
    const interval = setInterval(() => fetchNotifications(1, true), 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const fetchNotifications = async (p = 1, replace = false) => {
    try {
      setLoading(true);
      const params = { page: p, limit };
      const response = await notificationService.getMyNotifications(params);
      const notifs = response.data.data || [];
      if (replace) setApplications(notifs); else setApplications(prev => [...prev, ...notifs]);
      setUnreadCount(response.data.meta?.unreadCount || 0);
      setHasMore((p * limit) < (response.data.meta?.total || 0));
      setPage(p);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleNotifications = () => {
    const nextState = !showNotifications;
    setShowNotifications(nextState);
    if (nextState) fetchNotifications(1, true);
  };

  return (
    <div className="notification-center" ref={notificationRef}>
      <button 
        className="notification-bell"
        onClick={toggleNotifications}
        title="Notifications"
      >
        <svg className="bell-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
        <span className="badge">{unreadCount}</span>
      </button>

      {showNotifications && (
        <div className="notification-panel">
          <div className="notification-header">
            <h3>Your Application Status</h3>
            <button 
              className="close-btn"
              onClick={() => setShowNotifications(false)}
              aria-label="Close notifications"
              title="Close notifications"
            >
              x
            </button>
          </div>

          <div className="notification-content">
              {loading ? (
              <div className="loading">Loading notifications...</div>
            ) : applications.length === 0 ? (
              <div className="empty-state">
                <p>No leave applications yet</p>
              </div>
            ) : (
              <div className="notification-list">
                {applications.map(n => (
                  <div key={n.id} className={`notification-item ${n.is_read ? 'read' : 'unread'}`}>
                    <div className="notification-details">
                      <h4>{n.title}</h4>
                      <p className="date-info">{new Date(n.created_at).toLocaleString()}</p>
                      <p className="message">{n.message}</p>
                      <div style={{ marginTop: 6 }}>
                        {!n.is_read && <button className="btn btn-small" onClick={() => { notificationService.markRead(n.id).then(() => fetchNotifications(1, true)).catch(() => {}); }}>Mark read</button>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {hasMore && (
              <div style={{ padding: 8, textAlign: 'center' }}>
                <button className="btn btn-secondary" onClick={() => fetchNotifications(page + 1, false)} disabled={loading}>Load more</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationCenter;
