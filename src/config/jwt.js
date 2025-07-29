const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'your-fallback-secret';
const JWT_EXPIRE = process.env.JWT_EXPIRE || '24h';

/**
 * Generate JWT token
 * @param {Object} payload - Token payload
 * @returns {String} JWT token
 */
const generateToken = (payload) => {
  try {
    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRE,
      issuer: 'cosmic-solutions',
      audience: 'cosmic-solutions-users',
    });
  } catch (error) {
    logger.error(`Token generation error: ${error.message}`);
    throw new Error('Token generation failed');
  }
};

/**
 * Verify JWT token
 * @param {String} token - JWT token
 * @returns {Object} Decoded token payload
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET, {
      issuer: 'cosmic-solutions',
      audience: 'cosmic-solutions-users',
    });
  } catch (error) {
    logger.error(`Token verification error: ${error.message}`);
    throw new Error('Invalid token');
  }
};

/**
 * Decode JWT token without verification
 * @param {String} token - JWT token
 * @returns {Object} Decoded token payload
 */
const decodeToken = (token) => {
  try {
    return jwt.decode(token);
  } catch (error) {
    logger.error(`Token decode error: ${error.message}`);
    throw new Error('Token decode failed');
  }
};

module.exports = {
  generateToken,
  verifyToken,
  decodeToken,
};