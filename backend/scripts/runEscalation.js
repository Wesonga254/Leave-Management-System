require('dotenv').config();
const { initializeDatabase, getDatabase } = require('../src/database');
const { notifyUser } = require('../src/utils/notifications');

async function run() {
  try {
    await initializeDatabase();
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
      await db.run('UPDATE approval_workflow SET escalated = 1, escalated_at = CURRENT_TIMESTAMP WHERE id = ?', [r.id]);
      const approver = await db.get('SELECT id, email, phone, first_name FROM users WHERE id = ?', [r.approver_id]);
      const admins = await db.all("SELECT id, email, phone FROM users WHERE role = 'admin'");

      if (approver) {
        await notifyUser({ userId: approver.id, email: approver.email, phone: approver.phone, type: 'escalation', title: 'Approval Escalation', message: `Leave request #${r.leave_application_id} has been escalated for your attention.`, referenceId: r.leave_application_id });
      }

      for (const a of admins) {
        await notifyUser({ userId: a.id, email: a.email, phone: a.phone, type: 'escalation_admin', title: 'Approval Escalated', message: `Leave request #${r.leave_application_id} is escalated and requires attention.`, referenceId: r.leave_application_id });
      }
    }

    console.log(`Escalation run completed: ${rows.length} escalated`);
    process.exit(0);
  } catch (err) {
    console.error('Escalation run error', err);
    process.exit(1);
  }
}

run();
