import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';

// Import pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import DashboardPage from './pages/DashboardPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import DirectorDashboardPage from './pages/DirectorDashboardPage';
import SupervisorDashboardPage from './pages/SupervisorDashboardPage';
import HRDashboardPage from './pages/HRDashboardPage';
import ApprovalQueuePage from './pages/ApprovalQueuePage';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminHolidaysPage from './pages/AdminHolidaysPage';
import AdminLeaveTypesPage from './pages/AdminLeaveTypesPage';
import AdminSettingsPage from './pages/AdminSettingsPage';
import LeaveApplicationForm from './components/LeaveApplicationForm';
import LeaveHistoryPage from './pages/LeaveHistoryPage';
import LeaveCalendarPage from './pages/LeaveCalendarPage';
import ReportsPage from './pages/ReportsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import ApprovalWorkflowPage from './pages/ApprovalWorkflowPage';
import NotificationsPage from './pages/NotificationsPage';
import SystemActivityPage from './pages/SystemActivityPage';
import AccountApprovalsPage from './pages/AccountApprovalsPage';
import SystemHealthPage from './pages/SystemHealthPage';
import UpcomingHolidaysPage from './pages/UpcomingHolidaysPage';
import { withAuth } from './components/ProtectedRoute';
import AuthenticatedLayout from './components/AuthenticatedLayout';
import { normalizeRole } from './utils/roleHelper';
import Toast from './components/Toast';

function RoleDashboard({ userRole, userId }) {
  const role = normalizeRole(userRole);

  if (role === 'admin') {
    return <AdminDashboardPage userRole={userRole} userId={userId} />;
  }

  if (role === 'supervisor') {
    return <SupervisorDashboardPage userRole={userRole} userId={userId} />;
  }

  if (role === 'director') {
    return <DirectorDashboardPage userRole={userRole} userId={userId} />;
  }

  if (role === 'hr') {
    return <HRDashboardPage userRole={userRole} userId={userId} />;
  }

  return <DashboardPage userRole={userRole} userId={userId} />;
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('token'));
  const [userRole, setUserRole] = useState(normalizeRole(localStorage.getItem('userRole') || 'employee'));
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [currentUser, setCurrentUser] = useState(JSON.parse(localStorage.getItem('user') || '{}'));

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem('token');
    if (token) {
      setIsAuthenticated(true);
      setUserRole(normalizeRole(localStorage.getItem('userRole') || 'employee'));
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

  const routes = (
    <Routes>
      {!isAuthenticated ? (
        <>
          <Route path="/login" element={<LoginPage setIsAuthenticated={setIsAuthenticated} setUserRole={setUserRole} />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ForgotPasswordPage />} />
          <Route path="*" element={<Navigate to="/login" />} />
        </>
      ) : (
        <>
          <Route path="/dashboard" element={withAuth(RoleDashboard, ['employee', 'supervisor', 'hr', 'director', 'admin'])()} />
          <Route path="/hr-dashboard" element={withAuth(HRDashboardPage, ['hr'])()} />
          <Route path="/apply-leave" element={withAuth(LeaveApplicationForm, ['employee', 'supervisor', 'hr', 'director'])()} />
          <Route path="/history" element={withAuth(LeaveHistoryPage, ['employee', 'supervisor', 'hr', 'director'])()} />
          <Route path="/notifications" element={withAuth(NotificationsPage, ['employee', 'supervisor', 'hr', 'director', 'admin'])()} />
          <Route path="/leave-calendar" element={withAuth(LeaveCalendarPage, ['employee', 'supervisor', 'hr', 'director', 'admin'])()} />
          <Route path="/approval-queue" element={withAuth(ApprovalQueuePage, ['supervisor'])()} />
          <Route path="/approvals" element={withAuth(ApprovalWorkflowPage, ['supervisor'])()} />
          <Route path="/admin-dashboard" element={withAuth(AdminDashboardPage, ['admin'])()} />
          <Route path="/admin/users" element={withAuth(AdminUsersPage, ['hr', 'admin', 'director'])()} />
          <Route path="/admin/leave-types" element={withAuth(AdminLeaveTypesPage, ['admin'])()} />
          <Route path="/admin/holidays" element={withAuth(AdminHolidaysPage, ['admin'])()} />
          <Route path="/admin/settings" element={withAuth(AdminSettingsPage, ['admin'])()} />
          <Route path="/admin/activity-log" element={withAuth(SystemActivityPage, ['admin'])()} />
          <Route path="/admin/approvals" element={withAuth(AccountApprovalsPage, ['admin'])()} />
          <Route path="/admin/system-health" element={withAuth(SystemHealthPage, ['admin'])()} />
          <Route path="/reports" element={withAuth(ReportsPage, ['hr', 'admin', 'director'])()} />
          <Route path="/analytics" element={withAuth(AnalyticsPage, ['hr', 'director'])()} />
          <Route path="/holidays" element={withAuth(UpcomingHolidaysPage, ['employee', 'supervisor', 'hr', 'director', 'admin'])()} />
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </>
      )}
    </Routes>
  );

  return (
    <div className={`App ${isAuthenticated ? 'app-authenticated' : ''}`}>
      <Toast />
      {isAuthenticated ? (
        <AuthenticatedLayout
          currentUser={currentUser}
          isSidebarOpen={isSidebarOpen}
          onLogout={handleLogout}
          onToggleSidebar={() => setIsSidebarOpen(prev => !prev)}
          userRole={userRole}
        >
          {routes}
        </AuthenticatedLayout>
      ) : (
        <main className="app-main">
          <div className="container">{routes}</div>
        </main>
      )}
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
