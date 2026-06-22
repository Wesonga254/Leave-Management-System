const { getDatabase } = require('../database');

/**
 * Log a system activity for the audit trail.
 *
 * @param {Object} options
 * @param {number|null} options.userId      - Who performed the action
 * @param {string|null} options.userName    - Display name of the user
 * @param {string|null} options.userRole    - Role at time of action
 * @param {string}      options.action      - What happened (e.g. "Approved leave application")
 * @param {string}      options.category    - Category bucket: auth | leave | user | system | settings
 * @param {string|null} options.targetType  - Entity type affected: user | leave_application | leave_type | holiday | setting
 * @param {number|null} options.targetId    - ID of the entity affected
 * @param {string|null} options.details     - Extra context (JSON string or plain text)
 * @param {string|null} options.ipAddress   - Request IP
 */
const logActivity = async ({
  userId = null,
  userName = null,
  userRole = null,
  action,
  category = 'general',
  targetType = null,
  targetId = null,
  details = null,
  ipAddress = null
}) => {
  try {
    const db = getDatabase();
    await db.run(
      `INSERT INTO activity_log (user_id, user_name, user_role, action, category, target_type, target_id, details, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, userName, userRole, action, category, targetType, targetId, details, ipAddress]
    );
  } catch (err) {
    // Never let audit logging crash the main operation
    console.error('[AuditLog] Failed to write activity:', err.message);
  }
};

/**
 * Express middleware that automatically logs key API actions.
 * Attach after authenticateToken so req.user is available.
 */
const auditMiddleware = (req, res, next) => {
  // Capture the original res.json to intercept responses
  const originalJson = res.json.bind(res);

  res.json = (body) => {
    // Only log mutating requests that succeeded
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method) && res.statusCode < 400) {
      const user = req.user || {};
      const ip = req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress;

      // Derive a human-readable action from the route
      const action = deriveAction(req);
      if (action) {
        setImmediate(() => {
          logActivity({
            userId: user.id || null,
            userName: user.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : (user.username || null),
            userRole: user.role || null,
            action,
            category: deriveCategory(req),
            targetType: deriveTargetType(req),
            targetId: req.params?.id || req.params?.applicationId || body?.data?.id || body?.userId || null,
            details: summarizeBody(req),
            ipAddress: ip
          });
        });
      }
    }

    return originalJson(body);
  };

  next();
};

function deriveAction(req) {
  const path = req.originalUrl || req.url || '';
  const method = req.method;

  // Auth
  if (path.includes('/auth/register')) return 'Registered new account';
  if (path.includes('/auth/login')) return 'Logged in';

  // Leave
  if (path.includes('/leave/apply') && method === 'POST') return 'Submitted leave application';
  if (path.includes('/leave/') && method === 'PUT' && path.includes('/cancel')) return 'Cancelled leave application';

  // Approval
  if (path.includes('/approval/') && method === 'PUT') {
    const status = req.body?.status || '';
    if (status === 'approved') return 'Approved leave application';
    if (status === 'rejected') return 'Rejected leave application';
    return 'Updated approval status';
  }

  // Admin users
  if (path.includes('/admin/users') && method === 'POST') return 'Created user account';
  if (path.includes('/admin/users') && method === 'PUT' && path.includes('/registration')) return 'Reviewed user registration';
  if (path.includes('/admin/users') && method === 'PUT') return 'Updated user profile';
  if (path.includes('/admin/users') && method === 'DELETE') return 'Deleted user account';
  if (path.includes('/admin/privileged-users')) return 'Created privileged account';

  // Leave types
  if (path.includes('/admin/leave-types') && method === 'POST') return 'Added leave type';
  if (path.includes('/admin/leave-types') && method === 'PUT') return 'Updated leave type';
  if (path.includes('/admin/leave-types') && method === 'DELETE') return 'Deleted leave type';

  // Holidays
  if (path.includes('/admin/holidays') && method === 'POST') return 'Added public holiday';
  if (path.includes('/admin/holidays') && method === 'DELETE') return 'Deleted public holiday';

  // Settings
  if (path.includes('/admin/settings') && method === 'PUT') return 'Updated system setting';

  // Carry forward
  if (path.includes('/carry-forward/run')) return 'Ran leave carry-forward';

  // Password changes
  if (path.includes('/me/password')) return 'Changed own password';
  if (path.includes('/me') && method === 'PUT') return 'Updated own profile';

  return null; // Don't log unknown actions
}

function deriveCategory(req) {
  const path = req.originalUrl || '';
  if (path.includes('/auth/')) return 'auth';
  if (path.includes('/leave/') || path.includes('/approval/')) return 'leave';
  if (path.includes('/admin/users') || path.includes('/privileged-users')) return 'user';
  if (path.includes('/admin/settings') || path.includes('/carry-forward')) return 'system';
  if (path.includes('/admin/leave-types') || path.includes('/admin/holidays')) return 'settings';
  return 'general';
}

function deriveTargetType(req) {
  const path = req.originalUrl || '';
  if (path.includes('/admin/users') || path.includes('/privileged-users')) return 'user';
  if (path.includes('/leave/') || path.includes('/approval/')) return 'leave_application';
  if (path.includes('/admin/leave-types')) return 'leave_type';
  if (path.includes('/admin/holidays')) return 'holiday';
  if (path.includes('/admin/settings')) return 'setting';
  return null;
}

function summarizeBody(req) {
  // Only include safe fields — never log passwords
  const body = { ...req.body };
  delete body.password;
  delete body.password_hash;
  delete body.confirm_password;
  delete body.current_password;
  delete body.new_password;

  const str = JSON.stringify(body);
  // Cap at 500 chars
  return str.length > 500 ? str.slice(0, 500) + '...' : str;
}

module.exports = { logActivity, auditMiddleware };
