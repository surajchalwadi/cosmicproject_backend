const Notification = require('../models/Notification');
const logger = require('../utils/logger');

/**
 * Get User Notifications
 * @desc Get all notifications for the current user
 * @route GET /api/notifications
 * @access Private
 */
const getUserNotifications = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      type,
      isRead,
      priority,
      category,
    } = req.query;

    // Build filter object
    const filter = { userId: req.user.id };
    if (type) filter.type = type;
    if (isRead !== undefined) filter.isRead = isRead === 'true';
    if (priority) filter.priority = priority;
    if (category) filter.category = category;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get notifications with pagination
    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const totalNotifications = await Notification.countDocuments(filter);
    const totalPages = Math.ceil(totalNotifications / parseInt(limit));

    // Get unread count
    const unreadCount = await Notification.getUnreadCount(req.user.id);

    res.status(200).json({
      status: 'success',
      data: {
        notifications,
        unreadCount,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalNotifications,
          hasNext: parseInt(page) < totalPages,
          hasPrev: parseInt(page) > 1,
        },
      },
    });
  } catch (error) {
    logger.error(`Get user notifications error: ${error.message}`);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch notifications',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
};

/**
 * Create Notification
 * @desc Create a new notification
 * @route POST /api/notifications
 * @access Private (super-admin and manager only)
 */
const createNotification = async (req, res) => {
  try {
    const { userId, title, message, type, priority, category, expiresAt } = req.body;

    const notification = await Notification.create({
      userId,
      title,
      message,
      type,
      priority,
      category,
      expiresAt,
    });

    logger.info(`Notification created for user ${userId} by ${req.user.email}`);

    res.status(201).json({
      status: 'success',
      message: 'Notification created successfully',
      data: {
        notification,
      },
    });
  } catch (error) {
    logger.error(`Create notification error: ${error.message}`);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create notification',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
};

/**
 * Mark Notification as Read
 * @desc Mark a specific notification as read
 * @route PUT /api/notifications/:id/read
 * @access Private
 */
const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    
    const notification = await Notification.findOne({
      _id: id,
      userId: req.user.id,
    });

    if (!notification) {
      return res.status(404).json({
        status: 'error',
        message: 'Notification not found',
      });
    }

    await notification.markAsRead();

    res.status(200).json({
      status: 'success',
      message: 'Notification marked as read',
      data: {
        notification,
      },
    });
  } catch (error) {
    logger.error(`Mark notification as read error: ${error.message}`);
    res.status(500).json({
      status: 'error',
      message: 'Failed to mark notification as read',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
};

/**
 * Mark All Notifications as Read
 * @desc Mark all notifications as read for the current user
 * @route PUT /api/notifications/read-all
 * @access Private
 */
const markAllAsRead = async (req, res) => {
  try {
    await Notification.markAllAsRead(req.user.id);

    res.status(200).json({
      status: 'success',
      message: 'All notifications marked as read',
    });
  } catch (error) {
    logger.error(`Mark all notifications as read error: ${error.message}`);
    res.status(500).json({
      status: 'error',
      message: 'Failed to mark all notifications as read',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
};

/**
 * Delete Notification
 * @desc Delete a specific notification
 * @route DELETE /api/notifications/:id
 * @access Private
 */
const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    
    const notification = await Notification.findOneAndDelete({
      _id: id,
      userId: req.user.id,
    });

    if (!notification) {
      return res.status(404).json({
        status: 'error',
        message: 'Notification not found',
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Notification deleted successfully',
    });
  } catch (error) {
    logger.error(`Delete notification error: ${error.message}`);
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete notification',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
};

/**
 * Get Notification Stats
 * @desc Get notification statistics for the current user
 * @route GET /api/notifications/stats
 * @access Private
 */
const getNotificationStats = async (req, res) => {
  try {
    const stats = await Notification.aggregate([
      { $match: { userId: req.user.id } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          unread: { $sum: { $cond: ['$isRead', 0, 1] } },
          read: { $sum: { $cond: ['$isRead', 1, 0] } },
          byType: {
            $push: {
              type: '$type',
              priority: '$priority',
              isRead: '$isRead',
            },
          },
        },
      },
    ]);

    const typeStats = await Notification.aggregate([
      { $match: { userId: req.user.id } },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          unread: { $sum: { $cond: ['$isRead', 0, 1] } },
        },
      },
    ]);

    const priorityStats = await Notification.aggregate([
      { $match: { userId: req.user.id } },
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 },
          unread: { $sum: { $cond: ['$isRead', 0, 1] } },
        },
      },
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        overview: stats[0] || { total: 0, unread: 0, read: 0 },
        typeStats,
        priorityStats,
      },
    });
  } catch (error) {
    logger.error(`Get notification stats error: ${error.message}`);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch notification statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
};

module.exports = {
  getUserNotifications,
  createNotification,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getNotificationStats,
};