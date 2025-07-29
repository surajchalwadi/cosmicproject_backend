const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * Get All Users
 * @desc Get all users (admin only)
 * @route GET /api/users
 * @access Private (super-admin only)
 */
const getAllUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      role,
      search,
      sortBy = 'createdAt',
      order = 'desc',
    } = req.query;

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

    res.status(200).json({
      status: 'success',
      data: {
        users,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalUsers,
          hasNext: parseInt(page) < totalPages,
          hasPrev: parseInt(page) > 1,
        },
      },
    });
  } catch (error) {
    logger.error(`Get all users error: ${error.message}`);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch users',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
};

/**
 * Get User by ID
 * @desc Get single user by ID
 * @route GET /api/users/:id
 * @access Private
 */
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if user is trying to access their own profile or is admin
    if (req.user.id !== id && req.user.role !== 'super-admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied',
      });
    }

    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found',
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        user,
      },
    });
  } catch (error) {
    logger.error(`Get user by ID error: ${error.message}`);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch user',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
};

/**
 * Update User
 * @desc Update user information
 * @route PUT /api/users/:id
 * @access Private
 */
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Check if user is trying to update their own profile or is admin
    if (req.user.id !== id && req.user.role !== 'super-admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied',
      });
    }

    // Remove sensitive fields that shouldn't be updated directly
    delete updates.password;
    delete updates.loginAttempts;
    delete updates.lockUntil;
    delete updates._id;
    delete updates.__v;

    // Only super-admin can update role and isActive
    if (req.user.role !== 'super-admin') {
      delete updates.role;
      delete updates.isActive;
    }

    const user = await User.findByIdAndUpdate(
      id,
      { ...updates, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found',
      });
    }

    logger.info(`User updated: ${user.email} by ${req.user.email}`);

    res.status(200).json({
      status: 'success',
      message: 'User updated successfully',
      data: {
        user,
      },
    });
  } catch (error) {
    logger.error(`Update user error: ${error.message}`);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update user',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
};

/**
 * Delete User
 * @desc Delete user (soft delete by deactivating)
 * @route DELETE /api/users/:id
 * @access Private (super-admin only)
 */
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Prevent user from deleting themselves
    if (req.user.id === id) {
      return res.status(400).json({
        status: 'error',
        message: 'Cannot delete your own account',
      });
    }

    const user = await User.findByIdAndUpdate(
      id,
      { isActive: false, updatedAt: Date.now() },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found',
      });
    }

    logger.info(`User deactivated: ${user.email} by ${req.user.email}`);

    res.status(200).json({
      status: 'success',
      message: 'User deactivated successfully',
    });
  } catch (error) {
    logger.error(`Delete user error: ${error.message}`);
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete user',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
};

/**
 * Get Users by Role
 * @desc Get users filtered by role
 * @route GET /api/users/role/:role
 * @access Private
 */
const getUsersByRole = async (req, res) => {
  try {
    const { role } = req.params;
    const validRoles = ['super-admin', 'manager', 'technician'];
    
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid role specified',
      });
    }

    const users = await User.find({ role, isActive: true })
      .sort({ createdAt: -1 });

    res.status(200).json({
      status: 'success',
      data: {
        users,
        count: users.length,
      },
    });
  } catch (error) {
    logger.error(`Get users by role error: ${error.message}`);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch users by role',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
};

/**
 * Get User Stats
 * @desc Get user statistics
 * @route GET /api/users/stats
 * @access Private (super-admin only)
 */
const getUserStats = async (req, res) => {
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

    res.status(200).json({
      status: 'success',
      data: {
        overview: {
          totalUsers,
          activeUsers,
          inactiveUsers,
        },
        roleStats: stats,
      },
    });
  } catch (error) {
    logger.error(`Get user stats error: ${error.message}`);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch user statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  getUsersByRole,
  getUserStats,
};