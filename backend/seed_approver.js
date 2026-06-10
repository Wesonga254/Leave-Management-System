require('dotenv').config();
const bcrypt = require('bcryptjs');
const { initializeDatabase } = require('./src/database');

const createApprover = async () => {
  try {
    const db = await initializeDatabase();

    const role = (process.argv[2] || 'supervisor').toLowerCase();
    const allowedRoles = ['supervisor', 'hr', 'chief_officer'];

    if (!allowedRoles.includes(role)) {
      console.error(`Invalid approver role: ${role}. Use one of: supervisor, hr, chief_officer`);
      process.exit(1);
    }

    const existing = await db.get('SELECT id FROM users WHERE role = ? LIMIT 1', [role]);
    if (existing) {
      console.log(`An approver with role '${role}' already exists.`);
      process.exit(0);
    }

    const password = 'Approver123!';
    const hashedPassword = await bcrypt.hash(password, 10);

    const employeeIds = {
      supervisor: 'SUP001',
      hr: 'HR001',
      chief_officer: 'CO001'
    };

    const names = {
      supervisor: { first: 'System', last: 'Supervisor', dept: 'Operations', designation: 'Supervisor' },
      hr: { first: 'System', last: 'HR', dept: 'Human Resources', designation: 'HR Manager' },
      chief_officer: { first: 'System', last: 'Chief', dept: 'Management', designation: 'Chief Officer' }
    };

    const user = names[role];

    const result = await db.run(
      `INSERT INTO users (
        username, employee_id, password_hash, email, phone,
        first_name, last_name, department, designation,
        reporting_officer_id, role
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        `${role}@system.local`,
        employeeIds[role],
        hashedPassword,
        `${role}@system.local`,
        '',
        user.first,
        user.last,
        user.dept,
        user.designation,
        null,
        role
      ]
    );

    const leaveTypes = await db.all('SELECT id, annual_limit FROM leave_types');
    const currentYear = new Date().getFullYear();

    for (const leaveType of leaveTypes) {
      await db.run(
        `INSERT INTO leave_balance (user_id, leave_type_id, year, total_days, used_days, remaining_days)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [result.lastID, leaveType.id, currentYear, leaveType.annual_limit, 0, leaveType.annual_limit]
      );
    }

    console.log(`Approver created successfully:`);
    console.log(`  role: ${role}`);
    console.log(`  employee_id: ${employeeIds[role]}`);
    console.log(`  username: ${role}@system.local`);
    console.log(`  password: ${password}`);
    process.exit(0);
  } catch (error) {
    console.error('Failed to create approver:', error);
    process.exit(1);
  }
};

createApprover();
