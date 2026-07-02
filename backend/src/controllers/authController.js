const crypto = require('crypto');
const { getDatabase } = require('../database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { notifyUser, sendEmail } = require('../utils/notifications');
const { isLeaveTypeApplicableToGender } = require('../utils/leaveTypeGender');

const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d\s])\S{8,}$/;
const ACCOUNT_STATUS = {
  PENDING: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED'
};

const generateDefaultPassword = () => {
  const random = crypto.randomBytes(4).toString('hex');
  return `Lv${random}A1!`;
};

const sendWelcomeCredentials = async ({ userId, email, firstName, nationalId, employeeId, plainPassword, passwordWasGenerated }) => {
  const loginUrl = (process.env.FRONTEND_URL || 'http://localhost:3000') + '/login';
  const title = 'Your Login Credentials — Busia County Leave Management System';

  const textMessage = [
    `Hello ${firstName},`,
    '',
    'Your account has been created successfully on the Busia County Leave Management System.',
    'Use the credentials below to log in:',
    '',
    `Email: ${email}`,
    `National ID (Login): ${nationalId}`,
    `Employee ID: ${employeeId}`,
    passwordWasGenerated ? `Temporary Password: ${plainPassword}` : 'Password: Use the password you set during registration',
    '',
    `Login here: ${loginUrl}`,
    '',
    passwordWasGenerated ? 'Please change your password after your first login.' : '',
  ].filter(Boolean).join('\n');

  // fire-and-forget: don't block the registration response
  setImmediate(async () => {
    try {
      console.log(`[Registration] Sending welcome credentials to ${email} (userId: ${userId})`);

      // Create in-app notification
      if (userId) {
        const { createInAppNotification } = require('../utils/notifications');
        await createInAppNotification(userId, 'account_created', title, textMessage, null);
      }

      // Send the polished HTML email
      if (email) {
        const html = `
          <div style="font-family:'Inter',Arial,sans-serif;max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
            <div style="background:linear-gradient(135deg,#145A32 0%,#1E5494 50%,#2D6BB0 100%);padding:28px 32px;text-align:center">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700">Busia County Leave Management System</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:13px">Your Login Credentials</p>
            </div>
            <div style="padding:32px">
              <p style="color:#0f172a;font-size:16px;margin:0 0 18px">Hello <strong>${firstName}</strong>,</p>
              <p style="color:#334155;font-size:14px;line-height:1.6;margin:0 0 20px">Your account has been created successfully. Use the credentials below to log in and get started.</p>
              
              <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin:0 0 24px">
                <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 18px;border-bottom:1px solid #e2e8f0">
                  <span style="color:#64748b;font-size:13px;font-weight:600">Email</span>
                  <span style="color:#0f172a;font-size:14px;font-weight:600;font-family:'SF Mono',Consolas,monospace">${email}</span>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 18px;border-bottom:1px solid #e2e8f0">
                  <span style="color:#64748b;font-size:13px;font-weight:600">National ID (Login)</span>
                  <span style="color:#0f172a;font-size:14px;font-weight:600;font-family:'SF Mono',Consolas,monospace">${nationalId}</span>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 18px;border-bottom:1px solid #e2e8f0">
                  <span style="color:#64748b;font-size:13px;font-weight:600">Employee ID</span>
                  <span style="color:#0f172a;font-size:14px;font-weight:600;font-family:'SF Mono',Consolas,monospace">${employeeId}</span>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px;background:#ecfdf5;border-left:4px solid #16a34a">
                  <span style="color:#166534;font-size:13px;font-weight:700">${passwordWasGenerated ? 'Temporary Password' : 'Password'}</span>
                  <span style="color:#166534;font-size:16px;font-weight:800;font-family:'SF Mono',Consolas,monospace;letter-spacing:1px">${passwordWasGenerated ? plainPassword : 'As set during registration'}</span>
                </div>
              </div>

              <div style="text-align:center;margin:0 0 24px">
                <a href="${loginUrl}" style="display:inline-block;background:linear-gradient(135deg,#145A32 0%,#1E5494 50%,#2D6BB0 100%);color:#ffffff;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;letter-spacing:0.5px">Login to Your Account</a>
              </div>
              ${passwordWasGenerated ? '<p style="color:#64748b;font-size:13px;text-align:center;margin:0">Please change your password after your first login.</p>' : ''}
            </div>
            <div style="background:#f8fafc;padding:16px 32px;text-align:center;border-top:1px solid #e2e8f0">
              <p style="margin:0;color:#94a3b8;font-size:12px">County Government of Busia — Leave Management System</p>
            </div>
          </div>`;
        const emailResult = await sendEmail(email, title, textMessage, html).catch((err) => {
          console.error(`[Registration] ❌ Failed to send welcome email to ${email}:`, err.message);
          return null;
        });
        if (emailResult) {
          console.log(`[Registration] ✓ Welcome email sent successfully to ${email} — messageId: ${emailResult.messageId}`);
        } else {
          console.error(`[Registration] ❌ sendEmail returned falsy for ${email} — check SMTP config`);
        }
      } else {
        console.warn(`[Registration] No email address provided for userId ${userId} — skipping email`);
      }
    } catch (err) {
      console.error('[Registration] Welcome email dispatch error:', err.message, err.stack);
    }
  });
};

