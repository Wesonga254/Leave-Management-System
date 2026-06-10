const express = require('express');
const { getDatabase } = require('../database');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { notifyUser } = require('../utils/notifications');

const router = express.Router();

// Get approval workflow for an application
router.get('/applications/:applicationId', authenticateToken, async (req, res) => {
  try {
    const db = getDatabase();
    const { applicationId } = req.params;

    const workflow = await db.all(
      `SELECT 
        aw.*,
        u.first_name,
        u.last_name,
        u.email
       FROM approval_workflow aw
       JOIN users u ON aw.approver_id = u.id
       WHERE aw.leave_application_id = ?
      ORDER BY CASE aw.approval_level
        WHEN 'supervisor' THEN 1
        WHEN 'hr' THEN 2
        WHEN 'chief_officer' THEN 3
        ELSE 4
      END`,
      [applicationId]
    );

    res.json({
      success: true,
      data: workflow
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching approval workflow',
      error: error.message
    });
  }
});

// Get approvals assigned to current approver (pending)
router.get('/mine', authenticateToken, authorizeRole('supervisor'), async (req, res) => {
  try {
    const db = getDatabase();
    const approverId = req.user.id;

    const pending = await db.all(
      `SELECT 
        la.id as id,
        aw.id as workflow_id,
        aw.leave_application_id,
        aw.approval_level,
        aw.status as approval_status,
        aw.comments as approval_comments,
        aw.delegated_to,
        du.first_name as delegated_first_name,
        du.last_name as delegated_last_name,
        la.start_date,
        la.end_date,
        la.number_of_days,
        la.reason,
        la.status as application_status,
        la.leave_type_id,
        u.first_name,
        u.last_name,
        u.employee_id,
        lt.name as leave_type,
        aw.created_at as submitted_at
       FROM approval_workflow aw
       JOIN leave_applications la ON aw.leave_application_id = la.id
       JOIN users u ON la.user_id = u.id
       JOIN leave_types lt ON la.leave_type_id = lt.id
       LEFT JOIN users du ON aw.delegated_to = du.id
       WHERE (aw.approver_id = ? OR aw.delegated_to = ?)
         AND aw.status = 'pending'
         AND la.status = 'pending'
         AND NOT EXISTS (
          SELECT 1
          FROM approval_workflow earlier
          WHERE earlier.leave_application_id = aw.leave_application_id
            AND earlier.status = 'pending'
            AND earlier.id < aw.id
         )
       ORDER BY aw.created_at ASC`,
      [approverId, approverId]
    );

    res.json({ success: true, data: pending, count: pending.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get potential delegates (users in the same department)
router.get('/delegates', authenticateToken, authorizeRole('supervisor', 'hr', 'chief_officer', 'admin'), async (req, res) => {
  try {
    const db = getDatabase();
    // find user's department
    const user = await db.get('SELECT department FROM users WHERE id = ?', [req.user.id]);
    if (!user?.department) return res.json({ success: true, data: [] });

    const delegates = await db.all(
      `SELECT id, first_name, last_name, role, email FROM users WHERE department = ? AND id != ? ORDER BY first_name`,
      [user.department, req.user.id]
    );

    res.json({ success: true, data: delegates });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching delegates', error: err.message });
  }
});

// Update approval status
router.put('/applications/:applicationId/approve', 
  authenticateToken, 
  authorizeRole('supervisor'),
  async (req, res) => {
    try {
      const db = getDatabase();
      const { applicationId } = req.params;
      const { approval_level, status, comments } = req.body;

      if (!approval_level || !['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ message: 'Invalid approval data' });
      }

      // Get leave application details
      const leaveApp = await db.get(
        `SELECT 
          la.id, la.user_id, la.leave_type_id, la.start_date, la.end_date, la.number_of_days,
          lt.name as leave_type,
          u.email as applicant_email,
          u.phone as applicant_phone,
          u.first_name as applicant_first_name
         FROM leave_applications la
         JOIN leave_types lt ON la.leave_type_id = lt.id
         JOIN users u ON la.user_id = u.id
         WHERE la.id = ?`,
        [applicationId]
      );

      // Update approval workflow
      await db.run(
        `UPDATE approval_workflow 
         SET status = ?, comments = ?, approved_at = CURRENT_TIMESTAMP
         WHERE leave_application_id = ? AND approval_level = ?`,
        [status, comments || null, applicationId, approval_level]
      );

      // Check if all approvals are complete
      const pendingApprovals = await db.get(
        `SELECT COUNT(*) as count FROM approval_workflow 
         WHERE leave_application_id = ? AND status = 'pending'`,
        [applicationId]
      );

      let appStatus = 'pending';
      if (pendingApprovals.count === 0) {
        const rejectedApprovals = await db.get(
          `SELECT COUNT(*) as count FROM approval_workflow 
           WHERE leave_application_id = ? AND status = 'rejected'`,
          [applicationId]
        );

        appStatus = rejectedApprovals.count > 0 ? 'rejected' : 'approved';

        // Update leave application status
        await db.run(
          `UPDATE leave_applications SET status = ?, updated_at = CURRENT_TIMESTAMP 
           WHERE id = ?`,
          [appStatus, applicationId]
        );

        // If approved, update leave balance
        if (appStatus === 'approved') {
          const currentYear = new Date().getFullYear();
          await db.run(
            `UPDATE leave_balance 
             SET used_days = used_days + ?, remaining_days = remaining_days - ?, updated_at = CURRENT_TIMESTAMP
             WHERE user_id = ? AND leave_type_id = ? AND year = ?`,
            [leaveApp.number_of_days, leaveApp.number_of_days, leaveApp.user_id, leaveApp.leave_type_id, currentYear]
          );

          // Send approval notification to employee
          if (leaveApp) {
            try {
              await notifyUser({
                userId: leaveApp.user_id,
                email: leaveApp.applicant_email,
                phone: leaveApp.applicant_phone,
                type: 'approval',
                title: 'Leave Request Approved',
                message: `Your leave request (${leaveApp.leave_type}) from ${leaveApp.start_date} to ${leaveApp.end_date} has been approved.`,
                referenceId: applicationId
              });
            } catch (err) {
              console.error('Notification error:', err.message);
            }
          }
        } else if (appStatus === 'rejected') {
          // Send rejection notification to employee
          if (leaveApp) {
            try {
              await notifyUser({
                userId: leaveApp.user_id,
                email: leaveApp.applicant_email,
                phone: leaveApp.applicant_phone,
                type: 'rejection',
                title: 'Leave Request Rejected',
                message: `Your leave request (${leaveApp.leave_type}) from ${leaveApp.start_date} to ${leaveApp.end_date} has been rejected. Reason: ${comments || 'No reason provided'}`,
                referenceId: applicationId
              });
            } catch (err) {
              console.error('Notification error:', err.message);
            }
          }
        }
      }

      res.json({
        success: true,
        message: `Application ${status} successfully`,
        application_status: appStatus
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error updating approval',
        error: error.message
      });
    }
  }
);

module.exports = router;
