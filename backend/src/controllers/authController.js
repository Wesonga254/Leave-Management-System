const crypto = require('crypto');
const { getDatabase } = require('../database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { notifyUser, sendEmail } = require('../utils/notifications');

const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d\s])\S{8,}$/;

const generateDefaultPassword = () => {
  const random = crypto.randomBytes(4).toString('hex');
  return `Lv${random}A1!`;
};

const sendWelcomeCredentials = async ({ userId, email, firstName, nationalId, employeeId, plainPassword }) => {
  const loginHint = `National ID: ${nationalId} or Employee ID: ${employeeId}`;
  const title = 'Your Leave Management Account';
  const message = `Hello ${firstName},\n\nYour account has been created. Use the credentials below to log in, then change your password from your profile.\n\n${loginHint}\nTemporary password: ${plainPassword}\n\nPlease change this password after your first login.`;

  await notifyUser({
    userId,
    email,
    type: 'account_created',
    title,
    message,
    referenceId: null
  });

  if (email) {
    await sendEmail(
      email,
      title,
      message,
      `<p>Hello ${firstName},</p><p>Your account has been created. Use the credentials below to log in, then change your password from your profile.</p><p><strong>${loginHint}</strong><br><strong>Temporary password:</strong> ${plainPassword}</p><p>Please change this password after your first login.</p>`
    ).catch(() => null);
  }
};