const ensureDepartment = async (db, department) => {
  const name = String(department || '').trim();
  if (!name) return null;
  // Only match existing official departments — do NOT auto-create new ones
  const match = await db.get('SELECT id, name, director_id FROM departments WHERE LOWER(TRIM(name)) = LOWER(?)', [name]);
  if (match) return match;
  // If no exact match, try a partial match as fallback
  const partial = await db.get('SELECT id, name, director_id FROM departments WHERE LOWER(name) LIKE ?', [`%${name.toLowerCase()}%`]);
  return partial || null;
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
      directorate_id,
      designation,
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
    const departmentRecord = await ensureDepartment(db, department);

    // Determine role: allow admin to set role when creating users via authenticated admin requests
    let assignedRole = 'employee';
    if (req.body.role && req.user && req.user.role === 'admin') {
      assignedRole = req.body.role;
    }
    const isAdminCreated = req.user?.role === 'admin';
    const registrationStatus = isAdminCreated ? ACCOUNT_STATUS.APPROVED : ACCOUNT_STATUS.PENDING;
    const isActive = isAdminCreated ? 1 : 0;
    const verifiedBy = isAdminCreated ? req.user.id : null;
    const verifiedAt = isAdminCreated ? new Date().toISOString() : null;

    // Insert user (designation will be set during leave application)
    const result = await db.run(
      `INSERT INTO users (
        username, employee_id, password_hash, email, phone, first_name, middle_name, last_name,
        gender, kra_number, date_of_birth, department, department_id, directorate_id, designation, reporting_officer_id, role,
        registration_status, is_active, verified_by, verified_at
      )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        departmentRecord?.name || department,
        departmentRecord?.id || null,
        directorate_id || null,
        designation || 'Not Assigned',
        reporting_officer_id || null,
        assignedRole,
        registrationStatus,
        isActive,
        verifiedBy,
        verifiedAt
      ]
    );

    await initializeLeaveBalance(db, result.lastID);

    // Send welcome email for ALL new registrations (async, non-blocking)
    try {
      sendWelcomeCredentials({
        userId: result.lastID,
        email,
        firstName: first_name,
        nationalId: national_id,
        employeeId: employee_id,
        plainPassword,
        passwordWasGenerated
      });
    } catch (err) {
      console.error('Welcome email error:', err.message);
    }

    // Notify all admin users about the new registration
    try {
      const admins = await db.all(`SELECT id, email, phone FROM users WHERE role = 'admin'`);
      const fullName = [first_name, last_name].filter(Boolean).join(' ');
      const isApproved = registrationStatus === ACCOUNT_STATUS.APPROVED;
      for (const admin of admins) {
        await notifyUser({
          userId: admin.id,
          email: admin.email,
          phone: admin.phone,
          type: 'new_registration',
          title: isApproved ? 'New Staff Account' : 'Registration Pending',
          message: isApproved
            ? `${fullName} (${employee_id}) has been added to ${department} as ${assignedRole}.`
            : `${fullName} (${employee_id}) has registered under ${department} and needs approval.`,
          referenceId: result.lastID
        });
      }
    } catch (err) {
      console.error('Admin notification error:', err.message);
    }

    const responseData = {
      success: true,
      message: passwordWasGenerated
        ? isAdminCreated
          ? 'Account created successfully. Login credentials have been sent to the user\'s email.'
          : 'Registration submitted successfully. Login credentials have been emailed, but access requires admin approval.'
        : 'User registered successfully and is pending admin approval',
      user_id: result.lastID
    };

    // Return the generated password to admin so they can share it manually if email fails
    if (isAdminCreated && passwordWasGenerated) {
      responseData.temporary_password = plainPassword;
      responseData.login_id = national_id;
      responseData.employee_id = employee_id;
      responseData.user_email = email;
    }

    res.status(201).json(responseData);
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
    const { password } = req.body;
    const employee_id = req.body.employee_id ? String(req.body.employee_id).trim() : undefined;
    const national_id = req.body.national_id ? String(req.body.national_id).trim() : undefined;

    if (!password) {
      return res.status(400).json({ message: 'Password is required' });
    }

    // Allow login with either national_id or employee_id
    let user;
    if (employee_id) {
      user = await db.get(
        'SELECT * FROM users WHERE LOWER(employee_id) = LOWER(?)',
        [employee_id]
      );
    } else if (national_id) {
      user = await db.get(
        'SELECT * FROM users WHERE LOWER(username) = LOWER(?)',
        [national_id]
      );
    } else {
      return res.status(400).json({ message: 'National ID or Employee ID is required' });
    }

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const registrationStatus = String(user.registration_status || '').toUpperCase();
    if (user.is_active === 0 || (registrationStatus && !['APPROVED'].includes(registrationStatus))) {
      return res.status(403).json({
        message: registrationStatus === ACCOUNT_STATUS.REJECTED
          ? 'This registration request was rejected. Please contact an administrator.'
          : 'Your account is pending admin approval. You will be able to login after verification.'
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

// Forgot Password — send reset code via email
const forgotPassword = async (req, res) => {
  try {
    const db = getDatabase();
    const { identifier } = req.body;

    if (!identifier || !String(identifier).trim()) {
      return res.status(400).json({ message: 'Employee ID or National ID is required' });
    }

    const id = String(identifier).trim();

    // Look up user by employee_id or national_id (username)
    const user = await db.get(
      'SELECT id, email, first_name, employee_id, username FROM users WHERE LOWER(employee_id) = LOWER(?) OR LOWER(username) = LOWER(?)',
      [id, id]
    );

    // Always respond with success to prevent user enumeration
    if (!user || !user.email) {
      return res.json({ success: true, message: 'If an account with that ID exists, a reset code has been sent to the registered email.' });
    }

    // Generate a 6-digit numeric reset code
    const resetCode = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes

    // Store the reset code in the database
    await db.run(
      `UPDATE users SET reset_code = ?, reset_code_expires = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [resetCode, expiresAt, user.id]
    );

    // Send the reset code via email
    const loginUrl = (process.env.FRONTEND_URL || 'http://localhost:3000') + '/reset-password';
    const html = `
      <div style="font-family:'Inter',Arial,sans-serif;max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
        <div style="background:linear-gradient(135deg,#145A32 0%,#1E5494 50%,#2D6BB0 100%);padding:28px 32px;text-align:center">
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700">Password Reset</h1>
        </div>
        <div style="padding:32px">
          <p style="color:#0f172a;font-size:16px;margin:0 0 18px">Hello <strong>${user.first_name}</strong>,</p>
          <p style="color:#334155;font-size:14px;line-height:1.6;margin:0 0 20px">You requested a password reset. Use the code below to reset your password. This code expires in 15 minutes.</p>
          <div style="text-align:center;margin:0 0 24px">
            <span style="display:inline-block;background:#f8fafc;border:2px solid #1B7340;border-radius:12px;padding:18px 36px;font-size:32px;font-weight:800;letter-spacing:8px;color:#0f172a">${resetCode}</span>
          </div>
          <p style="color:#64748b;font-size:13px;text-align:center;margin:0">If you did not request this, ignore this email. Your password will remain unchanged.</p>
        </div>
        <div style="background:#f8fafc;padding:16px 32px;text-align:center;border-top:1px solid #e2e8f0">
          <p style="margin:0;color:#94a3b8;font-size:12px">Busia County Leave Management System</p>
        </div>
      </div>`;

    const textMessage = `Hello ${user.first_name},\n\nYour password reset code is: ${resetCode}\n\nThis code expires in 15 minutes.\n\nIf you did not request this, ignore this email.`;

    await sendEmail(user.email, 'Password Reset Code — Busia County LMS', textMessage, html);

    res.json({ success: true, message: 'If an account with that ID exists, a reset code has been sent to the registered email.' });
  } catch (error) {
    console.error('[ForgotPassword] Error:', error.message);
    res.status(500).json({ success: false, message: 'Error processing password reset request' });
  }
};

