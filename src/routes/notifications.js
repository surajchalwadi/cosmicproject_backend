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
const Notification = require('../models/Notification');
const notificationService = require('../services/notificationService');

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

// Test notification endpoint (for debugging)
router.post('/test', async (req, res) => {
  try {
    const { userId, message = 'Test notification' } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        status: 'error',
        message: 'userId is required'
      });
    }

    const testNotification = {
      title: 'Test Notification',
      message: message,
      type: 'info',
      priority: 'medium',
      category: 'general'
    };

    const result = await notificationService.sendRealTimeNotification(userId, testNotification);
    
    res.status(200).json({
      status: 'success',
      message: 'Test notification sent successfully',
      data: result
    });
  } catch (error) {
    console.error('Test notification error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to send test notification',
      error: error.message
    });
  }
});

module.exports = router;