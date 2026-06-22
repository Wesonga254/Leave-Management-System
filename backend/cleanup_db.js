/**
 * Database Cleanup Script
 * Keeps: admin user + EMP001 user + leave types + settings + holidays
 * Removes: all other users and ALL leave-related data (applications, approvals, attachments, notifications, balances, activity log)
 */
require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');
const fs = require('fs');

(async () => {
  const dbPath = path.join(__dirname, 'database.sqlite');
  console.log('=== DATABASE CLEANUP ===\n');
  console.log(`Database: ${dbPath}\n`);

  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  await db.exec('PRAGMA foreign_keys = OFF');

  // Step 1: Find admin and EMP001 users to keep
  const keepUsers = await db.all(`
    SELECT id, employee_id, first_name, last_name, role, email
    FROM users
    WHERE LOWER(role) = 'admin' OR LOWER(employee_id) = LOWER('EMP001')
  `);

  if (keepUsers.length === 0) {
    console.error('❌ No admin or EMP001 users found! Aborting.');
    process.exit(1);
  }

  const keepIds = keepUsers.map(u => u.id);
  console.log(`✓ Keeping ${keepUsers.length} user(s):`);
  keepUsers.forEach(u => {
    console.log(`  - ID:${u.id} | ${u.employee_id} | ${u.first_name} ${u.last_name} | ${u.role} | ${u.email}`);
  });

  // Step 2: Count what will be deleted
  const allUsers = await db.get('SELECT COUNT(*) as c FROM users');
  const toDeleteCount = allUsers.c - keepUsers.length;
  const leaveApps = await db.get('SELECT COUNT(*) as c FROM leave_applications');
  const approvals = await db.get('SELECT COUNT(*) as c FROM approval_workflow');
  const notifications = await db.get('SELECT COUNT(*) as c FROM notifications');
  const attachments = await db.get('SELECT COUNT(*) as c FROM attachments');
  const balances = await db.get('SELECT COUNT(*) as c FROM leave_balance');
  const carryForward = await db.get('SELECT COUNT(*) as c FROM leave_carry_forward_log');
  const approvalAudit = await db.get('SELECT COUNT(*) as c FROM leave_approval_audit').catch(() => ({ c: 0 }));
  const activityLog = await db.get('SELECT COUNT(*) as c FROM activity_log').catch(() => ({ c: 0 }));

  console.log(`\n📊 Will delete:`);
  console.log(`  Users:              ${toDeleteCount}`);
  console.log(`  Leave Applications: ${leaveApps.c}`);
  console.log(`  Approval Workflow:  ${approvals.c}`);
  console.log(`  Notifications:      ${notifications.c}`);
  console.log(`  Attachments:        ${attachments.c}`);
  console.log(`  Leave Balances:     ${balances.c}`);
  console.log(`  Carry Forward Log:  ${carryForward.c}`);
  console.log(`  Approval Audit:     ${approvalAudit.c}`);
  console.log(`  Activity Log:       ${activityLog.c}`);

  // Step 3: Delete everything
  console.log('\n--- Cleaning... ---');

  // Delete ALL leave applications and related data (for ALL users including kept ones)
  await db.run('DELETE FROM approval_workflow');
  console.log('  ✓ Cleared approval_workflow');

  await db.run('DELETE FROM leave_approval_audit').catch(() => {});
  console.log('  ✓ Cleared leave_approval_audit');

  // Delete physical attachment files
  const attachmentFiles = await db.all('SELECT file_path FROM attachments');
  for (const att of attachmentFiles) {
    const fullPath = path.join(__dirname, att.file_path);
    try {
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    } catch (e) { /* ignore */ }
  }
  await db.run('DELETE FROM attachments');
  console.log(`  ✓ Cleared attachments (${attachmentFiles.length} files removed)`);

  await db.run('DELETE FROM leave_applications');
  console.log('  ✓ Cleared leave_applications');

  await db.run('DELETE FROM notifications');
  console.log('  ✓ Cleared notifications');

  await db.run('DELETE FROM leave_carry_forward_log');
  console.log('  ✓ Cleared leave_carry_forward_log');

  await db.run('DELETE FROM leave_balance');
  console.log('  ✓ Cleared leave_balance');

  await db.run('DELETE FROM activity_log').catch(() => {});
  console.log('  ✓ Cleared activity_log');

  // Delete users NOT in the keep list
  const placeholders = keepIds.map(() => '?').join(',');
  await db.run(`UPDATE users SET reporting_officer_id = NULL WHERE reporting_officer_id NOT IN (${placeholders})`, keepIds);
  const deleteResult = await db.run(`DELETE FROM users WHERE id NOT IN (${placeholders})`, keepIds);
  console.log(`  ✓ Deleted ${deleteResult.changes} user(s)`);

  // Step 4: Re-initialize leave balances for kept users
  const leaveTypes = await db.all('SELECT id, annual_limit, applicable_gender FROM leave_types');
  const currentYear = new Date().getFullYear();

  for (const user of keepUsers) {
    const userData = await db.get('SELECT gender FROM users WHERE id = ?', [user.id]);
    const gender = userData?.gender || 'All';

    for (const lt of leaveTypes) {
      const applicable = lt.applicable_gender === 'All' ||
        lt.applicable_gender.toLowerCase() === gender.toLowerCase();
      if (applicable) {
        await db.run(
          `INSERT OR IGNORE INTO leave_balance (user_id, leave_type_id, year, total_days, used_days, remaining_days)
           VALUES (?, ?, ?, ?, 0, ?)`,
          [user.id, lt.id, currentYear, lt.annual_limit, lt.annual_limit]
        );
      }
    }
  }
  console.log('  ✓ Re-initialized leave balances for kept users');

  // Step 5: Verify
  const finalUsers = await db.all('SELECT id, employee_id, first_name, last_name, role FROM users');
  const finalApps = await db.get('SELECT COUNT(*) as c FROM leave_applications');
  const finalNotifs = await db.get('SELECT COUNT(*) as c FROM notifications');
  const finalBalances = await db.all('SELECT lb.user_id, lt.name, lb.total_days, lb.remaining_days FROM leave_balance lb JOIN leave_types lt ON lb.leave_type_id = lt.id');

  console.log('\n=== RESULT ===\n');
  console.log(`Users remaining: ${finalUsers.length}`);
  finalUsers.forEach(u => console.log(`  - ${u.employee_id}: ${u.first_name} ${u.last_name} (${u.role})`));
  console.log(`Leave applications: ${finalApps.c}`);
  console.log(`Notifications: ${finalNotifs.c}`);
  console.log(`Leave balances: ${finalBalances.length}`);
  console.log('\n✅ Database cleaned successfully!');

  await db.close();
  process.exit(0);
})();
