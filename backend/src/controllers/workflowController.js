const { getDatabase } = require('../database');
const { notifyUser } = require('../utils/notifications');

// Delegate an approval to another user
const delegateApproval = async (req, res) => {
  try {
    return res.status(403).json({
      success: false,
      message: 'Delegation is disabled. Leave requests must be approved by the employee\'s direct Supervisor.'
    });

    const db = getDatabase();
    const { applicationId, delegatedTo } = req.body;
    if (!applicationId || !delegatedTo) return res.status(400).json({ message: 'applicationId and delegatedTo are required' });

    // Update approval_workflow for the pending approver
    await db.run(
      `UPDATE approval_workflow SET delegated_to = ?, updated_at = CURRENT_TIMESTAMP WHERE leave_application_id = ? AND status = 'pending'`,
      [delegatedTo, applicationId]
    );

    // Notify delegated user
    const delegatedUser = await db.get('SELECT id, email, phone, first_name FROM users WHERE id = ?', [delegatedTo]);
    const app = await db.get('SELECT la.*, u.first_name as applicant_first FROM leave_applications la JOIN users u ON la.user_id = u.id WHERE la.id = ?', [applicationId]);
    if (delegatedUser && app) {
      await notifyUser({
        userId: delegatedUser.id,
        email: delegatedUser.email,
        phone: delegatedUser.phone,
        type: 'delegation',
        title: 'Approval Delegation Assigned',
        message: `You have been delegated to approve leave request #${applicationId} from ${app.applicant_first} (${app.start_date} to ${app.end_date}).`,
        referenceId: applicationId
      });
    }

    res.json({ success: true, message: 'Delegation applied' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error delegating approval', error: err.message });
  }
};

// Run escalation: find pending approvals older than configured timeout and escalate
const runEscalation = async (req, res) => {
  try {
    const db = getDatabase();
    const days = parseInt(process.env.ESCALATION_DAYS || '3');

    const rows = await db.all(
      `SELECT aw.id, aw.leave_application_id, aw.approver_id, aw.created_at, la.user_id as applicant_id, u.first_name as applicant_first
       FROM approval_workflow aw
       JOIN leave_applications la ON aw.leave_application_id = la.id
       JOIN users u ON la.user_id = u.id
       WHERE aw.status = 'pending' AND aw.escalated = 0 AND datetime(aw.created_at) <= datetime('now','-${days} days')`
    );

    for (const r of rows) {
      // mark escalated
      await db.run('UPDATE approval_workflow SET escalated = 1, escalated_at = CURRENT_TIMESTAMP WHERE id = ?', [r.id]);

      // notify approver and admin
      const approver = await db.get('SELECT id, email, phone, first_name FROM users WHERE id = ?', [r.approver_id]);
      const admins = await db.all("SELECT id, email, phone FROM users WHERE role = 'admin'");

      if (approver) {
        await notifyUser({ userId: approver.id, email: approver.email, phone: approver.phone, type: 'escalation', title: 'Approval Escalation', message: `Leave request #${r.leave_application_id} has been escalated for your attention.`, referenceId: r.leave_application_id });
      }

      for (const a of admins) {
        await notifyUser({ userId: a.id, email: a.email, phone: a.phone, type: 'escalation_admin', title: 'Approval Escalated', message: `Leave request #${r.leave_application_id} is escalated and requires attention.`, referenceId: r.leave_application_id });
      }
    }

    res.json({ success: true, escalated: rows.length });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error running escalation', error: err.message });
  }
};

module.exports = {
  delegateApproval,
  runEscalation
};