// Reset Password — verify code and set new password
const resetPassword = async (req, res) => {
  try {
    const db = getDatabase();
    const { identifier, code, new_password } = req.body;

    if (!identifier || !code || !new_password) {
      return res.status(400).json({ message: 'ID, reset code, and new password are required' });
    }

    if (!PASSWORD_PATTERN.test(new_password)) {
      return res.status(400).json({
        message: 'Password must be at least 8 characters and include uppercase, lowercase, number, special character, and no spaces'
      });
    }

    const id = String(identifier).trim();
    const user = await db.get(
      'SELECT id, reset_code, reset_code_expires FROM users WHERE LOWER(employee_id) = LOWER(?) OR LOWER(username) = LOWER(?)',
      [id, id]
    );

    if (!user || !user.reset_code) {
      return res.status(400).json({ message: 'Invalid or expired reset code' });
    }

    // Check code match
    if (user.reset_code !== String(code).trim()) {
      return res.status(400).json({ message: 'Invalid reset code' });
    }

    // Check expiry
    if (user.reset_code_expires && new Date(user.reset_code_expires) < new Date()) {
      return res.status(400).json({ message: 'Reset code has expired. Please request a new one.' });
    }

    // Hash and update
    const hashedPassword = await bcrypt.hash(new_password, 10);
    await db.run(
      'UPDATE users SET password_hash = ?, reset_code = NULL, reset_code_expires = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [hashedPassword, user.id]
    );

    res.json({ success: true, message: 'Password has been reset successfully. You can now login with your new password.' });
  } catch (error) {
    console.error('[ResetPassword] Error:', error.message);
    res.status(500).json({ success: false, message: 'Error resetting password' });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getCurrentUser,
  updateCurrentUser,
  changePassword,
  forgotPassword,
  resetPassword
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
