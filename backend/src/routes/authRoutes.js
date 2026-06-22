const express = require('express');
const router = express.Router();
const {
  registerUser,
  loginUser,
  getCurrentUser,
  updateCurrentUser,
  changePassword,
  forgotPassword,
  resetPassword
} = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

// Register
router.post('/register', registerUser);

// Login
router.post('/login', loginUser);

// Password Reset (public — no auth needed)
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Public departments list (for registration form dropdown — no auth needed)
router.get('/departments', async (req, res) => {
  try {
    const { getDatabase } = require('../database');
    const db = getDatabase();
    const departments = await db.all('SELECT id, name FROM departments ORDER BY name');
    res.json({ success: true, data: departments });
  } catch (err) {
    // Fallback to the shared constant if DB fails
    const { BUSIA_COUNTY_DEPARTMENTS } = require('../../../shared/departments');
    res.json({
      success: true,
      data: BUSIA_COUNTY_DEPARTMENTS.map((name, i) => ({ id: i + 1, name }))
    });
  }
});

// Public directorates list (for registration form — no auth needed)
router.get('/directorates', async (req, res) => {
  try {
    const { getDatabase } = require('../database');
    const db = getDatabase();
    const { department_id } = req.query;
    let query = 'SELECT id, name, department_id FROM directorates';
    const params = [];
    if (department_id) {
      query += ' WHERE department_id = ?';
      params.push(department_id);
    }
    query += ' ORDER BY name';
    const directorates = await db.all(query, params);
    res.json({ success: true, data: directorates });
  } catch (err) {
    res.json({ success: true, data: [] });
  }
});

// Get Current User
router.get('/me', authenticateToken, getCurrentUser);
router.put('/me', authenticateToken, updateCurrentUser);
router.put('/me/password', authenticateToken, changePassword);

module.exports = router;

