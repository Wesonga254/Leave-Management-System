require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

(async () => {
  const db = await open({
    filename: path.join(__dirname, 'database.sqlite'),
    driver: sqlite3.Database
  });

  console.log('=== USERS ===');
  const users = await db.all('SELECT id, employee_id, first_name, last_name, role, department, reporting_officer_id FROM users');
  users.forEach(u => {
    console.log(`  ID:${u.id} | ${u.employee_id} | ${u.first_name} ${u.last_name} | role:${u.role} | dept:${u.department} | supervisor_id:${u.reporting_officer_id}`);
  });

  console.log('\n=== LEAVE APPLICATIONS ===');
  const apps = await db.all('SELECT la.*, lt.name as leave_type FROM leave_applications la JOIN leave_types lt ON la.leave_type_id = lt.id ORDER BY la.id DESC');
  if (apps.length === 0) console.log('  (none)');
  apps.forEach(a => {
    console.log(`  ID:${a.id} | user_id:${a.user_id} | ${a.leave_type} | ${a.start_date} to ${a.end_date} | status:${a.status}`);
  });

  console.log('\n=== APPROVAL WORKFLOW ===');
  const wf = await db.all('SELECT * FROM approval_workflow ORDER BY id DESC');
  if (wf.length === 0) console.log('  (none)');
  wf.forEach(w => {
    console.log(`  ID:${w.id} | app_id:${w.leave_application_id} | approver_id:${w.approver_id} | level:${w.approval_level} | status:${w.status}`);
  });

  console.log('\n=== NOTIFICATIONS ===');
  const notifs = await db.all('SELECT id, user_id, type, title, is_read FROM notifications ORDER BY id DESC LIMIT 10');
  if (notifs.length === 0) console.log('  (none)');
  notifs.forEach(n => {
    console.log(`  ID:${n.id} | user_id:${n.user_id} | ${n.type} | ${n.title} | read:${n.is_read}`);
  });

  await db.close();
})();
