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
  getCarryoverData,
  calculateDaysPreview
} = require('../controllers/leaveController');
const { authenticateToken, authorizeExactRole } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// Day calculation preview (must be before /applications/:id to avoid route collision)
router.get('/calculate-days', calculateDaysPreview);

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

// iCal export — download .ics file of user's approved leave
router.get('/calendar/export.ics', async (req, res) => {
  try {
    const { getDatabase } = require('../database');
    const { generateICalFeed } = require('../utils/icalGenerator');
    const db = getDatabase();
    const year = req.query.year || new Date().getFullYear();

    const applications = await db.all(`
      SELECT la.id, la.start_date, la.end_date, la.number_of_days, la.reason, la.status,
             u.first_name, u.last_name,
             lt.name as leave_type
      FROM leave_applications la
      JOIN users u ON la.user_id = u.id
      JOIN leave_types lt ON la.leave_type_id = lt.id
      WHERE la.user_id = ?
        AND la.status = 'approved'
        AND STRFTIME('%Y', la.start_date) = ?
      ORDER BY la.start_date ASC
    `, [req.user.id, year.toString()]);

    const calName = `My Leave Calendar ${year}`;
    const icsContent = generateICalFeed(applications, calName);

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="leave_calendar_${year}.ics"`);
    return res.send(icsContent);
  } catch (err) {
    console.error('[iCal] Export error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to generate calendar file' });
  }
});

module.exports = router;
