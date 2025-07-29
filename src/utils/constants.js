// User roles
const USER_ROLES = {
  SUPER_ADMIN: "superadmin",
  MANAGER: "manager",
  TECHNICIAN: "technician",
};

// Notification types
const NOTIFICATION_TYPES = {
  INFO: "info",
  SUCCESS: "success",
  WARNING: "warning",
  ERROR: "error",
  SYSTEM: "system",
};

// Notification priorities
const NOTIFICATION_PRIORITIES = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  URGENT: "urgent",
};

// Notification categories
const NOTIFICATION_CATEGORIES = {
  GENERAL: "general",
  SECURITY: "security",
  SYSTEM: "system",
  TASK: "task",
  MAINTENANCE: "maintenance",
};

// HTTP status codes
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  LOCKED: 423,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
};

// Error messages
const ERROR_MESSAGES = {
  VALIDATION_FAILED: "Validation failed",
  INVALID_CREDENTIALS: "Invalid credentials",
  ACCESS_DENIED: "Access denied",
  USER_NOT_FOUND: "User not found",
  USER_ALREADY_EXISTS: "User already exists",
  ACCOUNT_LOCKED: "Account is temporarily locked",
  ACCOUNT_DEACTIVATED: "Account is deactivated",
  TOKEN_EXPIRED: "Token expired",
  INVALID_TOKEN: "Invalid token",
  INSUFFICIENT_PERMISSIONS: "Insufficient permissions",
  INTERNAL_SERVER_ERROR: "Internal server error",
};

// Success messages
const SUCCESS_MESSAGES = {
  LOGIN_SUCCESS: "Login successful",
  LOGOUT_SUCCESS: "Logout successful",
  REGISTRATION_SUCCESS: "Registration successful",
  PASSWORD_CHANGED: "Password changed successfully",
  USER_UPDATED: "User updated successfully",
  USER_DELETED: "User deleted successfully",
  NOTIFICATION_CREATED: "Notification created successfully",
  NOTIFICATION_MARKED_READ: "Notification marked as read",
  ALL_NOTIFICATIONS_MARKED_READ: "All notifications marked as read",
};

// Database configuration
const DB_CONFIG = {
  MAX_CONNECTION_ATTEMPTS: 3,
  RECONNECT_INTERVAL: 5000,
  CONNECTION_TIMEOUT: 30000,
  MAX_POOL_SIZE: 10,
};

// JWT configuration
const JWT_CONFIG = {
  DEFAULT_EXPIRE: "24h",
  REFRESH_EXPIRE: "7d",
  ISSUER: "cosmic-solutions",
  AUDIENCE: "cosmic-solutions-users",
};

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  MAX_REQUESTS: 100,
  LOGIN_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  LOGIN_MAX_REQUESTS: 5,
};

// Security configuration
const SECURITY_CONFIG = {
  BCRYPT_SALT_ROUNDS: 12,
  MAX_LOGIN_ATTEMPTS: 5,
  LOCK_TIME: 2 * 60 * 60 * 1000, // 2 hours
  PASSWORD_MIN_LENGTH: 6,
  PASSWORD_MAX_LENGTH: 128,
};

// Pagination defaults
const PAGINATION_DEFAULTS = {
  PAGE: 1,
  LIMIT: 10,
  MAX_LIMIT: 100,
};

// Sorting defaults
const SORT_DEFAULTS = {
  FIELD: "createdAt",
  ORDER: "desc",
};

// File upload configuration
const FILE_UPLOAD_CONFIG = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_TYPES: ["image/jpeg", "image/png", "image/gif"],
  UPLOAD_PATH: "uploads/",
};

// Email configuration
const EMAIL_CONFIG = {
  FROM_NAME: "Cosmic Solutions",
  FROM_EMAIL: "noreply@cosmicsolutions.com",
  TEMPLATES: {
    WELCOME: "welcome",
    PASSWORD_RESET: "password-reset",
    ACCOUNT_LOCKED: "account-locked",
  },
};

// Socket.io events
const SOCKET_EVENTS = {
  CONNECTION: "connection",
  DISCONNECT: "disconnect",
  NEW_NOTIFICATION: "new_notification",
  SYSTEM_MESSAGE: "system_message",
  USER_STATUS_CHANGE: "user_status_change",
  JOIN_ROOM: "join_room",
  LEAVE_ROOM: "leave_room",
};

// Cache configuration
const CACHE_CONFIG = {
  DEFAULT_TTL: 3600, // 1 hour
  USER_CACHE_TTL: 1800, // 30 minutes
  NOTIFICATION_CACHE_TTL: 300, // 5 minutes
};

// Logging levels
const LOG_LEVELS = {
  ERROR: "error",
  WARN: "warn",
  INFO: "info",
  HTTP: "http",
  VERBOSE: "verbose",
  DEBUG: "debug",
  SILLY: "silly",
};

// Environment types
const ENVIRONMENTS = {
  DEVELOPMENT: "development",
  TESTING: "testing",
  STAGING: "staging",
  PRODUCTION: "production",
};

// API response status
const API_STATUS = {
  SUCCESS: "success",
  ERROR: "error",
  FAIL: "fail",
};

// Default user data for seeding
const DEFAULT_USERS = [
  {
    name: "Super Admin",
    email: "admin@cosmicsolutions.com",
    password: "Admin@123",
    role: USER_ROLES.SUPER_ADMIN,
  },
  {
    name: "Manager",
    email: "manager@cosmicsolutions.com",
    password: "Manager@123",
    role: USER_ROLES.MANAGER,
  },
  {
    name: "Sarah Johnson",
    email: "sarah.johnson@cosmicsolutions.com",
    password: "Sarah@123",
    role: USER_ROLES.MANAGER,
  },
  {
    name: "David Kim",
    email: "david.kim@cosmicsolutions.com",
    password: "David@123",
    role: USER_ROLES.MANAGER,
  },
  {
    name: "Technician",
    email: "technician@cosmicsolutions.com",
    password: "Tech@123",
    role: USER_ROLES.TECHNICIAN,
  },
  {
    name: "Mike Chen",
    email: "mike.chen@cosmicsolutions.com",
    password: "Mike@123",
    role: USER_ROLES.TECHNICIAN,
  },
  {
    name: "Lisa Rodriguez",
    email: "lisa.rodriguez@cosmicsolutions.com",
    password: "Lisa@123",
    role: USER_ROLES.TECHNICIAN,
  },
  {
    name: "James Wilson",
    email: "james.wilson@cosmicsolutions.com",
    password: "James@123",
    role: USER_ROLES.TECHNICIAN,
  },
];

module.exports = {
  USER_ROLES,
  NOTIFICATION_TYPES,
  NOTIFICATION_PRIORITIES,
  NOTIFICATION_CATEGORIES,
  HTTP_STATUS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  DB_CONFIG,
  JWT_CONFIG,
  RATE_LIMIT_CONFIG,
  SECURITY_CONFIG,
  PAGINATION_DEFAULTS,
  SORT_DEFAULTS,
  FILE_UPLOAD_CONFIG,
  EMAIL_CONFIG,
  SOCKET_EVENTS,
  CACHE_CONFIG,
  LOG_LEVELS,
  ENVIRONMENTS,
  API_STATUS,
  DEFAULT_USERS,
};
