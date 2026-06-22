require('dotenv').config();
const { initializeDatabase, getDatabase } = require('./src/database');

const cleanup = async () => {
  try {
    const db = await initializeDatabase();

    console.log('--- Starting cleanup ---');

    // 1. Clear all leave-related data
    console.log('Clearing attachments...');
    await db.run('DELETE FROM attachments');

    console.log('Clearing leave approval audit...');
    await db.run('DELETE FROM leave_approval_audit');

    console.log('Clearing approval workflow...');
    await db.run('DELETE FROM approval_workflow');

    console.log('Clearing notifications...');
    await db.run('DELETE FROM notifications');

    console.log('Clearing leave carry forward log...');
    await db.run('DELETE FROM leave_carry_forward_log');

    console.log('Clearing leave applications...');
    await db.run('DELETE FROM leave_applications');

    console.log('All leave applications cleared!');

    // 2. Identify users to keep (EMP001, ADMIN, HR by employee_id)
    const keepIds = ['EMP001', 'ADMIN', 'HR'];
    const usersToKeep = await db.all(
      `SELECT id, employee_id, username, role FROM users WHERE employee_id IN (${keepIds.map(() => '?').join(',')})`,
      keepIds
    );
    console.log('\nUsers being kept:');
    usersToKeep.forEach(u => console.log(`  - ${u.employee_id} (${u.username}, role: ${u.role})`));

    const keepUserIds = usersToKeep.map(u => u.id);

    if (keepUserIds.length === 0) {
      console.log('WARNING: No users found with employee_ids EMP001, ADMIN, or HR. Skipping user deletion.');
    } else {
      // Clear leave balances for users being removed
      console.log('\nClearing leave balances for removed users...');
      await db.run(
        `DELETE FROM leave_balance WHERE user_id NOT IN (${keepUserIds.map(() => '?').join(',')})`,
        keepUserIds
      );

      // Remove users not in the keep list
      const removedCount = await db.run(
        `DELETE FROM users WHERE employee_id NOT IN (${keepIds.map(() => '?').join(',')})`,
        keepIds
      );
      console.log(`Removed ${removedCount.changes} users.`);
    }

    // 3. Reset leave balances for remaining users (set used_days to 0)
    console.log('\nResetting leave balances for remaining users...');
    await db.run('UPDATE leave_balance SET used_days = 0, remaining_days = total_days');

    console.log('\n--- Cleanup complete! ---');
    
    // Show remaining users
    const remaining = await db.all('SELECT employee_id, username, role FROM users');
    console.log('\nRemaining users:');
    remaining.forEach(u => console.log(`  - ${u.employee_id} (${u.username}, role: ${u.role})`));

    process.exit(0);
  } catch (err) {
    console.error('Cleanup failed:', err);
    process.exit(1);
  }
};

cleanup();
