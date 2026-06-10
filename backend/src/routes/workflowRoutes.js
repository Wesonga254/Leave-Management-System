const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { delegateApproval, runEscalation } = require('../controllers/workflowController');

// Delegate an approval (supervisors or above)
router.post('/delegate', authenticateToken, authorizeRole('supervisor', 'hr', 'chief_officer', 'admin'), delegateApproval);

// Run escalation (admin or system job)
router.post('/escalate/run', authenticateToken, authorizeRole('admin'), runEscalation);

module.exports = router;
