const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authController = require('../controllers/authController');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// All admin routes require authentication and admin role
router.use(authenticateToken);

// Users management
router.get('/users', authorizeRole('hr', 'admin'), adminController.listUsers);
router.get('/users/:id', authorizeRole('hr', 'admin'), adminController.getUser);
router.put('/users/:id/registration', authorizeRole('hr', 'admin'), adminController.reviewRegistration);
router.put('/users/:id', authorizeRole('admin'), adminController.updateUser);
router.delete('/users/:id', authorizeRole('admin'), adminController.deleteUser);
// Admin can create users
router.post('/users', authorizeRole('admin'), async (req, res) => authController.registerUser(req, res));

// Holidays management
router.get('/holidays', authorizeRole('admin'), async (req, res) => adminController.listHolidays(req, res));
router.post('/holidays', authorizeRole('admin'), async (req, res) => adminController.addHoliday(req, res));
router.delete('/holidays/:id', authorizeRole('admin'), async (req, res) => adminController.deleteHoliday(req, res));

// Leave types management (admin)
router.get('/leave-types', authorizeRole('admin'), async (req, res) => adminController.listLeaveTypesAdmin(req, res));
router.post('/leave-types', authorizeRole('admin'), async (req, res) => adminController.addLeaveType(req, res));
router.put('/leave-types/:id', authorizeRole('admin'), async (req, res) => adminController.updateLeaveType(req, res));
router.delete('/leave-types/:id', authorizeRole('admin'), async (req, res) => adminController.deleteLeaveType(req, res));

// Settings
router.get('/settings', authorizeRole('admin'), async (req, res) => adminController.listSettings(req, res));
router.put('/settings/:key', authorizeRole('admin'), async (req, res) => adminController.updateSetting(req, res));

module.exports = router;
