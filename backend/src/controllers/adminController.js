const { getDatabase } = require('../database');

// List users (admin only)
const listUsers = async (req, res) => {
  try {
    const db = getDatabase();
    const users = await db.all(`
      SELECT id, username, employee_id, first_name, middle_name, last_name, email, department, designation, role,
             gender, kra_number, date_of_birth, registration_status, verified_at, verification_notes, created_at
      FROM users
      ORDER BY
        CASE registration_status WHEN 'pending_hr_approval' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
        id DESC
    `);
    res.json({ success: true, data: users, count: users.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get single user
const getUser = async (req, res) => {
  try {
    const db = getDatabase();
    const userId = req.params.id;
    const user = await db.get(`
      SELECT id, username, employee_id, first_name, middle_name, last_name, email, phone, department,
             designation, role, reporting_officer_id, gender, kra_number, date_of_birth, registration_status
      FROM users
      WHERE id = ?
    `, [userId]);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const reviewRegistration = async (req, res) => {
  try {
    const db = getDatabase();
    const userId = req.params.id;
    const { status, notes } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be approved or rejected' });
    }

    const existing = await db.get('SELECT id, registration_status FROM users WHERE id = ?', [userId]);
    if (!existing) return res.status(404).json({ success: false, message: 'User not found' });

    await db.run(
      `UPDATE users
       SET registration_status = ?, verified_by = ?, verified_at = CURRENT_TIMESTAMP, verification_notes = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [status, req.user.id, notes || null, userId]
    );

    if (status === 'approved') {
      await initializeLeaveBalance(db, userId);
    }

    const updated = await db.get(`
      SELECT id, username, employee_id, first_name, middle_name, last_name, email, department, role, registration_status, verified_at
      FROM users
      WHERE id = ?
    `, [userId]);

    res.json({ success: true, data: updated, message: `Registration ${status}` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update user (admin only) - can change role, department, designation, reporting_officer_id
const updateUser = async (req, res) => {
  try {
    const db = getDatabase();
    const userId = req.params.id;
    const { role, department, designation, reporting_officer_id } = req.body;

    const existing = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
    if (!existing) return res.status(404).json({ success: false, message: 'User not found' });

    await db.run(
      `UPDATE users SET role = COALESCE(?, role), department = COALESCE(?, department), designation = COALESCE(?, designation), reporting_officer_id = COALESCE(?, reporting_officer_id), updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [role, department, designation, reporting_officer_id || null, userId]
    );

    const updated = await db.get('SELECT id, username, employee_id, first_name, last_name, email, department, designation, role FROM users WHERE id = ?', [userId]);
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete user
const deleteUser = async (req, res) => {
  try {
    const db = getDatabase();
    const userId = Number(req.params.id);

    if (Number.isNaN(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID' });
    }

    if (req.user.id === userId) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own account' });
    }

    const existing = await db.get('SELECT id, role FROM users WHERE id = ?', [userId]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (existing.role === 'admin') {
      const adminCount = await db.get(`SELECT COUNT(*) as count FROM users WHERE role = 'admin'`);
      if (adminCount.count <= 1) {
        return res.status(400).json({ success: false, message: 'Cannot delete the last admin account' });
      }
    }

    const leaveApps = await db.get(
      'SELECT COUNT(*) as count FROM leave_applications WHERE user_id = ?',
      [userId]
    );
    if (leaveApps.count > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete this user because they have leave applications on record. Reassign or archive their records first.'
      });
    }

    await db.run('UPDATE users SET reporting_officer_id = NULL WHERE reporting_officer_id = ?', [userId]);
    await db.run('DELETE FROM notifications WHERE user_id = ?', [userId]);
    await db.run('DELETE FROM leave_balance WHERE user_id = ?', [userId]);
    await db.run('DELETE FROM approval_workflow WHERE approver_id = ? OR delegated_to = ?', [userId, userId]);
    await db.run('DELETE FROM users WHERE id = ?', [userId]);

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    const isConstraint = /FOREIGN KEY constraint failed/i.test(error.message || '');
    res.status(isConstraint ? 400 : 500).json({
      success: false,
      message: isConstraint
        ? 'Cannot delete this user because they are still linked to other records in the system.'
        : 'Error deleting user'
    });
  }
};

const initializeLeaveBalance = async (db, userId) => {
  const leaveTypes = await db.all('SELECT id, annual_limit FROM leave_types');
  const currentYear = new Date().getFullYear();

  for (const leaveType of leaveTypes) {
    await db.run(
      `INSERT OR IGNORE INTO leave_balance (user_id, leave_type_id, year, total_days, used_days, remaining_days)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, leaveType.id, currentYear, leaveType.annual_limit, 0, leaveType.annual_limit]
    );
  }
};

// Holidays management
const listHolidays = async (req, res) => {
  try {
    const db = getDatabase();
    const holidays = await db.all('SELECT id, date, name FROM public_holidays ORDER BY date ASC');
    res.json({ success: true, data: holidays });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const addHoliday = async (req, res) => {
  try {
    const db = getDatabase();
    const { date, name } = req.body;
    if (!date) return res.status(400).json({ success: false, message: 'Date is required' });
    await db.run('INSERT OR IGNORE INTO public_holidays (date, name) VALUES (?, ?)', [date, name || null]);
    res.json({ success: true, message: 'Holiday added' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const deleteHoliday = async (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    await db.run('DELETE FROM public_holidays WHERE id = ?', [id]);
    res.json({ success: true, message: 'Holiday deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Leave types management (admin)
const listLeaveTypesAdmin = async (req, res) => {
  try {
    const db = getDatabase();
    const types = await db.all('SELECT id, name, annual_limit, description FROM leave_types ORDER BY name');
    res.json({ success: true, data: types });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const addLeaveType = async (req, res) => {
  try {
    const db = getDatabase();
    const { name, annual_limit, description } = req.body;
    if (!name || !annual_limit) return res.status(400).json({ success: false, message: 'Name and annual_limit are required' });
    const result = await db.run('INSERT INTO leave_types (name, annual_limit, description) VALUES (?, ?, ?)', [name, annual_limit, description || null]);
    const created = await db.get('SELECT id, name, annual_limit, description FROM leave_types WHERE id = ?', [result.lastID]);
    res.json({ success: true, data: created });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const updateLeaveType = async (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { name, annual_limit, description } = req.body;
    const existing = await db.get('SELECT id FROM leave_types WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ success: false, message: 'Leave type not found' });
    await db.run('UPDATE leave_types SET name = COALESCE(?, name), annual_limit = COALESCE(?, annual_limit), description = COALESCE(?, description) WHERE id = ?', [name, annual_limit, description, id]);
    const updated = await db.get('SELECT id, name, annual_limit, description FROM leave_types WHERE id = ?', [id]);
    res.json({ success: true, data: updated });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const deleteLeaveType = async (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    await db.run('DELETE FROM leave_types WHERE id = ?', [id]);
    res.json({ success: true, message: 'Leave type deleted' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// Settings management
const listSettings = async (req, res) => {
  try {
    const db = getDatabase();
    const rows = await db.all('SELECT key, value, description FROM settings ORDER BY key');
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const updateSetting = async (req, res) => {
  try {
    const db = getDatabase();
    const { key } = req.params;
    const { value } = req.body;
    await db.run('UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?', [value, key]);
    const updated = await db.get('SELECT key, value, description FROM settings WHERE key = ?', [key]);
    res.json({ success: true, data: updated });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

module.exports = {
  listUsers,
  getUser,
  updateUser,
  deleteUser,
  reviewRegistration,
  listHolidays,
  addHoliday,
  deleteHoliday,
  listLeaveTypesAdmin,
  addLeaveType,
  updateLeaveType,
  deleteLeaveType,
  listSettings,
  updateSetting
};

