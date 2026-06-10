const jwt = require('jsonwebtoken');
const { getDatabase } = require('../database');

const ROLE_RANK = {
  employee: 1,
  supervisor: 2,
  hr: 3,
  chief_officer: 4,
  admin: 5
};

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Authorize based on role or higher in hierarchy
const authorizeRole = (...roles) => {
  // compute minimum required rank
  const requiredRank = Math.min(...roles.map(r => ROLE_RANK[r] || 999));
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'User not authenticated' });
    }
    const userRank = ROLE_RANK[req.user.role] || 0;
    if (userRank < requiredRank) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    next();
  };
};

// Authorize that the current user is the approver for a given applicationId
const authorizeApprover = () => {
  return async (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'User not authenticated' });
    const db = getDatabase();
    const applicationId = req.params.applicationId || req.params.id || req.body.applicationId || req.body.id;
    if (!applicationId) return res.status(400).json({ message: 'Application id required' });

    try {
      const aw = await db.get(
        `SELECT * FROM approval_workflow WHERE leave_application_id = ? AND status = 'pending' LIMIT 1`,
        [applicationId]
      );
      if (!aw) return res.status(404).json({ message: 'No pending approval for this application' });

      // allow if user is approver or delegated_to or has higher role
      if (aw.approver_id === req.user.id || aw.delegated_to === req.user.id) return next();

      const userRank = ROLE_RANK[req.user.role] || 0;
      const requiredRank = ROLE_RANK[aw.approval_level] || 0;
      if (userRank >= requiredRank) return next();

      return res.status(403).json({ message: 'Not authorized to act on this approval' });
    } catch (err) {
      return res.status(500).json({ message: 'Authorization check failed', error: err.message });
    }
  };
};

module.exports = {
  authenticateToken,
  authorizeRole,
  authorizeApprover
};
