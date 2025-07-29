const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');

const router = express.Router();

// Import User model with error handling
let User;
try {
  User = require('../models/User');
} catch (error) {
  console.error('Error importing User model:', error.message);
}

// Import auth middleware with error handling
let protect, authenticateToken;
try {
  const authMiddleware = require('../middleware/auth');
  protect = authMiddleware.protect;
  authenticateToken = authMiddleware.authenticateToken;
} catch (error) {
  console.error('Error importing auth middleware:', error.message);
  // Provide fallback middleware to prevent crashes
  protect = (req, res, next) => {
    res.status(501).json({
      status: 'error',
      message: 'Auth middleware not configured properly'
    });
  };
  authenticateToken = protect;
}

// ===========================
// UTILITY FUNCTIONS
// ===========================

/**
 * Generate JWT token with error handling
 */
const generateToken = (userId) => {
  try {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is not defined in environment variables');
    }
    
    return jwt.sign(
      { id: userId }, 
      process.env.JWT_SECRET, 
      {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d'
      }
    );
  } catch (error) {
    console.error('Token generation error:', error.message);
    throw new Error('Token generation failed');
  }
};

// ===========================
// VALIDATION MIDDLEWARE
// ===========================

/**
 * Login validation
 */
const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

/**
 * Registration validation
 */
const validateRegistration = [
  body('name')
    .trim()
    .isLength({ min: 2 })
    .withMessage('Name must be at least 2 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  body('role')
    .isIn(['superadmin', 'manager', 'technician'])
    .withMessage('Invalid role')
];

/**
 * Change password validation
 */
const validateChangePassword = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters'),
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Passwords do not match');
      }
      return true;
    })
];

// ===========================
// CONTROLLER FUNCTIONS
// ===========================

/**
 * Login user with comprehensive error handling
 */
const login = async (req, res) => {
  try {
    // Check if User model is available
    if (!User) {
      return res.status(500).json({
        status: 'error',
        message: 'User model not available',
        details: 'Database model configuration issue'
      });
    }

    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    console.log('Login attempt for email:', email);

    // Find user and include password for comparison
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      console.log('User not found:', email);
      return res.status(401).json({
        status: 'error',
        message: 'Invalid email or password'
      });
    }

    console.log('User found, checking password...');

    // Check if comparePassword method exists
    if (!user.comparePassword || typeof user.comparePassword !== 'function') {
      console.error('comparePassword method not available on user model');
      return res.status(500).json({
        status: 'error',
        message: 'Authentication method not configured'
      });
    }

    // Compare password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      console.log('Invalid password for user:', email);
      return res.status(401).json({
        status: 'error',
        message: 'Invalid email or password'
      });
    }

    // Check if user is active
    if (user.status !== 'Active') {
      console.log('Inactive user login attempt:', email, 'Status:', user.status);
      return res.status(401).json({
        status: 'error',
        message: 'Account is not active. Please contact administrator.'
      });
    }

    console.log('Password valid, generating token...');

    // Generate token
    const token = generateToken(user._id);

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    console.log('Login successful for user:', email);

    res.json({
      status: 'success',
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department,
          status: user.status,
          lastLogin: user.lastLogin
        },
        token
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Login failed',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/**
 * Register new user
 */
const register = async (req, res) => {
  try {
    // Check if User model is available
    if (!User) {
      return res.status(500).json({
        status: 'error',
        message: 'User model not available'
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { name, email, password, role, department, phone } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        status: 'error',
        message: 'User with this email already exists'
      });
    }

    // Create new user
    const user = new User({
      name,
      email,
      password,
      role,
      department,
      phone
    });

    await user.save();

    // Generate token
    const token = generateToken(user._id);

    res.status(201).json({
      status: 'success',
      message: 'User registered successfully',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department,
          status: user.status
        },
        token
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Registration failed',
      error: error.message
    });
  }
};

/**
 * Get current user
 */
const getCurrentUser = async (req, res) => {
  try {
    if (!User) {
      return res.status(500).json({
        status: 'error',
        message: 'User model not available'
      });
    }

    // If using protect middleware, user data is more detailed
    if (req.user && req.user.id) {
      const user = await User.findById(req.user.id).populate('assignedProjects');
      return res.json({
        status: 'success',
        data: {
          user
        }
      });
    }
    
    // If using authenticateToken, user data is already populated
    res.json({
      status: 'success',
      data: {
        user: req.user
      }
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch user data',
      error: error.message
    });
  }
};

/**
 * Change password
 */
const changePassword = async (req, res) => {
  try {
    if (!User) {
      return res.status(500).json({
        status: 'error',
        message: 'User model not available'
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id || req.user._id;
    const user = await User.findById(userId).select('+password');

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Check current password
    if (!(await user.comparePassword(currentPassword))) {
      return res.status(400).json({
        status: 'error',
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({
      status: 'success',
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Password change failed',
      error: error.message
    });
  }
};

/**
 * Logout user
 */
const logout = async (req, res) => {
  try {
    res.json({
      status: 'success',
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Logout failed',
      error: error.message
    });
  }
};

// ===========================
// TEST ROUTES FOR DEBUGGING
// ===========================

/**
 * Test route to check environment variables
 */
const testEnv = (req, res) => {
  res.json({
    status: 'success',
    message: 'Environment check',
    data: {
      hasJwtSecret: !!process.env.JWT_SECRET,
      jwtExpiresIn: process.env.JWT_EXPIRES_IN || 'not set (using default: 7d)',
      hasMongoUri: !!process.env.MONGODB_URI,
      nodeEnv: process.env.NODE_ENV || 'not set',
      userModelLoaded: !!User,
      authMiddlewareLoaded: !!protect
    }
  });
};

// ===========================
// ROUTES
// ===========================

// Test route
router.get('/test-env', testEnv);

// Public routes
router.post('/register', validateRegistration, register);
router.post('/login', validateLogin, login);

// Protected routes
router.post('/logout', protect, logout);
router.get('/me', authenticateToken, getCurrentUser);

router.put('/change-password', protect, validateChangePassword, changePassword);

// Alternative routes for backward compatibility
router.get('/profile', authenticateToken, getCurrentUser);

module.exports = router;