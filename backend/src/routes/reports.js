const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// All report routes require authentication
router.use(authenticateToken);

// Employee Leave History - accessible to HR, manager, and the employee themselves
router.get('/employee-leave-history', reportController.getEmployeeLeaveHistory);

// Department Leave Report - HR and above
router.get('/department-report', authorizeRole('hr', 'chief_officer'), reportController.getDepartmentLeaveReport);

// Leave Balance Report - HR and above
router.get('/leave-balance', authorizeRole('hr', 'chief_officer'), reportController.getLeaveBalanceReport);

// Pending Approval Report - Managers and above
router.get('/pending-approvals', authorizeRole('manager', 'hr', 'chief_officer'), reportController.getPendingApprovalReport);

// Monthly Leave Trends - HR and above
router.get('/monthly-trends', authorizeRole('hr', 'chief_officer'), reportController.getMonthlyLeaveTrends);

// Summary Dashboard - HR and above
router.get('/summary-dashboard', authorizeRole('hr', 'chief_officer'), reportController.getSummaryDashboard);

module.exports = router;
