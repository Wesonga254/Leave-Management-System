import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import './App.css';

// Import pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import ApprovalQueuePage from './pages/ApprovalQueuePage';
import AdminUsersPage from './pages/AdminUsersPage';
import LeaveApplicationForm from './components/LeaveApplicationForm';
import LeaveHistoryPage from './pages/LeaveHistoryPage';
import LeaveCalendarPage from './pages/LeaveCalendarPage';
import ReportsPage from './pages/ReportsPage';
import ApprovalWorkflowPage from './pages/ApprovalWorkflowPage';
import NotificationsPage from './pages/NotificationsPage';
import NotificationCenter from './components/NotificationCenter';
import ProfileDropdown from './components/ProfileDropdown';
import { withAuth } from './components/ProtectedRoute';
import { hasRole } from './utils/roleHelper';

const NAV_ITEMS = [
  { label: 'Dashboard', path: '/dashboard', roles: ['employee', 'supervisor', 'hr', 'chief_officer', 'admin'] },
  { label: 'Apply Leave', path: '/apply-leave', roles: ['employee', 'supervisor'] },
  { label: 'My Application', path: '/history', roles: ['employee', 'supervisor'] },
  { label: 'Notifications', path: '/notifications', roles: ['employee', 'supervisor', 'hr', 'chief_officer', 'admin'] },
  { label: 'Leave Calendar', path: '/leave-calendar', roles: ['employee', 'supervisor'] },
  { label: 'Approval Queue', path: '/approval-queue', roles: ['supervisor'] },
  { label: 'Reports', path: '/reports', roles: ['hr', 'chief_officer', 'admin'] },
  { label: 'Admin', path: '/admin-dashboard', roles: ['admin'] },
  { label: 'Users', path: '/admin/users', roles: ['hr', 'admin'] }
];

function RoleDashboard({ userRole, userId }) {
  if (userRole === 'admin') {
    return <AdminDashboardPage userRole={userRole} userId={userId} />;
  }

  if (userRole === 'supervisor') {
    return <ApprovalQueuePage userRole={userRole} userId={userId} />;
  }

  return <DashboardPage userRole={userRole} userId={userId} />;
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('token'));
  const [userRole, setUserRole] = useState(localStorage.getItem('userRole') || 'employee');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [currentUser, setCurrentUser] = useState(JSON.parse(localStorage.getItem('user') || '{}'));
  const location = useLocation();

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem('token');
    if (token) {
      setIsAuthenticated(true);
      setUserRole(localStorage.getItem('userRole') || 'employee');
      setCurrentUser(JSON.parse(localStorage.getItem('user') || '{}'));
    }
  }, []);

  useEffect(() => {
    const handleProfileUpdate = () => {
      setCurrentUser(JSON.parse(localStorage.getItem('user') || '{}'));
    };

    window.addEventListener('user-profile-updated', handleProfileUpdate);
    window.addEventListener('storage', handleProfileUpdate);
    return () => {
      window.removeEventListener('user-profile-updated', handleProfileUpdate);
      window.removeEventListener('storage', handleProfileUpdate);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userId');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    setUserRole('employee');
    setCurrentUser({});
  };

  const filteredNavItems = NAV_ITEMS.filter(item => hasRole(userRole, item.roles));
  const sidebarName = [currentUser.first_name, currentUser.last_name].filter(Boolean).join(' ') || 'Account User';
  const sidebarInitials = [currentUser.first_name, currentUser.last_name]
    .filter(Boolean)
    .map(name => name.charAt(0).toUpperCase())
    .join('') || 'U';

  return (
    <div className={`App ${isAuthenticated ? 'app-authenticated' : ''}`}>
      {isAuthenticated && (
        <header className="navbar">
          <div className="nav-container">
            <div className="brand-group">
              <button
                type="button"
                className="sidebar-toggle"
                onClick={() => setIsSidebarOpen(prev => !prev)}
                aria-label={isSidebarOpen ? 'Hide navigation pages' : 'Show navigation pages'}
                aria-expanded={isSidebarOpen}
                aria-controls="system-sidebar"
              >
                <span></span>
                <span></span>
                <span></span>
              </button>
              <h1 className="nav-title">Leave Management System</h1>
            </div>

            <div className="nav-actions">
              {hasRole(userRole, ['employee', 'supervisor', 'hr', 'chief_officer', 'admin']) && <NotificationCenter />}
              <span className="nav-action-divider" aria-hidden="true"></span>
              <ProfileDropdown onLogout={handleLogout} />
            </div>
          </div>
        </header>
      )}

      <div className="app-body">
        {isAuthenticated && (
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
                <span>{currentUser.employee_id || userRole.replace(/_/g, ' ')}</span>
              </div>
            </div>
            <nav className="sidebar-nav" aria-label="System pages">
              {filteredNavItems.map(item => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`sidebar-link ${location.pathname === item.path ? 'active' : ''}`}
                >
                  {item.label}
                </Link>
              ))}
              <button type="button" className="sidebar-link sidebar-action" onClick={handleLogout}>
                Logout
              </button>
            </nav>
          </aside>
        )}

        <main className="app-main">
        <div className="container">
          <Routes>
            {!isAuthenticated ? (
              <>
                <Route path="/login" element={<LoginPage setIsAuthenticated={setIsAuthenticated} setUserRole={setUserRole} />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="*" element={<Navigate to="/login" />} />
              </>
            ) : (
              <>
                <Route path="/dashboard" element={withAuth(RoleDashboard, ['employee', 'supervisor', 'hr', 'chief_officer', 'admin'])()} />
                <Route path="/apply-leave" element={withAuth(LeaveApplicationForm, ['employee', 'supervisor'])()} />
                <Route path="/history" element={withAuth(LeaveHistoryPage, ['employee', 'supervisor'])()} />
                <Route path="/notifications" element={withAuth(NotificationsPage, ['employee', 'supervisor', 'hr', 'chief_officer', 'admin'])()} />
                <Route path="/leave-calendar" element={withAuth(LeaveCalendarPage, ['employee', 'supervisor', 'hr', 'chief_officer', 'admin'])()} />
                <Route path="/approval-queue" element={withAuth(ApprovalQueuePage, ['supervisor', 'admin'])()} />
                <Route path="/approvals" element={withAuth(ApprovalWorkflowPage, ['supervisor', 'admin'])()} />
                <Route path="/admin-dashboard" element={withAuth(AdminDashboardPage, ['admin'])()} />
                <Route path="/admin/users" element={withAuth(AdminUsersPage, ['hr', 'admin'])()} />
                <Route path="/reports" element={withAuth(ReportsPage, ['hr', 'chief_officer', 'admin'])()} />
                <Route path="*" element={<Navigate to="/dashboard" />} />
              </>
            )}
          </Routes>
        </div>
        </main>
      </div>
    </div>
  );
}

function AppWithRouter() {
  return (
    <Router>
      <App />
    </Router>
  );
}

export default AppWithRouter;
