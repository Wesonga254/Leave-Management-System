const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

let db;

const initializeDatabase = async () => {
  db = await open({
    filename: path.join(__dirname, '../database.sqlite'),
    driver: sqlite3.Database
  });

  // Enable foreign keys
  await db.exec('PRAGMA foreign_keys = ON');

  // Create tables
  await createTables();
  
  return db;
};

const createTables = async () => {
  // Users table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      employee_id TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      profile_image TEXT,
      first_name TEXT NOT NULL,
      middle_name TEXT,
      last_name TEXT NOT NULL,
      gender TEXT,
      kra_number TEXT,
      date_of_birth DATE,
      department TEXT NOT NULL,
      designation TEXT DEFAULT 'Not Assigned',
      reporting_officer_id INTEGER,
      role TEXT DEFAULT 'employee',
      registration_status TEXT DEFAULT 'approved',
      verified_by INTEGER,
      verified_at DATETIME,
      verification_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (reporting_officer_id) REFERENCES users(id),
      FOREIGN KEY (verified_by) REFERENCES users(id)
    )
  `);

  const userColumns = await db.all('PRAGMA table_info(users)');
  const hasUserColumn = (name) => userColumns.some(column => column.name === name);
  const addUserColumn = async (name, definition) => {
    if (!hasUserColumn(name)) {
      await db.exec(`ALTER TABLE users ADD COLUMN ${name} ${definition}`);
    }
  };

  await addUserColumn('middle_name', 'TEXT');
  await addUserColumn('profile_image', 'TEXT');
  await addUserColumn('gender', 'TEXT');
  await addUserColumn('kra_number', 'TEXT');
  await addUserColumn('date_of_birth', 'DATE');
  await addUserColumn('registration_status', "TEXT DEFAULT 'approved'");
  await addUserColumn('verified_by', 'INTEGER');
  await addUserColumn('verified_at', 'DATETIME');
  await addUserColumn('verification_notes', 'TEXT');
  await db.run("UPDATE users SET registration_status = 'approved' WHERE registration_status IS NULL");

  // Leave Types table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS leave_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      annual_limit INTEGER NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Leave Balance table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS leave_balance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      leave_type_id INTEGER NOT NULL,
      year INTEGER NOT NULL,
      total_days INTEGER NOT NULL,
      used_days INTEGER DEFAULT 0,
      remaining_days INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (leave_type_id) REFERENCES leave_types(id),
      UNIQUE(user_id, leave_type_id, year)
    )
  `);

  // Leave Applications table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS leave_applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      leave_type_id INTEGER NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      number_of_days INTEGER NOT NULL,
      reason TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (leave_type_id) REFERENCES leave_types(id)
    )
  `);

  // Approval Workflow table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS approval_workflow (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      leave_application_id INTEGER NOT NULL,
      approver_id INTEGER NOT NULL,
      approval_level TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      comments TEXT,
      approved_at DATETIME,
      delegated_to INTEGER,
      escalated INTEGER DEFAULT 0,
      escalated_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (leave_application_id) REFERENCES leave_applications(id),
      FOREIGN KEY (approver_id) REFERENCES users(id)
    )
  `);

  // Notifications table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT,
      reference_id INTEGER,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Public holidays table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS public_holidays (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date DATE NOT NULL,
      name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(date)
    )
  `);

  // Settings table for system-wide configuration
  await db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Seed default settings if missing
  const s1 = await db.get("SELECT COUNT(*) as c FROM settings WHERE key = 'ESCALATION_DAYS'");
  if (s1.c === 0) await db.run("INSERT INTO settings (key, value, description) VALUES ('ESCALATION_DAYS', '3', 'Days before escalation')");
  const s2 = await db.get("SELECT COUNT(*) as c FROM settings WHERE key = 'SICK_ATTACHMENT_THRESHOLD'");
  if (s2.c === 0) await db.run("INSERT INTO settings (key, value, description) VALUES ('SICK_ATTACHMENT_THRESHOLD', '3', 'Minimum consecutive sick days requiring attachment')");
  const s3 = await db.get("SELECT COUNT(*) as c FROM settings WHERE key = 'COMPASSIONATE_ATTACHMENT_REQUIRED'");
  if (s3.c === 0) await db.run("INSERT INTO settings (key, value, description) VALUES ('COMPASSIONATE_ATTACHMENT_REQUIRED', '1', 'Require attachment for compassionate leave')");

  // Attachments table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      leave_application_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER,
      uploaded_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (leave_application_id) REFERENCES leave_applications(id),
      FOREIGN KEY (uploaded_by) REFERENCES users(id)
    )
  `);

  const workflowColumns = await db.all('PRAGMA table_info(approval_workflow)');
  const hasWorkflowColumn = (name) => workflowColumns.some(column => column.name === name);
  const addWorkflowColumn = async (name, definition) => {
    if (!hasWorkflowColumn(name)) {
      await db.exec(`ALTER TABLE approval_workflow ADD COLUMN ${name} ${definition}`);
    }
  };

  await addWorkflowColumn('comments', 'TEXT');
  await addWorkflowColumn('approved_at', 'DATETIME');
  await addWorkflowColumn('delegated_to', 'INTEGER');
  await addWorkflowColumn('escalated', 'INTEGER DEFAULT 0');
  await addWorkflowColumn('escalated_at', 'DATETIME');
  await addWorkflowColumn('updated_at', 'DATETIME');

  const attachmentColumns = await db.all('PRAGMA table_info(attachments)');
  const hasAttachmentColumn = (name) => attachmentColumns.some(column => column.name === name);
  if (!hasAttachmentColumn('file_name')) {
    await db.exec('ALTER TABLE attachments ADD COLUMN file_name TEXT');
    await db.run('UPDATE attachments SET file_name = filename WHERE file_name IS NULL');
  }
  if (!hasAttachmentColumn('file_type')) {
    await db.exec('ALTER TABLE attachments ADD COLUMN file_type TEXT');
  }

  // Seed default leave types if not exists
  const leaveTypesCount = await db.get('SELECT COUNT(*) as count FROM leave_types');
  if (leaveTypesCount.count === 0) {
    await db.run(
      `INSERT INTO leave_types (name, annual_limit, description)
       VALUES (?, ?, ?)`,
      ['Annual Leave', 24, 'Paid annual leave']
    );
    await db.run(
      `INSERT INTO leave_types (name, annual_limit, description)
       VALUES (?, ?, ?)`,
      ['Sick Leave', 12, 'Sick leave for medical reasons']
    );
    await db.run(
      `INSERT INTO leave_types (name, annual_limit, description)
       VALUES (?, ?, ?)`,
      ['Compassionate Leave', 5, 'Compassionate leave for bereavement or urgent family needs']
    );
    await db.run(
      `INSERT INTO leave_types (name, annual_limit, description)
       VALUES (?, ?, ?)`,
      ['Casual Leave', 5, 'Casual leave for personal reasons']
    );
  }

  const requiredLeaveTypes = [
    ['Annual Leave', 24, 'Paid annual leave'],
    ['Sick Leave', 12, 'Sick leave for medical reasons'],
    ['Compassionate Leave', 5, 'Compassionate leave for bereavement or urgent family needs']
  ];

  for (const [name, annualLimit, description] of requiredLeaveTypes) {
    const existing = await db.get('SELECT id FROM leave_types WHERE LOWER(name) = LOWER(?)', [name]);
    if (!existing) {
      await db.run(
        'INSERT INTO leave_types (name, annual_limit, description) VALUES (?, ?, ?)',
        [name, annualLimit, description]
      );
    }
  }
};

const getDatabase = () => {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase first.');
  }
  return db;
};

module.exports = {
  initializeDatabase,
  getDatabase
};
