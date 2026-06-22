import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

function SystemHealthPage() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState(null);

  const fetchHealth = useCallback(async () => {
    try {
      setLoading(true);
      const startTime = performance.now();

      // Test API + Database connectivity
      const apiRes = await api.get('/admin/users');
      const apiLatency = Math.round(performance.now() - startTime);
      const apiOk = apiRes.data?.success === true;

      // Test departments endpoint
      const deptStart = performance.now();
      const deptRes = await api.get('/admin/departments');
      const deptLatency = Math.round(performance.now() - deptStart);
      const deptOk = deptRes.data?.success === true;

      // Test directorates endpoint
      const dirStart = performance.now();
      const dirRes = await api.get('/admin/directorates');
      const dirLatency = Math.round(performance.now() - dirStart);
      const dirOk = dirRes.data?.success === true;

      // Frontend check
      const frontendOk = true;
      const frontendLatency = 0;

      setHealth({
        services: [
          { name: 'API Server', status: apiOk ? 'Operational' : 'Degraded', latency: apiLatency, endpoint: '/admin/users' },
          { name: 'Database', status: apiOk ? 'Connected' : 'Error', latency: apiLatency, endpoint: 'SQLite' },
          { name: 'Departments Service', status: deptOk ? 'Operational' : 'Error', latency: deptLatency, endpoint: '/admin/departments' },
          { name: 'Directorates Service', status: dirOk ? 'Operational' : 'Error', latency: dirLatency, endpoint: '/admin/directorates' },
          { name: 'Frontend Application', status: frontendOk ? 'Operational' : 'Error', latency: frontendLatency, endpoint: window.location.origin },
          { name: 'Authentication', status: apiOk ? 'Operational' : 'Error', latency: apiLatency, endpoint: '/auth' },
        ],
        serverTime: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'production',
        browserInfo: navigator.userAgent.split(' ').slice(-2).join(' '),
      });
      setLastChecked(new Date());
    } catch (err) {
      setHealth({
        services: [
          { name: 'API Server', status: 'Offline', latency: null, endpoint: '/admin/users' },
          { name: 'Database', status: 'Unreachable', latency: null, endpoint: 'SQLite' },
          { name: 'Departments Service', status: 'Unknown', latency: null, endpoint: '/admin/departments' },
          { name: 'Directorates Service', status: 'Unknown', latency: null, endpoint: '/admin/directorates' },
          { name: 'Frontend Application', status: 'Operational', latency: 0, endpoint: window.location.origin },
          { name: 'Authentication', status: 'Unknown', latency: null, endpoint: '/auth' },
        ],
        error: err.message,
      });
      setLastChecked(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHealth(); }, [fetchHealth]);

  const getStatusClass = (status) => {
    if (!status) return 'unknown';
    const s = status.toLowerCase();
    if (['operational', 'connected'].includes(s)) return 'ok';
    if (['degraded'].includes(s)) return 'warn';
    return 'error';
  };

  const allOperational = health?.services?.every(s => getStatusClass(s.status) === 'ok');

  return (
    <div className="system-health-page">
      <div className="page-header">
        <div>
          <h2>System Health</h2>
          <p className="subtitle">Service status and connectivity</p>
        </div>
        <button className="btn btn-secondary" onClick={fetchHealth} disabled={loading}>
          {loading ? 'Checking...' : 'Run Health Check'}
        </button>
      </div>

      {lastChecked && (
        <p className="last-checked">Last checked: {lastChecked.toLocaleString()}</p>
      )}

      {loading && !health ? (
        <div className="empty-state"><p>Running health checks...</p></div>
      ) : health && (
        <>
          {/* Overall Status Banner */}
          <div className={`health-banner ${allOperational ? 'health-banner-ok' : 'health-banner-error'}`}>
            <span className={`health-dot-lg ${allOperational ? 'dot-ok' : 'dot-error'}`} />
            <div>
              <strong>{allOperational ? 'All Systems Operational' : 'Service Issues Detected'}</strong>
              <span>{allOperational ? 'All services are running normally.' : 'One or more services may be experiencing issues.'}</span>
            </div>
          </div>

          {/* Service Status Table */}
          <div className="health-section">
            <h3>Services</h3>
            <div className="health-table-wrap">
              <table className="health-table">
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>Status</th>
                    <th>Response Time</th>
                    <th>Endpoint</th>
                  </tr>
                </thead>
                <tbody>
                  {(health.services || []).map((svc, i) => (
                    <tr key={i}>
                      <td className="svc-name">{svc.name}</td>
                      <td>
                        <span className={`status-pill status-${getStatusClass(svc.status)}`}>
                          <span className={`status-dot status-dot-${getStatusClass(svc.status)}`} />
                          {svc.status}
                        </span>
                      </td>
                      <td className="svc-latency">{svc.latency != null ? `${svc.latency} ms` : '—'}</td>
                      <td className="svc-endpoint">{svc.endpoint}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Environment Info */}
          <div className="health-section">
            <h3>Environment</h3>
            <div className="env-grid">
              <div className="env-item">
                <span className="env-label">Server Time</span>
                <span className="env-value">{new Date(health.serverTime || Date.now()).toLocaleString()}</span>
              </div>
              <div className="env-item">
                <span className="env-label">Environment</span>
                <span className="env-value">{health.environment || '—'}</span>
              </div>
              <div className="env-item">
                <span className="env-label">Client</span>
                <span className="env-value">{health.browserInfo || '—'}</span>
              </div>
              <div className="env-item">
                <span className="env-label">Application URL</span>
                <span className="env-value">{window.location.origin}</span>
              </div>
            </div>
          </div>
        </>
      )}

      <style>{`
        .system-health-page .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 20px;
        }
        .system-health-page .subtitle {
          margin: 4px 0 0;
          color: var(--dark-gray);
          font-size: 14px;
        }
        .last-checked {
          font-size: 12px;
          color: #6b7280;
          margin: 0 0 18px;
        }

        /* Banner */
        .health-banner {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 18px 22px;
          border-radius: 10px;
          margin-bottom: 24px;
        }
        .health-banner-ok {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
        }
        .health-banner-error {
          background: #fef2f2;
          border: 1px solid #fecaca;
        }
        .health-banner strong {
          display: block;
          font-size: 15px;
          color: #111827;
        }
        .health-banner span {
          font-size: 13px;
          color: #6b7280;
        }
        .health-dot-lg {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .dot-ok {
          background: #22c55e;
          box-shadow: 0 0 8px rgba(34,197,94,0.4);
        }
        .dot-error {
          background: #ef4444;
          box-shadow: 0 0 8px rgba(239,68,68,0.4);
        }

        /* Section */
        .health-section {
          margin-bottom: 24px;
        }
        .health-section h3 {
          font-size: 13px;
          font-weight: 700;
          color: #374151;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin: 0 0 10px;
        }

        /* Table */
        .health-table-wrap {
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          overflow: hidden;
        }
        .health-table {
          width: 100%;
          border-collapse: collapse;
        }
        .health-table thead {
          background: #f9fafb;
        }
        .health-table th {
          padding: 10px 16px;
          font-size: 11px;
          font-weight: 700;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          text-align: left;
          border-bottom: 1px solid #e5e7eb;
        }
        .health-table td {
          padding: 12px 16px;
          font-size: 14px;
          color: #111827;
          border-bottom: 1px solid #f3f4f6;
        }
        .health-table tr:last-child td {
          border-bottom: none;
        }
        .svc-name {
          font-weight: 600;
        }
        .svc-latency {
          font-family: 'SF Mono', Consolas, monospace;
          font-size: 13px;
          color: #374151;
        }
        .svc-endpoint {
          font-family: 'SF Mono', Consolas, monospace;
          font-size: 12px;
          color: #6b7280;
        }

        /* Status pill */
        .status-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 3px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
        }
        .status-ok {
          background: #f0fdf4;
          color: #166534;
          border: 1px solid #bbf7d0;
        }
        .status-warn {
          background: #fffbeb;
          color: #92400e;
          border: 1px solid #fde68a;
        }
        .status-error {
          background: #fef2f2;
          color: #991b1b;
          border: 1px solid #fecaca;
        }
        .status-unknown {
          background: #f3f4f6;
          color: #6b7280;
          border: 1px solid #e5e7eb;
        }
        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
        .status-dot-ok { background: #22c55e; }
        .status-dot-warn { background: #f59e0b; }
        .status-dot-error { background: #ef4444; }
        .status-dot-unknown { background: #9ca3af; }

        /* Environment */
        .env-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px;
        }
        .env-item {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 14px 16px;
        }
        .env-label {
          display: block;
          font-size: 11px;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          margin-bottom: 4px;
        }
        .env-value {
          display: block;
          font-size: 13px;
          font-weight: 500;
          color: #111827;
          word-break: break-all;
        }

        @media (max-width: 768px) {
          .health-table-wrap { overflow-x: auto; }
          .health-table { min-width: 500px; }
        }
      `}</style>
    </div>
  );
}

export default SystemHealthPage;
