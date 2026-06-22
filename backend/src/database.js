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
      department_id INTEGER,
      designation TEXT DEFAULT 'Not Assigned',
      reporting_officer_id INTEGER,
      role TEXT DEFAULT 'employee',
      registration_status TEXT DEFAULT 'APPROVED',
      is_active INTEGER DEFAULT 1,
      verified_by INTEGER,
      verified_at DATETIME,
      verification_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (department_id) REFERENCES departments(id),
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
  await addUserColumn('department_id', 'INTEGER');
  await addUserColumn('registration_status', "TEXT DEFAULT 'APPROVED'");
  await addUserColumn('is_active', 'INTEGER DEFAULT 1');
  await addUserColumn('verified_by', 'INTEGER');
  await addUserColumn('verified_at', 'DATETIME');
  await addUserColumn('verification_notes', 'TEXT');
  await addUserColumn('directorate_id', 'INTEGER');
  await db.run("UPDATE users SET registration_status = 'APPROVED' WHERE registration_status IS NULL");
  await db.run("UPDATE users SET is_active = 1 WHERE is_active IS NULL");

  await db.exec(`
    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      director_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (director_id) REFERENCES users(id)
    )
  `);

  const departmentColumns = await db.all('PRAGMA table_info(departments)');
  const hasDepartmentColumn = (name) => departmentColumns.some(column => column.name === name);
  if (!hasDepartmentColumn('director_id')) {
    await db.exec('ALTER TABLE departments ADD COLUMN director_id INTEGER');
  }
  if (!hasDepartmentColumn('updated_at')) {
    await db.exec('ALTER TABLE departments ADD COLUMN updated_at DATETIME');
  }

  // Sync departments from users table
  const existingDepartments = await db.all(`
    SELECT DISTINCT department
    FROM users
    WHERE department IS NOT NULL AND TRIM(department) != ''
  `);
  for (const row of existingDepartments) {
    await db.run('INSERT OR IGNORE INTO departments (name) VALUES (?)', [row.department.trim()]);
  }
  await db.run(`
    UPDATE users
    SET department_id = (
      SELECT d.id FROM departments d WHERE LOWER(d.name) = LOWER(users.department)
    )
    WHERE department_id IS NULL
      AND department IS NOT NULL
      AND TRIM(department) != ''
  `);

  // Directorates table — child of departments
  await db.exec(`
    CREATE TABLE IF NOT EXISTS directorates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      department_id INTEGER NOT NULL,
      director_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (department_id) REFERENCES departments(id),
      FOREIGN KEY (director_id) REFERENCES users(id),
      UNIQUE(name, department_id)
    )
  `);

  // Migrate: add director_id to directorates if missing
  const directorateColumns = await db.all('PRAGMA table_info(directorates)');
  const hasDirectorateCol = (name) => directorateColumns.some(c => c.name === name);
  if (!hasDirectorateCol('director_id')) {
    await db.exec('ALTER TABLE directorates ADD COLUMN director_id INTEGER');
  }

  // Seed County Government of Busia directorates under each department
  const busiaDirectorates = {
    'The County Treasury and Economic Planning': [
      'Budget & Expenditure', 'Revenue Collection', 'Economic Planning',
      'Accounting Services', 'Supply Chain Management', 'Internal Audit'
    ],
    'Health and Sanitation': [
      'Medical Services', 'Public Health', 'Nursing Services',
      'Pharmaceutical Services', 'Health Administration', 'Sanitation'
    ],
    'Smart Agriculture, Livestock, Fisheries and Blue Economy': [
      'Agriculture & Crops', 'Livestock Production', 'Veterinary Services',
      'Fisheries & Blue Economy', 'Cooperative Development'
    ],
    'Education and Industrial Skills Development': [
      'Education', 'Early Childhood Development',
      'Vocational & Industrial Skills Training', 'Youth Development'
    ],
    'Lands, Housing and Urban Development': [
      'Lands Administration', 'Housing & Urban Development',
      'Physical Planning', 'Survey & Mapping'
    ],
    'Public Service Management and Governance': [
      'Public Service Management', 'County Administration',
      'Human Resource Management', 'Legal Services',
      'Governance & Devolution'
    ],
    'Transport, Roads and Public Works': [
      'Roads & Bridges', 'Public Works', 'Transport',
      'Mechanical & Equipment Services'
    ],
    'Water, Irrigation, Environment, Natural Resources, Climate Change and Energy': [
      'Water Services', 'Irrigation', 'Environment & Climate Change',
      'Natural Resources', 'Energy', 'Forestry'
    ],
    'Trade, Investment, Industrialization, Cooperatives and SME': [
      'Trade & Markets', 'Investment Promotion', 'Industrialization',
      'Cooperatives', 'SME Development', 'Weights & Measures'
    ],
    'Youth, Sports, Tourism, Culture, Social Protection, Gender Affairs and Creative Arts': [
      'Youth Affairs', 'Sports & Recreation', 'Tourism & Wildlife',
      'Culture & Heritage', 'Social Protection',
      'Gender Affairs', 'Creative Arts'
    ],
    'Strategic Partnerships, ICT and Digital Economy': [
      'ICT & E-Government', 'Digital Economy',
      'Strategic Partnerships', 'Communication & Public Relations'
    ],
    'County Public Service Board': [
      'Recruitment & Selection', 'Human Resource Advisory',
      'Performance Management', 'Compliance & Standards'
    ],
    'Human Resource': [
      'HR Operations', 'Staff Welfare', 'Training & Development',
      'Records Management'
    ]
  };

  for (const [deptName, directorateNames] of Object.entries(busiaDirectorates)) {
    const dept = await db.get('SELECT id FROM departments WHERE LOWER(name) = LOWER(?)', [deptName]);
    if (!dept) continue;
    for (const dirName of directorateNames) {
      await db.run(
        'INSERT OR IGNORE INTO directorates (name, department_id) VALUES (?, ?)',
        [dirName, dept.id]
      );
    }
  }

  // Leave Types table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS leave_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      annual_limit INTEGER NOT NULL,
      description TEXT,
      applicable_gender TEXT DEFAULT 'All',
      max_carry_forward_days INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const leaveTypeColumns = await db.all('PRAGMA table_info(leave_types)');
  const hasLeaveTypeColumn = (name) => leaveTypeColumns.some(column => column.name === name);
  if (!hasLeaveTypeColumn('applicable_gender')) {
    await db.exec("ALTER TABLE leave_types ADD COLUMN applicable_gender TEXT DEFAULT 'All'");
  }
  if (!hasLeaveTypeColumn('max_carry_forward_days')) {
    await db.exec('ALTER TABLE leave_types ADD COLUMN max_carry_forward_days INTEGER DEFAULT 0');
  }
  await db.run("UPDATE leave_types SET applicable_gender = 'All' WHERE applicable_gender IS NULL OR TRIM(applicable_gender) = ''");
  await db.run('UPDATE leave_types SET max_carry_forward_days = 0 WHERE max_carry_forward_days IS NULL');
  await db.run("UPDATE leave_types SET applicable_gender = 'Female' WHERE LOWER(name) LIKE '%maternity%'");
  await db.run("UPDATE leave_types SET applicable_gender = 'Male' WHERE LOWER(name) LIKE '%paternity%'");

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
      requested_days INTEGER,
      approved_days INTEGER,
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
      title TEXT NOT NULL DEFAULT '',
      message TEXT,
      reference_id INTEGER,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Migration: add title column if missing
  const notifCols = await db.all('PRAGMA table_info(notifications)');
  if (!notifCols.some(c => c.name === 'title')) {
    await db.exec("ALTER TABLE notifications ADD COLUMN title TEXT NOT NULL DEFAULT ''");
    console.log('[Migration] Added "title" column to notifications table');
  }
  // Migration: add reference_id column if missing (old schema used leave_application_id)
  if (!notifCols.some(c => c.name === 'reference_id')) {
    await db.exec('ALTER TABLE notifications ADD COLUMN reference_id INTEGER');
    if (notifCols.some(c => c.name === 'leave_application_id')) {
      await db.run('UPDATE notifications SET reference_id = leave_application_id WHERE reference_id IS NULL AND leave_application_id IS NOT NULL');
    }
    console.log('[Migration] Added "reference_id" column to notifications table');
  }

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

  // Settings table
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
  const s4 = await db.get("SELECT COUNT(*) as c FROM settings WHERE key = 'LEAVE_YEAR_END_DATE'");
  if (s4.c === 0) await db.run("INSERT INTO settings (key, value, description) VALUES ('LEAVE_YEAR_END_DATE', '12-31', 'Leave year end date in MM-DD format')");

  await db.exec(`
    CREATE TABLE IF NOT EXISTS leave_carry_forward_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      leave_type_id INTEGER NOT NULL,
      from_year INTEGER NOT NULL,
      to_year INTEGER NOT NULL,
      remaining_days INTEGER DEFAULT 0,
      amount_carried INTEGER DEFAULT 0,
      amount_forfeited INTEGER DEFAULT 0,
      max_carry_forward_days INTEGER DEFAULT 0,
      processed_by INTEGER,
      source TEXT DEFAULT 'manual',
      processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (leave_type_id) REFERENCES leave_types(id),
      FOREIGN KEY (processed_by) REFERENCES users(id),
      UNIQUE(user_id, leave_type_id, from_year, to_year)
    )
  `);

  const leaveApplicationColumns = await db.all('PRAGMA table_info(leave_applications)');
  const hasLeaveApplicationColumn = (name) => leaveApplicationColumns.some(column => column.name === name);
  if (!hasLeaveApplicationColumn('requested_days')) {
    await db.exec('ALTER TABLE leave_applications ADD COLUMN requested_days INTEGER');
    await db.run('UPDATE leave_applications SET requested_days = number_of_days WHERE requested_days IS NULL');
  }
  if (!hasLeaveApplicationColumn('approved_days')) {
    await db.exec('ALTER TABLE leave_applications ADD COLUMN approved_days INTEGER');
  }

  await db.exec(`
    CREATE TABLE IF NOT EXISTS leave_approval_audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      leave_application_id INTEGER NOT NULL,
      approver_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      original_days INTEGER,
      adjusted_days INTEGER,
      comments TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (leave_application_id) REFERENCES leave_applications(id),
      FOREIGN KEY (approver_id) REFERENCES users(id)
    )
  `);

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

  await db.run(`
    DELETE FROM approval_workflow
    WHERE LOWER(approval_level) != 'supervisor'
  `);
  await db.run(`
    DELETE FROM approval_workflow
    WHERE id NOT IN (
      SELECT MIN(id)
      FROM approval_workflow
      GROUP BY leave_application_id
    )
  `);
  await db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_approval_workflow_one_per_leave
    ON approval_workflow(leave_application_id)
  `);

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
      `INSERT INTO leave_types (name, annual_limit, description, applicable_gender)
       VALUES (?, ?, ?, ?)`,
      ['Annual Leave', 24, 'Paid annual leave', 'All']
    );
    await db.run(
      `INSERT INTO leave_types (name, annual_limit, description, applicable_gender)
       VALUES (?, ?, ?, ?)`,
      ['Sick Leave', 12, 'Sick leave for medical reasons', 'All']
    );
    await db.run(
      `INSERT INTO leave_types (name, annual_limit, description, applicable_gender)
       VALUES (?, ?, ?, ?)`,
      ['Compassionate Leave', 5, 'Compassionate leave for bereavement or urgent family needs', 'All']
    );
    await db.run(
      `INSERT INTO leave_types (name, annual_limit, description, applicable_gender)
       VALUES (?, ?, ?, ?)`,
      ['Casual Leave', 5, 'Casual leave for personal reasons', 'All']
    );
  }

  const requiredLeaveTypes = [
    ['Annual Leave', 24, 'Paid annual leave', 'All', 5],
    ['Sick Leave', 12, 'Sick leave for medical reasons', 'All', 0],
    ['Compassionate Leave', 5, 'Compassionate leave for bereavement or urgent family needs', 'All', 0],
    ['Maternity Leave', 90, 'Leave for maternity', 'Female', 0],
    ['Paternity Leave', 14, 'Leave for paternity', 'Male', 0]
  ];

  for (const [name, annualLimit, description, applicableGender, maxCarryForwardDays] of requiredLeaveTypes) {
    const existing = await db.get('SELECT id FROM leave_types WHERE LOWER(name) = LOWER(?)', [name]);
    if (!existing) {
      await db.run(
        'INSERT INTO leave_types (name, annual_limit, description, applicable_gender, max_carry_forward_days) VALUES (?, ?, ?, ?, ?)',
        [name, annualLimit, description, applicableGender, maxCarryForwardDays]
      );
    } else {
      await db.run(
        `UPDATE leave_types
         SET max_carry_forward_days = COALESCE(max_carry_forward_days, ?)
         WHERE id = ?`,
        [maxCarryForwardDays, existing.id]
      );
    }
  }

  const currentYear = new Date().getFullYear();
  await db.run(
    `INSERT OR IGNORE INTO leave_balance (user_id, leave_type_id, year, total_days, used_days, remaining_days)
     SELECT u.id, lt.id, ?, lt.annual_limit, 0, lt.annual_limit
     FROM users u
     CROSS JOIN leave_types lt
     WHERE lt.applicable_gender = 'All'
        OR LOWER(lt.applicable_gender) = LOWER(u.gender)`,
    [currentYear]
  );

  // System Activity Log table (audit trail)
  // Check if table exists and has the right schema; recreate if needed
  const activityTableExists = await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='activity_log'");
  if (activityTableExists) {
    const activityCols = await db.all('PRAGMA table_info(activity_log)');
    const hasCategory = activityCols.some(c => c.name === 'category');
    if (!hasCategory) {
      // Table exists but is missing columns — drop and recreate
      await db.exec('DROP TABLE activity_log');
    }
  }

  await db.exec(`
    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      user_name TEXT,
      user_role TEXT,
      action TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'general',
      target_type TEXT,
      target_id INTEGER,
      details TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Index for fast querying by date and category
  try {
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at DESC)`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_activity_log_category ON activity_log(category)`);
  } catch (e) {
    // Indexes may already exist
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
