const jwt = require('jsonwebtoken');
const User = require('../models/User');
const LoginSession = require('../models/LoginSession');
const logger = require('../utils/logger');

/**
 * Protect middleware - Verify JWT token with session management
 */
const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      console.log('No token provided');
      return res.status(401).json({
        status: 'error',
        message: 'Access denied. No token provided.',
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      console.log('Invalid token:', err.message);
      return res.status(401).json({
        status: 'error',
        message: 'Invalid token',
      });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      console.log('User not found for id:', decoded.id);
      return res.status(401).json({
        status: 'error',
        message: 'User not found',
      });
    }

    if (!user.isActive) {
      console.log('User is not active:', user.email);
      return res.status(401).json({
        status: 'error',
        message: 'User account is deactivated',
      });
    }

    // const session = await LoginSession.findOne({
    //   token,
    //   userId: decoded.id,
    //   isActive: true,
    // });

    // if (!session) {
    //   console.log('Session not found or inactive for user:', user.email);
    //   return res.status(401).json({
    //     status: 'error',
    //     message: 'Session expired or invalid',
    //   });
    // }

    // await session.updateActivity();

    req.user = user;
    next();
  } catch (error) {
    console.log('General auth error:', error.message);
    res.status(500).json({
      status: 'error',
      message: 'Authentication failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
};

/**
 * Simple JWT authentication without session management (backward compatibility)
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'Access token is required'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');

    if (!user || user.status !== 'Active') {
      return res.status(401).json({
        status: 'error',
        message: 'User not found or inactive'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({
      status: 'error',
      message: 'Invalid or expired token'
    });
  }
};

/**
 * Authorize middleware - Check user roles
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'User not authenticated',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. Insufficient permissions.',
      });
    }

    next();
  };
};

/**
 * Role-based authorization (alias for backward compatibility)
 */
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. Insufficient permissions.'
      });
    }
    next();
  };
};

/**
 * Optional auth middleware - Similar to protect but doesn't require token
 */
const optionalAuth = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);
      
      if (user && user.isActive) {
        req.user = {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      }
    }

    next();
  } catch (error) {
    // Continue without user if token is invalid
    next();
  }
};

module.exports = {
  protect,
  authenticateToken,
  authorize,
  authorizeRoles,
  optionalAuth,
};