require('dotenv').config();
const bcrypt = require('bcryptjs');
const { initializeDatabase, getDatabase } = require('./src/database');

const createAdminIfMissing = async () => {
  try {
    const db = await initializeDatabase();

    // Check if an admin exists
    const existingAdmin = await db.get('SELECT * FROM users WHERE role = ?', ['admin']);
    if (existingAdmin) {
      console.log('Admin user already exists:', existingAdmin.employee_id || existingAdmin.username);
      process.exit(0);
    }

    const password = 'Admin123!';
    const hashed = await bcrypt.hash(password, 10);

    const result = await db.run(
      `INSERT INTO users (username, employee_id, password_hash, email, phone, first_name, last_name, department, designation, reporting_officer_id, role)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['admin', 'ADMIN', hashed, 'admin@example.com', '', 'System', 'Administrator', 'Administration', 'Administrator', null, 'admin']
    );

    const adminId = result.lastID;

    // Initialize leave balances for admin for current year
    const leaveTypes = await db.all('SELECT id, annual_limit FROM leave_types');
    const currentYear = new Date().getFullYear();
    for (const lt of leaveTypes) {
      await db.run(
        `INSERT INTO leave_balance (user_id, leave_type_id, year, total_days, used_days, remaining_days)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [adminId, lt.id, currentYear, lt.annual_limit, 0, lt.annual_limit]
      );
    }

    console.log('Admin user created: employee_id=ADMIN password=Admin123!');
    process.exit(0);
  } catch (err) {
    console.error('Failed to create admin user:', err);
    process.exit(1);
  }
};

createAdminIfMissing();
