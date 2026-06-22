const express = require('express');
const router = express.Router();
const {
  getEmployeeLeaveHistory,
  getDepartmentLeaveReport,
  getLeaveBalanceReport,
  getPendingApprovalReport,
  getMonthlyLeaveTrends,
  getSummaryDashboard,
  getDirectorEmployees,
  getDirectorLeaveDashboard,
  exportReport
} = require('../controllers/reportController');
const { authenticateToken, authorizeDashboardRole, authorizeExactRole } = require('../middleware/auth');

// All reports require authentication

// All reports require authentication
router.use(authenticateToken);

// Employee leave history
router.get('/employee-history', getEmployeeLeaveHistory);
router.get('/employee-history/:user_id', getEmployeeLeaveHistory);

// Department leave report (HR/Manager access)
router.get('/department', authorizeDashboardRole('hr', 'admin', 'director'), getDepartmentLeaveReport);

// Leave balance report (HR/Manager access)
router.get('/balance', authorizeDashboardRole('hr', 'admin', 'director'), getLeaveBalanceReport);

// Pending approvals report (Managers/HR access)
router.get('/pending-approvals', authorizeDashboardRole('supervisor', 'hr', 'admin'), getPendingApprovalReport);

// Monthly trends report (HR/Management access)
router.get('/monthly-trends', authorizeDashboardRole('hr', 'admin', 'director'), getMonthlyLeaveTrends);

// Summary dashboard report (HR/Management access)
router.get('/summary', authorizeDashboardRole('hr', 'admin', 'director'), getSummaryDashboard);

// Director read-only department views
router.get('/director/employees', authorizeDashboardRole('director'), getDirectorEmployees);
router.get('/director/dashboard', authorizeDashboardRole('director'), getDirectorLeaveDashboard);

// Export CSV endpoints (server-side exports)
router.get('/export/:type', authorizeExactRole('hr', 'admin'), async (req, res) => {
  return exportReport(req, res);
});

module.exports = router;
