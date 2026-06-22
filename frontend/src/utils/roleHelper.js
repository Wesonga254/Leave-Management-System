/**
 * Role-based redirect helper after login
 * @param {string} role - User role
 * @returns {string} - Path to redirect to
 */
export const getRoleBasedRedirect = (role) => {
  const roleRedirects = {
    admin: '/admin-dashboard',
    supervisor: '/dashboard',
    hr: '/hr-dashboard',
    director: '/dashboard',
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
  const normalizedRole = normalizeRole(userRole);
  if (!normalizedRole) return false;
  const normalizedRequired = Array.isArray(requiredRoles)
    ? requiredRoles.map(normalizeRole)
    : normalizeRole(requiredRoles);
  if (Array.isArray(requiredRoles)) {
    return normalizedRequired.includes(normalizedRole);
  }
  return normalizedRole === normalizedRequired;
};

export const normalizeRole = (role) => {
  const value = String(role || '').trim().toLowerCase();
  if (value === 'hr_manager' || value === 'hr manager' || value === 'human_resources') return 'hr';
  return value;
};

/**
 * Get human-readable role name
 * @param {string} role - Role key
 * @returns {string}
 */
export const getRoleName = (role) => {
  const normalizedRole = normalizeRole(role);
  const roleNames = {
    admin: 'Administrator',
    supervisor: 'Supervisor',
    hr: 'HR Manager',
    director: 'Director',
    employee: 'Employee'
  };
  return roleNames[normalizedRole] || role;
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
  normalizeRole,
  getRoleName,
  getRoleIcon
};
