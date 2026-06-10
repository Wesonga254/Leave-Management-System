const express = require('express');
const router = express.Router();
const {
  registerUser,
  loginUser,
  getCurrentUser,
  updateCurrentUser,
  changePassword
} = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

// Register
router.post('/register', registerUser);

// Login
router.post('/login', loginUser);

// Get Current User
router.get('/me', authenticateToken, getCurrentUser);
router.put('/me', authenticateToken, updateCurrentUser);
router.put('/me/password', authenticateToken, changePassword);

module.exports = router;
