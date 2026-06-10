const express = require('express');
const router = express.Router();
const {
  getEmployeeLeaveHistory,
  getDepartmentLeaveReport,
  getLeaveBalanceReport,
  getPendingApprovalReport,
  getMonthlyLeaveTrends,
  getSummaryDashboard,
  exportReport
} = require('../controllers/reportController');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// All reports require authentication
router.use(authenticateToken);

// Employee leave history
router.get('/employee-history', getEmployeeLeaveHistory);
router.get('/employee-history/:user_id', getEmployeeLeaveHistory);

// Department leave report (HR/Manager access)
router.get('/department', authorizeRole('hr', 'manager', 'admin'), getDepartmentLeaveReport);

// Leave balance report (HR/Manager access)
router.get('/balance', authorizeRole('hr', 'manager', 'admin'), getLeaveBalanceReport);

// Pending approvals report (Managers/HR access)
router.get('/pending-approvals', authorizeRole('supervisor', 'manager', 'hr', 'admin'), getPendingApprovalReport);

// Monthly trends report (HR/Management access)
router.get('/monthly-trends', authorizeRole('hr', 'manager', 'admin'), getMonthlyLeaveTrends);

// Summary dashboard report (HR/Management access)
router.get('/summary', authorizeRole('hr', 'manager', 'admin'), getSummaryDashboard);

// Export CSV endpoints (server-side exports)
router.get('/export/:type', authorizeRole('hr', 'manager', 'admin'), async (req, res) => {
  return exportReport(req, res);
});

module.exports = router;
