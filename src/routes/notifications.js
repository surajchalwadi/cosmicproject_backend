const express = require('express');
const {
  getUserNotifications,
  createNotification,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getNotificationStats,
} = require('../controllers/notificationController');
const { protect, authorize } = require('../middleware/auth');
const { validateCreateNotification } = require('../middleware/validation');

const router = express.Router();

// All routes are protected
router.use(protect);

// Get user notifications
router.get('/', getUserNotifications);

// Get notification statistics
router.get('/stats', getNotificationStats);

// Mark all notifications as read
router.put('/read-all', markAllAsRead);

// Create notification (super-admin and manager only)
router.post('/', authorize('super-admin', 'manager'), validateCreateNotification, createNotification);

// Mark notification as read
router.put('/:id/read', markAsRead);

// Delete notification
router.delete('/:id', deleteNotification);

module.exports = router;