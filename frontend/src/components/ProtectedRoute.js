import React from 'react';
import { Navigate } from 'react-router-dom';
import { hasRole } from '../utils/roleHelper';

const Forbidden = () => (
  <div className="card">
    <h2 className="card-title">Access restricted</h2>
    <p className="subtitle">You do not have permission to view this page.</p>
  </div>
);

/**
 * HOC for protected routes that requires authentication and/or specific roles
 * @param {React.Component} Component - The component to render if authorized
 * @param {string[]} allowedRoles - Array of allowed roles (optional)
 * @returns {React.Component} - Protected component
 */
export const withAuth = (Component, allowedRoles = null) => {
  return (props) => {
    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('userRole');
    const userId = localStorage.getItem('userId');

    // Check if user is authenticated
    if (!token || !userId) {
      return <Navigate to="/login" replace />;
    }

    // Check if specific roles are required
    if (allowedRoles && !hasRole(userRole, allowedRoles)) {
      return <Forbidden />;
    }

    return <Component {...props} userRole={userRole} userId={userId} />;
  };
};

/**
 * ProtectedRoute component for use in route configuration
 */
export const ProtectedRoute = ({ 
  component: Component, 
  allowedRoles = null,
  ...rest 
}) => {
  const token = localStorage.getItem('token');
  const userRole = localStorage.getItem('userRole');
  const userId = localStorage.getItem('userId');

  if (!token || !userId) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !hasRole(userRole, allowedRoles)) {
    return <Forbidden />;
  }

  return <Component {...rest} userRole={userRole} userId={userId} />;
};

export default withAuth;