// Register User
const registerUser = async (req, res) => {
  try {
    const db = getDatabase();
    const {
      national_id,
      employee_id,
      password,
      email,
      phone,
      first_name,
      middle_name,
      last_name,
      gender,
      kra_number,
      date_of_birth,
      department,
      reporting_officer_id
    } = req.body;

    // Validate input
    if (!national_id || !employee_id || !email || !first_name || !last_name || !gender || !date_of_birth || !department) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const plainPassword = password || generateDefaultPassword();
    if (!PASSWORD_PATTERN.test(plainPassword)) {
      return res.status(400).json({
        message: 'Password must be at least 8 characters and include uppercase, lowercase, number, special character, and no spaces'
      });
    }

    const existingUser = await db.get(
      `SELECT id FROM users WHERE username = ? OR employee_id = ? OR LOWER(email) = LOWER(?) OR (kra_number IS NOT NULL AND kra_number != '' AND LOWER(kra_number) = LOWER(?))`,
      [national_id, employee_id, email, kra_number || '']
    );
    if (existingUser) {
      return res.status(400).json({ message: 'National ID, employee ID, email, or KRA number already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    const passwordWasGenerated = !password;

    // Determine role: allow admin to set role when creating users via authenticated admin requests
    let assignedRole = 'employee';
    if (req.body.role && req.user && req.user.role === 'admin') {
      assignedRole = req.body.role;
    }
    const registrationStatus = 'approved';
    const verifiedBy = req.user?.id || null;
    const verifiedAt = new Date().toISOString();

    // Insert user (designation will be set during leave application)
    const result = await db.run(
      `INSERT INTO users (
        username, employee_id, password_hash, email, phone, first_name, middle_name, last_name,
        gender, kra_number, date_of_birth, department, designation, reporting_officer_id, role,
        registration_status, verified_by, verified_at
      )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        national_id,
        employee_id,
        hashedPassword,
        email,
        phone,
        first_name,
        middle_name || null,
        last_name,
        gender,
        kra_number || null,
        date_of_birth,
        department,
        'Not Assigned',
        reporting_officer_id || null,
        assignedRole,
        registrationStatus,
        verifiedBy,
        verifiedAt
      ]
    );

    await initializeLeaveBalance(db, result.lastID);

    if (passwordWasGenerated) {
      try {
        await sendWelcomeCredentials({
          userId: result.lastID,
          email,
          firstName: first_name,
          nationalId: national_id,
          employeeId: employee_id,
          plainPassword
        });
      } catch (err) {
        console.error('Welcome email error:', err.message);
      }
    }

    res.status(201).json({
      success: true,
      message: passwordWasGenerated
        ? 'Account created successfully. Login credentials have been sent to the user\'s email.'
        : 'User registered successfully',
      user_id: result.lastID
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error registering user',
      error: error.message
    });
  }
};

// Login User
const loginUser = async (req, res) => {
  try {
    const db = getDatabase();
    const { national_id, employee_id, password } = req.body;

    if (!password) {
      return res.status(400).json({ message: 'Password is required' });
    }

    // Allow login with either national_id or employee_id
    let user;
    if (employee_id) {
      user = await db.get(
        'SELECT * FROM users WHERE employee_id = ?',
        [employee_id]
      );
    } else if (national_id) {
      user = await db.get(
        'SELECT * FROM users WHERE username = ?',
        [national_id]
      );
    } else {
      return res.status(400).json({ message: 'National ID or Employee ID is required' });
    }

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (user.registration_status && user.registration_status !== 'approved') {
      return res.status(403).json({
        message: user.registration_status === 'rejected'
          ? 'This registration request was rejected. Please contact HR.'
          : 'Your account is pending HR approval. You will be able to login after verification.'
      });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid password' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        national_id: user.username,
        email: user.email,
        phone: user.phone,
        profile_image: user.profile_image,
        first_name: user.first_name,
        middle_name: user.middle_name,
        last_name: user.last_name,
        employee_id: user.employee_id,
        gender: user.gender,
        kra_number: user.kra_number,
        date_of_birth: user.date_of_birth,
        department: user.department,
        designation: user.designation,
        registration_status: user.registration_status,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error during login',
      error: error.message
    });
  }
};

// Get Current User
const getCurrentUser = async (req, res) => {
  try {
    const db = getDatabase();
    const user = await db.get(
      `SELECT u.*, supervisor.first_name as supervisor_first_name, supervisor.last_name as supervisor_last_name
       FROM users u
       LEFT JOIN users supervisor ON u.reporting_officer_id = supervisor.id
       WHERE u.id = ?`,
      [req.user.id]
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        national_id: user.username,
        email: user.email,
        phone: user.phone,
        profile_image: user.profile_image,
        first_name: user.first_name,
        middle_name: user.middle_name,
        last_name: user.last_name,
        employee_id: user.employee_id,
        gender: user.gender,
        kra_number: user.kra_number,
        date_of_birth: user.date_of_birth,
        department: user.department,
        designation: user.designation,
        reporting_officer_id: user.reporting_officer_id,
        supervisor_name: [user.supervisor_first_name, user.supervisor_last_name].filter(Boolean).join(' '),
        registration_status: user.registration_status,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching user',
      error: error.message
    });
  }
};

// Update Current User
const updateCurrentUser = async (req, res) => {
  try {
    const db = getDatabase();
    const {
      email,
      phone,
      profile_image,
      first_name,
      middle_name,
      last_name,
      kra_number,
      date_of_birth,
      designation
    } = req.body;

    if (!first_name || !last_name || !email) {
      return res.status(400).json({ message: 'First name, last name, and email are required' });
    }

    await db.run(
      `UPDATE users
       SET email = ?,
           phone = ?,
           profile_image = ?,
           first_name = ?,
           middle_name = ?,
           last_name = ?,
           kra_number = ?,
           date_of_birth = ?,
           designation = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        email,
        phone || null,
        profile_image || null,
        first_name,
        middle_name || null,
        last_name,
        kra_number || null,
        date_of_birth || null,
        designation || null,
        req.user.id
      ]
    );

    return getCurrentUser(req, res);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating profile',
      error: error.message
    });
  }
};

const changePassword = async (req, res) => {
  try {
    const db = getDatabase();
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }

    if (!PASSWORD_PATTERN.test(new_password)) {
      return res.status(400).json({
        message: 'New password must be at least 8 characters and include uppercase, lowercase, number, special character, and no spaces'
      });
    }

    const user = await db.get('SELECT id, password_hash FROM users WHERE id = ?', [req.user.id]);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const passwordMatch = await bcrypt.compare(current_password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(new_password, 10);
    await db.run(
      'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [hashedPassword, req.user.id]
    );

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating password',
      error: error.message
    });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getCurrentUser,
  updateCurrentUser,
  changePassword
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
