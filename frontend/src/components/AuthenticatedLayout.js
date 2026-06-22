import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import NotificationCenter from './NotificationCenter';
import ProfileDropdown from './ProfileDropdown';
import { hasRole, normalizeRole } from '../utils/roleHelper';

export const NAV_ITEMS = [
  // Role dashboards (always first)
  { label: 'Dashboard', path: '/dashboard', roles: ['employee', 'supervisor', 'director'] },
  { label: 'HR Dashboard', path: '/hr-dashboard', roles: ['hr'] },
  { label: 'Admin Dashboard', path: '/admin-dashboard', roles: ['admin'] },

  // Personal leave actions
  { label: 'Apply Leave', path: '/apply-leave', roles: ['employee', 'supervisor', 'hr', 'director'] },
  { label: 'My Applications', path: '/history', roles: ['employee', 'supervisor', 'hr', 'director'] },

  // Supervisor approval
  { label: 'Approval Queue', path: '/approval-queue', roles: ['supervisor'] },

  // Admin management
  { label: 'Account Approvals', path: '/admin/approvals', roles: ['admin'] },
  { label: 'User Management', path: '/admin/users', roles: ['hr', 'admin', 'director'] },
  { label: 'Leave Policies', path: '/admin/leave-types', roles: ['admin'] },
  { label: 'Settings', path: '/admin/settings', roles: ['admin'] },

  // Reports & analytics
  { label: 'Reports', path: '/reports', roles: ['hr', 'admin', 'director'] },
  { label: 'Analytics', path: '/analytics', roles: ['hr', 'director'] },

  // Shared pages (bottom)
  { label: 'Leave Calendar', path: '/leave-calendar', roles: ['employee', 'supervisor', 'hr', 'director', 'admin'] },
  { label: 'Public Holidays', path: '/holidays', roles: ['employee', 'supervisor', 'hr', 'director', 'admin'] },

  // Admin system pages (bottom)
  { label: 'System Activity', path: '/admin/activity-log', roles: ['admin'] },
  { label: 'System Health', path: '/admin/system-health', roles: ['admin'] },
];

function AuthenticatedLayout({
  children,
  currentUser,
  isSidebarOpen,
  onToggleSidebar,
  onLogout,
  userRole
}) {
  const location = useLocation();
  const filteredNavItems = NAV_ITEMS.filter(item => hasRole(userRole, item.roles));
  const sidebarName = [currentUser.first_name, currentUser.last_name].filter(Boolean).join(' ') || 'Account User';
  const sidebarInitials = [currentUser.first_name, currentUser.last_name]
    .filter(Boolean)
    .map(name => name.charAt(0).toUpperCase())
    .join('') || 'U';

  return (
    <>
      <header className="navbar">
        <div className="nav-container">
          <div className="brand-group">
            <div className="nav-logo-area">
              <img
                src="/busia-county-logo.png"
                alt="County Government of Busia"
                className="nav-logo"
                style={{ height: 75, width: 'auto', borderRadius: 4 }}
              />
            </div>
            <button
              type="button"
              className="sidebar-toggle"
              onClick={onToggleSidebar}
              aria-label={isSidebarOpen ? 'Hide navigation' : 'Show navigation'}
              aria-expanded={isSidebarOpen}
              aria-controls="system-sidebar"
            >
              <span></span>
              <span></span>
              <span></span>
            </button>
            <h1 className="nav-title">Busia County Leave Management System</h1>
          </div>

          <div className="nav-actions">
            <NotificationCenter />
            <span className="nav-action-divider" aria-hidden="true"></span>
            <ProfileDropdown onLogout={onLogout} />
          </div>
        </div>
      </header>

      <div className="app-body">
        {/* Mobile backdrop overlay when sidebar is open */}
        {isSidebarOpen && (
          <div className="sidebar-backdrop" onClick={onToggleSidebar}></div>
        )}

        <aside className={`sidebar ${isSidebarOpen ? '' : 'collapsed'}`} id="system-sidebar">
          <div className="sidebar-user-card">
            <div className="sidebar-user-avatar">
              {currentUser.profile_image ? (
                <img src={currentUser.profile_image} alt="" />
              ) : (
                <span>{sidebarInitials}</span>
              )}
            </div>
            <div className="sidebar-user-meta">
              <strong>{sidebarName}</strong>
              <span>{currentUser.employee_id || normalizeRole(userRole).replace(/_/g, ' ')}</span>
            </div>
          </div>
          <nav className="sidebar-nav" aria-label="System pages">
            {filteredNavItems.map(item => (
              <Link
                key={item.path}
                to={item.path}
                className={`sidebar-link ${location.pathname === item.path ? 'active' : ''}`}
                onClick={() => { if (window.innerWidth <= 768) onToggleSidebar(); }}
              >
                {item.label}
              </Link>
            ))}

          </nav>
        </aside>

        <main className="app-main">
          <div className="container">{children}</div>
        </main>
      </div>
    </>
  );
}

export default AuthenticatedLayout;
