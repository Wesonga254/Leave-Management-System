const express = require('express');
const router = express.Router();
const {
  submitLeaveApplication,
  getLeaveApplications,
  updateLeaveApplicationStatus,
  getLeaveTypes,
  getLeaveBalance,
  getLeaveApplicationById,
  updateOwnLeaveApplication,
  downloadLeaveApplication,
  cancelLeaveApplication,
  getAnalyticsTrends,
  getTeamStats,
  getCarryoverData
} = require('../controllers/leaveController');
const { authenticateToken, authorizeExactRole } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// Leave Application routes
router.post('/applications', submitLeaveApplication);
router.get('/applications', getLeaveApplications);
router.get('/applications/:id', getLeaveApplicationById);
router.get('/applications/:id/download', downloadLeaveApplication);
router.patch('/applications/:id', updateOwnLeaveApplication);
router.put('/applications/:id', authorizeExactRole('supervisor'), updateLeaveApplicationStatus);
router.delete('/applications/:id', cancelLeaveApplication);

// Leave Types routes
router.get('/types', getLeaveTypes);

// Leave Balance routes
router.get('/balance', getLeaveBalance);
router.get('/balance/carryover', getCarryoverData);

// Analytics & Trends routes
router.get('/analytics/trends', getAnalyticsTrends);
router.get('/analytics/team-stats', getTeamStats);

// Public holidays — visible to all authenticated users
router.get('/holidays', async (req, res) => {
  try {
    const { getDatabase } = require('../database');
    const db = getDatabase();
    const holidays = await db.all('SELECT id, date, name FROM public_holidays ORDER BY date ASC');
    res.json({ success: true, data: holidays });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load holidays' });
  }
});

module.exports = router;
