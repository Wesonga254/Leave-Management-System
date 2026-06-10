import React, { useEffect, useState } from 'react';
import { notificationService } from '../services/api';
import './NotificationsPage.css';

function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit] = useState(12);
  const [hasMore, setHasMore] = useState(false);
  const [onlyUnread, setOnlyUnread] = useState(false);

  useEffect(() => {
    fetchNotifications(1, true);
    const interval = setInterval(() => fetchNotifications(1, true), 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlyUnread]);

  const fetchNotifications = async (nextPage = 1, replace = false) => {
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
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const markRead = async (id) => {
    try {
      await notificationService.markRead(id);
      setNotifications(prev => prev.map(item => (
        item.id === id ? { ...item, is_read: true } : item
      )));
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  return (
    <div className="notifications-page">
      <div className="notifications-header">
        <div>
          <h1>Notifications</h1>
          <p>Review leave updates and application messages.</p>
        </div>
        <label className="unread-toggle">
          <input
            type="checkbox"
            checked={onlyUnread}
            onChange={(event) => setOnlyUnread(event.target.checked)}
          />
          Unread only
        </label>
      </div>

      <div className="notifications-panel-page">
        {loading && notifications.length === 0 ? (
          <div className="loading">Loading notifications...</div>
        ) : notifications.length === 0 ? (
          <div className="empty-state">No notifications found</div>
        ) : (
          <div className="notifications-list-page">
            {notifications.map(notification => (
              <article
                key={notification.id}
                className={`notification-row-page ${notification.is_read ? 'read' : 'unread'}`}
              >
                <div className="notification-row-content">
                  <div className="notification-row-heading">
                    <h2>{notification.title}</h2>
                    <span>{new Date(notification.created_at).toLocaleString()}</span>
                  </div>
                  <p>{notification.message}</p>
                </div>
                {!notification.is_read && (
                  <button
                    type="button"
                    className="btn btn-primary btn-small"
                    onClick={() => markRead(notification.id)}
                  >
                    Mark read
                  </button>
                )}
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
    </div>
  );
}

export default NotificationsPage;
