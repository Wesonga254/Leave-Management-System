const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDatabase } = require('../database');
const { body, validationResult } = require('express-validator');

const router = express.Router();

// Register endpoint
router.post('/register', [
  body('national_id').trim().notEmpty().withMessage('National ID is required'),
  body('employee_id').trim().notEmpty().withMessage('Employee ID is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('first_name').trim().notEmpty().withMessage('First name is required'),
  body('last_name').trim().notEmpty().withMessage('Last name is required'),
  body('department').trim().notEmpty().withMessage('Department is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const db = getDatabase();
    const { national_id, employee_id, password, email, phone, first_name, last_name, department } = req.body;

    // Check if user already exists
    const existingUser = await db.get('SELECT * FROM users WHERE username = ? OR employee_id = ?', [national_id, employee_id]);
    if (existingUser) {
      return res.status(400).json({ message: 'National ID or Employee ID already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    const result = await db.run(
      `INSERT INTO users (username, employee_id, password_hash, email, phone, first_name, last_name, department, designation, role)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [national_id, employee_id, hashedPassword, email, phone, first_name, last_name, department, 'Not Assigned', 'employee']
    );

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      userId: result.lastID
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Login endpoint
router.post('/login', [
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

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

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ message: 'Invalid password' });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
        employee_id: user.employee_id
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        employee_id: user.employee_id,
        department: user.department,
        designation: user.designation,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
