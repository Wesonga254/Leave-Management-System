const express = require('express');
const { getDatabase } = require('../database');
const { body, validationResult } = require('express-validator');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

const router = express.Router();

// Get all leave types
router.get('/', async (req, res) => {
  try {
    const db = getDatabase();
    const leaveTypes = await db.all('SELECT * FROM leave_types');
    res.json({ success: true, data: leaveTypes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create leave type (HR only)
router.post('/', authenticateToken, authorizeRole('hr', 'chief_officer'), [
  body('name').trim().notEmpty().withMessage('Leave type name is required'),
  body('annual_limit').isInt({ min: 1 }).withMessage('Annual limit must be a positive number'),
  body('description').optional().trim()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const db = getDatabase();
    const { name, annual_limit, description } = req.body;

    const result = await db.run(
      'INSERT INTO leave_types (name, annual_limit, description) VALUES (?, ?, ?)',
      [name, annual_limit, description]
    );

    res.status(201).json({
      success: true,
      message: 'Leave type created successfully',
      id: result.lastID
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
