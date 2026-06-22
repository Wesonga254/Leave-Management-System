const express = require('express');
const { getDatabase } = require('../database');
const { body, validationResult } = require('express-validator');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

const router = express.Router();

// Submit leave application
router.post('/apply', authenticateToken, [
  body('leave_type_id').isInt().withMessage('Valid leave type is required'),
  body('start_date').isISO8601().withMessage('Valid start date is required'),
  body('end_date').isISO8601().withMessage('Valid end date is required'),
  body('number_of_days').isInt({ min: 1 }).withMessage('Number of days must be positive'),
  body('reason').optional().trim()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const db = getDatabase();
    const { leave_type_id, start_date, end_date, number_of_days, reason } = req.body;
    const userId = req.user.id;

    // Check leave balance
    const currentYear = new Date().getFullYear();
    const balance = await db.get(
      'SELECT remaining_days FROM leave_balance WHERE user_id = ? AND leave_type_id = ? AND year = ?',
      [userId, leave_type_id, currentYear]
    );

    if (!balance || balance.remaining_days < number_of_days) {
      return res.status(400).json({ message: 'Insufficient leave balance' });
    }

    // Insert leave application
    const result = await db.run(
      `INSERT INTO leave_applications (user_id, leave_type_id, start_date, end_date, number_of_days, reason, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, leave_type_id, start_date, end_date, number_of_days, reason, 'pending']
    );

    const leaveApplicationId = result.lastID;

    // Create approval workflow entry for supervisor
    const approvalLevels = ['supervisor'];
    for (const level of approvalLevels) {
      let approverId = null;

      if (level === 'supervisor') {
        // Get user's reporting officer
        const user = await db.get('SELECT reporting_officer_id FROM users WHERE id = ?', [userId]);
        approverId = user.reporting_officer_id;
      }

      if (approverId) {
        await db.run(
          'INSERT INTO approval_workflow (leave_application_id, approver_id, approval_level, status) VALUES (?, ?, ?, ?)',
          [leaveApplicationId, approverId, level, 'pending']
        );
      }
    }

    res.status(201).json({
      success: true,
      message: 'Leave application submitted successfully',
      applicationId: leaveApplicationId
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get user's leave applications
router.get('/my-applications', authenticateToken, async (req, res) => {
  try {
    const db = getDatabase();
    const userId = req.user.id;

    const applications = await db.all(
      `SELECT la.*, lt.name as leave_type
       FROM leave_applications la
       JOIN leave_types lt ON la.leave_type_id = lt.id
       WHERE la.user_id = ?
       ORDER BY la.created_at DESC`,
      [userId]
    );

    res.json({ success: true, data: applications });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get leave balance for user
router.get('/balance', authenticateToken, async (req, res) => {
  try {
    const db = getDatabase();
    const userId = req.user.id;
    const currentYear = new Date().getFullYear();

    const balances = await db.all(
      `SELECT lb.*, lt.name as leave_type
       FROM leave_balance lb
       JOIN leave_types lt ON lb.leave_type_id = lt.id
       WHERE lb.user_id = ? AND lb.year = ?`,
      [userId, currentYear]
    );

    res.json({ success: true, data: balances, year: currentYear });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
