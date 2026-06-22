const { getDatabase } = require('../database');
const { isLeaveTypeApplicableToGender } = require('../utils/leaveTypeGender');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { notifyUser, sendEmail } = require('../utils/notifications');
const carryForwardService = require('../services/carryForwardService');

// List users (admin only)
const listUsers = async (req, res) => {
  try {
    const db = getDatabase();

    let query = `
      SELECT u.id, u.username, u.employee_id, u.first_name, u.middle_name, u.last_name, u.email, u.department, u.department_id, u.designation, u.role,
             u.gender, u.kra_number, u.date_of_birth, u.registration_status, u.verified_at, u.verification_notes, u.created_at,
             COALESCE(
               (SELECT dir.name FROM directorates dir WHERE dir.director_id = u.id LIMIT 1),
               (SELECT dir.name FROM directorates dir
                JOIN users sup ON sup.id = u.reporting_officer_id
                WHERE dir.director_id = sup.id OR dir.director_id = (SELECT sup2.reporting_officer_id FROM users sup2 WHERE sup2.id = u.reporting_officer_id)
                LIMIT 1)
             ) as directorate_name
      FROM users u
    `;
    const params = [];

    // Directors only see users in their department
    if (req.user.role === 'director') {
      // Check directorates first (preferred), then fall back to departments
      let deptId = null;
      const directorate = await db.get(
        `SELECT dir.department_id FROM directorates dir WHERE dir.director_id = ? LIMIT 1`,
        [req.user.id]
      );
      if (directorate) {
        deptId = directorate.department_id;
      } else {
        const dept = await db.get(
          `SELECT d.id FROM departments d WHERE d.director_id = ? LIMIT 1`,
          [req.user.id]
        );
        if (dept) deptId = dept.id;
      }
      if (deptId) {
        query += ` WHERE u.department_id = ?`;
        params.push(deptId);
      }
    }

    query += ` ORDER BY
      CASE u.registration_status WHEN 'pending_hr_approval' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
      u.id DESC`;

    const users = await db.all(query, params);
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
      SELECT u.id, u.username, u.employee_id, u.first_name, u.middle_name, u.last_name, u.email, u.phone, u.department,
             u.designation, u.role, u.reporting_officer_id, u.gender, u.kra_number, u.date_of_birth,
             u.registration_status, u.is_active, u.directorate_id,
             s.first_name || ' ' || s.last_name as supervisor_name
      FROM users u
      LEFT JOIN users s ON u.reporting_officer_id = s.id
      WHERE u.id = ?
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

// Update user (admin only) - can change profile, role, department, designation
const updateUser = async (req, res) => {
  try {
    const db = getDatabase();
    const userId = req.params.id;
    const { role, department, designation, reporting_officer_id, directorate_id,
            first_name, middle_name, last_name, email, gender, employee_id } = req.body;

    const existing = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
    if (!existing) return res.status(404).json({ success: false, message: 'User not found' });

    const newRole = role || existing.role;
    const newDepartment = department || existing.department;

    // If user was previously a director and role is changing away from director, unset them
    if (existing.role === 'director' && newRole !== 'director') {
      await db.run(
        `UPDATE directorates SET director_id = NULL WHERE director_id = ?`,
        [userId]
      );
      await db.run(
        `UPDATE departments SET director_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE director_id = ?`,
        [userId]
      );
    }

    // Determine the effective reporting_officer_id — allow explicit clearing
    const effectiveReportingOfficer = 'reporting_officer_id' in req.body
      ? (reporting_officer_id || null)
      : existing.reporting_officer_id;

    await db.run(
      `UPDATE users SET
        first_name = COALESCE(?, first_name),
        middle_name = COALESCE(?, middle_name),
        last_name = COALESCE(?, last_name),
        email = COALESCE(?, email),
        gender = COALESCE(?, gender),
        employee_id = COALESCE(?, employee_id),
        role = COALESCE(?, role),
        department = COALESCE(?, department),
        designation = COALESCE(?, designation),
        reporting_officer_id = ?,
        directorate_id = COALESCE(?, directorate_id),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [first_name, middle_name !== undefined ? middle_name : null, last_name, email, gender,
       employee_id, role, department, designation, effectiveReportingOfficer,
       directorate_id !== undefined ? directorate_id : null, userId]
    );

    // Sync department_id
    if (newDepartment) {
      const dept = await db.get('SELECT id FROM departments WHERE LOWER(name) = LOWER(?)', [newDepartment]);
      if (dept) {
        await db.run('UPDATE users SET department_id = ? WHERE id = ?', [dept.id, userId]);

        // If role is (now) director, also set departments.director_id for dashboard compatibility
        if (newRole === 'director') {
          await db.run(
            `UPDATE departments SET director_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [userId, dept.id]
          );
        }
      }
    }

    const updated = await db.get(
      `SELECT id, username, employee_id, first_name, middle_name, last_name, email,
              department, designation, role, gender, directorate_id
       FROM users WHERE id = ?`, [userId]);
    res.json({ success: true, data: updated, message: 'User updated successfully' });
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
  const user = await db.get('SELECT gender FROM users WHERE id = ?', [userId]);
  const gender = user?.gender || 'All';
  const leaveTypes = await db.all('SELECT id, annual_limit, applicable_gender FROM leave_types');
  const currentYear = new Date().getFullYear();

  for (const leaveType of leaveTypes) {
    if (isLeaveTypeApplicableToGender(leaveType, gender)) {
      await db.run(
        `INSERT OR IGNORE INTO leave_balance (user_id, leave_type_id, year, total_days, used_days, remaining_days)
         VALUES (?, ?, ?, ?, 0, ?)`,
        [userId, leaveType.id, currentYear, leaveType.annual_limit, leaveType.annual_limit]
      );
    }
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


const sendWelcomeCredentials = async ({ userId, email, firstName, nationalId, employeeId, plainPassword }) => {
  const loginUrl = (process.env.FRONTEND_URL || 'http://localhost:3000') + '/login';
  const loginHint = `National ID: ${nationalId} or Employee ID: ${employeeId}`;
  const title = 'Your Leave Management Account';
  const message = `Hello ${firstName},\n\nYour account has been created. Use the credentials below to log in, then change your password from your profile.\n\n${loginHint}\nTemporary password: ${plainPassword}\n\nPlease change this password after your first login.`;

  // Create in-app notification only (skip email here to avoid duplicate)
  try {
    const { createInAppNotification } = require('../utils/notifications');
    await createInAppNotification(userId, 'account_created', title, message, null);
  } catch (err) {
    console.error('[PrivilegedAccount] In-app notification error:', err.message);
  }

  // Send one polished HTML email
  if (email) {
    try {
      const html = `
        <div style="font-family:'Inter',Arial,sans-serif;max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
          <div style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);padding:28px 32px;text-align:center">
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700">Leave Management System</h1>
          </div>
          <div style="padding:32px">
            <p style="color:#0f172a;font-size:16px;margin:0 0 18px">Hello <strong>${firstName}</strong>,</p>
            <p style="color:#334155;font-size:14px;line-height:1.6;margin:0 0 20px">Your account has been created. Use the credentials below to log in, then change your password from your profile.</p>
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #0f766e;border-radius:8px;padding:18px;margin:0 0 24px">
              <p style="margin:0 0 8px;color:#0f172a;font-size:14px"><strong>Login ID:</strong> ${loginHint}</p>
              <p style="margin:0;color:#0f172a;font-size:14px"><strong>Temporary Password:</strong> ${plainPassword}</p>
            </div>
            <div style="text-align:center;margin:0 0 24px">
              <a href="${loginUrl}" style="display:inline-block;background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);color:#ffffff;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;letter-spacing:0.5px">Login to Your Account</a>
            </div>
            <p style="color:#64748b;font-size:13px;text-align:center;margin:0">Please change your password after your first login.</p>
          </div>
          <div style="background:#f8fafc;padding:16px 32px;text-align:center;border-top:1px solid #e2e8f0">
            <p style="margin:0;color:#94a3b8;font-size:12px">This is an automated message from the Leave Management System.</p>
          </div>
        </div>`;
      const result = await sendEmail(email, title, message, html);
      if (result) {
        console.log(`[PrivilegedAccount] ✓ Welcome email sent to ${email} — messageId: ${result.messageId}`);
      } else {
        console.error(`[PrivilegedAccount] ❌ sendEmail returned falsy for ${email} — check SMTP config`);
      }
    } catch (err) {
      console.error(`[PrivilegedAccount] ❌ Failed to send welcome email to ${email}:`, err.message);
    }
  } else {
    console.warn(`[PrivilegedAccount] No email address for userId ${userId} — skipping email`);
  }
};

const createPrivilegedAccount = async (req, res) => {
  try {
    const db = getDatabase();
    const {
      national_id,
      employee_id,
      email,
      first_name,
      last_name,
      gender,
      date_of_birth,
      department,
      directorate_id,
      reporting_officer_id,
      assigned_role
    } = req.body;

    if (!national_id || !employee_id || !email || !first_name || !last_name || !gender || !date_of_birth || !department || !assigned_role) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Supervisors and directors must be assigned to a directorate
    if (assigned_role === 'supervisor' || assigned_role === 'director') {
      if (!directorate_id) {
        return res.status(400).json({ success: false, message: `A directorate must be selected when creating a ${assigned_role} account.` });
      }
      const directorate = await db.get('SELECT id, name, director_id FROM directorates WHERE id = ?', [directorate_id]);
      if (!directorate) {
        return res.status(400).json({ success: false, message: 'Selected directorate not found.' });
      }
      // Only directors have exclusivity — one per directorate
      if (assigned_role === 'director' && directorate.director_id) {
        const currentDirector = await db.get('SELECT first_name, last_name FROM users WHERE id = ?', [directorate.director_id]);
        return res.status(400).json({
          success: false,
          message: `The directorate "${directorate.name}" already has a director: ${currentDirector ? currentDirector.first_name + ' ' + currentDirector.last_name : 'Unknown'}. Each directorate can only have one director.`
        });
      }
    }

    const existingUser = await db.get(
      `SELECT id FROM users WHERE username = ? OR employee_id = ? OR LOWER(email) = LOWER(?)`,
      [national_id, employee_id, email]
    );
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'National ID, employee ID, or email already exists' });
    }

    // Look up department_id for FK consistency
    const deptRow = await db.get('SELECT id FROM departments WHERE LOWER(name) = LOWER(?)', [department]);
    const departmentId = deptRow ? deptRow.id : null;

    const random = crypto.randomBytes(4).toString('hex');
    const plainPassword = `Lv${random}A1!`;
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    const result = await db.run(
      `INSERT INTO users (
        username, employee_id, password_hash, email, first_name, last_name,
        gender, date_of_birth, department, department_id, directorate_id, designation, reporting_officer_id, role,
        registration_status, is_active, verified_by, verified_at
      )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', 1, ?, CURRENT_TIMESTAMP)`,
      [
        national_id,
        employee_id,
        hashedPassword,
        email,
        first_name,
        last_name,
        gender,
        date_of_birth,
        department,
        departmentId,
        directorate_id || null,
        'Not Assigned',
        reporting_officer_id || null,
        assigned_role,
        req.user.id
      ]
    );

    const userId = result.lastID;
    await initializeLeaveBalance(db, userId);

    // If role is director, assign them as the head of the selected directorate
    if (assigned_role === 'director' && directorate_id) {
      await db.run(
        `UPDATE directorates SET director_id = ? WHERE id = ?`,
        [userId, directorate_id]
      );

      // Also set departments.director_id so the Director Dashboard works
      if (departmentId) {
        await db.run(
          `UPDATE departments SET director_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [userId, departmentId]
        );
      }
    }

    try {
      await sendWelcomeCredentials({
        userId,
        email,
        firstName: first_name,
        nationalId: national_id,
        employeeId: employee_id,
        plainPassword
      });
    } catch (err) {
      console.error('Welcome email error:', err.message);
    }

    // Get directorate name for success message
    let assignedDirName = '';
    if (directorate_id) {
      const dirInfo = await db.get('SELECT name FROM directorates WHERE id = ?', [directorate_id]);
      assignedDirName = dirInfo ? dirInfo.name : '';
    }

    const roleMessages = {
      director: `Director account created and assigned to head the "${assignedDirName}" directorate under ${department}. Login credentials have been sent.`,
      supervisor: `Supervisor account created and assigned to the "${assignedDirName}" directorate under ${department}. Login credentials have been sent.`
    };

    res.status(201).json({
      success: true,
      message: roleMessages[assigned_role] || 'Privileged user created successfully and login credentials have been sent.',
      user_id: userId,
      temporary_password: plainPassword,
      login_id: national_id,
      employee_id: employee_id,
      user_email: email
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const runCarryForwardNow = async (req, res) => {
  try {
    const { fromYear, toYear } = req.body;
    const summary = await carryForwardService.runCarryForward({
      fromYear,
      toYear,
      source: 'manual',
      processedBy: req.user.id
    });
    res.json({ success: true, message: 'Carry-forward executed successfully', data: summary });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const listCarryForwardLog = async (req, res) => {
  try {
    const db = getDatabase();
    const logs = await db.all(
      `SELECT
         l.*,
         u.first_name || ' ' || u.last_name as employee_name,
         u.employee_id,
         lt.name as leave_type,
         p.first_name || ' ' || p.last_name as processed_by_name
       FROM leave_carry_forward_log l
       JOIN users u ON l.user_id = u.id
       JOIN leave_types lt ON l.leave_type_id = lt.id
       LEFT JOIN users p ON l.processed_by = p.id
       ORDER BY l.processed_at DESC`
    );
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
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
  updateSetting,
  createPrivilegedAccount,
  runCarryForwardNow,
  listCarryForwardLog
};

