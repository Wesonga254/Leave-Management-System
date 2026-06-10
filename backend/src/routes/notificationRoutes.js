const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// Get my notifications
router.get('/', notificationController.listMyNotifications);

// Mark notification as read
router.put('/:id/read', notificationController.markAsRead);

module.exports = router;
