const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { generateToken } = require('../config/jwt');
const logger = require('../utils/logger');

/**
 * Authenticate user credentials
 * @param {String} email - User email
 * @param {String} password - User password
 * @param {String} role - User role
 * @returns {Object|null} User object or null if authentication fails
 */
const authenticateUser = async (email, password, role) => {
  try {
    // Find user by email
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      logger.warn(`Authentication failed: User not found - ${email}`);
      return null;
    }

    // Check if user is active
    if (!user.isActive) {
      logger.warn(`Authentication failed: User inactive - ${email}`);
      return null;
    }

    // Check if account is locked
    if (user.isLocked) {
      logger.warn(`Authentication failed: Account locked - ${email}`);
      return null;
    }

    // Verify role
    if (user.role !== role) {
      logger.warn(`Authentication failed: Role mismatch - ${email}`);
      await user.incLoginAttempts();
      return null;
    }

    // Compare password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      logger.warn(`Authentication failed: Invalid password - ${email}`);
      await user.incLoginAttempts();
      return null;
    }

    // Reset login attempts on successful authentication
    if (user.loginAttempts > 0) {
      await user.resetLoginAttempts();
    }

    // Update last login
    await user.updateLastLogin();

    logger.info(`User authenticated successfully: ${email}`);
    return user;
  } catch (error) {
    logger.error(`Authentication service error: ${error.message}`);
    throw error;
  }
};

/**
 * Create new user account
 * @param {Object} userData - User data
 * @returns {Object} Created user object
 */
const createUser = async (userData) => {
  try {
    const { name, email, password, role } = userData;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new Error('User already exists with this email');
    }

    // Create new user
    const user = await User.create({
      name,
      email,
      password,
      role,
    });

    logger.info(`New user created: ${email} (Role: ${role})`);
    return user;
  } catch (error) {
    logger.error(`Create user service error: ${error.message}`);
    throw error;
  }
};

/**
 * Generate authentication token for user
 * @param {Object} user - User object
 * @returns {String} JWT token
 */
const generateAuthToken = (user) => {
  try {
    return generateToken({
      id: user._id,
      email: user.email,
      role: user.role,
    });
  } catch (error) {
    logger.error(`Generate auth token error: ${error.message}`);
    throw error;
  }
};

/**
 * Change user password
 * @param {String} userId - User ID
 * @param {String} currentPassword - Current password
 * @param {String} newPassword - New password
 * @returns {Boolean} Success status
 */
const changePassword = async (userId, currentPassword, newPassword) => {
  try {
    // Get user with password
    const user = await User.findById(userId).select('+password');
    
    if (!user) {
      throw new Error('User not found');
    }

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      throw new Error('Current password is incorrect');
    }

    // Update password
    user.password = newPassword;
    await user.save();

    logger.info(`Password changed for user: ${user.email}`);
    return true;
  } catch (error) {
    logger.error(`Change password service error: ${error.message}`);
    throw error;
  }
};

/**
 * Validate user permissions
 * @param {String} userId - User ID
 * @param {String} targetUserId - Target user ID
 * @param {String} userRole - User role
 * @returns {Boolean} Permission status
 */
const validateUserPermissions = (userId, targetUserId, userRole) => {
  // Super admin can access any user
  if (userRole === 'super-admin') {
    return true;
  }

  // Users can only access their own data
  return userId === targetUserId;
};

/**
 * Get user by ID with role-based access control
 * @param {String} requesterId - Requester user ID
 * @param {String} requesterRole - Requester role
 * @param {String} targetUserId - Target user ID
 * @returns {Object|null} User object or null if not authorized
 */
const getUserWithPermissions = async (requesterId, requesterRole, targetUserId) => {
  try {
    // Check permissions
    if (!validateUserPermissions(requesterId, targetUserId, requesterRole)) {
      throw new Error('Access denied');
    }

    const user = await User.findById(targetUserId);
    if (!user) {
      throw new Error('User not found');
    }

    return user;
  } catch (error) {
    logger.error(`Get user with permissions error: ${error.message}`);
    throw error;
  }
};

module.exports = {
  authenticateUser,
  createUser,
  generateAuthToken,
  changePassword,
  validateUserPermissions,
  getUserWithPermissions,
};