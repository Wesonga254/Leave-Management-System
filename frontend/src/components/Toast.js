import React, { useState, useEffect } from 'react';
import './Toast.css';

function Toast() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handleToast = (e) => {
      const { message, type = 'success', duration = 4000 } = e.detail || {};
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { id, message, type }]);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    };

    window.addEventListener('show-toast', handleToast);
    return () => {
      window.removeEventListener('show-toast', handleToast);
    };
  }, []);

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="toast-container" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.type}`}>
          <div className="toast-content">
            <span className="toast-icon">
              {toast.type === 'success' && '✓'}
              {toast.type === 'error' && '✗'}
              {toast.type === 'info' && 'ℹ'}
              {toast.type === 'warning' && '⚠'}
            </span>
            <span className="toast-message">{toast.message}</span>
          </div>
          <button type="button" className="toast-close" onClick={() => removeToast(toast.id)}>
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

export default Toast;

export const showToast = (message, type = 'success', duration = 4000) => {
  window.dispatchEvent(
    new CustomEvent('show-toast', {
      detail: { message, type, duration }
    })
  );
};
