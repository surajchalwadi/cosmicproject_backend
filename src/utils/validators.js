const validator = require('validator');

// Custom validation rules
const VALIDATION_RULES = {
  // User validation
  NAME_MIN_LENGTH: 2,
  NAME_MAX_LENGTH: 50,
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_MAX_LENGTH: 128,
  
  // Project validation
  PROJECT_TITLE_MIN_LENGTH: 3,
  PROJECT_TITLE_MAX_LENGTH: 100,
  DESCRIPTION_MAX_LENGTH: 1000,
  
  // Task validation
  TASK_TITLE_MIN_LENGTH: 3,
  TASK_TITLE_MAX_LENGTH: 100,
  
  // File validation
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_FILE_TYPES: ['jpeg', 'jpg', 'png', 'gif', 'pdf', 'doc', 'docx', 'dwg'],
  
  // Common validation
  PHONE_REGEX: /^[\+]?[1-9][\d]{0,15}$/,
  
  // Role validation
  VALID_ROLES: ['super-admin', 'manager', 'technician'],
  VALID_PRIORITIES: ['low', 'medium', 'high', 'urgent'],
  VALID_TASK_STATUSES: ['assigned', 'in_progress', 'completed', 'delayed'],
  VALID_PROJECT_STATUSES: ['planning', 'in_progress', 'completed', 'on_hold', 'cancelled']
};

class ValidationError extends Error {
  constructor(message, field = null) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.statusCode = 400;
  }
}

class Validators {
  // Generic validation helper
  static validateRequired(value, fieldName) {
    if (value === undefined || value === null || value === '') {
      throw new ValidationError(`${fieldName} is required`, fieldName);
    }
  }

  static validateStringLength(value, fieldName, minLength, maxLength) {
    if (typeof value !== 'string') {
      throw new ValidationError(`${fieldName} must be a string`, fieldName);
    }
    
    if (value.length < minLength) {
      throw new ValidationError(
        `${fieldName} must be at least ${minLength} characters long`,
        fieldName
      );
    }
    
    if (value.length > maxLength) {
      throw new ValidationError(
        `${fieldName} must be no more than ${maxLength} characters long`,
        fieldName
      );
    }
  }

  static validateEnum(value, fieldName, allowedValues) {
    if (!allowedValues.includes(value)) {
      throw new ValidationError(
        `${fieldName} must be one of: ${allowedValues.join(', ')}`,
        fieldName
      );
    }
  }

  // Email validation
  static validateEmail(email) {
    this.validateRequired(email, 'email');
    
    if (!validator.isEmail(email)) {
      throw new ValidationError('Invalid email format', 'email');
    }
    
    return email.toLowerCase().trim();
  }

