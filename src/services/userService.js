const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * Get all users with filtering and pagination
 * @param {Object} options - Query options
 * @returns {Object} Users data with pagination
 */
const getAllUsers = async (options = {}) => {
  try {
    const {
      page = 1,
      limit = 10,
      role,
      search,
      sortBy = 'createdAt',
      order = 'desc',
    } = options;

    // Build filter object
    const filter = {};
    if (role) filter.role = role;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = order === 'asc' ? 1 : -1;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get users with pagination
    const users = await User.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const totalUsers = await User.countDocuments(filter);
    const totalPages = Math.ceil(totalUsers / parseInt(limit));

    return {
      users,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalUsers,
        hasNext: parseInt(page) < totalPages,
        hasPrev: parseInt(page) > 1,
      },
    };
  } catch (error) {
    logger.error(`Get all users service error: ${error.message}`);
    throw error;
  }
};

/**
 * Get user by ID
 * @param {String} userId - User ID
 * @returns {Object} User object
 */
const getUserById = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  } catch (error) {
    logger.error(`Get user by ID service error: ${error.message}`);
    throw error;
  }
};

/**
 * Update user information
 * @param {String} userId - User ID
 * @param {Object} updateData - Update data
 * @param {String} updaterRole - Role of the user making the update
 * @returns {Object} Updated user object
 */
const updateUser = async (userId, updateData, updaterRole) => {
  try {
    // Remove sensitive fields that shouldn't be updated directly
    const allowedUpdates = { ...updateData };
    delete allowedUpdates.password;
    delete allowedUpdates.loginAttempts;
    delete allowedUpdates.lockUntil;
    delete allowedUpdates._id;
    delete allowedUpdates.__v;

    // Only super-admin can update role and isActive
    if (updaterRole !== 'super-admin') {
      delete allowedUpdates.role;
      delete allowedUpdates.isActive;
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { ...allowedUpdates, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );

    if (!user) {
      throw new Error('User not found');
    }

    logger.info(`User updated: ${user.email}`);
    return user;
  } catch (error) {
    logger.error(`Update user service error: ${error.message}`);
    throw error;
  }
};

/**
 * Deactivate user (soft delete)
 * @param {String} userId - User ID
 * @returns {Object} Updated user object
 */
const deactivateUser = async (userId) => {
  try {
    const user = await User.findByIdAndUpdate(
      userId,
      { isActive: false, updatedAt: Date.now() },
      { new: true }
    );

    if (!user) {
      throw new Error('User not found');
    }

    logger.info(`User deactivated: ${user.email}`);
    return user;
  } catch (error) {
    logger.error(`Deactivate user service error: ${error.message}`);
    throw error;
  }
};

/**
 * Get users by role
 * @param {String} role - User role
 * @returns {Array} Array of users
 */
const getUsersByRole = async (role) => {
  try {
    const validRoles = ['super-admin', 'manager', 'technician'];
    
    if (!validRoles.includes(role)) {
      throw new Error('Invalid role specified');
    }

    const users = await User.find({ role, isActive: true })
      .sort({ createdAt: -1 });

    return users;
  } catch (error) {
    logger.error(`Get users by role service error: ${error.message}`);
    throw error;
  }
};

/**
 * Get user statistics
 * @returns {Object} User statistics
 */
const getUserStats = async () => {
  try {
    const stats = await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 },
          active: { $sum: { $cond: ['$isActive', 1, 0] } },
          inactive: { $sum: { $cond: ['$isActive', 0, 1] } },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const inactiveUsers = await User.countDocuments({ isActive: false });

    return {
      overview: {
        totalUsers,
        activeUsers,
        inactiveUsers,
      },
      roleStats: stats,
    };
  } catch (error) {
    logger.error(`Get user stats service error: ${error.message}`);
    throw error;
  }
};

/**
 * Search users by name or email
 * @param {String} query - Search query
 * @param {Number} limit - Result limit
 * @returns {Array} Array of matching users
 */
const searchUsers = async (query, limit = 10) => {
  try {
    const users = await User.find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } },
      ],
      isActive: true,
    })
      .select('name email role')
      .limit(limit)
      .sort({ name: 1 });

    return users;
  } catch (error) {
    logger.error(`Search users service error: ${error.message}`);
    throw error;
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  updateUser,
  deactivateUser,
  getUsersByRole,
  getUserStats,
  searchUsers,
};