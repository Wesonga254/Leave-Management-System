const express = require('express');
const { getDatabase } = require('../database');
const { authenticateToken, authorizeRole, authorizeExactRole } = require('../middleware/auth');
const { notifyUser } = require('../utils/notifications');
const { sendFinalApprovalEmails } = require('../controllers/leaveController');

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
       ORDER BY aw.id ASC`,
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
router.get('/mine', authenticateToken, authorizeExactRole('supervisor'), async (req, res) => {
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
        la.requested_days,
        la.approved_days,
        la.reason,
        la.status as application_status,
        la.leave_type_id,
        u.first_name,
        u.last_name,
        u.employee_id,
        lt.name as leave_type,
        lb.total_days as balance_total_days,
        lb.used_days as balance_used_days,
        lb.remaining_days as balance_remaining_days,
        aw.created_at as submitted_at
       FROM approval_workflow aw
       JOIN leave_applications la ON aw.leave_application_id = la.id
       JOIN users u ON la.user_id = u.id
       JOIN leave_types lt ON la.leave_type_id = lt.id
       LEFT JOIN leave_balance lb ON lb.user_id = la.user_id
        AND lb.leave_type_id = la.leave_type_id
        AND lb.year = CAST(STRFTIME('%Y', la.start_date) AS INTEGER)
       LEFT JOIN users du ON aw.delegated_to = du.id
       WHERE (aw.approver_id = ? OR aw.delegated_to = ?)
         AND aw.status = 'pending'
         AND la.status = 'pending'
         AND aw.approval_level = 'supervisor'
       ORDER BY aw.created_at ASC`,
      [approverId, approverId]
    );

    res.json({ success: true, data: pending, count: pending.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get potential delegates (users in the same department)
router.get('/delegates', authenticateToken, authorizeExactRole('supervisor'), async (req, res) => {
  try {
    const db = getDatabase();
    // find user's department
    const user = await db.get('SELECT department FROM users WHERE id = ?', [req.user.id]);
    if (!user?.department) return res.json({ success: true, data: [] });

    const delegates = await db.all(
      `SELECT id, first_name, last_name, role, email
       FROM users
       WHERE department = ? AND role = 'supervisor' AND id != ?
       ORDER BY first_name`,
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
  authorizeExactRole('supervisor'),
  async (req, res) => {
    try {
      const db = getDatabase();
      const { applicationId } = req.params;
      const { status, comments, approved_days } = req.body;

      if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ message: 'Invalid approval data' });
      }

      // Get leave application details
      const leaveApp = await db.get(
        `SELECT 
          la.id, la.user_id, la.leave_type_id, la.start_date, la.end_date, la.number_of_days, la.requested_days,
          lt.name as leave_type,
          u.email as applicant_email,
          u.phone as applicant_phone,
          u.first_name as applicant_first_name,
          u.last_name as applicant_last_name,
          u.employee_id
         FROM leave_applications la
         JOIN leave_types lt ON la.leave_type_id = lt.id
         JOIN users u ON la.user_id = u.id
         WHERE la.id = ?`,
        [applicationId]
      );

      if (!leaveApp) {
        return res.status(404).json({ success: false, message: 'Leave application not found' });
      }

      const workflow = await db.get(
        `SELECT aw.*, la.status as application_status
         FROM approval_workflow aw
         JOIN leave_applications la ON aw.leave_application_id = la.id
         WHERE aw.leave_application_id = ?
           AND aw.approval_level = 'supervisor'
           AND aw.status = 'pending'
           AND aw.approver_id = ?`,
        [applicationId, req.user.id]
      );

      if (!workflow) {
        return res.status(403).json({ success: false, message: 'This approval is not pending for your account' });
      }

      if (workflow.application_status !== 'pending') {
        return res.status(400).json({ success: false, message: 'This application has already been actioned' });
      }

      const originalDays = leaveApp.requested_days || leaveApp.number_of_days;
      const adjustedDays = status === 'approved'
        ? Math.max(1, Math.min(parseInt(approved_days || leaveApp.number_of_days, 10) || leaveApp.number_of_days, leaveApp.number_of_days))
        : null;

      await db.run('BEGIN TRANSACTION');

      if (status === 'approved') {
        const balanceYear = new Date(leaveApp.start_date).getFullYear();
        const leaveBalance = await db.get(
          `SELECT remaining_days FROM leave_balance WHERE user_id = ? AND leave_type_id = ? AND year = ?`,
          [leaveApp.user_id, leaveApp.leave_type_id, balanceYear]
        );
        if (!leaveBalance || leaveBalance.remaining_days < adjustedDays) {
          await db.run('ROLLBACK');
          return res.status(400).json({
            success: false,
            message: `You do not have enough leave days. Available balance: ${leaveBalance?.remaining_days || 0} days, Requested: ${adjustedDays} days.`
          });
        }
      }

      await db.run(
        `UPDATE approval_workflow 
         SET status = ?, comments = ?, approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [status, comments || null, workflow.id]
      );

      await db.run(
        `INSERT INTO leave_approval_audit (leave_application_id, approver_id, action, original_days, adjusted_days, comments)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [applicationId, req.user.id, status, originalDays, adjustedDays, comments || null]
      );

      const appStatus = status === 'approved' ? 'approved' : 'rejected';
      await db.run(
        `UPDATE leave_applications
         SET status = ?,
             number_of_days = CASE WHEN ? = 'approved' THEN ? ELSE number_of_days END,
             approved_days = CASE WHEN ? = 'approved' THEN ? ELSE approved_days END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [appStatus, appStatus, adjustedDays, appStatus, adjustedDays, applicationId]
      );

      if (appStatus === 'approved') {
        const balanceYear = new Date(leaveApp.start_date).getFullYear();
        await db.run(
          `UPDATE leave_balance
           SET used_days = used_days + ?, remaining_days = remaining_days - ?, updated_at = CURRENT_TIMESTAMP
           WHERE user_id = ? AND leave_type_id = ? AND year = ?`,
          [adjustedDays, adjustedDays, leaveApp.user_id, leaveApp.leave_type_id, balanceYear]
        );
      }

      await db.run('COMMIT');

      if (appStatus === 'approved') {
        sendFinalApprovalEmails(db, applicationId, adjustedDays)
          .catch(err => console.error('Final approval email error:', err.message));
      }

      try {
        await notifyUser({
          userId: leaveApp.user_id,
          email: leaveApp.applicant_email,
          phone: leaveApp.applicant_phone,
          type: appStatus === 'approved' ? 'approval' : 'rejection',
          title: appStatus === 'approved' ? 'Leave Approved' : 'Leave Not Approved',
          message: appStatus === 'approved'
            ? `Your ${leaveApp.leave_type} (${leaveApp.start_date} – ${leaveApp.end_date}) has been approved.${comments ? ' Note: ' + comments : ''}`
            : `Your ${leaveApp.leave_type} (${leaveApp.start_date} – ${leaveApp.end_date}) was not approved.${comments ? ' Reason: ' + comments : ''}`,
          referenceId: applicationId
        });

        // Notify HR users
        const applicantName = [leaveApp.applicant_first_name, leaveApp.applicant_last_name].filter(Boolean).join(' ');
        const hrUsers = await db.all(`SELECT id, email, phone FROM users WHERE role = 'hr'`);
        for (const hr of hrUsers) {
          await notifyUser({
            userId: hr.id,
            email: hr.email,
            phone: hr.phone,
            type: appStatus === 'approved' ? 'leave_hr_notice' : 'leave_hr_notice',
            title: appStatus === 'approved' ? 'Leave Approved' : 'Leave Not Approved',
            message: appStatus === 'approved'
              ? `${applicantName} (${leaveApp.employee_id || 'N/A'}) — ${leaveApp.leave_type} (${leaveApp.start_date} – ${leaveApp.end_date}) approved, ${adjustedDays} day(s).${comments ? ' Note: ' + comments : ''}`
              : `${applicantName} (${leaveApp.employee_id || 'N/A'}) — ${leaveApp.leave_type} (${leaveApp.start_date} – ${leaveApp.end_date}) not approved.${comments ? ' Reason: ' + comments : ''}`,
            referenceId: applicationId
          });
        }

        // Notify the department director
        const applicantUser = await db.get('SELECT department_id FROM users WHERE id = ?', [leaveApp.user_id]);
        let directorNotified = false;
        if (applicantUser?.department_id) {
          const dept = await db.get('SELECT director_id FROM departments WHERE id = ?', [applicantUser.department_id]);
          if (dept?.director_id) {
            const director = await db.get('SELECT id, email, phone FROM users WHERE id = ?', [dept.director_id]);
            if (director) {
              directorNotified = true;
              await notifyUser({
                userId: director.id,
                email: director.email,
                phone: director.phone,
                type: appStatus === 'approved' ? 'leave_approved_info' : 'leave_rejected_info',
                title: appStatus === 'approved' ? 'Leave Approved' : 'Leave Not Approved',
                message: appStatus === 'approved'
                  ? `${applicantName}'s ${leaveApp.leave_type} (${leaveApp.start_date} – ${leaveApp.end_date}) approved, ${adjustedDays} day(s).`
                  : `${applicantName}'s ${leaveApp.leave_type} (${leaveApp.start_date} – ${leaveApp.end_date}) not approved.${comments ? ' Reason: ' + comments : ''}`,
                referenceId: applicationId
              });
            }
          }
        }
        // Fallback: notify all directors if no department director found
        if (!directorNotified) {
          const directors = await db.all(`SELECT id, email, phone FROM users WHERE role = 'director'`);
          for (const dir of directors) {
            await notifyUser({
              userId: dir.id,
              email: dir.email,
              phone: dir.phone,
              type: appStatus === 'approved' ? 'leave_approved_info' : 'leave_rejected_info',
              title: appStatus === 'approved' ? 'Leave Approved' : 'Leave Not Approved',
              message: appStatus === 'approved'
                ? `${applicantName}'s ${leaveApp.leave_type} (${leaveApp.start_date} – ${leaveApp.end_date}) approved, ${adjustedDays} day(s).`
                : `${applicantName}'s ${leaveApp.leave_type} (${leaveApp.start_date} – ${leaveApp.end_date}) not approved.${comments ? ' Reason: ' + comments : ''}`,
              referenceId: applicationId
            });
          }
        }

        // Send rejection email if rejected
        if (appStatus === 'rejected') {
          const { sendLeaveRejectionEmail } = require('../utils/notifications');
          sendLeaveRejectionEmail({
            to: leaveApp.applicant_email,
            firstName: leaveApp.applicant_first_name,
            leaveType: leaveApp.leave_type,
            startDate: leaveApp.start_date,
            endDate: leaveApp.end_date,
            numberOfDays: leaveApp.number_of_days,
            comments: comments
          }).catch(err => console.error('Rejection email error:', err.message));
        }

        // Notify admin users (informational)
        const adminUsers = await db.all(`SELECT id FROM users WHERE role = 'admin'`);
        for (const admin of adminUsers) {
          await notifyUser({
            userId: admin.id,
            type: appStatus === 'approved' ? 'leave_approved_info' : 'leave_rejected_info',
            title: appStatus === 'approved' ? 'Leave Approved' : 'Leave Not Approved',
            message: `${applicantName}'s ${leaveApp.leave_type} (${leaveApp.start_date} – ${leaveApp.end_date}) was ${appStatus}.`,
            referenceId: applicationId
          });
        }
      } catch (err) {
        console.error('Notification error:', err.message);
      }

      res.json({
        success: true,
        message: `Application ${status} successfully`,
        application_status: appStatus
      });
    } catch (error) {
      await db.run('ROLLBACK').catch(() => {});
      res.status(500).json({
        success: false,
        message: 'Error updating approval',
        error: error.message
      });
    }
  }
);