  // Password validation
  static validatePassword(password) {
    this.validateRequired(password, 'password');
    this.validateStringLength(
      password,
      'password',
      VALIDATION_RULES.PASSWORD_MIN_LENGTH,
      VALIDATION_RULES.PASSWORD_MAX_LENGTH
    );
    
    // Check for at least one uppercase letter
    if (!/[A-Z]/.test(password)) {
      throw new ValidationError(
        'Password must contain at least one uppercase letter',
        'password'
      );
    }
    
    // Check for at least one lowercase letter
    if (!/[a-z]/.test(password)) {
      throw new ValidationError(
        'Password must contain at least one lowercase letter',
        'password'
      );
    }
    
    // Check for at least one number
    if (!/\d/.test(password)) {
      throw new ValidationError(
        'Password must contain at least one number',
        'password'
      );
    }
    
    // Check for at least one special character
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      throw new ValidationError(
        'Password must contain at least one special character',
        'password'
      );
    }
  }

  // Name validation
  static validateName(name) {
    this.validateRequired(name, 'name');
    this.validateStringLength(
      name,
      'name',
      VALIDATION_RULES.NAME_MIN_LENGTH,
      VALIDATION_RULES.NAME_MAX_LENGTH
    );
    
    // Check for invalid characters
    if (!/^[a-zA-Z\s\-'\.]+$/.test(name)) {
      throw new ValidationError(
        'Name can only contain letters, spaces, hyphens, apostrophes, and periods',
        'name'
      );
    }
    
    return name.trim();
  }

  // Phone validation
  static validatePhone(phone) {
    if (!phone) return null; // Phone is optional
    
    if (!VALIDATION_RULES.PHONE_REGEX.test(phone)) {
      throw new ValidationError(
        'Invalid phone number format',
        'phone'
      );
    }
    
    return phone.trim();
  }

  // Role validation
  static validateRole(role) {
    this.validateRequired(role, 'role');
    this.validateEnum(role, 'role', VALIDATION_RULES.VALID_ROLES);
  }

  // Priority validation
  static validatePriority(priority) {
    if (!priority) return 'medium'; // Default priority
    this.validateEnum(priority, 'priority', VALIDATION_RULES.VALID_PRIORITIES);
    return priority;
  }

  // Date validation
  static validateDate(dateString, fieldName) {
    if (!dateString) return null;
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      throw new ValidationError(`Invalid date format for ${fieldName}`, fieldName);
    }
    
    return date;
  }

  // Future date validation
  static validateFutureDate(dateString, fieldName) {
    const date = this.validateDate(dateString, fieldName);
    if (!date) return null;
    
    if (date < new Date()) {
      throw new ValidationError(`${fieldName} must be in the future`, fieldName);
    }
    
    return date;
  }

  // MongoDB ObjectId validation
  static validateObjectId(id, fieldName) {
    if (!id) return null;
    
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      throw new ValidationError(`Invalid ${fieldName} format`, fieldName);
    }
    
    return id;
  }

  // User validation
  static validateUser(userData) {
    const errors = {};
    
    try {
      userData.name = this.validateName(userData.name);
    } catch (error) {
      errors.name = error.message;
    }
    
    try {
      userData.email = this.validateEmail(userData.email);
    } catch (error) {
      errors.email = error.message;
    }
    
    try {
      if (userData.password) {
        this.validatePassword(userData.password);
      }
    } catch (error) {
      errors.password = error.message;
    }
    
    try {
      this.validateRole(userData.role);
    } catch (error) {
      errors.role = error.message;
    }
    
    try {
      userData.phone = this.validatePhone(userData.phone);
    } catch (error) {
      errors.phone = error.message;
    }
    
    if (Object.keys(errors).length > 0) {
      const error = new ValidationError('Validation failed');
      error.errors = errors;
      throw error;
    }
    
    return userData;
  }

  // Project validation
  static validateProject(projectData) {
    const errors = {};
    
    try {
      this.validateRequired(projectData.clientName, 'clientName');
      this.validateStringLength(
        projectData.clientName,
        'clientName',
        VALIDATION_RULES.PROJECT_TITLE_MIN_LENGTH,
        VALIDATION_RULES.PROJECT_TITLE_MAX_LENGTH
      );
    } catch (error) {
      errors.clientName = error.message;
    }
    
    try {
      this.validateRequired(projectData.siteName, 'siteName');
      this.validateStringLength(
        projectData.siteName,
        'siteName',
        VALIDATION_RULES.PROJECT_TITLE_MIN_LENGTH,
        VALIDATION_RULES.PROJECT_TITLE_MAX_LENGTH
      );
    } catch (error) {
      errors.siteName = error.message;
    }
    
    try {
      this.validateRequired(projectData.location, 'location');
    } catch (error) {
      errors.location = error.message;
    }
    
    try {
      projectData.priority = this.validatePriority(projectData.priority);
    } catch (error) {
      errors.priority = error.message;
    }
    
    try {
      projectData.deadline = this.validateFutureDate(projectData.deadline, 'deadline');
    } catch (error) {
      errors.deadline = error.message;
    }
    
    try {
      if (projectData.description) {
        this.validateStringLength(
          projectData.description,
          'description',
          0,
          VALIDATION_RULES.DESCRIPTION_MAX_LENGTH
        );
      }
    } catch (error) {
      errors.description = error.message;
    }
    
    try {
      if (projectData.assignedManager) {
        this.validateObjectId(projectData.assignedManager, 'assignedManager');
      }
    } catch (error) {
      errors.assignedManager = error.message;
    }
    
    if (Object.keys(errors).length > 0) {
      const error = new ValidationError('Validation failed');
      error.errors = errors;
      throw error;
    }
    
    return projectData;
  }

  // Task validation
  static validateTask(taskData) {
    const errors = {};
    
    try {
      this.validateRequired(taskData.title, 'title');
      this.validateStringLength(
        taskData.title,
        'title',
        VALIDATION_RULES.TASK_TITLE_MIN_LENGTH,
        VALIDATION_RULES.TASK_TITLE_MAX_LENGTH
      );
    } catch (error) {
      errors.title = error.message;
    }
    
    try {
      this.validateRequired(taskData.project, 'project');
      this.validateObjectId(taskData.project, 'project');
    } catch (error) {
      errors.project = error.message;
    }
    
    try {
      this.validateRequired(taskData.assignedTo, 'assignedTo');
      this.validateObjectId(taskData.assignedTo, 'assignedTo');
    } catch (error) {
      errors.assignedTo = error.message;
    }
    
    try {
      taskData.priority = this.validatePriority(taskData.priority);
    } catch (error) {
      errors.priority = error.message;
    }
    
    try {
      if (taskData.status) {
        this.validateEnum(taskData.status, 'status', VALIDATION_RULES.VALID_TASK_STATUSES);
      }
    } catch (error) {
      errors.status = error.message;
    }
    
    try {
      taskData.deadline = this.validateFutureDate(taskData.deadline, 'deadline');
    } catch (error) {
      errors.deadline = error.message;
    }
    
    try {
      if (taskData.estimatedHours !== undefined) {
        const hours = parseFloat(taskData.estimatedHours);
        if (isNaN(hours) || hours < 0) {
          throw new ValidationError('Estimated hours must be a positive number', 'estimatedHours');
        }
        taskData.estimatedHours = hours;
      }
    } catch (error) {
      errors.estimatedHours = error.message;
    }
    
    try {
      if (taskData.progress !== undefined) {
        const progress = parseInt(taskData.progress);
        if (isNaN(progress) || progress < 0 || progress > 100) {
          throw new ValidationError('Progress must be a number between 0 and 100', 'progress');
        }
        taskData.progress = progress;
      }
    } catch (error) {
      errors.progress = error.message;
    }
    
    if (Object.keys(errors).length > 0) {
      const error = new ValidationError('Validation failed');
      error.errors = errors;
      throw error;
    }
    
    return taskData;
  }

  // File validation
  static validateFile(file) {
    if (!file) {
      throw new ValidationError('File is required', 'file');
    }
    
    // Check file size
    if (file.size > VALIDATION_RULES.MAX_FILE_SIZE) {
      throw new ValidationError(
        `File size must be less than ${VALIDATION_RULES.MAX_FILE_SIZE / (1024 * 1024)}MB`,
        'file'
      );
    }
    
    // Check file type
    const extension = file.originalname.split('.').pop().toLowerCase();
    if (!VALIDATION_RULES.ALLOWED_FILE_TYPES.includes(extension)) {
      throw new ValidationError(
        `File type not allowed. Allowed types: ${VALIDATION_RULES.ALLOWED_FILE_TYPES.join(', ')}`,
        'file'
      );
    }
    
    return true;
  }

  // Comment validation
  static validateComment(comment) {
    this.validateRequired(comment, 'comment');
    this.validateStringLength(comment, 'comment', 1, 500);
    return comment.trim();
  }

  // Notification validation
  static validateNotification(notificationData) {
    const errors = {};
    
    try {
      this.validateRequired(notificationData.type, 'type');
      this.validateEnum(
        notificationData.type,
        'type',
        ['task_assigned', 'task_completed', 'task_delayed', 'task_overdue', 'system', 'alert']
      );
    } catch (error) {
      errors.type = error.message;
    }
    
    try {
      this.validateRequired(notificationData.title, 'title');
      this.validateStringLength(notificationData.title, 'title', 1, 100);
    } catch (error) {
      errors.title = error.message;
    }
    
    try {
      this.validateRequired(notificationData.message, 'message');
      this.validateStringLength(notificationData.message, 'message', 1, 500);
    } catch (error) {
      errors.message = error.message;
    }
    
    try {
      this.validateRequired(notificationData.userId, 'userId');
      this.validateObjectId(notificationData.userId, 'userId');
    } catch (error) {
      errors.userId = error.message;
    }
    
    try {
      notificationData.priority = this.validatePriority(notificationData.priority);
    } catch (error) {
      errors.priority = error.message;
    }
    
    if (Object.keys(errors).length > 0) {
      const error = new ValidationError('Validation failed');
      error.errors = errors;
      throw error;
    }
    
    return notificationData;
  }

  // Sanitize input to prevent XSS
  static sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    
    return input
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  // Validate and sanitize all string fields in an object
  static sanitizeObject(obj) {
    const sanitized = {};
    
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        sanitized[key] = this.sanitizeInput(value);
      } else if (Array.isArray(value)) {
        sanitized[key] = value.map(item => 
          typeof item === 'string' ? this.sanitizeInput(item) : item
        );
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }
}

module.exports = {
  Validators,
  ValidationError,
  VALIDATION_RULES
};
