/**
 * Role-based redirect helper after login
 * @param {string} role - User role
 * @returns {string} - Path to redirect to
 */
export const getRoleBasedRedirect = (role) => {
  const roleRedirects = {
    admin: '/admin-dashboard',
    supervisor: '/approval-queue',
    hr: '/dashboard',
    chief_officer: '/dashboard',
    employee: '/dashboard'
  };

  return roleRedirects[role] || '/dashboard';
};

/**
 * Check if user has required role(s)
 * @param {string} userRole - User's current role
 * @param {string|string[]} requiredRoles - Role(s) required
 * @returns {boolean}
 */
export const hasRole = (userRole, requiredRoles) => {
  if (!userRole) return false;
  if (Array.isArray(requiredRoles)) {
    return requiredRoles.includes(userRole);
  }
  return userRole === requiredRoles;
};

/**
 * Get human-readable role name
 * @param {string} role - Role key
 * @returns {string}
 */
export const getRoleName = (role) => {
  const roleNames = {
    admin: 'Administrator',
    supervisor: 'Supervisor',
    hr: 'HR Manager',
    chief_officer: 'Chief Officer',
    employee: 'Employee'
  };
  return roleNames[role] || role;
};

/**
 * Get role icon
 * @param {string} role - Role key
 * @returns {string}
 */
export const getRoleIcon = (role) => {
  // Icons removed to avoid AI-like appearance
  return '';
};

export default {
  getRoleBasedRedirect,
  hasRole,
  getRoleName,
  getRoleIcon
};