// Bulk approve/reject multiple applications
router.post('/bulk-action',
  authenticateToken,
  authorizeExactRole('supervisor'),
  async (req, res) => {
    try {
      const db = getDatabase();
      const { applicationIds, status, comments } = req.body;

      if (!Array.isArray(applicationIds) || applicationIds.length === 0) {
        return res.status(400).json({ success: false, message: 'applicationIds must be a non-empty array' });
      }
      if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ success: false, message: 'status must be approved or rejected' });
      }
      if (applicationIds.length > 50) {
        return res.status(400).json({ success: false, message: 'Maximum 50 applications per bulk action' });
      }

      const results = { succeeded: [], failed: [] };

      for (const appId of applicationIds) {
        try {
          const workflow = await db.get(
            `SELECT aw.id, aw.leave_application_id, la.user_id, la.leave_type_id, la.start_date,
                    la.number_of_days, la.status as app_status, la.requested_days
             FROM approval_workflow aw
             JOIN leave_applications la ON aw.leave_application_id = la.id
             WHERE aw.leave_application_id = ?
               AND aw.approval_level = 'supervisor'
               AND aw.status = 'pending'
               AND (aw.approver_id = ? OR aw.delegated_to = ?)
               AND la.status = 'pending'`,
            [appId, req.user.id, req.user.id]
          );

          if (!workflow) {
            results.failed.push({ id: appId, reason: 'Not pending for your approval' });
            continue;
          }

          const days = workflow.number_of_days;

          if (status === 'approved') {
            const balanceYear = new Date(workflow.start_date).getFullYear();
            const balance = await db.get(
              `SELECT remaining_days FROM leave_balance WHERE user_id = ? AND leave_type_id = ? AND year = ?`,
              [workflow.user_id, workflow.leave_type_id, balanceYear]
            );
            if (!balance || balance.remaining_days < days) {
              results.failed.push({ id: appId, reason: 'Insufficient leave balance' });
              continue;
            }
          }

          await db.run('BEGIN TRANSACTION');

          await db.run(
            `UPDATE approval_workflow SET status = ?, comments = ?, approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [status, comments || null, workflow.id]
          );

          const originalDays = workflow.requested_days || workflow.number_of_days;
          await db.run(
            `INSERT INTO leave_approval_audit (leave_application_id, approver_id, action, original_days, adjusted_days, comments) VALUES (?, ?, ?, ?, ?, ?)`,
            [appId, req.user.id, status, originalDays, status === 'approved' ? days : null, comments || null]
          );

          await db.run(
            `UPDATE leave_applications SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [status, appId]
          );

          if (status === 'approved') {
            const balanceYear = new Date(workflow.start_date).getFullYear();
            await db.run(
              `UPDATE leave_balance SET used_days = used_days + ?, remaining_days = remaining_days - ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND leave_type_id = ? AND year = ?`,
              [days, days, workflow.user_id, workflow.leave_type_id, balanceYear]
            );
          }

          await db.run('COMMIT');

          // Send notification (async, don't block)
          const leaveApp = await db.get(
            `SELECT u.email, u.phone, u.first_name, lt.name as leave_type, la.start_date, la.end_date
             FROM leave_applications la JOIN users u ON la.user_id = u.id JOIN leave_types lt ON la.leave_type_id = lt.id
             WHERE la.id = ?`, [appId]
          );
          if (leaveApp) {
            notifyUser({
              userId: workflow.user_id,
              email: leaveApp.email,
              phone: leaveApp.phone,
              type: status === 'approved' ? 'approval' : 'rejection',
              title: status === 'approved' ? 'Leave Approved' : 'Leave Not Approved',
              message: `Your ${leaveApp.leave_type} (${leaveApp.start_date} – ${leaveApp.end_date}) has been ${status}.${comments ? ' Note: ' + comments : ''}`,
              referenceId: appId
            }).catch(err => console.error('Bulk notification error:', err.message));
          }

          if (status === 'approved') {
            sendFinalApprovalEmails(db, appId, days).catch(() => {});
          }

          results.succeeded.push(appId);
        } catch (err) {
          await db.run('ROLLBACK').catch(() => {});
          results.failed.push({ id: appId, reason: err.message });
        }
      }

      res.json({
        success: true,
        message: `Processed ${results.succeeded.length} of ${applicationIds.length} applications`,
        results
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

module.exports = router;
