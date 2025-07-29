const bcrypt = require('bcryptjs');
const User = require('../models/User');
const LoginSession = require('../models/LoginSession');
const { generateToken } = require('../config/jwt');
const logger = require('../utils/logger');

/**
 * User Registration
 * @desc Register a new user
 * @route POST /api/auth/register
 * @access Public
 */
const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        status: 'error',
        message: 'User already exists with this email',
      });
    }

    // HASH THE PASSWORD HERE
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user with hashed password
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role,
    });

    // Generate JWT token
    const token = generateToken({
      id: user._id,
      email: user.email,
      role: user.role,
    });

    // Create login session
    await LoginSession.create({
      userId: user._id,
      token,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent') || 'Unknown',
      isActive: true,
    });

    logger.info(`New user registered: ${user.email} (Role: ${user.role})`);

    res.status(201).json({
      status: 'success',
      message: 'User registered successfully',
      data: {
        user,
        token,
      },
    });
  } catch (error) {
    logger.error(`Registration error: ${error.message}`);
    res.status(500).json({
      status: 'error',
      message: 'Registration failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
};

/**
 * User Login
 * @desc Authenticate user and return token
 * @route POST /api/auth/login
 * @access Public
 */
const login = async (req, res) => {
  try {
    const { email, password, role } = req.body;

    // Find user and include password for comparison
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid credentials',
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        status: 'error',
        message: 'Account is deactivated',
      });
    }

    // Check if account is locked
    if (user.isLocked) {
      return res.status(423).json({
        status: 'error',
        message: 'Account is temporarily locked due to multiple failed login attempts',
      });
    }

    // Verify role matches
    if (user.role !== role) {
      await user.incLoginAttempts();
      return res.status(401).json({
        status: 'error',
        message: 'Invalid credentials',
      });
    }

    // Compare password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      await user.incLoginAttempts();
      return res.status(401).json({
        status: 'error',
        message: 'Invalid credentials',
      });
    }

    // Reset login attempts on successful login
    if (user.loginAttempts > 0) {
      await user.resetLoginAttempts();
    }

    // Update last login
    await user.updateLastLogin();

    // Generate JWT token
    const token = generateToken({
      id: user._id,
      email: user.email,
      role: user.role,
    });

    // Create login session
    await LoginSession.create({
      userId: user._id,
      token,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent') || 'Unknown',
      isActive: true,
    });
    console.log('Created LoginSession:', { userId: user._id.toString(), token });
    // Log all active sessions for this user
    const activeSessions = await LoginSession.find({ userId: user._id, isActive: true });
    console.log('Active sessions for user:', user.email, activeSessions.map(s => s.token));

    logger.info(`User logged in: ${user.email} (Role: ${user.role})`);

    res.status(200).json({
      status: 'success',
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          lastLogin: user.lastLogin,
        },
        token,
      },
    });
  } catch (error) {
    logger.error(`Login error: ${error.message}`);
    res.status(500).json({
      status: 'error',
      message: 'Login failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
};

/**
 * User Logout
 * @desc Logout user and invalidate session
 * @route POST /api/auth/logout
 * @access Private
 */
const logout = async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (token) {
      // Find and deactivate the session
      const session = await LoginSession.findOne({ token, isActive: true });
      if (session) {
        await session.deactivate();
      }
    }

    logger.info(`User logged out: ${req.user.email}`);

    res.status(200).json({
      status: 'success',
      message: 'Logout successful',
    });
  } catch (error) {
    logger.error(`Logout error: ${error.message}`);
    res.status(500).json({
      status: 'error',
      message: 'Logout failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
};

/**
 * Get Current User
 * @desc Get current authenticated user
 * @route GET /api/auth/me
 * @access Private
 */
const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
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
    logger.error(`Get current user error: ${error.message}`);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get user information',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
};

/**
 * Change Password
 * @desc Change user password
 * @route PUT /api/auth/change-password
 * @access Private
 */
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    // Get user with password
    const user = await User.findById(req.user.id).select('+password');
    
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found',
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        status: 'error',
        message: 'Current password is incorrect',
      });
    }

    // Update password
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    // Invalidate all existing sessions
    await LoginSession.updateMany(
      { userId: user._id, isActive: true },
      { $set: { isActive: false, logoutTime: Date.now() } }
    );

    logger.info(`Password changed for user: ${user.email}`);

    res.status(200).json({
      status: 'success',
      message: 'Password changed successfully',
    });
  } catch (error) {
    logger.error(`Change password error: ${error.message}`);
    res.status(500).json({
      status: 'error',
      message: 'Password change failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
};

module.exports = {
  register,
  login,
  logout,
  getCurrentUser,
  changePassword,
};